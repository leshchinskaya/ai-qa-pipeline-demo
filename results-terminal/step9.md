make step9
=== Шаг 9: трассировка требований → код/тесты (feature: qr-booking, model: claude-opus-4-7) ===
--- Строю матрицу через Claude (model: claude-opus-4-7) ---
claude -p --dangerously-skip-permissions --model claude-opus-4-7 "$TRACE_PROMPT" < /dev/null
Матрица сохранена в `results/autotests/traceability-matrix.md`.

**Ключевые цифры:** 28 требований BR.05.1–05.28; 8 ✅ Done / 18 🟡 Partial / 1 ❌ Missing / 1 ⚠️ Test-only. Прогон автотестов: 117 кейсов, 82 pass / 35 fail / 0 skip.

**Главные сигналы (не из агентских отчётов, а из прямой проверки кода/тестов):**

1. **BR.05.26 (offline)** — ❌ в коде нет `navigator.onLine` проверки. Тесты `TC-QR-004` и `TC-SCN-23` называются «offline», но дёргают мок Firestore-ошибки — это ⚠️ Test-only, фича не работает в реальном offline.
2. **BR.05.18 (shared-аккаунт)** — ⚠️ код в `devices-qr.js:766-780` имеет fallback на shared-uid, если пользователь не выбран. Это нарушает требование «поле обязательно». Тест `TC-QR-033` ассертит `currentUserId === sharedUserId` — то есть закрепляет неверное поведение. Поле `bookedBy` в `bookingRecord` вообще не пишется.
3. **P0 smoke красные:** `TC-QR-017.1` и `TC-SCN-08` (office-бронь) падают — это блокирует release.
4. **BR.05.21** — нет UI-кнопки «Повторить», только повторный тап confirm.
5. **BR.05.28** — событие `qr_scan` шлётся, но без `device_form`/`booking_type`, и значения `result` (`device_found`/`device_not_found`/`invalid_payload`) не совпадают с требуемыми (`success`/`not_found`/`already_booked_other`/...).
6. **BR.05.8** — кнопка скрыта неавторизованному, но автоматического OAuth-редиректа и сохранения `deviceId` через login нет.

**Контекст по тестам:** согласно `implementation-applied.md` две инфраструктурных правки (вендоринг html5-qrcode + статический `users.js`) уже применены, но `test-results.json` от 2026-05-26T06:21 был, видимо, до них — большинство 🟡 Partial из-за красных тестов может починиться перепрогоном. Тем не менее, code-side gaps (P0-6 выше) перепрогон не уберёт — это реальный долг.

Готово:
  Матрица: results/autotests/traceability-matrix.md
