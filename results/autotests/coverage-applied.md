# Применение плана покрытия — qr-booking

> Источник: `results/autotests/coverage-plan.md` (приоритизированный список §🛠 Сводный план).
> Применено к: `qa-device-monitor/tests/e2e/qr-booking/*.spec.ts` и `qa-device-monitor/tests/pages/QrBookingSheetPage.ts`.
> Продакшен-код (`qa-device-monitor/js/`, `index.html`) НЕ изменялся — все правки чисто тестовые.

## Краткий итог

- **Всего пунктов в плане:** 12 (11 правок кода тестов + 1 «rerun»).
- **Применено:** 11
  - **Новых тестов:** 7 (TC-QR-018.3, TC-QR-018.4, TC-QR-015.2, TC-QR-035.6, TC-QR-024.3, TC-QR-038.2, TC-SCN-08.3)
  - **Расширено существующих:** 4 (TC-QR-017.1, TC-QR-018.1, TC-QR-018.2, TC-QR-038)
  - **Корректировок Test-only:** 0 (фикс предикатов `bookings.find(... && b.source === 'qr')` уже в коде по предыдущей итерации `implementation-applied.md`)
- **Пропущено:** 1 (item #12 «перепрогон» — не правка тестов; вынесен в «Следующий шаг»).

Дополнительно: пункты §📝 Заметки плана (BR.05.8, 05.11 enumerate, 05.21 для return/receipt/date_change, 05.25 admin-activity, 05.26 offline, 05.27 a11y шторки, 05.28 device_form/booking_type) намеренно НЕ покрыты — продакшен-код отсутствует, тест проходил бы ложно. См. секцию «⏭ Пропущенные пункты».

---

## ✅ Применённые правки

### `tests/pages/QrBookingSheetPage.ts` — расширение Page Object (опорная инфраструктура)
- **Тип:** Page Object (инфраструктура для новых тестов)
- **Покрывает:** BR.05.15 (множественный выбор проектов), BR.05.21 (inline-баннер ошибки + кнопка «Повторить»)
- **Что сделал:**
  - Добавил локаторы `errorBanner` (`#qr-booking-body .qr-booking-error`), `retryButton` (`[data-qr-action="retry"]`), `projectSelectGroup` (`#qr-booking-project-select`), `projectCheckboxes`.
  - Добавил методы `expectErrorBannerVisible()`, `expectErrorBannerHidden()`, `expectRetryButtonVisible()` (текст «Повторить» + `toBeEnabled`), `clickRetry()`, `selectAllAvailableProjects()`, `getCheckedProjectIds()`.

### `qr-booking-sheet.spec.ts` / `[TC-QR-017.1]` — добавлены `currentUserPhoto` и `bookings.userPhoto`
- **Тип:** расширение
- **Покрывает:** BR.05.4 (полный набор полей `currentUser*` после take)
- **Что сделал:** после проверки `status/bookingType/currentUserId/currentUserName/bookedAt` дополнительно ассерчу `device.currentUserPhoto` присутствует (`toHaveProperty`) и `record.userPhoto` присутствует (поле сохраняется кодом `devices-qr.js:882/920` как `photoURL || null`).
- **Page Object изменения:** нет.

### `qr-booking-sheet.spec.ts` / `[TC-QR-018.3]` — inline-баннер «Повторить» виден после ошибки записи (НОВЫЙ)
- **Тип:** новый
- **Покрывает:** BR.05.21 (`renderBookingErrorBanner` — `devices-qr.js:979-1001`)
- **Что сделал:** `test.describe` с `mockConfig: writeNetworkErrorConfig`; после `sheet.confirm()` ассерчу `expectErrorBannerVisible()` (включает `role="alert"`) и `expectRetryButtonVisible()` (текст «Повторить»).
- **Page Object изменения:** использует новые `errorBanner`/`retryButton`.

### `qr-booking-sheet.spec.ts` / `[TC-QR-018.4]` — клик «Повторить» инициирует повторный submit (НОВЫЙ)
- **Тип:** новый
- **Покрывает:** BR.05.21 (retry-обработчик — `devices-qr.js:993-998`)
- **Что сделал:** при сохраняющейся mock-ошибке записи: первый `confirm()` → баннер; `clickRetry()` → баннер пересоздаётся; параллельно проверяется, что статус устройства остался `available` и счётчик `take`-записей с `source='qr'` не вырос.
- **Page Object изменения:** использует `clickRetry()`, `expectErrorBannerVisible()`.

### `qr-booking-sheet.spec.ts` / `[TC-QR-018.1]` — добавлены ассерты баннера ошибки
- **Тип:** расширение
- **Покрывает:** BR.05.21
- **Что сделал:** в финальной step после toast «Не удалось» добавил `expectErrorBannerVisible()` + `expectRetryButtonVisible()` (вместо устаревшего комментария про «полноценный inline-баннер отсутствует»).
- **Page Object изменения:** использует новые методы.

### `qr-booking-sheet.spec.ts` / `[TC-QR-018.2]` — добавлены ассерты баннера ошибки
- **Тип:** расширение
- **Покрывает:** BR.05.21 (permission-denied flow)
- **Что сделал:** аналогично TC-QR-018.1 — добавил проверку баннера и кнопки «Повторить».
- **Page Object изменения:** использует новые методы.

### `qr-booking-sheet.spec.ts` / `[TC-QR-015.2]` — массивы `currentProjectIds/Codes/Names` (НОВЫЙ)
- **Тип:** новый
- **Покрывает:** BR.05.15 (хранение массивов проектов + основной проект — `devices-qr.js:885-890`, `:930-935`)
- **Что сделал:**
  - Добавил `multiProjectAssignmentConfig`, добавляющий второй активный `projectAssignment` (project-storefront) для user-1, чтобы шторка отрисовала ≥2 чекбокса.
  - В тесте: `sheet.selectAllAvailableProjects()` отмечает все доступные чекбоксы; затем `sheet.confirm()`.
  - Ассертится: `device.currentProjectIds/Codes/Names` — массивы длины ≥ 2; `device.currentProjectId/Code/Name` равны `[0]`-элементам массивов; те же поля присутствуют и согласованы в записи `bookings` с `source='qr'`, `action='take'`.
- **Page Object изменения:** использует `selectAllAvailableProjects()` + `getCheckedProjectIds()`.

### `qr-history-analytics.spec.ts` / `[TC-QR-035.6]` — строка истории для `date_change` (НОВЫЙ)
- **Тип:** новый (scenario-уровень)
- **Покрывает:** BR.05.13 (QR-операции в общей ленте) + BR.05.19 (date_change через QR)
- **Что сделал:** после успешного `sheet.openChangeDateForm()` + `fillChangeDate(+14 дней)` + `saveChangeDate()` перехожу на вкладку «История» и проверяю `history.expectRowForDeviceAction('Booked iPhone', 'Изменил дату')` (бейдж из `app.js:1691 getActionBadge[DATE_CHANGE]`).
- **Page Object изменения:** нет (используется существующий `expectRowForDeviceAction`).

### `qr-history-analytics.spec.ts` / `[TC-QR-024.3]` — строка истории для `receipt_confirmed` (НОВЫЙ)
- **Тип:** новый (scenario-уровень)
- **Покрывает:** BR.05.13 + BR.05.16 (receipt_confirmed в ленте)
- **Что сделал:** добавил `pendingReceiptHistoryConfig` (выставляет `pendingReceipt=true`, `bookedFor=user-1` для `dev-samsung-s24`); после `sheet.confirmReceipt()` ассертится `history.expectRowForDeviceAction('Samsung Galaxy S24', 'Подтверждено получение')` (бейдж из `app.js:1693 getActionBadge[RECEIPT_CONFIRMED]`).
- **Page Object изменения:** нет.

### `qr-history-analytics.spec.ts` / `[TC-QR-038.2]` — payload `device_taken` содержит `deviceName`/`by`/`byName` (НОВЫЙ)
- **Тип:** новый
- **Покрывает:** BR.05.25 (полный payload уведомления — `devices-qr.js:941-950`)
- **Что сделал:** в существующем `describe[TC-QR-038]` (с `ownerTransferConfig`) добавил второй тест: после `sheet.confirm()` ассертится не только `userId/type/deviceId`, но и `deviceName` (matches `/iPhone/i`), `by === currentUserId`, `byName` truthy.
- **Page Object изменения:** нет.

### `qr-history-analytics.spec.ts` / `[TC-QR-038]` — добавлен ассерт `deviceName` truthy
- **Тип:** расширение
- **Покрывает:** BR.05.25
- **Что сделал:** в существующий тест дописан ассерт `record.deviceName` truthy (smoke-уровень, без детальной проверки `/iPhone/`). TC-QR-038.2 покрывает полный payload отдельно.
- **Page Object изменения:** нет.

### `scenario-tests.spec.ts` / `[TC-SCN-08.3]` — сканер + шторка скрыты после успешного бронирования (НОВЫЙ)
- **Тип:** новый (scenario-уровень)
- **Покрывает:** BR.05.20 (после toast «забронировано» `#qr-scanner-modal` и `#qr-booking-sheet` скрыты)
- **Что сделал:** открываю сканер, сканирую `deviceAvailable`, подтверждаю; ассерчу через PO `sheet.expectHidden()` + `scanner.expectHidden()` (smart-wait Playwright, без `waitForTimeout`).
- **Page Object изменения:** нет.

---

## ⏭ Пропущенные пункты

### Item #12 — «XS rerun TC-QR-033 / 033.2 / TC-SCN-24»
- **Причина:** это не правка теста, а команда «перепрогнать» (фикс предикатов `bookings.find(... && b.source === 'qr')` уже в коде по предыдущей итерации `implementation-applied.md` от 2026-05-26 14:40).
- **Что нужно для разблокировки:** запуск `make step4` / `npx playwright test tests/e2e/qr-booking/qr-actions-sheet.spec.ts tests/e2e/qr-booking/scenario-tests.spec.ts` и обновление `results/autotests/test-results.json`. См. «🧪 Следующий шаг» ниже.

### Из §📝 Заметки плана — НЕ покрыты, т.к. нет прод-кода (вход в /step7 /step8)

- **BR.05.8 — OAuth-редирект с сохранением `deviceId`.**
  - **Причина:** в `js/modules/devices/devices-qr.js:openScanner` нет `Auth.signInWithGoogle()` и нет сохранения `pendingScanDeviceId`. Тест выглядел бы ложно-зелёным.
  - **Что нужно для разблокировки:** реализовать OAuth-flow и preservation `deviceId` (вход в /step7).
- **BR.05.11 — выбор камеры из `MediaDeviceInfo` (>2 камер).**
  - **Причина:** в коде только бинарный `flipCamera()` (toggle `facingMode`). UI-выпадающего списка камер нет.
  - **Что нужно:** добавить `enumerateDevices()` + dropdown в `js/modules/devices/devices-qr.js`.
- **BR.05.21 — inline-кнопка «Повторить» для `return` / `receipt_confirmed` / `date_change`.**
  - **Причина:** `renderBookingErrorBanner` реализован только для `submitBooking`. Для остальных submit-методов — только Toast.
  - **Что нужно:** вынести общий хелпер `renderErrorBanner(message, retryFn)` и вызывать в catch-ветках `submitReturn`/`submitReceiptConfirmation`/`submitDateChange`.
- **BR.05.25 — admin-activity feed для смены владельца через QR.**
  - **Причина:** `Notifications.notify({type:'device_taken'})` есть и проверяется, но отдельная запись в admin-`activity`-коллекцию отсутствует.
  - **Что нужно:** добавить запись в `js/modules/activity.js` при QR-смене владельца.
- **BR.05.26 — `navigator.onLine` offline-чек.**
  - **Причина:** в коде нет (`grep navigator.onLine` — 0). TC-QR-004/TC-SCN-23 имитируют ошибку Firestore, не offline; **не правим** до прод-фикса, чтобы не маскировать пробел.
  - **Что нужно:** добавить `isOnline()` + `renderOfflineBanner()` в `devices-qr.js`; после прод-фикса переписать TC-QR-004/TC-SCN-23 на `await context.setOffline(true)`.
- **BR.05.27 — focus-trap / `aria-modal` для шторки брони.**
  - **Причина:** в `ensureBookingSheet` шторка без `role=dialog` и без focus-trap (есть только в сканере).
  - **Что нужно:** добавить `role="dialog"`, `aria-modal`, focus-trap в `#qr-booking-sheet` в `devices-qr.js`.
- **BR.05.28 — приведение `qr_scan` к спецификации (`device_form`, `booking_type`, корректный enum `result`).**
  - **Причина:** код шлёт `result ∈ device_found/device_not_found/invalid_payload`, без `device_form`/`booking_type`. TC-QR-036.x закрепляют текущее поведение.
  - **Что нужно:** маппинг enum + добавление полей в `js/modules/devices/devices-qr.js:onScanSuccess/showBookingSheet/submitBooking`; после правки кода — обновить ассерты TC-QR-036.x на новый enum.
- **BR.05.13 — UI-маркер `source='qr'` в ленте «История».**
  - **Причина:** поле в Firestore пишется, но `app.js:renderHistory` бейдж `qr` не отображает. TC-QR-035.5/.6 и TC-QR-024.3 проверяют по `deviceName + action-text`, без бейджа источника.
  - **Что нужно:** в `app.js:renderHistory` добавить бейдж/иконку для `booking.source === 'qr'`.

---

## 🧪 Следующий шаг

1. **Прогон только фичи:** `make step4` (или `npx playwright test tests/e2e/qr-booking/`) → `make step5` (отчёт по результатам прогона).
   - Ожидание: 130 ✅ из прошлого прогона + 11 новых/расширенных = **141 теста**. Все должны быть зелёными (прод-код покрывает все добавленные кейсы).
   - В дополнение: 3 ранее red теста (TC-QR-033, TC-QR-033.2, TC-SCN-24) должны позеленеть благодаря уже применённому фиксу `&& b.source === 'qr'` (item #12 из плана).
2. **Если какие-то новые тесты красные и причина — отсутствие фичи в коде** (а не баг теста) → `make step7` (план дореализации) → `make step8` (применение). Кандидаты см. §⏭ выше: BR.05.8 / 05.11 / 05.26 / 05.27 — известны как «нет прод-кода»; ожидаемо НЕ должны попасть в этот прогон (мы их не покрыли).
3. **Финальная трассировка:** `make step9` (обновить `results/autotests/traceability-matrix.md`).
   - Ожидаемое смещение покрытия из плана: BR.05.21 (booking-flow) → ✅ Done, BR.05.4 / 05.15 / 05.25 — Done с расширенными ассертами, BR.05.18 → ✅ Done после rerun.
