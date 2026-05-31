# План дореализации — qr-booking

## Краткий итог
- Всего тестов: **140** (по `stats` из `results/autotests/test-results.json:8692-8699`).
- Passed: **139** | Failed: **1** | Skipped: **0** | Flaky: **0**.
- В коде специй (`qa-device-monitor/tests/e2e/qr-booking/*.spec.ts`) `test.skip` / `test.fixme` отсутствуют — нечего «расскипливать».
- **Готовность фичи:** QR-бронирование функционирует, прошло 99.3 % регресса. Единственный дефект — баг в обработке кликов внутри модальной шторки: динамическое удаление узла внутри `#qr-booking-sheet` через делегированный click-handler ошибочно закрывает саму шторку. Это влияет минимум на retry бронирования и потенциально на любые другие «удалить-и-перерисовать» сценарии.

---

## 🔴 Failing tests — что чинить в коде

### `[P1][TC-QR-018.4] Шторка брони — клик «Повторить» инициирует повторный submit @regression` — `qr-booking-sheet.spec.ts:608`
- **Что проверяет:** после первой ошибки сети при `submitBooking` отображается inline-баннер ошибки `.qr-booking-error` с кнопкой «Повторить». Клик по «Повторить» должен удалить старый баннер, заново вызвать `submitBooking()` и (при повторной ошибке) пересоздать баннер; запись `bookings.take.source='qr'` не должна добавиться, статус устройства должен остаться `available`. Эталон шагов — `results/manual_tests/component_tests.json:600-633` (компонентный тест-кейс «Шторка брони — запрос бронирования, ошибка»).
- **Ошибка:**
  ```
  expect(locator('#qr-booking-body .qr-booking-error')).toBeVisible() failed
  Received: hidden
  Timeout:  10000ms
    24 × locator resolved to <div role="alert" class="qr-booking-error">…</div>
       - unexpected value "hidden"
  ```
  Локатор стабильно находит элемент с правильным классом и `role="alert"`, но он считается hidden. По YAML-snapshot из `test-results/.../error-context.md:30-205` видно, что после клика «Повторить» на экране — главный список устройств, шторка `#qr-booking-sheet` не отрисована → она закрыта (`hidden`-класс).
  Сломалось на `QrBookingSheetPage.expectErrorBannerVisible` (`tests/pages/QrBookingSheetPage.ts:331`) после шага «Клик «Повторить» → баннер пересоздаётся при повторной ошибке» (`qr-booking-sheet.spec.ts:633-640`).
- **Корневая причина:** **продакшен-баг** в `js/modules/devices/devices-qr.js`. На шторке висят два «соседних» обработчика клика:

  1. Делегированный «click outside content» (строки 443-447 в `ensureBookingSheet`):
     ```js
     sheet.addEventListener('click', (e) => {
         if (!e.target.closest('.modal-content')) {
             this.closeBookingSheet();
         }
     });
     ```
  2. Обработчик кнопки «Повторить» в `renderBookingErrorBanner` (строки 993-998):
     ```js
     retryBtn.addEventListener('click', () => {
         banner.remove();
         this.submitBooking();
     });
     ```

  Последовательность:
  1. Пользователь кликает «Повторить».
  2. Обработчик кнопки выполняется первым: `banner.remove()` синхронно отвязывает узел кнопки от DOM, далее запускается `submitBooking()` (async, идёт до первого `await`).
  3. Событие всплывает на `sheet`. К этому моменту `e.target` — кнопка-сирота, и `e.target.closest('.modal-content')` возвращает `null` (отсоединённый элемент не имеет предков).
  4. Условие `!null === true` → синхронно вызывается `closeBookingSheet()` (`devices-qr.js:478-487`), который добавляет класс `hidden` шторке и сбрасывает `this.lastDevice = null`.
  5. Микротаска `submitBooking()` продолжает работу: `device` зафиксирован в локальной переменной до сброса `lastDevice`, поэтому транзакция всё-таки выполняется, ловит мок-ошибку и вызывает `renderBookingErrorBanner` — новый баннер появляется внутри `#qr-booking-body`, но `#qr-booking-sheet.hidden` делает его невидимым.
  6. Playwright видит `.qr-booking-error` в DOM, но `toBeVisible()` падает.

  Тест корректен и описывает реальное требование (BR.05.21 + manual `component_tests.json:600-633` + `:1066-1090` — баннер должен сохраняться/появляться, статус устройства не должен меняться). Баг — в продакшене.
- **Что сделать в продакшен-коде:**
  - Файл: `js/modules/devices/devices-qr.js`
    - Заменить делегированный «outside click» на `sheet` (строки 443-447 в `ensureBookingSheet`) на явный обработчик на `.modal-overlay`, чтобы динамическое удаление любого внутреннего узла (баннер, чекбоксы, suggest-меню `#qr-user-suggest`) больше не вызывало ложного «outside click»:
      ```js
      const overlay = sheet.querySelector('.modal-overlay');
      if (overlay) {
          overlay.addEventListener('click', () => this.closeBookingSheet());
      }
      ```
      Это совместимо с разметкой `ensureBookingSheet` (`devices-qr.js:431-440`): `.modal-overlay` и `.modal-content` — сёстры внутри `#qr-booking-sheet`, поэтому клики по контенту никогда не достигнут оверлея.
    - **Дополнительно (defence-in-depth):** в `renderBookingErrorBanner` (`devices-qr.js:993-998`) обработчик retry должен останавливать всплытие, чтобы не зависеть от структуры родительских слушателей:
      ```js
      retryBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          banner.remove();
          this.submitBooking();
      });
      ```
  - Аналогичный делегированный «outside click» висит на `qr-scanner-modal` (`devices-qr.js:117-121`). Та же проблема может всплыть для модалки сканера при будущих динамических удалениях. Рекомендуется применить ту же замену там же, чтобы не плодить регрессию (тестового падения сейчас нет, но архитектурно — тот же баг).
- **Сложность:** **S** (3-5 строк в `devices-qr.js`, без миграций, без изменения тестов).
- **Покрытые тесты:** TC-QR-018.4 (прямо). Профилактически — все будущие сценарии, которые удаляют DOM-узел внутри `#qr-booking-sheet` или `#qr-scanner-modal` в обработчиках кликов.

---

## ⏭ Skipped tests — что реализовать, чтобы расскипить

**Нет.** В `results/autotests/test-results.json` `"skipped": 0` (см. `stats:8692-8699`). В `qa-device-monitor/tests/e2e/qr-booking/*.spec.ts` поиск `test.skip|test.fixme|describe.skip|describe.fixme` не дал совпадений. Раздел пуст преднамеренно — расскипливать нечего, дополнительной фичи реализовывать не нужно.

---

## 🛠 Сводный план реализации (приоритизированный)

1. **[S]** `js/modules/devices/devices-qr.js:443-447` — заменить делегированный обработчик «outside click» на `sheet` явным слушателем на `.modal-overlay`. Чинит: `[P1][TC-QR-018.4] Шторка брони — клик «Повторить» инициирует повторный submit`.
2. **[S]** `js/modules/devices/devices-qr.js:993-998` — добавить `e.stopPropagation()` в обработчик retry-кнопки `renderBookingErrorBanner`. Defence-in-depth для того же теста; снижает риск регрессии, если в будущем на шторку повесят дополнительные delegated-handlers.
3. **[S, опционально]** `js/modules/devices/devices-qr.js:117-121` — применить ту же замену (`.modal-overlay` вместо делегата на `#qr-scanner-modal`) для модалки сканера. Тестов сейчас не чинит, но устраняет тот же баг в симметричном месте.

Изменения в тестах **не требуются** — текущие спецы и Page Object корректны и соответствуют каноническим шагам из `manual_tests/component_tests.json`.

---

## 📝 Вопросы / неоднозначности

- **Пункт 3 (профилактика для `qr-scanner-modal`).** Текущий регресс его не требует, но архитектурно это тот же баг. Подтвердить, что готовы внести в этот же PR; иначе вынести отдельно.
- **Точная замена обработчика.** Альтернатива «click на `.modal-overlay`» — оставить делегат на `sheet`, но менять условие на `e.target.classList.contains('modal-overlay')` или сравнение `e.target === sheet`. Оба варианта эквивалентны по поведению; выбран первый, потому что он соответствует разметке `ensureBookingSheet` и явно описывает намерение «клик по подложке = закрыть».
- **Скрытые регрессии.** Поиск по `js/` не выявил других мест, где обработчик клика делает `child.remove()` внутри `#qr-booking-sheet`. Если такие появятся (например, динамические suggestion-меню для shared-аккаунта в `#qr-user-suggest`), их также защитит исправление пункта 1.
