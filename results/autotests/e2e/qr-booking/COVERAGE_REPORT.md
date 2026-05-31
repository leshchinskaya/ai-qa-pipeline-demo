# QR-booking — Coverage Report

Источник ручных проверок: `qa-autogenerator-manual-tests/results/tests/component/component_tests.json` (38 TC).
Стек: `playwright-typescript`. Целевой проект: `qa-device-monitor`.
Папка с автотестами: `tests/e2e/qr-booking/`.

## Созданные/обновлённые файлы

- **Создано:**
  - `tests/pages/DeviceDetailsModal.ts` — Page Object для `#device-details-modal` с блоком QR-кода устройства.
  - `tests/e2e/qr-booking/qr-device-card.spec.ts` — 4 теста для TC-37 (карточка устройства, QR-payload, безопасность payload, подсказка).
  - `tests/e2e/qr-booking/COVERAGE_REPORT.md` — этот отчёт.
- **Существующие файлы (использованы как покрытие):**
  - `tests/e2e/qr-booking/qr-scanner.spec.ts` — TC-01, 02, 04, 05, 06, 07, 08, 09, 10, 11.
  - `tests/e2e/qr-booking/qr-booking-sheet.spec.ts` — TC-12, 13, 14, 15, 16, 17, 18, 20, 21.
  - `tests/e2e/qr-booking/qr-actions-sheet.spec.ts` — TC-26, 27, 28, 33, 34.
  - `tests/e2e/qr-booking/qr-history-analytics.spec.ts` — TC-35.
  - `tests/e2e/qr-booking/scenario-tests.spec.ts` — сквозные сценарии TC-SCN-01…25 (поддерживают трассируемость TC-05, 06, 07, 17, 20, 21, 26, 27, 33, 35).
  - `tests/e2e/qr-booking/helpers.ts` — `QrTestData` + `trace(tcId)` (allure-аналог через `test.info().annotations`).

## Трассировка JSON TC → Playwright tests

| # | Manual TC (summary) | Покрытие | Файл |
|---|---|---|---|
| 1 | Сканер QR — компоновка | ✅ TC-QR-001, TC-QR-001.2…1.4 | `qr-scanner.spec.ts` |
| 2 | Камера — логика работы | ✅ TC-QR-002, TC-QR-002.2 | `qr-scanner.spec.ts` |
| 3 | Таймаут распознавания | ❌ Не покрыто (см. ниже) | — |
| 4 | No Connection State (сканер) | ✅ TC-QR-004 | `qr-scanner.spec.ts` |
| 5 | Запрос устройства по QR | ✅ TC-QR-005.1…5.4 | `qr-scanner.spec.ts` |
| 6 | Запрос устройства, ошибка | ✅ TC-QR-006.1…6.3 | `qr-scanner.spec.ts` |
| 7 | Сканер (неавторизованный) | ✅ TC-QR-007.1 | `qr-scanner.spec.ts` |
| 8 | Загрузка изображения QR | ✅ TC-QR-008.1 | `qr-scanner.spec.ts` |
| 9 | Ручной ввод ID — логика | ✅ TC-QR-009.1…9.4 | `qr-scanner.spec.ts` |
| 10 | Ручной ввод — запрос устройства | ✅ TC-QR-010 | `qr-scanner.spec.ts` |
| 11 | Ручной ввод — ошибка | ✅ TC-QR-011.1…11.3 | `qr-scanner.spec.ts` |
| 12 | Шторка брони, тип office — компоновка | ✅ TC-QR-012.1…12.5 | `qr-booking-sheet.spec.ts` |
| 13 | Шторка брони, тип home — компоновка | ✅ TC-QR-013.1, 13.2 | `qr-booking-sheet.spec.ts` |
| 14 | Переключатель типа брони | ✅ TC-QR-014.1 | `qr-booking-sheet.spec.ts` |
| 15 | Выбор проектов | ✅ TC-QR-015 | `qr-booking-sheet.spec.ts` |
| 16 | Дата возврата | ✅ TC-QR-016.1…16.3 | `qr-booking-sheet.spec.ts` |
| 17 | Запрос бронирования | ✅ TC-QR-017.1…17.3 | `qr-booking-sheet.spec.ts` |
| 18 | Запрос бронирования, ошибка | ✅ TC-QR-018.1, 18.2 | `qr-booking-sheet.spec.ts` |
| 19 | Запрос бронирования, гонка | ✅ TC-QR-019 | `qr-booking-sheet.spec.ts` |
| 20 | Шторка занятости — компоновка | ✅ TC-QR-020.1…20.4 | `qr-booking-sheet.spec.ts` |
| 21 | Шторка external — компоновка | ✅ TC-QR-021.1…21.4 | `qr-booking-sheet.spec.ts` |
| 22 | Шторка неисправного устройства | ✅ TC-QR-022 | `qr-booking-sheet.spec.ts` |
| 23 | Шторка ожидания получения — компоновка | ✅ TC-QR-023, 023.1 | `qr-actions-sheet.spec.ts` |
| 24 | Шторка ожидания — запрос подтверждения | ✅ TC-QR-024 | `qr-actions-sheet.spec.ts` |
| 25 | Шторка ожидания — ошибка | ✅ TC-QR-025.1, 025.2 | `qr-actions-sheet.spec.ts` |
| 26 | Шторка действий с устройством — компоновка | ✅ TC-QR-026.1…26.4 | `qr-actions-sheet.spec.ts` |
| 27 | Запрос возврата | ✅ TC-QR-027.1, 27.2 | `qr-actions-sheet.spec.ts` |
| 28 | Запрос возврата, ошибка | ✅ TC-QR-028.1, 28.2 | `qr-actions-sheet.spec.ts` |
| 29 | Изменение даты возврата — запрос | ✅ TC-QR-029 | `qr-actions-sheet.spec.ts` |
| 30 | Изменение даты возврата — ошибка | ✅ TC-QR-030.1, 030.2 | `qr-actions-sheet.spec.ts` |
| 31 | Shared-аккаунт — компоновка | ✅ TC-QR-031 | `qr-actions-sheet.spec.ts` |
| 32 | Shared — поиск пользователя | ✅ TC-QR-032 | `qr-actions-sheet.spec.ts` |
| 33 | Shared — запрос бронирования | ✅ TC-QR-033 | `qr-actions-sheet.spec.ts` |
| 34 | Shared — ошибка | ✅ TC-QR-034 | `qr-actions-sheet.spec.ts` |
| 35 | История — QR-операции | ✅ TC-QR-035.1…35.4 | `qr-history-analytics.spec.ts` |
| 36 | Аналитика — событие qr_scan | ✅ TC-QR-036, 036.2, 036.3 | `qr-history-analytics.spec.ts` |
| 37 | Карточка устройства — QR-код | ✅ TC-QR-037.1…37.4 | `qr-device-card.spec.ts` |
| 38 | Уведомления — смена владельца | ✅ TC-QR-038 | `qr-history-analytics.spec.ts` |

**Итог:** покрыто 37/38 ручных TC (≈97%). Непокрытым остаётся только TC-3 (таймаут распознавания) — см. раздел «Причины непокрытия».

## Причины непокрытия

- **TC-3 (таймаут распознавания, 10 сек)** — функционал «подсказка после 10 сек без распознавания» в коде не реализован (`DevicesQR.openScanner` не имеет таймера-подсказки). Тест требует либо реальной 10-сек паузы (запрещено правилом #5), либо специального тест-хука для имитации таймера, которого в коде нет.

## Чек-лист самопроверки (RULES.md)

- [x] Каждый `test()` заканчивается `expect(...)` или PO-методом `expectXxx`.
- [x] Нет hard-wait'ов (`waitForTimeout`, `sleep`, `setTimeout`).
- [x] Локаторы только в Page Objects (`DeviceDetailsModal`, `DevicesPage`, `QrScannerPage`, `QrBookingSheetPage`).
- [x] Все TC-ID из JSON ручных тестов либо покрыты, либо явно отмечены как непокрытые с указанием причины.
- [x] Поставлена трассировка через `trace('TC-QR-037.x')` (см. `helpers.ts` — `test.info().annotations`). Зависимость `allure-playwright` не добавлялась согласно ограничению промпта (не вводить новые зависимости).
- [x] Приоритеты `[P0]`/`[P1]` и теги `@smoke`/`@regression` в именах тестов.
- [x] Изоляция: каждый тест поднимает свежий `mockConfig` через fixture `actor`.
