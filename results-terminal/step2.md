# Шаг 2 — Генерация ручных тест-кейсов

Из требований генерируются компонентные и сценарные тесты. Итог: `results/manual_tests/{component,scenario}_tests.json` (38 + 30 тестов).

```console
make step2
=== Шаг 2: генерация ручных тестов (component + scenario) ===
cd qa-autogenerator-manual-tests && make cli-generate-tests TYPE=both SKIP_GUI=true
🚀 Часть 2: Выбор требований и генерация тестов

📋 План выполнения:
  1️⃣  Генерация промпта для компонентных тестов
  2️⃣  Создание таск-листа компонентных (AI)
  3️⃣  Ревью таск-листа компонентных (AI)
  4️⃣  Генерация компонентных тестов (AI)
  5️⃣  Генерация промпта для сценарных тестов
  6️⃣  Создание таск-листа сценарных (AI)
  7️⃣  Ревью таск-листа сценарных (AI)
  8️⃣  Генерация сценарных тестов (AI)

📝 Генерация промпта для компонентных тестов...
🔄 Агрегируем swagger файлы...
venv/bin/python3 -m internal.swagger.swagger_aggregator
2026-05-25 11:06:51,578 - INFO - ℹ️ 🚀 Starting swagger aggregation...
2026-05-25 11:06:51,578 - INFO - ℹ️ Found 1 swagger files
2026-05-25 11:06:51,578 - INFO - ℹ️ Loading swagger file: example.yaml
2026-05-25 11:06:51,578 - WARNING - ⚠️ ⚠️ Empty or invalid spec in: example.yaml
2026-05-25 11:06:51,578 - INFO - ℹ️ ℹ️ No valid swagger specifications found, creating empty swagger file
2026-05-25 11:06:51,579 - SUCCESS - ✅ ✅ Empty swagger file created: ~/qa-autogenerator-manual-tests/results/requirements/swagger.yaml
✅ Swagger successfully aggregated to: ~/qa-autogenerator-manual-tests/results/requirements/swagger.yaml

./internal/prompts_tests/component/generate_component_prompt.sh
🚀 Генерация промпта для компонентных тестов...
📁 Корень проекта: qa-autogenerator-manual-tests
🐍 Используем Python: qa-autogenerator-manual-tests/venv/bin/python3
✅ Файл 'qa-autogenerator-manual-tests/results/tests/component/final_prompt_component.txt' успешно сгенерирован.
✅ Prompt successfully generated at: qa-autogenerator-manual-tests/results/tests/component/final_prompt_component.txt
✅ Промпт для компонентных тестов сгенерирован: results/tests/component/final_prompt_component.txt

📝 Создание таск-листа для компонентных тестов...
🤖 Автоматическое создание таск-листа для компонентных тестов через Claude Code CLI...
📝 Отправка промпта в Claude Code AI...
Оба файла созданы. Вот что получилось:

---

**`task_list_tests.md`** — 36 тестов, организованы по 10 блокам:

| Блок | Тестов |
|------|--------|
| Экран сканера QR | 11 |
| Шторка брони (доступное устройство) | 8 |
| Шторка занятости / external / неисправного | по 1 |
| Шторка pendingReceipt | 3 |
| Шторка действий (своё устройство) | 5 |
| Шторка брони shared-аккаунт | 4 |
| История + Аналитика | 2 |

Каждый тест: название в формате `ПУТЬ - ТЕСТ` и одна строка с описанием — что именно проверяем. В конце файла: таблица покрытия BR.05.x и секция TODO с вопросами к ТЗ.

**`task_list_tech.md`** — технические правила для агента: JSON-схема, форматирование, структура `testRepositoryPath` с готовыми путями для каждой шторки, специфика Firestore вместо REST API, обязательный набор ошибок, чеклист самопроверки на 10 пунктов.
✅ Таск-лист создан в results/tests/component/task_list/

🔍 Ревью таск-листа для компонентных тестов...
🤖 Автоматическое ревью таск-листа для компонентных тестов через Claude Code CLI...
📝 Отправка промпта в Claude Code AI...
Готово. Вот что было сделано:

---

**Найденные проблемы и исправления:**

**1. Формат `summary` (Чеклист 1)** — все 36 тестов переименованы: добавлен обязательный префикс `QR-бронирование.`, чтобы имена соответствовали формату `"Фича. Экран. Элемент - тест, уточнение"`.

**2. Защита от двойных тапов (Чеклист 2)** — в тесте №33 (shared-аккаунт, запрос бронирования) добавлено `"Кнопка блокируется до завершения"` — единственный тест успешного запроса, где это отсутствовало.

**3. Пробелы в покрытии (Чеклист 3)** — три непокрытых BR:
- **BR.05.1** и **BR.05.12** → новый тест №37 `QR-бронирование. Карточка устройства. QR-код - компоновка` (отображение QR в карточке/админке, payload содержит только `deviceId`, нет чувствительных данных)
- **BR.05.25** → новый тест №38 `QR-бронирование. Уведомления. Смена владельца устройства - логика работы` (in-app уведомление предыдущему владельцу при смене/возврате)

**Итог:** 36 → 38 тестов. Все 28 BR теперь покрыты.
✅ Ревью таск-листа завершено

✨ Генерация компонентных тестов...
🤖 Автоматическая генерация компонентных тестов через Claude Code CLI...
📝 Отправка промпта в Claude Code AI...
Все 38 тестов сгенерированы и записаны в `results/tests/component/component_tests.json`. Все проверки прошли:

- **38 тестов** — по одному на каждую строку из `task_list_tests.md`
- **Summary ≤ 100 символов** у всех тестов
- **testRepositoryPath** строго 4 уровня, все начинаются с `new_mobile/`
- **testCaseType = "component"**, **priority = "Normal"**, **labels = []** у всех
- **Нет обратных кавычек** (backticks) в JSON
- **JSON валидный** — прошёл парсинг через `json.load()`

Покрыты все 12 блоков: сканер QR (11 тестов), шторка брони (8), шторка занятости/external/неисправного (по 1), ожидания получения (3), действий с устройством (5), shared-аккаунт (4), история, аналитика, карточка устройства, уведомления.
✅ Тесты сгенерированы в results/tests/component/component_tests.json

---

📄 Проверка наличия компонентных тестов в CSV...
✅ Компонентные тесты в CSV найдены

📝 Генерация промпта для сценарных тестов...
🔄 Агрегируем swagger файлы...
venv/bin/python3 -m internal.swagger.swagger_aggregator
2026-05-25 11:38:03,919 - INFO - ℹ️ 🚀 Starting swagger aggregation...
2026-05-25 11:38:03,920 - INFO - ℹ️ Found 1 swagger files
2026-05-25 11:38:03,920 - INFO - ℹ️ Loading swagger file: example.yaml
2026-05-25 11:38:03,920 - WARNING - ⚠️ ⚠️ Empty or invalid spec in: example.yaml
2026-05-25 11:38:03,920 - INFO - ℹ️ ℹ️ No valid swagger specifications found, creating empty swagger file
2026-05-25 11:38:03,920 - SUCCESS - ✅ ✅ Empty swagger file created: ~/qa-autogenerator-manual-tests/results/requirements/swagger.yaml
✅ Swagger successfully aggregated to: ~/qa-autogenerator-manual-tests/results/requirements/swagger.yaml

./internal/prompts_tests/scenario/generate_scenario_prompt.sh
🚀 Генерация промпта для сценарных тестов...
📁 Корень проекта: qa-autogenerator-manual-tests
🐍 Используем Python: qa-autogenerator-manual-tests/venv/bin/python3
✅ Файл 'qa-autogenerator-manual-tests/results/tests/scenario/final_prompt_scenario.txt' успешно сгенерирован.
✅ Prompt successfully generated at: qa-autogenerator-manual-tests/results/tests/scenario/final_prompt_scenario.txt
✅ Промпт для сценарных тестов сгенерирован: results/tests/scenario/final_prompt_scenario.txt

📝 Создание таск-листа для сценарных тестов...
🤖 Автоматическое создание таск-листа для сценарных тестов через Claude Code CLI...
📝 Отправка промпта в Claude Code AI...
Файлы созданы. Вот что сделано:

**`task_list_tech.md`** — технические детали для агента:
- Схема TestCase с полями и типами
- Таблица `testRepositoryPath` для трёх подфич: `сканер`, `шторка-брони`, `история`
- Firestore-поля в формате `{{}}` (без backtick)
- Правила форматирования action/data/result, TODO-маркеры, запрет кавычек
- Ключевые бизнес-правила (атомарность, pendingReceipt, shared-аккаунт и т.д.)

**`task_list_tests.md`** — 26 тестов с декомпозицией:
- Каждый тест: название (≤100 символов), приоритет, тип (smoke/sanity), путь в репозитории, покрываемые требования BR.05.x и описание что проверяем
- 2 smoke (критические happy path), 21 sanity (ошибки, спецсостояния, граничные случаи), 3 TODO (сложные в ручном тестировании)
- Сгруппированы логически: открытие сканера → камера/ввод → бронирование → спецсостояния устройств → ошибки → спецсценарии
✅ Таск-лист создан в results/tests/scenario/task_list/

🔍 Ревью таск-листа для сценарных тестов...
🤖 Автоматическое ревью таск-листа для сценарных тестов через Claude Code CLI...
📝 Отправка промпта в Claude Code AI...
Готово. Вот краткое резюме того, что было сделано:

## Результаты ревью

### Найдено 8 проблем, все исправлены:

**Непротиворечивость (3 проблемы):**
1. **Тест 2** — противоречил BR.05.2: кнопка скрыта, но тест не указывал точку входа → добавлена формулировка «прямая ссылка»
2. **Тест 15 (бывший)** — смешивал роли user/admin в одном результате → разделён на тест 17 (обычный пользователь) и тест 18 (admin)
3. **Тест 24 (бывший)** — называл нотификацию «in-app», BR.05.25 требует «push/чат-нотификация» → исправлено

**Условная логика (1 проблема):**
4. **Тест 12** — содержал «(для home)» без указания bookingType в предусловии → разделён на тест 12 (office) и тест 13 (home, новый)

**Полнота покрытия (3 проблемы):**
5. **BR.05.1** полностью не покрыт — добавлен тест 27 (QR в карточке устройства)
6. **BR.05.19 date_change** — действие описывалось, но не тестировалось → добавлен тест 15
7. **BR.05.20 toast** в тесте на pendingReceipt отсутствовал → добавлен

**Классификация (1 проблема):**
8. **Тест 26 (бывший)** — путь `шторка-брони` для аналитики → исправлен на `аналитика`

**Итог:** 26 → 30 тестов, покрытие BR.05.1–BR.05.28 полное (28/28).
✅ Ревью таск-листа завершено

✨ Генерация сценарных тестов...
🤖 Автоматическая генерация сценарных тестов через Claude Code CLI...
📝 Отправка промпта в Claude Code AI...
Все проверки пройдены. Файл `results/tests/scenario/scenario_tests.json` содержит 30 валидных сценарных тестов:

- **2 smoke** (Blocker): открытие сканера + распознавание кода, успешное бронирование office
- **25 sanity** (Normal/Minor): все прочие сценарии — негативные флоу, спецсостояния устройств, ошибки, граничные случаи
- **3 TODO** (Minor): уведомление владельцу, a11y, аналитика — с маркером `(?)` в шагах

Структура путей строго трёхуровневая: `qr-бронирование/{сканер|шторка-брони|история|аналитика}/scenario`. Бэктики отсутствуют, все Firestore-поля в формате `{{field}}`, одинарные кавычки внутри строк.
✅ Тесты сгенерированы в results/tests/scenario/scenario_tests.json

✅ Часть 2 завершена успешно!
📂 Результаты:
   - Компонентные тесты: results/tests/component/component_tests.json
   - Сценарные тесты: results/tests/scenario/scenario_tests.json

📤 Следующий шаг: make test-viewer

Готово:
  qa-autogenerator-manual-tests/results/tests/component/component_tests.json
  qa-autogenerator-manual-tests/results/tests/scenario/scenario_tests.json
```
