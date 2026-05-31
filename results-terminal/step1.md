# Шаг 1 — Ревью требований

Ревью ТЗ (v1.1) инструментом `qa-autogenerator-manual-tests`. Итог: оценка **42%**, отчёт `results/review_requirements/review.md`.

```console
make step1
=== Шаг 1: ревью требований ===
mkdir -p qa-autogenerator-manual-tests/results/requirements
cp CL-05_QR_Booking.md qa-autogenerator-manual-tests/results/requirements/requirements.md
cd qa-autogenerator-manual-tests && make prompt-review
🔄 Агрегируем swagger файлы...
venv/bin/python3 -m internal.swagger.swagger_aggregator
2026-05-25 10:51:14,074 - INFO - ℹ️ 🚀 Starting swagger aggregation...
2026-05-25 10:51:14,074 - INFO - ℹ️ Found 1 swagger files
2026-05-25 10:51:14,074 - INFO - ℹ️ Loading swagger file: example.yaml
2026-05-25 10:51:14,074 - WARNING - ⚠️ ⚠️ Empty or invalid spec in: example.yaml
2026-05-25 10:51:14,074 - INFO - ℹ️ ℹ️ No valid swagger specifications found, creating empty swagger file
2026-05-25 10:51:14,075 - SUCCESS - ✅ ✅ Empty swagger file created: ~/qa-autogenerator-manual-tests/results/requirements/swagger.yaml
✅ Swagger successfully aggregated to: ~/qa-autogenerator-manual-tests/results/requirements/swagger.yaml

./internal/prompts_tests/review_requirements/generate_review_requirements_prompt.sh
🚀 Генерация промпта для ревью требований...
📁 Корень проекта: qa-autogenerator-manual-tests
🐍 Используем Python: qa-autogenerator-manual-tests/venv/bin/python3
⚠️ Предупреждение: Файл метаданных '~/qa-autogenerator-manual-tests/internal/prompts_tests/internal/confluence/artifacts/<feature-page>/page_metadata.txt' не найден.
✅ Файл 'qa-autogenerator-manual-tests/results/tests/review_requirements/final_prompt_review_requirements.txt' успешно сгенерирован.
✅ Prompt successfully generated at: qa-autogenerator-manual-tests/results/tests/review_requirements/final_prompt_review_requirements.txt
✅ Промпт для ревью требований сгенерирован: results/tests/review_requirements/final_prompt_review_requirements.txt
cd qa-autogenerator-manual-tests && make cli-review-requirements
🤖 Автоматическое ревью требований через Claude Code CLI...
📝 Отправка промпта в Claude Code AI...
Ревью завершено. Результат сохранён в `results/tests/review_requirements/review.md`.

**Итог анализа ТЗ QR-бронирования (CL-05):**

**Оценка: 42% — Неудовлетворительно**

Ключевые проблемы:
- **5 критических замечаний**: нет Swagger/моделей данных, нет списка методов API, нет точек инициализации экрана, нет последовательности формирования экрана, нет описания лоадеров
- **7 важных замечаний**: нет дизайна и визуальных материалов, не описаны характеристики полей ввода, не описаны жесты управления шторкой, дублирование BR.05.9/BR.05.19

Сильная сторона документа — хорошо проработанные бизнес-требования с детальными критериями приёмки и покрытием edge-cases (pendingReceipt, shared-аккаунт, offline, атомарность транзакций, accessibility, аналитика). Но без структурных разделов ТЗ документ не готов к разработке.
✅ Ревью требований завершено. Результат в results/tests/review_requirements/review.md

Готово. Открой: qa-autogenerator-manual-tests/results/tests/review_requirements/review.md
```
