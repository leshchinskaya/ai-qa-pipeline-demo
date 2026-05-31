# Шаг 8 — Применение плана дореализации

План применяется к коду приложения. Итог: 13 правок, `results/autotests/implementation-applied.md`.

```console
make step8
=== Шаг 8: применение плана дореализации (feature: qr-booking, model: claude-opus-4-7) ===
claude -p --dangerously-skip-permissions --model claude-opus-4-7 "$APPLY_PROMPT" < /dev/null
Готово. Прошёл по сводному плану из 18 пунктов, применил 13 правок и пропустил 5 (с обоснованием).

**Применённые правки**:
- Тест-инфра: `mockFirebase.ts` (поле `empty`, стаб analytics), `scenario-tests.spec.ts` (unauthConfig), `qr-booking-sheet.spec.ts` (baseline-сравнение в TC-QR-018.1/018.2) — закрывают **6 failing**.
- Продакшен (`js/modules/devices/devices-qr.js`): единый паттерн закрытия модалок (3 failing), `min` у даты (1 failing), debounce submitReturn/submitBooking (1 failing), `source:'qr'` в submitBooking (1 skip), новые стейты `renderBrokenDeviceState`/`renderPendingReceiptState` + админ-кнопка (8 skip), «Изменить дату возврата» + `submitDateChange` (3 skip), 10-сек таймер (2 skip), `qr_scan` analytics через новый `js/utils/analytics.js` (2 skip), a11y (focus-trap, aria, фокус-возврат) — 1 skip.

**Пропущенные** (зафиксированы причины в отчёте): TC-QR-037 dup (тест-only, неоднозначность scope), in-app notifications (L, открытый вопрос #5), shared-аккаунт UI (L, открытый вопрос #6), чек-листы проектов (M, неуказана точка получения projects), `runTransaction` (L, расширение мок-инфры).

Отчёт сохранён в `results/autotests/implementation-applied.md`. Файлы прошли `node -c` синтаксический контроль; тесты не запускал по правилу.

Готово:
  Отчёт применения: results/autotests/implementation-applied.md
  Проверь: make step4   (или make step6 — полный регресс)
```
