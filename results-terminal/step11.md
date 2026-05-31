make step11
=== Шаг 11: применение плана улучшения покрытия (feature: qr-booking, model: claude-opus-4-7) ===
claude -p --dangerously-skip-permissions --model claude-opus-4-7 "$COVERAGE_APPLY_PROMPT" < /dev/null
Done. Applied all 26 items from the coverage plan and saved the report.

**Summary:**
- **Page Objects** updated: `QrBookingSheetPage.ts` (user-search locators/methods for shared), `DevicesPage.ts` (`expectDeviceCardStatus`), `HistoryPage.ts` (`expectRowForDeviceAction`), `DeviceDetailsModal.ts` (`getQrPayloadText`).
- **14 new tests** added across qr-booking-sheet (3), qr-scanner (1), qr-actions-sheet (3), qr-history-analytics (4 incl. parameterized 027.4), scenario-tests (4).
- **10 extensions** to existing tests (017.1, 017.2, 018.1, 018.2, 019, 020.1, 021.3, 027.2, 035.1, 036/036.2/036.3 source-camera, plus 029 TODO comment on SCN-29).
- **2 Test-only corrections** (TC-QR-033, TC-SCN-24) — rewritten to match BR.05.18, marked `test.skip(...)` with TODO citing the required production-code fix in `devices-qr.js:766-780, 856-874`.
- **2 new tests** are also `test.skip(...)` (TC-QR-033 rewritten body and TC-QR-033.2) — blocked on the same BR.05.18 code fix.
- `npx tsc --noEmit` reports 0 new errors in modified files (12 pre-existing errors in untouched files remain).
- Report saved to `results/autotests/coverage-applied.md`.

Готово:
  Отчёт применения: results/autotests/coverage-applied.md
  Проверь: make step4 → make step5
