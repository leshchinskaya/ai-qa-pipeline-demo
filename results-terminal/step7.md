# Шаг 7 — План дореализации кода по отчёту тестов

По результатам прогона строится план доработок. Итог: `results/autotests/implementation-plan.md`.

```console
make step7
=== Шаг 7: план дореализации кода по отчёту тестов (feature: qr-booking) ===
--- Прогоняю тесты с JSON-репортером для свежих данных ---
cd qa-device-monitor && PLAYWRIGHT_JSON_OUTPUT_NAME=results/autotests/test-results.json \
      npx playwright test tests/e2e/qr-booking --reporter=json > /dev/null 2>&1 || true
--- Строю план через Claude (model: claude-opus-4-7) ---
claude -p --dangerously-skip-permissions --model claude-opus-4-7 "$PLAN_PROMPT" < /dev/null
Отчёт сохранён в `results/autotests/implementation-plan.md`.

## Краткая выжимка

**Из 11 failed:**
- **3 — реальный продакшен-баг в обработке кликов по `.modal-overlay`** (TC-QR-001.3 / 012.5 / 026.4): обработчик `click` навешан на оверлей, а Playwright целит в его центр, который перекрыт `.modal-content`. Чинится одной правкой в `devices-qr.js` (renderScannerModal + ensureBookingSheet).
- **1 — недостающая фича** (TC-QR-016.3): нет атрибута `min` у `#qr-booking-until`. Добавить `min="${today}"`.
- **1 — нет debounce/idempotency** (TC-QR-027.2): добавить `_returnInProgress`-флаг + `btn.disabled=true` в `submitReturn`.
- **6 — баги тестовой инфраструктуры** (помечено как «тест требует правки»):
  - TC-QR-006.1 / 011.1 / SCN-20 — мок `buildQuerySnapshot` без поля `empty`.
  - TC-QR-018.1 / 018.2 — тест ожидает `0`, но seed уже даёт ~19 записей `take` для `dev-iphone-13` (нужен baseline diff).
  - TC-SCN-02 — `unauthConfig` обнуляет `auth.user`, из-за чего `signInWithPopup` бросает.

**Из 28 skipped:** дубли группируются в ~13 продакшен-задач. Самые ценные «расскипа»: `renderBrokenDeviceState` (3 теста, S), `renderPendingReceiptState` (5 тестов, M), «изменить дату возврата» (3 теста, M), `source='qr'` в `submitBooking` (1 тест, S). Аналитика, in-app уведомления, shared-UI, axe-core, race-condition — отдельные L-задачи.

Полный приоритизированный список из 18 пунктов и блок открытых вопросов — в файле отчёта.

Готово:
  План:       results/autotests/implementation-plan.md
  Сырые данные: results/autotests/test-results.json
```
