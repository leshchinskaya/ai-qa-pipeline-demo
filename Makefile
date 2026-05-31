.PHONY: help init step1 review-requirements step2 gen-manual-tests step3 gen-autotests step3-component gen-autotests-component step3-improve step3-improve-component step4 test-feature step4-headed step4-ui step5 step6 regress step7 plan step8 apply step9 trace step10 coverage-plan step11 coverage-apply report pw-install run-app demo-buggy demo-fixed all clean

# === Конфиг (правь здесь, если меняются пути/фичи) ===
ROOT            := /Users/leshchinskaya/podlodka
QA_AUTOGEN_DIR  := $(ROOT)/qa-autogenerator-manual-tests
E2E_DIR         := $(ROOT)/e2e-test-framework
PROJECT_DIR     := $(ROOT)/qa-device-monitor

# Демо-стенды для конференции (ДО/ПОСЛЕ по фиче QR-бронирования)
DEMO_BUGGY_DIR  := $(ROOT)/qa-device-monitor-demo-qr-1ver
DEMO_FIXED_DIR  := $(ROOT)/qa-device-monitor-demo

REQUIREMENTS_SRC := $(ROOT)/CL-05_QR_Booking.md
REQUIREMENTS_DST := $(QA_AUTOGEN_DIR)/results/requirements/requirements.md

FEATURE         := qr-booking
STACK           := playwright-typescript
E2E_MODEL       := claude-opus-4-7
MANUAL_TESTS    := $(QA_AUTOGEN_DIR)/results/tests/scenario/scenario_tests.json
COMPONENT_TESTS := $(QA_AUTOGEN_DIR)/results/tests/component/component_tests.json

# Папка со сгенерёнными e2e-тестами по фиче внутри qa-device-monitor
FEATURE_TESTS_DIR := $(PROJECT_DIR)/tests/e2e/$(FEATURE)

# Локальная папка-агрегатор артефактов
RESULTS_DIR     := $(ROOT)/results

# === Цели ===

help:
	@echo "Команды (можно вызывать по короткому алиасу или по stepN):"
	@echo "  make init                — разовая подготовка (venv + зависимости qa-autogenerator)"
	@echo "  make review-requirements — Шаг 1: ревью требований ($(REQUIREMENTS_SRC))   [alias: step1]"
	@echo "  make gen-manual-tests    — Шаг 2: генерация ручных тестов (component + scenario)  [step2]"
	@echo "  make gen-autotests       — Шаг 3: генерация автотестов из scenario → $(PROJECT_DIR)  [step3]"
	@echo "  make gen-autotests-component — то же из component_tests.json  [step3-component]"
	@echo "  make step3-improve       — Шаг 3.1: улучшить автотесты по review.md (scenario)"
	@echo "  make step3-improve-component — то же для component"
	@echo "  make test-feature        — Шаг 4: прогон автотестов только по фиче '$(FEATURE)'  [step4]"
	@echo "  make step4-headed        — то же, но с видимым браузером"
	@echo "  make step4-ui            — Playwright UI mode по фиче '$(FEATURE)'"
	@echo "  make report              — Шаг 5: открыть HTML-отчёт последнего прогона  [step5]"
	@echo "  make regress             — Шаг 6: прогон ВСЕХ автотестов (регресс)  [step6]"
	@echo "  make plan                — Шаг 7: построить план дореализации кода по отчёту  [step7]"
	@echo "  make apply               — Шаг 8: применить план — доработать продакшен-код  [step8]"
	@echo "  make trace               — Шаг 9: трассировка требований → код/тесты  [step9]"
	@echo "  make coverage-plan       — Шаг 10: план улучшения покрытия по trace-матрице  [step10]"
	@echo "  make coverage-apply      — Шаг 11: добавить/расширить тесты по coverage-плану  [step11]"
	@echo "  make pw-install — установить браузеры Playwright (разовая)"
	@echo "  make run-app — запустить локальный сервер qa-device-monitor (make run)"
	@echo "  make demo-buggy — демо ДО (QR-бронирование с багами) на http://localhost:8081"
	@echo "  make demo-fixed — демо ПОСЛЕ (QR-бронирование без багов) на http://localhost:8082"
	@echo "  make clean      — освободить порты 8081/8082"
	@echo "  make all     — последовательно step1 → step2 → step3"
	@echo ""
	@echo "Текущие параметры:"
	@echo "  FEATURE          = $(FEATURE)"
	@echo "  STACK            = $(STACK)"
	@echo "  REQUIREMENTS_SRC = $(REQUIREMENTS_SRC)"
	@echo "  PROJECT_DIR      = $(PROJECT_DIR)"

init:
	cd $(QA_AUTOGEN_DIR) && make init

step1 review-requirements:
	@echo "=== Шаг 1: ревью требований ==="
	mkdir -p $(QA_AUTOGEN_DIR)/results/requirements
	cp $(REQUIREMENTS_SRC) $(REQUIREMENTS_DST)
	cd $(QA_AUTOGEN_DIR) && make prompt-review
	cd $(QA_AUTOGEN_DIR) && make cli-review-requirements
	@echo ""
	@echo "--- Копирую артефакты в $(RESULTS_DIR) ---"
	mkdir -p $(RESULTS_DIR)/review_requirements
	cp $(REQUIREMENTS_DST) $(RESULTS_DIR)/requirements.md
	cp $(QA_AUTOGEN_DIR)/results/tests/review_requirements/review.md $(RESULTS_DIR)/review_requirements/review.md
	@echo ""
	@echo "Готово. Открой: $(RESULTS_DIR)/review_requirements/review.md"

step2 gen-manual-tests:
	@echo "=== Шаг 2: генерация ручных тестов (component + scenario) ==="
	cd $(QA_AUTOGEN_DIR) && make cli-generate-tests TYPE=both SKIP_GUI=true
	@echo ""
	@echo "--- Копирую артефакты в $(RESULTS_DIR) ---"
	mkdir -p $(RESULTS_DIR)/manual_tests
	cp $(COMPONENT_TESTS) $(RESULTS_DIR)/manual_tests/component_tests.json
	cp $(MANUAL_TESTS)    $(RESULTS_DIR)/manual_tests/scenario_tests.json
	@if [ -f $(QA_AUTOGEN_DIR)/results/tests/component/task_list/task_list_tests_diff.md ]; then \
		cp $(QA_AUTOGEN_DIR)/results/tests/component/task_list/task_list_tests_diff.md \
		   $(RESULTS_DIR)/manual_tests/component_task_list_diff.md; \
	fi
	@if [ -f $(QA_AUTOGEN_DIR)/results/tests/scenario/task_list/task_list_tests_diff.md ]; then \
		cp $(QA_AUTOGEN_DIR)/results/tests/scenario/task_list/task_list_tests_diff.md \
		   $(RESULTS_DIR)/manual_tests/scenario_task_list_diff.md; \
	fi
	@echo ""
	@echo "Готово:"
	@echo "  $(RESULTS_DIR)/manual_tests/component_tests.json"
	@echo "  $(RESULTS_DIR)/manual_tests/scenario_tests.json"

step3 gen-autotests:
	@echo "=== Шаг 3: генерация автотестов из scenario_tests.json (model: $(E2E_MODEL)) ==="
	cd $(E2E_DIR) && make cli-generate-all-e2e-tests \
		STACK=$(STACK) \
		FEATURE=$(FEATURE) \
		MANUAL_TESTS=$(MANUAL_TESTS) \
		PROJECT=$(PROJECT_DIR) \
		MODEL=$(E2E_MODEL) < /dev/null
	@echo ""
	@echo "--- Копирую первичный review в $(RESULTS_DIR)/autotests/review-scenario.md ---"
	mkdir -p $(RESULTS_DIR)/autotests
	cp $(E2E_DIR)/results/$(FEATURE)/review.md $(RESULTS_DIR)/autotests/review-scenario.md
	-@$(MAKE) --no-print-directory step3-improve
	@-cp $(E2E_DIR)/results/$(FEATURE)/review.md $(RESULTS_DIR)/autotests/review-scenario.md 2>/dev/null && \
	  echo "--- Обновил копию review (после improve) ---" || true
	@echo ""
	@echo "Готово:"
	@echo "  $(PROJECT_DIR)/tests/e2e/$(FEATURE)/*.spec.ts"
	@echo "  $(PROJECT_DIR)/tests/pages/*.page.ts"
	@echo "  $(RESULTS_DIR)/autotests/review-scenario.md"

step3-component gen-autotests-component:
	@echo "=== Шаг 3 (component): генерация автотестов из component_tests.json (model: $(E2E_MODEL)) ==="
	cd $(E2E_DIR) && make cli-generate-all-e2e-tests \
		STACK=$(STACK) \
		FEATURE=$(FEATURE) \
		MANUAL_TESTS=$(COMPONENT_TESTS) \
		PROJECT=$(PROJECT_DIR) \
		MODEL=$(E2E_MODEL) < /dev/null
	@echo ""
	@echo "--- Копирую первичный review в $(RESULTS_DIR)/autotests/review-component.md ---"
	mkdir -p $(RESULTS_DIR)/autotests
	cp $(E2E_DIR)/results/$(FEATURE)/review.md $(RESULTS_DIR)/autotests/review-component.md
	-@$(MAKE) --no-print-directory step3-improve
	@-cp $(E2E_DIR)/results/$(FEATURE)/review.md $(RESULTS_DIR)/autotests/review-component.md 2>/dev/null && \
	  echo "--- Обновил копию review (после improve) ---" || true
	@echo ""
	@echo "Готово: $(RESULTS_DIR)/autotests/review-component.md"

# Дополнительный проход по review.md: чинит то, что первая итерация пометила
# как "❌ требует ручного вмешательства", и доводит остальное до RULES.md.
# Можно запускать многократно — каждый прогон добавляет новый "Round N" в review.md.
define IMPROVE_PROMPT
Прочитай:
- $(E2E_DIR)/common/RULES.md
- $(E2E_DIR)/results/$(FEATURE)/final_prompt.txt
- $(E2E_DIR)/results/$(FEATURE)/review.md (текущий отчёт ревью)
- ручные тесты по пути MANUAL_TESTS, указанному в final_prompt.txt

В PROJECT, указанном в final_prompt.txt, найди файлы тестов tests/e2e/$(FEATURE)/ и tests/pages/.

Задача — улучшить автотесты:
1. Внимательно изучи секцию "❌ что НЕ удалось исправить" (или аналогичную "осталось руками") в review.md и попробуй применить фиксы для каждого пункта.
2. Дополнительно пройди весь чек-лист RULES.md и улучши тесты: покрытие краевых случаев из ручных тестов, читаемость assertion'ов, изоляцию шагов в Page Objects, устойчивость локаторов, корректную расстановку priority-тегов ([P0]/[P1], @smoke/@regression).
3. Каждое улучшение применяй СРАЗУ через Edit/Write — никаких "TODO" в коде.
4. Обнови $(E2E_DIR)/results/$(FEATURE)/review.md: добавь новый раздел "🔁 Round N (improve)" (N — следующий по порядку) с тремя секциями: 🛠 применённые улучшения этой итерации, ✅ доделал из прошлого ❌, ❌ что всё ещё требует ручного вмешательства (и почему).
endef
export IMPROVE_PROMPT

step3-improve:
	@echo "=== Шаг 3.1: улучшение автотестов по review.md (feature: $(FEATURE), model: $(E2E_MODEL)) ==="
	@test -f $(E2E_DIR)/results/$(FEATURE)/review.md || { echo "Нет $(E2E_DIR)/results/$(FEATURE)/review.md. Сначала прогони 'make step3'."; exit 1; }
	@command -v claude >/dev/null 2>&1 || { echo "Claude CLI не найден в PATH."; exit 1; }
	claude -p --dangerously-skip-permissions --model $(E2E_MODEL) "$$IMPROVE_PROMPT" < /dev/null
	@echo ""
	@echo "Готово. Обновлённый отчёт: $(E2E_DIR)/results/$(FEATURE)/review.md"

step3-improve-component: step3-improve
	@echo "(component использует ту же фичу '$(FEATURE)' и тот же review.md)"

pw-install:
	cd $(PROJECT_DIR) && npm install && npx playwright install

run-app:
	@echo "=== Запуск локального сервера qa-device-monitor (Ctrl+C — остановить) ==="
	cd $(PROJECT_DIR) && make run

demo-buggy:
	@echo "=== Демо ДО (QR-бронирование с багами): http://localhost:8081 (Ctrl+C — остановить) ==="
	cd $(DEMO_BUGGY_DIR) && make run PORT=8081

demo-fixed:
	@echo "=== Демо ПОСЛЕ (QR-бронирование без багов): http://localhost:8082 (Ctrl+C — остановить) ==="
	cd $(DEMO_FIXED_DIR) && make run PORT=8082

clean:
	@-lsof -ti:8081 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:8082 | xargs kill -9 2>/dev/null || true
	@echo "Порты 8081/8082 освобождены"

step4 test-feature:
	@echo "=== Шаг 4: автотесты по фиче '$(FEATURE)' ==="
	@test -d $(FEATURE_TESTS_DIR) || { echo "Нет папки $(FEATURE_TESTS_DIR). Сначала сделай 'make step3'."; exit 1; }
	cd $(PROJECT_DIR) && npx playwright test tests/e2e/$(FEATURE); \
	status=$$?; \
	echo ""; \
	echo "HTML-отчёт: $(PROJECT_DIR)/playwright-report/index.html"; \
	echo "Открыть:    make step5"; \
	exit $$status

step4-headed:
	@test -d $(FEATURE_TESTS_DIR) || { echo "Нет папки $(FEATURE_TESTS_DIR). Сначала сделай 'make step3'."; exit 1; }
	cd $(PROJECT_DIR) && npx playwright test tests/e2e/$(FEATURE) --headed

step4-ui:
	@test -d $(FEATURE_TESTS_DIR) || { echo "Нет папки $(FEATURE_TESTS_DIR). Сначала сделай 'make step3'."; exit 1; }
	cd $(PROJECT_DIR) && npx playwright test tests/e2e/$(FEATURE) --ui

step5 report:
	@echo "=== Шаг 5: открываю HTML-отчёт ==="
	cd $(PROJECT_DIR) && npx playwright show-report

step6 regress:
	@echo "=== Шаг 6: регрессионный прогон ВСЕХ автотестов ==="
	cd $(PROJECT_DIR) && npx playwright test; \
	status=$$?; \
	echo ""; \
	echo "HTML-отчёт: $(PROJECT_DIR)/playwright-report/index.html"; \
	echo "Открыть:    make step5"; \
	exit $$status

PLAN_JSON := $(RESULTS_DIR)/autotests/test-results.json
PLAN_MD   := $(RESULTS_DIR)/autotests/implementation-plan.md

# План дореализации кода: что добавить/поправить в продакшен-коде,
# чтобы упавшие тесты позеленели и скип-тесты расскипились.
define PLAN_PROMPT
Прочитай:
- JSON с результатами последнего прогона Playwright: $(PLAN_JSON)
- HTML-отчёт (для контекста, если нужно): $(PROJECT_DIR)/playwright-report/index.html
- Ручные тесты (КАНОНИЧНОЕ описание шагов и ожиданий): $(RESULTS_DIR)/manual_tests/component_tests.json и $(RESULTS_DIR)/manual_tests/scenario_tests.json
- Файлы автотестов: $(PROJECT_DIR)/tests/e2e/$(FEATURE)/*.spec.ts
- Page Objects: $(PROJECT_DIR)/tests/pages/*.page.ts
- Хелперы и фикстуры: $(PROJECT_DIR)/tests/helpers/, $(PROJECT_DIR)/tests/fixtures/
- Продакшен-код приложения: $(PROJECT_DIR)/js/, $(PROJECT_DIR)/index.html и другие .html в корне $(PROJECT_DIR)/
- Документация проекта (если есть): $(PROJECT_DIR)/CLAUDE.md, $(PROJECT_DIR)/DOCUMENTATION.md, $(PROJECT_DIR)/README.md
- Ревью автотестов: $(RESULTS_DIR)/autotests/review-scenario.md, $(RESULTS_DIR)/autotests/review-component.md
- Исходные требования: $(RESULTS_DIR)/requirements.md

ВАЖНО: JSON-файлы из manual_tests/ — источник истины по тому, ЧТО должен делать каждый тест-кейс (шаги + ожидаемые результаты на человеческом языке). Если автотест .spec.ts расходится с описанием в JSON — это сигнал, что фича в коде сделана не так, как требовалось (или сам автотест неточен). Используй JSON, чтобы понять корневую причину упавшего теста.

Задача — построить детальный план дореализации продакшен-кода, чтобы:
1. Все упавшие тесты (status: "failed" в JSON) проходили.
2. Все skip-тесты (test.skip / test.fixme в коде, или status: "skipped" в JSON) расскипились — для каждого описать, что нужно реализовать в продакшен-коде, чтобы тест стал валидным и зелёным.

ВАЖНО: план должен править ПРОДАКШЕН-КОД, не тесты. Тесты считаем эталоном требований. Менять тест разрешено только если он явно некорректен (баг в локаторе, опечатка в ожидаемом значении) — это отдельно помечай как "тест требует правки".

Структура отчёта (Markdown):

# План дореализации — $(FEATURE)

## Краткий итог
- Всего тестов: N
- Passed: X | Failed: Y | Skipped: Z
- Общая оценка готовности фичи (1-2 предложения).

## 🔴 Failing tests — что чинить в коде
Для каждого упавшего теста:
### `<test name>` — `<spec_file>:<line>`
- **Что проверяет:** 1-2 предложения.
- **Ошибка:** короткая выжимка из error message + где сломалось (локатор/assertion).
- **Корневая причина:** один из {продакшен-баг, недостающая фича, неверный локатор в тесте, неверное ожидание в тесте}.
- **Что сделать в продакшен-коде:**
  - Файл: `<path>` — конкретное изменение (добавить data-testid, реализовать обработчик, поправить логику X).
  - При необходимости несколько файлов списком.
- **Сложность:** S / M / L
- **Покрытые тесты:** этот + (если правка попутно чинит другие — список).

## ⏭ Skipped tests — что реализовать, чтобы расскипить
Для каждого:
### `<test name>` — `<spec_file>:<line>`
- **Причина пропуска:** цитата из skip-комментария или test.skip(reason).
- **Что не хватает в продакшен-коде:** конкретная фича/контрол/эндпойнт.
- **Что сделать:**
  - Файл: `<path>` — конкретное изменение.
- **Сложность:** S / M / L

## 🛠 Сводный план реализации (приоритизированный)
Список задач от самой "ценной" (чинит больше тестов / разблокирует регресс) к менее. failed важнее skipped, S перед L при равной ценности. Формат:
1. **[S]** `<path>` — что сделать. Чинит: `test A`, `test B`.
2. **[M]** ...

## 📝 Вопросы / неоднозначности
- Места, где из тестов/кода непонятно намерение, и нужна доп. инфа от пользователя.

Сохрани отчёт в файл: $(PLAN_MD)
endef
export PLAN_PROMPT

step7 plan:
	@echo "=== Шаг 7: план дореализации кода по отчёту тестов (feature: $(FEATURE)) ==="
	@test -d $(FEATURE_TESTS_DIR) || { echo "Нет $(FEATURE_TESTS_DIR). Сначала сделай 'make step3'."; exit 1; }
	@command -v claude >/dev/null 2>&1 || { echo "Claude CLI не найден в PATH."; exit 1; }
	@mkdir -p $(RESULTS_DIR)/autotests
	@echo "--- Прогоняю тесты с JSON-репортером для свежих данных ---"
	-cd $(PROJECT_DIR) && PLAYWRIGHT_JSON_OUTPUT_NAME=$(PLAN_JSON) \
	  npx playwright test tests/e2e/$(FEATURE) --reporter=json > /dev/null 2>&1 || true
	@test -f $(PLAN_JSON) || { echo "Не удалось получить JSON-отчёт ($(PLAN_JSON))."; exit 1; }
	@echo "--- Строю план через Claude (model: $(E2E_MODEL)) ---"
	claude -p --dangerously-skip-permissions --model $(E2E_MODEL) "$$PLAN_PROMPT" < /dev/null
	@echo ""
	@echo "Готово:"
	@echo "  План:       $(PLAN_MD)"
	@echo "  Сырые данные: $(PLAN_JSON)"

APPLY_REPORT := $(RESULTS_DIR)/autotests/implementation-applied.md

# Применение плана: Claude читает implementation-plan.md и доводит продакшен-код,
# чтобы failing-тесты позеленели, а skip-тесты стали валидны.
define APPLY_PROMPT
Прочитай:
- План дореализации: $(PLAN_MD)
- Сырые результаты тестов: $(PLAN_JSON)
- Ручные тесты (КАНОНИЧНОЕ описание шагов и ожиданий): $(RESULTS_DIR)/manual_tests/component_tests.json и $(RESULTS_DIR)/manual_tests/scenario_tests.json
- Спецификации автотестов: $(PROJECT_DIR)/tests/e2e/$(FEATURE)/*.spec.ts
- Page Objects: $(PROJECT_DIR)/tests/pages/*.page.ts
- Продакшен-код приложения: $(PROJECT_DIR)/js/, $(PROJECT_DIR)/index.html и другие .html в корне $(PROJECT_DIR)/
- Документация: $(PROJECT_DIR)/CLAUDE.md, $(PROJECT_DIR)/DOCUMENTATION.md, $(PROJECT_DIR)/README.md (если есть)

ВАЖНО: JSON-файлы из manual_tests/ — источник истины по тому, ЧТО должен делать каждый тест-кейс. Перед правкой продакшен-кода для пункта плана сверяйся с этим JSON, чтобы реализовать поведение, которое реально ожидается тестом, а не своё понимание плана.

Задача — пройти по плану и применить все правки к ПРОДАКШЕН-КОДУ:
1. Идти по сводному приоритизированному списку из плана сверху вниз.
2. Для каждого пункта прочитай актуальный код указанного файла, реализуй изменение через tool Edit/Write.
3. После каждой правки коротко зафиксируй, что сделал.
4. Если в плане помечено "тест требует правки" — поправь и тест тоже (в $(PROJECT_DIR)/tests/), но только эти явно помеченные случаи. По умолчанию тесты НЕ трогай.
5. Не выдумывай новые требования — реализуй ровно то, что описано в плане.
6. Если по ходу выяснилось, что план для пункта некорректен (файла нет, конфликт, противоречие) — пропусти этот пункт и зафиксируй причину, не пытайся "придумать" обход.
7. ЗАПРЕЩЕНО: ставить TODO/FIXME в коде вместо реализации; коммитить/пушить; запускать тесты; ставить test.skip на ранее зелёные тесты.

После прохода сохрани отчёт в $(APPLY_REPORT) со структурой:

# Применение плана — $(FEATURE)

## Краткий итог
- Всего пунктов в плане: N
- Применено: X
- Пропущено: Y (с причинами)
- Сложность реально потраченная: S/M/L vs план.

## ✅ Применённые правки
Для каждого пункта плана, который реализован:
### `<path>` — короткое описание
- Что было: 1 предложение.
- Что стало: 1-2 предложения.
- Покрытые тесты (из плана): список.

## ⏭ Пропущенные пункты
Для каждого пропуска:
### `<path>` — короткое описание
- Причина пропуска (что не сошлось с реальным состоянием кода).
- Что нужно от пользователя, чтобы разблокировать.

## 🧪 Следующий шаг
Команда для проверки: `make step4`. Если регресс — `make step6`.

Сохрани отчёт в файл: $(APPLY_REPORT)
endef
export APPLY_PROMPT

step8 apply:
	@echo "=== Шаг 8: применение плана дореализации (feature: $(FEATURE), model: $(E2E_MODEL)) ==="
	@test -f $(PLAN_MD) || { echo "Нет плана: $(PLAN_MD). Сначала сделай 'make step7'."; exit 1; }
	@command -v claude >/dev/null 2>&1 || { echo "Claude CLI не найден в PATH."; exit 1; }
	claude -p --dangerously-skip-permissions --model $(E2E_MODEL) "$$APPLY_PROMPT" < /dev/null
	@echo ""
	@echo "Готово:"
	@echo "  Отчёт применения: $(APPLY_REPORT)"
	@echo "  Проверь: make step4   (или make step6 — полный регресс)"

TRACE_MD := $(RESULTS_DIR)/autotests/traceability-matrix.md

# Трассировка: сопоставить требования из CL-05 с реальной реализацией в коде
# и фактическим покрытием тестами (вкл. их актуальный pass/fail/skip-статус).
define TRACE_PROMPT
Прочитай:
- Требования: $(RESULTS_DIR)/requirements.md (US-XX, бизнес-правила, разделы 1-11)
- Ручные тесты (КАНОНИЧНОЕ описание шагов и ожиданий, источник истины по поведению): $(RESULTS_DIR)/manual_tests/component_tests.json и $(RESULTS_DIR)/manual_tests/scenario_tests.json
- Автотесты: $(PROJECT_DIR)/tests/e2e/$(FEATURE)/*.spec.ts, $(PROJECT_DIR)/tests/pages/*.page.ts
- Свежие результаты прогона (если есть): $(PLAN_JSON)
- Продакшен-код: $(PROJECT_DIR)/js/ (core/, modules/, utils/), $(PROJECT_DIR)/index.html и другие .html в корне
- Документация: $(PROJECT_DIR)/CLAUDE.md, $(PROJECT_DIR)/DOCUMENTATION.md, $(PROJECT_DIR)/ARCHITECTURE_ANALYSIS.md (если есть)
- Контекст по предыдущим работам: $(PLAN_MD), $(APPLY_REPORT) (если есть)

Задача — построить матрицу трассируемости: для КАЖДОГО требования показать что реально реализовано в коде сейчас, какими тестами покрыто, и каков фактический статус.

ВАЖНО:
- Источник истины — продакшен-код, а не план или тесты. Тесты могут проходить, но проверять не то — это gap.
- Для каждого требования делай реальное grep по коду; не верь, что фича есть, только потому что про неё упомянуто в комментарии.
- Если требование декомпозируется на подпункты (US-05.1 с шагами 1-7) — разверни.

Структура отчёта (Markdown):

# Матрица трассируемости — $(FEATURE)

## Краткий итог
- Всего требований: N (US-XX: M, бизнес-правила: K, прочие пункты: L)
- ✅ Done: A (X%) — реализовано в коде + покрыто зелёными тестами
- 🟡 Partial: B (Y%) — реализовано частично или покрыто косвенно / тест есть, но красный/скип
- ❌ Missing: C (Z%) — нет ни в коде, ни в тестах
- ⚠️ Test-only: D — есть тест, но реализации в коде нет (или наоборот)
- Общая оценка готовности фичи: 1-2 предложения.

## Матрица (таблица)

| ID | Требование (1 строка) | Реализация (файл:строка/функция) | Покрытие автотестами (spec:test) | Статус теста | Статус |
|----|------------------------|----------------------------------|----------------------------------|--------------|--------|
| US-05.1 | Быстрая бронь по QR | js/modules/qr/scanner.js:scan() | qr-booking/booking.spec.ts:scanAndBook | ✅ pass | ✅ Done |
| US-05.2 | ... | — | — | — | ❌ Missing |

(Для "Реализация" указывай конкретные пути файл:строка или файл:функция. Если ничего не нашёл — поставь —.
Для "Покрытие" указывай spec_file:test_name. Если несколько — перечисли через ; .
Для "Статус теста": ✅ pass / ❌ fail / ⏭ skip / — нет теста.
Для "Статус": ✅ Done / 🟡 Partial / ❌ Missing / ⚠️ Test-only — твоя оценка по совокупности.)

## ❌ Что НЕ реализовано (по приоритету)
Список с короткими карточками: ID, что нужно, какие файлы тронуть, оценка S/M/L. Это вход для следующего цикла /plan → /apply.

## 🟡 Partial — что доделать
Аналогично: что уже есть, чего не хватает.

## ⚠️ Risk / Test-only
Кейсы, где тест говорит "зелено", но в коде фичи может не быть (мок/устаревший локатор/неверный assertion) — или наоборот.

## 📝 Заметки
Места, где требования двусмысленны и непонятно, реализовано ли — нужна сверка с пользователем.

Сохрани отчёт в файл: $(TRACE_MD)
endef
export TRACE_PROMPT

step9 trace:
	@echo "=== Шаг 9: трассировка требований → код/тесты (feature: $(FEATURE), model: $(E2E_MODEL)) ==="
	@if [ ! -f $(RESULTS_DIR)/requirements.md ] && [ -f $(REQUIREMENTS_DST) ]; then \
	   echo "--- requirements.md в $(RESULTS_DIR) нет, но есть в $(REQUIREMENTS_DST) — копирую ---"; \
	   mkdir -p $(RESULTS_DIR); \
	   cp $(REQUIREMENTS_DST) $(RESULTS_DIR)/requirements.md; \
	 fi
	@if [ ! -f $(RESULTS_DIR)/review_requirements/review.md ] && [ -f $(QA_AUTOGEN_DIR)/results/tests/review_requirements/review.md ]; then \
	   mkdir -p $(RESULTS_DIR)/review_requirements; \
	   cp $(QA_AUTOGEN_DIR)/results/tests/review_requirements/review.md $(RESULTS_DIR)/review_requirements/review.md; \
	 fi
	@test -f $(RESULTS_DIR)/requirements.md || { echo "Нет $(RESULTS_DIR)/requirements.md и в источнике $(REQUIREMENTS_DST) тоже. Сделай 'make step1'."; exit 1; }
	@command -v claude >/dev/null 2>&1 || { echo "Claude CLI не найден в PATH."; exit 1; }
	@mkdir -p $(RESULTS_DIR)/autotests
	@if [ ! -f $(PLAN_JSON) ]; then \
	   echo "--- Нет $(PLAN_JSON), пробую освежить (best-effort) ---"; \
	   cd $(PROJECT_DIR) && PLAYWRIGHT_JSON_OUTPUT_NAME=$(PLAN_JSON) \
	     npx playwright test tests/e2e/$(FEATURE) --reporter=json > /dev/null 2>&1 || true; \
	 fi
	@echo "--- Строю матрицу через Claude (model: $(E2E_MODEL)) ---"
	claude -p --dangerously-skip-permissions --model $(E2E_MODEL) "$$TRACE_PROMPT" < /dev/null
	@echo ""
	@echo "Готово:"
	@echo "  Матрица: $(TRACE_MD)"

COVERAGE_PLAN_MD    := $(RESULTS_DIR)/autotests/coverage-plan.md
COVERAGE_APPLIED_MD := $(RESULTS_DIR)/autotests/coverage-applied.md

# План улучшения покрытия — что добавить в автотесты, чтобы закрыть Missing/Partial/Test-only
# пункты из traceability-matrix.md.
define COVERAGE_PLAN_PROMPT
Прочитай:
- Матрица трассируемости (входная точка): $(TRACE_MD)
- Исходные требования: $(RESULTS_DIR)/requirements.md
- Ручные тесты (КАНОНИЧНОЕ описание шагов и ожиданий): $(RESULTS_DIR)/manual_tests/component_tests.json и $(RESULTS_DIR)/manual_tests/scenario_tests.json
- Существующие автотесты: $(PROJECT_DIR)/tests/e2e/$(FEATURE)/*.spec.ts
- Page Objects: $(PROJECT_DIR)/tests/pages/*.page.ts
- Хелперы/фикстуры: $(PROJECT_DIR)/tests/helpers/, $(PROJECT_DIR)/tests/fixtures/
- Свежие результаты прогона (если есть): $(PLAN_JSON)
- Продакшен-код: $(PROJECT_DIR)/js/, $(PROJECT_DIR)/index.html и другие .html
- Ревью предыдущих генераций: $(RESULTS_DIR)/autotests/review-scenario.md, $(RESULTS_DIR)/autotests/review-component.md
- Контекст по уже применённым доработкам: $(RESULTS_DIR)/autotests/implementation-applied.md (если есть)

Задача — построить план дополнения АВТОТЕСТОВОГО ПОКРЫТИЯ, чтобы:
1. Закрыть пункты со статусом ❌ Missing (есть в требованиях, нет в коде/тестах) — но только те, где код УЖЕ реализован (или реализуем; см. трассировку). Если фичи в коде нет, тест писать смысла нет — отметь в "📝 Заметки".
2. Закрыть пункты со статусом 🟡 Partial — расширить существующие тесты до полного покрытия требования.
3. Разобрать ⚠️ Test-only — проверить, действительно ли там есть реализация, или тест проверяет не то; предложить корректировку теста.
4. Дополнить негативные сценарии и edge cases, если они есть в требованиях, но не в текущих тестах.

ВАЖНО:
- Источник истины — требования + продакшен-код. Тесты только подтверждают.
- Каждый новый/расширяемый тест должен ссылаться на конкретный пункт требований (US-XX, BR.X, §N.N).
- Соблюдай стиль и архитектуру существующих spec.ts и page-objects (Page Object Model, теги [P0]/[P1], @smoke/@regression).
- Не дублируй то, что уже покрыто.

Структура отчёта (Markdown):

# План улучшения покрытия — $(FEATURE)

## Краткий итог
- Текущее покрытие (из trace-матрицы): Done X / Partial Y / Missing Z / Test-only W
- Целевое покрытие после применения плана: Done X' / Partial Y' / Missing Z'
- Сколько новых тест-кейсов добавляем: N (scenario: A, component: B)
- Сколько существующих расширяем: M

## 🆕 Новые тест-кейсы — закрыть Missing
Для каждого:
### `<имя теста>` — `<spec_file>` (новый или существующий)
- **Покрывает:** US-XX / BR.X / §N.N — короткая формулировка из требования.
- **Тип:** component / scenario
- **Приоритет:** P0 / P1
- **Тег:** @smoke / @regression
- **Шаги (Given/When/Then или Arrange/Act/Assert):** 3-7 пунктов.
- **Assertion:** что именно проверяем в конце.
- **Page Object изменения:** какие методы/локаторы добавить в `<file.page.ts>` (если нужно).
- **Зависимости:** что должно быть готово (фикстуры, моки, эндпойнты).
- **Сложность:** S / M / L

## 🔄 Расширение существующих тестов — закрыть Partial
Для каждого:
### `<test name>` — `<spec_file>:<line>`
- **Что покрывает сейчас:** 1 строка.
- **Чего не хватает (из требования):** 1-2 пункта.
- **Что добавить:** конкретно — новый assertion, новый шаг, доп. сценарий (data-driven).
- **Page Object изменения:** если нужны.
- **Сложность:** S / M / L

## ⚠️ Корректировка Test-only / некорректных тестов
Для каждого:
### `<test name>` — `<spec_file>:<line>`
- **Проблема:** что в тесте не соответствует реальной реализации/требованию.
- **Что поправить в тесте** (или подтвердить, что фичи в коде нет и тест нужно скипнуть с TODO до реализации).
- **Сложность:** S / M / L

## 📋 Изменения в Page Objects (сводно)
- `<file.page.ts>` → добавить методы: `<list>`; локаторы: `<list>`.
- Без дубликатов с пунктами выше — здесь только сводка для удобства.

## 🛠 Сводный план (приоритизированный)
Сверху — то, что даёт максимум покрытия за минимум усилий. Сначала P0 + S, потом P0 + M, потом P1.
1. **[P0/S]** `<spec_file>` → новый тест `<name>` (US-XX).
2. **[P0/M]** `<spec_file>:<line>` → расширить `<test_name>` (US-YY).
3. ...

## 📝 Заметки
- Пункты Missing, для которых ПРОДАКШЕН-КОДА ещё нет — список (это вход для /step7 /step8, не для покрытия).
- Двусмысленности в требованиях.
- Решения, которые принял эвристически.

Сохрани отчёт в файл: $(COVERAGE_PLAN_MD)
endef
export COVERAGE_PLAN_PROMPT

step10 coverage-plan:
	@echo "=== Шаг 10: план улучшения покрытия по trace-матрице (feature: $(FEATURE), model: $(E2E_MODEL)) ==="
	@test -f $(TRACE_MD) || { echo "Нет $(TRACE_MD). Сначала сделай 'make step9'."; exit 1; }
	@command -v claude >/dev/null 2>&1 || { echo "Claude CLI не найден в PATH."; exit 1; }
	@mkdir -p $(RESULTS_DIR)/autotests
	@if [ ! -f $(PLAN_JSON) ]; then \
	   echo "--- Нет $(PLAN_JSON), пробую освежить (best-effort) ---"; \
	   cd $(PROJECT_DIR) && PLAYWRIGHT_JSON_OUTPUT_NAME=$(PLAN_JSON) \
	     npx playwright test tests/e2e/$(FEATURE) --reporter=json > /dev/null 2>&1 || true; \
	 fi
	@echo "--- Строю план покрытия через Claude (model: $(E2E_MODEL)) ---"
	claude -p --dangerously-skip-permissions --model $(E2E_MODEL) "$$COVERAGE_PLAN_PROMPT" < /dev/null
	@echo ""
	@echo "Готово:"
	@echo "  План покрытия: $(COVERAGE_PLAN_MD)"

# Применение плана покрытия: создаём/расширяем .spec.ts и Page Objects по плану.
define COVERAGE_APPLY_PROMPT
Прочитай:
- План улучшения покрытия (входная точка): $(COVERAGE_PLAN_MD)
- Матрица трассируемости: $(TRACE_MD)
- Исходные требования: $(RESULTS_DIR)/requirements.md
- Ручные тесты (КАНОНИЧНОЕ описание шагов): $(RESULTS_DIR)/manual_tests/component_tests.json и $(RESULTS_DIR)/manual_tests/scenario_tests.json
- Существующие автотесты: $(PROJECT_DIR)/tests/e2e/$(FEATURE)/*.spec.ts
- Page Objects: $(PROJECT_DIR)/tests/pages/*.page.ts
- Хелперы/фикстуры: $(PROJECT_DIR)/tests/helpers/, $(PROJECT_DIR)/tests/fixtures/
- Правила для автотестов: $(E2E_DIR)/common/RULES.md
- Продакшен-код (для понимания селекторов): $(PROJECT_DIR)/js/, $(PROJECT_DIR)/index.html и .html в корне

Задача — пройти по плану покрытия и применить все изменения К ТЕСТАМ:
1. Идти по сводному приоритизированному списку из плана сверху вниз.
2. Для каждого пункта:
   - Если новый тест — добавь его в указанный или подходящий существующий $(FEATURE)/*.spec.ts. При необходимости создай новый файл.
   - Если расширение — найди тест, добавь шаги/assertion'ы.
   - Если правка Test-only — поправь конкретный тест (изменения в .spec.ts разрешены).
   - Для Page Object изменений — обнови соответствующий .page.ts (методы + локаторы).
3. Все правки применяй СРАЗУ через Edit/Write — никаких TODO.
4. Соблюдай стиль и архитектуру:
   - Page Object Model (локаторы только в *.page.ts, не в spec.ts)
   - assertion в конце теста, без hard-wait (waitForTimeout/sleep)
   - priority-теги в имени теста ([P0]/[P1]) + @smoke/@regression
   - ссылка на требование в комментарии перед test() (US-XX / BR.X / §N.N)
5. Если пункт плана требует реализации в продакшен-коде (фичи нет) — НЕ пиши тест, пометь как пропущенный с указанием, что это вход для /step7 /step8.
6. ЗАПРЕЩЕНО: трогать продакшен-код в $(PROJECT_DIR)/js/, $(PROJECT_DIR)/index.html и т.д.; запускать тесты; коммитить.

После прохода сохрани отчёт в $(COVERAGE_APPLIED_MD) со структурой:

# Применение плана покрытия — $(FEATURE)

## Краткий итог
- Всего пунктов в плане: N
- Применено: X (новых: A, расширено: B, поправлено Test-only: C)
- Пропущено: Y (с причинами — обычно нет реализации в коде)

## ✅ Применённые правки
Для каждого:
### `<spec_file>` / `<test_name>` — короткое описание
- **Тип:** новый / расширение / правка
- **Покрывает:** US-XX / BR.X
- **Что сделал:** 1-2 предложения.
- **Page Object изменения:** если были.

## ⏭ Пропущенные пункты
Для каждого:
### `<id из плана>` — описание
- **Причина:** обычно "нет реализации в продакшен-коде".
- **Что нужно для разблокировки:** ссылка на план дореализации (step7).

## 🧪 Следующий шаг
1. Прогон: `make step4` (только фича) → `make step5` (отчёт).
2. Если новые тесты красные и причина — отсутствие фичи в коде → `make step7` → `make step8`.
3. Финальная трассировка: `make step9`.

Сохрани отчёт в файл: $(COVERAGE_APPLIED_MD)
endef
export COVERAGE_APPLY_PROMPT

step11 coverage-apply:
	@echo "=== Шаг 11: применение плана улучшения покрытия (feature: $(FEATURE), model: $(E2E_MODEL)) ==="
	@test -f $(COVERAGE_PLAN_MD) || { echo "Нет $(COVERAGE_PLAN_MD). Сначала сделай 'make step10'."; exit 1; }
	@command -v claude >/dev/null 2>&1 || { echo "Claude CLI не найден в PATH."; exit 1; }
	claude -p --dangerously-skip-permissions --model $(E2E_MODEL) "$$COVERAGE_APPLY_PROMPT" < /dev/null
	@echo ""
	@echo "Готово:"
	@echo "  Отчёт применения: $(COVERAGE_APPLIED_MD)"
	@echo "  Проверь: make step4 → make step5"

all: step1 step2 step3
	@echo ""
	@echo "=== Полный пайплайн завершён ==="
