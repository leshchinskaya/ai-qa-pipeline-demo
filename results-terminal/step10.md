make step10
=== Шаг 10: план улучшения покрытия по trace-матрице (feature: qr-booking, model: claude-opus-4-7) ===
--- Строю план покрытия через Claude (model: claude-opus-4-7) ---
claude -p --dangerously-skip-permissions --model claude-opus-4-7 "$COVERAGE_PLAN_PROMPT" < /dev/null
План сохранён в `results/autotests/coverage-plan.md`.

**Краткое резюме:**
- **Закрываем** 12 Partial-пунктов матрицы расширением существующих ассертов (поля `currentUserId`, `bookedAt`, `bookedUntil`, `source='qr'`, `bookingType` в bookings, `payload.source` в qr_scan).
- **Добавляем 14 новых тест-кейсов** (10 component + 4 scenario): disabled-кнопки для home/broken, idempotency двойного скана, `bookedAt` не перетирается при receipt, реалтайм-обновление каталога после QR-операции, аналитика для разных `source`, уникальность QR-payload между устройствами.
- **Корректируем 2 Test-only теста** (`TC-QR-033`, `TC-SCN-24`) — после фикса BR.05.18 в коде (или временно скипаем с TODO).
- **3 Missing-требования** не покрываем — кода нет: BR.05.8 (OAuth-redirect), BR.05.21 (inline-retry-кнопка), BR.05.26 (offline). Это вход для следующих шагов разработки.
- **Сводный план** приоритизирован: 3 P0-пункта → 17 P1/S → 4 P1/M. Итого ≈15-20 часов работы над тестами без правки продакшен-кода.

Готово:
  План покрытия: results/autotests/coverage-plan.md
