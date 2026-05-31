# План улучшения покрытия — qr-booking

> **Источник истины:** `results/requirements.md` (BR.05.1–28) + продакшен-код `qa-device-monitor/js/`. Тесты только подтверждают.
> **Базовая трассировка:** `results/autotests/traceability-matrix.md` (последний прогон **2026-05-26 11:24**, 133 теста: 130 ✅ / 3 ❌; фикс предикатов `bookings.find()` уже применён в `implementation-applied.md`, перепрогон не выполнен).
> **Стиль и архитектура:** Page Object Model, `[P0]/[P1]` + `@smoke/@regression`, `trace(...)`, `test.step(...)`, `QrTestData` из `helpers.ts`, изоляция через `test.use({ mockConfig })`, ассерты и через UI, и через `getDoc`/`getCollection`.
> **Контекст:** предыдущий цикл `coverage-applied.md` уже добавил 14 новых + 10 расширений + 2 корректировки. Этот документ — **следующий инкремент**: добраны мелкие точечные пробелы, где продакшен-код уже реализован, но текущие тесты не проверяют конкретные требования.

---

## Краткий итог

- **Текущее покрытие (из trace-матрицы):** Done **19** / Partial **8** / Missing **1** / Test-only red (после фикса) **3** ⚠️.
- **Целевое покрытие после применения плана:** Done **20** (+ BR.05.5 переходит к «по строгому смыслу AC», см. п.4 ниже) / Partial **7** (BR.05.21 закрывается в части booking-flow — продукт уже реализовал баннер `renderBookingErrorBanner`) / Missing **1** (BR.05.26 — блокер на стороне кода).
- **Сколько новых тест-кейсов добавляем:** **7** (component: **5**, scenario: **2**).
- **Сколько существующих расширяем:** **4**.
- **Корректировка Test-only:** **0** (правки `bookings.find(... && b.source === 'qr')` уже в коде — нужен только **перепрогон** для подтверждения).

> **Важно:** добавляем только тесты к **уже реализованной** функциональности. Всё, что блокируется отсутствием прод-кода (BR.05.8, BR.05.11 enumerateDevices, BR.05.21 для return/receipt/date_change, BR.05.25 admin-activity, BR.05.26 offline, BR.05.27 шторка a11y, BR.05.28 device_form/booking_type) — попадает в «📝 Заметки».

---

## 🆕 Новые тест-кейсы — закрыть Partial / уточнить покрытие

### `[P1][TC-QR-018.3] Шторка брони — inline-баннер с кнопкой «Повторить» виден после ошибки записи @regression` — `qr-booking-sheet.spec.ts` (новый)
- **Покрывает:** BR.05.21 — «при ошибке записи — банер с описанием причины + retry». В коде `js/modules/devices/devices-qr.js:979-1001` (`renderBookingErrorBanner`) баннер `.qr-booking-error` с `[data-qr-action="retry"]` и текстом «Повторить» РЕАЛИЗОВАН, но напрямую в e2e-тестах не проверен (TC-QR-018.1/.2 проверяют только toast и enabled).
- **Тип:** component | **Приоритет:** P1 | **Тег:** @regression
- **Шаги:**
  1. `test.use({ mockConfig: writeNetworkErrorConfig })` (уже есть).
  2. Авторизоваться, открыть шторку для `QrTestData.deviceAvailable`.
  3. Нажать `sheet.confirm()`.
  4. Дождаться toast «Не удалось».
- **Assertion:** `expect(page.locator('#qr-booking-body .qr-booking-error')).toBeVisible()`; кнопка `[data-qr-action="retry"]` видна, текст содержит «Повторить»; элемент имеет `role="alert"`.
- **Page Object изменения:** в `QrBookingSheetPage.ts` добавить локаторы `errorBanner = page.locator('#qr-booking-body .qr-booking-error')` и `retryButton = errorBanner.locator('[data-qr-action="retry"]')`; методы `expectErrorBannerVisible()`, `expectRetryButtonVisible()`, `clickRetry()`.
- **Зависимости:** существующий `writeNetworkErrorConfig`.
- **Сложность:** **S**.

### `[P1][TC-QR-018.4] Шторка брони — клик «Повторить» инициирует повторный submit @regression` — `qr-booking-sheet.spec.ts` (новый)
- **Покрывает:** BR.05.21 — «`retry`-кнопка инициирует повторную операцию без перезагрузки». Код `:993-998` подписан на click → удаляет баннер → вызывает `submitBooking()`.
- **Тип:** component | **Приоритет:** P1 | **Тег:** @regression
- **Шаги:**
  1. `test.use({ mockConfig: writeNetworkErrorConfig })`.
  2. Открыть шторку, `sheet.confirm()`, дождаться баннера.
  3. Зафиксировать `bookings.length` до retry.
  4. `sheet.clickRetry()`.
- **Assertion:** Баннер исчезает (`errorBanner` сначала visible, после клика — пересоздан/исчез на момент re-submit и появился снова при повторной ошибке); счётчик попыток (`window.__submitBookingCalls` или factual повторный toast «Не удалось») — растёт; статус устройства остался `available`; запись `take` в `bookings` не появилась (предикат с `&& source === 'qr'`).
- **Page Object изменения:** уже из TC-QR-018.3.
- **Зависимости:** доработать `mockFirebase` опциональным счётчиком вызовов `runTransaction` (если ещё нет) — иначе считать через косвенный признак (`page.evaluate(() => window.__bookingErrorRenders ?? 0)`); fallback — проверять, что баннер снова стал visible после короткого `waitFor`.
- **Сложность:** **M**.

### `[P1][TC-QR-038.2] Уведомления — payload device_taken содержит deviceName и byName @regression` — `qr-history-analytics.spec.ts` (новый)
- **Покрывает:** BR.05.25 — «push/чат-нотификация прошлому владельцу с deviceName и именем нового владельца». Текущий TC-QR-038 проверяет только `userId`, `type`, `deviceId`. Код `devices-qr.js:941-950` пишет также `deviceName`, `by`, `byName`.
- **Тип:** component | **Приоритет:** P1 | **Тег:** @regression
- **Шаги:**
  1. `test.use({ mockConfig: ownerTransferConfig })` (уже есть).
  2. Авторизоваться, отсканировать `dev-iphone-13`, подтвердить бронь.
  3. Получить `notifications` из store.
- **Assertion:** `record.deviceName` truthy (содержит `iPhone` или каноничное имя); `record.by === QrTestData.currentUserId`; `record.byName` truthy.
- **Page Object изменения:** нет.
- **Сложность:** **S**.

### `[P1][TC-QR-035.6] История — после QR date_change в таблице видна строка с deviceName и action «Изменил дату» @regression` — `qr-history-analytics.spec.ts` (новый)
- **Покрывает:** BR.05.13 — «QR-операции отображаются на вкладке "История" наравне с ручными». Сейчас TC-QR-035.5 покрывает только `return`. Для `date_change` (BR.05.19 home) — нет UI-проверки.
- **Тип:** scenario | **Приоритет:** P1 | **Тег:** @regression
- **Шаги:**
  1. Авторизоваться, отсканировать `QrTestData.deviceOwnHome` (своё home).
  2. Через `sheet.openEditDate()` + `EditDateModal.setDate(...)` + `submit` сменить дату возврата.
  3. Перейти на `NavigateToTab('history')`.
- **Assertion:** `history.expectRowForDeviceAction('Booked iPhone', 'Изменил дату')` — текст бейджа берётся из `app.js:getActionBadge` для `action=date_change`.
- **Page Object изменения:** нет (уже есть `expectRowForDeviceAction` из coverage-applied + `EditDateModal`).
- **Сложность:** **S**.

### `[P1][TC-QR-024.3] История — после receipt_confirmed в таблице видна строка с action «Подтвердил получение» @regression` — `qr-history-analytics.spec.ts` (новый)
- **Покрывает:** BR.05.13 + BR.05.16 — «`receipt_confirmed` отображается в общей ленте истории».
- **Тип:** scenario | **Приоритет:** P1 | **Тег:** @regression
- **Шаги:**
  1. `test.use({ mockConfig: pendingReceiptConfig })`.
  2. Авторизоваться, отсканировать pending-устройство, нажать «Подтвердить получение».
  3. `NavigateToTab('history')`.
- **Assertion:** `history.expectRowForDeviceAction('Samsung S24', /Подтвердил/i)`.
- **Page Object изменения:** нет.
- **Сложность:** **S**.

### `[P1][TC-QR-015.2] Шторка брони — выбор ≥2 проектов: bookings содержит массивы currentProjectIds/Codes/Names @regression` — `qr-booking-sheet.spec.ts` (новый)
- **Покрывает:** BR.05.15 — «сохраняются `currentProjectIds[]`, `currentProjectCodes[]`, `currentProjectNames[]`». Текущий TC-QR-015/TC-SCN-10 проверяет UI и одно поле; массивы не валидируются явно.
- **Тип:** component | **Приоритет:** P1 | **Тег:** @regression
- **Шаги:**
  1. Авторизоваться, открыть шторку для `deviceAvailable`.
  2. В select `#qr-booking-project-select` выбрать 2 проекта (`Devices.selectProjectsByCodes` или прямой `page.evaluate` set value).
  3. `sheet.confirm()`.
- **Assertion:** Найти запись `take` с `source='qr'`. `record.currentProjectIds`, `.currentProjectCodes`, `.currentProjectNames` — массивы длины ≥ 2; `record.currentProjectId/Code/Name` (основной) присутствует и равен первому элементу. Параллельно — те же поля на `device`.
- **Page Object изменения:** добавить `QrBookingSheetPage.selectProjectCodes(codes: string[])` (обёртка над select). Если `Devices.isProjectContextEnabled()` отключено по умолчанию — fixture-config должен включать `featureFlags.projectContext = true`.
- **Зависимости:** доработать или использовать существующий `projectContextEnabledConfig` (если уже есть; иначе создать в `mockFirebase.ts`).
- **Сложность:** **M**.

### `[P1][TC-SCN-08.3] QR-бронирование — сканер закрывается после успешного бронирования @regression` — `scenario-tests.spec.ts` (новый)
- **Покрывает:** BR.05.20 — «сканер закрывается» после success-toast. Текущий TC-SCN-08/TC-QR-017.1 проверяют toast и реалтайм-обновление, но не явное закрытие `#qr-scanner-modal`/`#qr-booking-sheet`.
- **Тип:** scenario | **Приоритет:** P1 | **Тег:** @regression
- **Шаги:**
  1. Авторизоваться, открыть сканер, отсканировать `deviceAvailable`.
  2. `sheet.confirm()`.
- **Assertion:** `expect(app.toastByText('забронировано')).toBeVisible()`; `expect(scanner.modal).toBeHidden()`; `expect(sheet.sheet).toBeHidden()` (использует `setTimeout(() => closeBookingSheet(), 0)` в `:957`).
- **Page Object изменения:** нет (использует существующие локаторы).
- **Сложность:** **S**.

---

## 🔄 Расширение существующих тестов — закрыть Partial

### `[P1][TC-QR-018.1] Шторка брони — ошибка сети` — `qr-booking-sheet.spec.ts:387`
- **Что покрывает сейчас:** toast «Не удалось», `status` не меняется, `bookings.take` не растёт, `confirm` enabled.
- **Чего не хватает (BR.05.21):** прямая проверка inline-баннера ошибки и кнопки «Повторить».
- **Что добавить:** после toast — `sheet.expectErrorBannerVisible()`; `sheet.expectRetryButtonVisible()`. Дублирует часть TC-QR-018.3 концептуально, но здесь — fast-fail на основном happy-path-ошибочном кейсе.
- **Page Object изменения:** из TC-QR-018.3.
- **Сложность:** **S**.

### `[P1][TC-QR-018.2] Шторка брони — ошибка прав доступа` — `qr-booking-sheet.spec.ts:428`
- **Что покрывает сейчас:** toast, статус не меняется, нет take.
- **Чего не хватает (BR.05.21):** аналогично TC-QR-018.1 — баннер и retry-кнопка.
- **Что добавить:** `expectErrorBannerVisible()` + `expectRetryButtonVisible()`.
- **Сложность:** **S**.

### `[P0][TC-QR-017.1] Шторка брони — успешное бронирование office` — `qr-booking-sheet.spec.ts:250`
- **Что покрывает сейчас:** toast, status, bookingType; `currentUserId`, `currentUserName`, `bookedAt` (добавлено в coverage-applied).
- **Чего не хватает (BR.05.4):** **`currentUserPhoto`** перечислен в AC, но в тесте не проверяется.
- **Что добавить:** ассерт `device.currentUserPhoto === user.photoURL` (в test data может быть null → `toBeDefined()`/`toBeNull()` — проверить контракт). Также проверить, что `bookings.userPhoto` записан (`devices-qr.js:920`).
- **Page Object изменения:** нет.
- **Сложность:** **S**.

### `[P1][TC-QR-038] Уведомления — in-app уведомление при смене владельца` — `qr-history-analytics.spec.ts:412`
- **Что покрывает сейчас:** существование `notification` с `userId`/`type`/`deviceId`.
- **Чего не хватает (BR.05.25):** также по AC — `deviceName` и имя нового владельца в payload. (Дополняет TC-QR-038.2 — оставить TC-QR-038 как «smoke»-уровень + добавить explicit asserts.)
- **Что добавить:** assert `record.deviceName` truthy. Альтернатива: объединить с TC-QR-038.2 (если разделять не имеет смысла — оставить только новый).
- **Сложность:** **S**.

---

## ⚠️ Корректировка Test-only / некорректных тестов

### `TC-QR-033`, `TC-QR-033.2`, `TC-SCN-24` — **только перепрогон**, корректировки кода не требуется
- **Состояние:** ассерты `bookings.find(... && b.source === 'qr')` уже в коде (`implementation-applied.md` от 2026-05-26 14:40); продакшен-код `devices-qr.js:803-937` корректно пишет `bookedBy/bookedByName` для shared.
- **Что нужно:** перепрогон `make step4` или `npx playwright test tests/e2e/qr-booking/qr-actions-sheet.spec.ts tests/e2e/qr-booking/scenario-tests.spec.ts` → обновить `results/autotests/test-results.json`. Если оба теста зелёные — статус BR.05.18 переключается на ✅ Done в trace-матрице.
- **Сложность:** **XS** (нет кода/тестов на правку).

### `TC-QR-004`, `TC-SCN-23` — **намеренно не правим**
- **Состояние:** оба теста имитируют сетевую ошибку Firestore, но НЕ `navigator.onLine === false` (см. trace-matrix §Risk). Они зелёные, но проверяют не BR.05.26.
- **Решение:** **до реализации `navigator.onLine`-проверки в коде** (см. «📝 Заметки» п.3) — оставляем без правок, чтобы не маскировать пробел. После прод-фикса — переписать на `await context.setOffline(true)` + ассерт баннера «Нет сети, бронирование недоступно».

### `TC-QR-036.x`, `TC-SCN-30/.2` — **намеренно не правим**
- **Состояние:** тесты закрепляют фактическое поведение кода (`result = device_found/device_not_found/invalid_payload`, `source = camera/manual/image`), а не enum из BR.05.28 (`success/already_booked_other/...`, `source ∈ camera/upload/manual`, `device_form`, `booking_type`).
- **Решение:** до правки кода в `logScanEvent` — не переписываем. После — обновить ассерты на новый enum.

---

## 📋 Изменения в Page Objects (сводно)

### `tests/pages/QrBookingSheetPage.ts`
- Локаторы: `errorBanner = page.locator('#qr-booking-body .qr-booking-error')`, `retryButton = errorBanner.locator('[data-qr-action="retry"]')`.
- Методы:
  - `expectErrorBannerVisible(): Promise<void>` — `await expect(this.errorBanner).toBeVisible()`.
  - `expectRetryButtonVisible(): Promise<void>` — assert text contains «Повторить» + `toBeEnabled()`.
  - `clickRetry(): Promise<void>` — `await this.retryButton.click()`.
  - `selectProjectCodes(codes: string[]): Promise<void>` — обёртка над `#qr-booking-project-select` (мульти-select / chips).

### `tests/pages/HistoryPage.ts` (методы уже есть из coverage-applied)
- Использовать существующий `expectRowForDeviceAction(deviceName, actionRegexOrText)` для action-текстов `«Вернул»`, `«Изменил дату»`, `«Подтвердил получение»` (бейджи из `app.js:getActionBadge`).

### `tests/helpers/mockFirebase.ts`
- Доработать `pendingReceiptConfig` (если нужно для TC-QR-024.3 — может оказаться, что уже включает корректный pending-state).
- При необходимости — `projectContextEnabledConfig` для TC-QR-015.2 (если feature-flag по умолчанию выключен).

---

## 🛠 Сводный план (приоритизированный)

Сверху — максимум покрытия за минимум усилий: сначала P0/S, затем P0/M, затем P1.

| # | Приоритет | Сложность | Файл / тест | Покрывает |
|---|-----------|-----------|-------------|-----------|
| 1 | **P0/S** | расширение | `qr-booking-sheet.spec.ts:250` → TC-QR-017.1: добавить assertion `currentUserPhoto`, `bookings.userPhoto` | BR.05.4 |
| 2 | **P1/S** | новый | `qr-booking-sheet.spec.ts` → **TC-QR-018.3** баннер ошибки + кнопка «Повторить» виден | BR.05.21 (booking-flow) |
| 3 | **P1/S** | расширение | `qr-booking-sheet.spec.ts:387` → TC-QR-018.1: `expectErrorBannerVisible()` + `expectRetryButtonVisible()` | BR.05.21 |
| 4 | **P1/S** | расширение | `qr-booking-sheet.spec.ts:428` → TC-QR-018.2: то же, для permission-error | BR.05.21 |
| 5 | **P1/S** | новый | `qr-history-analytics.spec.ts` → **TC-QR-038.2** payload `device_taken` содержит `deviceName`/`byName` | BR.05.25 |
| 6 | **P1/S** | расширение | `qr-history-analytics.spec.ts:412` → TC-QR-038: `record.deviceName` truthy | BR.05.25 |
| 7 | **P1/S** | новый | `qr-history-analytics.spec.ts` → **TC-QR-035.6** строка истории для `date_change` | BR.05.13 |
| 8 | **P1/S** | новый | `qr-history-analytics.spec.ts` → **TC-QR-024.3** строка истории для `receipt_confirmed` | BR.05.13 + 05.16 |
| 9 | **P1/S** | новый | `scenario-tests.spec.ts` → **TC-SCN-08.3** сканер и шторка скрыты после success | BR.05.20 |
| 10 | **P1/M** | новый | `qr-booking-sheet.spec.ts` → **TC-QR-018.4** клик «Повторить» вызывает повторный submit | BR.05.21 |
| 11 | **P1/M** | новый | `qr-booking-sheet.spec.ts` → **TC-QR-015.2** массивы `currentProjectIds[]/Codes[]/Names[]` в bookings | BR.05.15 |
| 12 | **XS** | rerun | `tests/e2e/qr-booking/qr-actions-sheet.spec.ts` + `scenario-tests.spec.ts` → TC-QR-033/.2/TC-SCN-24 перепрогон | BR.05.18 |

**Оценка трудозатрат:**
- Этап 1 (P0/S): 1 расширение — **~1 час**.
- Этап 2 (P1/S): 7 пунктов (5 новых + 3 расширения) — **~4-5 часов**.
- Этап 3 (P1/M): 2 новых теста — **~3-4 часа**.
- Этап 4 (rerun): запуск тестов — **~10 минут**.

**Итого:** **7 новых + 4 расширения + 1 перепрогон** ≈ **8-10 часов** работы (без правки продакшен-кода).

---

## 📝 Заметки

### Пункты Missing / Partial, для которых ПРОДАКШЕН-КОДА ещё нет (тесты НЕ пишем — вход для /step7 /step8)

1. **BR.05.8 — OAuth-редирект с сохранением `deviceId`.** В `devices-qr.js:openScanner` нет `Auth.signInWithGoogle()` и нет сохранения `pendingScanDeviceId` (`grep localStorage|sessionStorage` по `devices-qr.js` — 0 совпадений). Тест писать смысла нет.
2. **BR.05.11 — выбор камеры из `MediaDeviceInfo` (>2 камер).** В коде только бинарный `flipCamera()` (`facingMode` toggle). UI-выпадающего списка камер нет.
3. **BR.05.21 — inline-кнопка «Повторить» для `return`/`receipt_confirmed`/`date_change`.** В коде только `submitBooking` имеет `renderBookingErrorBanner`. `submitReturn`/`submitReceiptConfirmation`/`submitDateChange` показывают только Toast. Поэтому план покрывает retry-баннер ТОЛЬКО для booking-flow (TC-QR-018.3/.4).
4. **BR.05.25 — admin-activity feed.** `Notifications.notify({type:'device_taken'})` пишется (тестируется), но запись в admin-`activity`-коллекцию не найдена (`grep` по `js/modules/activity.js` — 0 совпадений по `qr`/`source: 'qr'`). До правки кода — не пишем тест.
5. **BR.05.26 — `navigator.onLine` offline-чек.** В коде отсутствует (`grep navigator\.onLine` по `js/` — 0). Существующие TC-QR-004/TC-SCN-23 имитируют ошибку Firestore — это не offline; **не правим** до прод-фикса.
6. **BR.05.27 — focus-trap / `aria-modal` для шторки брони.** Атрибуты есть только в сканере (`devices-qr.js:75-159`). `ensureBookingSheet` шторку без role=dialog. Тест писать нельзя — пробьёт зелёным то, чего нет.
7. **BR.05.28 — `device_form`, `booking_type` в `qr_scan`; enum `result` по AC.** Код шлёт `{source, deviceId, result}` с фактическими `device_found/device_not_found/invalid_payload`. Тесты TC-QR-036.x закрепляют текущее частичное поведение; полное покрытие — после правки `logScanEvent`.
8. **BR.05.13 — UI-маркер `source='qr'`.** Поле в Firestore пишется, но `app.js:renderHistory` не отображает бейдж. Тесты TC-QR-035.5/.6 и TC-QR-024.3 проверяют по `deviceName + action-text`, без бейджа.

### Двусмысленности в требованиях

1. **BR.05.5** — «кнопка подтверждения брони неактивна с подсказкой». Реализация и тесты идут по пути «нет кнопки + баннер "Устройство уже занято"». Нужно подтверждение продукта.
2. **BR.05.18** — `bookedByName` — `displayName` или `email`? Текущий код пишет `actorName = displayName || email`. Тест разрешает оба варианта через regex.
3. **BR.05.25** — push vs in-app: в коде только in-app через `notifications`-коллекцию. Push не реализован; если продукт ждёт push — поднимать с PM.
4. **BR.05.4** — `currentUserPhoto` обязателен или null допустим? В test data `user-1.photoURL` может быть `null`. Тест проверяет совпадение со значением, какое бы оно ни было.

### Решения, принятые эвристически

1. **TC-QR-038.2 и расширение TC-QR-038** — два теста проверяют payload notification по-разному (smoke vs detailed). Если решим объединить — оставить только TC-QR-038.2 с расширенным набором ассертов. По-умолчанию — оставляем оба, чтобы smoke оставался быстрым.
2. **TC-QR-018.4** — для проверки факта повторного `submitBooking()` используем косвенный признак (баннер ошибки появляется снова после клика по retry, при сохранении mock-ошибки). Прямой счётчик вызовов `runTransaction` опционален.
3. **TC-QR-015.2** — если `projectContext` не включён по умолчанию в `defaultMockConfig`, тест требует отдельный `projectContextEnabledConfig`. Перед реализацией — проверить state `Devices.isProjectContextEnabled()` (см. `devices-qr.js:864`).
4. **TC-SCN-08.3** — закрытие сканера происходит через `setTimeout(() => closeBookingSheet(), 0)` (`:957`). Возможно, `expect(...).toBeHidden({ timeout: 1000 })` потребует увеличенного таймаута.

### Что НЕ покрываем намеренно

- **BR.05.3 / 05.11 (реальный `getUserMedia`)** — `simulateScan` патчит DOM напрямую; реальный WebRTC не e2e-тестируется (manual).
- **BR.05.22 — реальная гонка двух браузерных контекстов** — текущий TC-QR-019 эмулирует гонку через прямое изменение store; реальная гонка требует разделения test runner.
- **TC-SCN-26 (админ-генерация QR)** — QR рендерится в `devices-admin.js:openDeviceDetails`, тесты на админ-flow генерации вне scope `qr-booking`.

---

**Артефакты:** `requirements.md`, `traceability-matrix.md`, `component_tests.json`, `scenario_tests.json`, `test-results.json` (2026-05-26 11:24), `tests/e2e/qr-booking/`, `js/modules/devices/devices-qr.js`, `js/modules/notifications.js`, `js/utils/analytics.js`, `js/core/auth.js`, `js/core/app.js`, `index.html`, `coverage-applied.md`, `implementation-applied.md`.
