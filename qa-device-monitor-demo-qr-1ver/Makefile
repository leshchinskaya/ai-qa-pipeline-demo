.PHONY: run clean help

# Default port
PORT := 8080

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help: ## Показать справку по доступным командам
	@echo "$(GREEN)Доступные команды:$(NC)"
	@echo ""
	@echo "  $(YELLOW)make run$(NC)   - Запустить демо-стенд на порту $(PORT)"
	@echo "  $(YELLOW)make clean$(NC) - Очистить порт $(PORT) (убить процесс, если занят)"
	@echo "  $(YELLOW)make help$(NC)  - Показать эту справку"
	@echo ""

clean: ## Очистить порт 8080
	@echo "$(YELLOW)Очистка порта $(PORT)...$(NC)"
	@-lsof -ti:$(PORT) | xargs kill -9 2>/dev/null || true
	@echo "$(GREEN)Порт $(PORT) очищен$(NC)"

check-python: ## Проверить наличие Python 3
	@echo "$(YELLOW)Проверка Python...$(NC)"
	@which python3 >/dev/null 2>&1 && echo "$(GREEN)Python 3 найден$(NC)" || \
	(which python >/dev/null 2>&1 && echo "$(GREEN)Python найден$(NC)" || \
	(echo "$(YELLOW)Ошибка: Python 3 не найден. Установите Python 3 для продолжения.$(NC)" && exit 1))

run: clean check-python ## Запустить демо-стенд (с авто-открытием браузера)
	@echo ""
	@echo "$(GREEN)Запуск демо-стенда на порту $(PORT)...$(NC)"
	@echo "$(GREEN)Приложение: http://localhost:$(PORT)$(NC)"
	@echo "$(YELLOW)Для остановки нажмите Ctrl+C$(NC)"
	@echo ""
	@( sleep 1; (command -v open >/dev/null 2>&1 && open http://localhost:$(PORT)) || \
	   (command -v xdg-open >/dev/null 2>&1 && xdg-open http://localhost:$(PORT)) || true ) &
	@if command -v python3 >/dev/null 2>&1; then \
		python3 -m http.server $(PORT); \
	else \
		python -m http.server $(PORT); \
	fi
