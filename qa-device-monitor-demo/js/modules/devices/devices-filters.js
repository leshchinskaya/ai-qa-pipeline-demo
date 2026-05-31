/**
 * Devices Filters Module
 * Панель фильтров, поиск, персистентность фильтров, применение фильтров
 *
 * Этот файл расширяет объект Devices методами управления фильтрами.
 * Должен загружаться ПОСЛЕ devices-catalog.js.
 */
Object.assign(Devices, {
    /**
     * Настройка поиска
     */
    setupSearch() {
        SearchUtils.setup({
            inputId:    'devices-search',
            wrapperId:  'devices-search-wrapper',
            clearBtnId: 'devices-search-clear',
            debounceMs: 100,
            onSearch: (query) => {
                this.searchQuery = query;
                this.requestSortedMainDevicesRender();
            },
            onClear: () => {
                this.searchQuery = '';
                this.requestSortedMainDevicesRender();
            }
        });
    },

    /**
     * Очистка поиска
     */
    clearSearch() {
        SearchUtils.clear('devices-search', 'devices-search-wrapper');
        this.searchQuery = '';
        this.requestSortedMainDevicesRender();
    },

    /**
     * Настройка поиска в админ-панели устройств
     */
    setupAdminDevicesSearch() {
        SearchUtils.setup({
            inputId:    'admin-devices-search',
            wrapperId:  'admin-devices-search-wrapper',
            clearBtnId: 'admin-devices-search-clear',
            debounceMs: 150,
            onSearch: (query) => {
                this.adminDevicesSearchQuery = query;
                this.renderAdminDevices();
            },
            onClear: () => {
                this.adminDevicesSearchQuery = '';
                this.renderAdminDevices();
            }
        });
    },

    /**
     * Очистка поиска в админ-панели устройств
     */
    clearAdminDevicesSearch() {
        SearchUtils.clear('admin-devices-search', 'admin-devices-search-wrapper');
        this.adminDevicesSearchQuery = '';
        this.renderAdminDevices();
    },

    /**
     * Настройка кнопок фильтрации
     */
    setupFilterButtons() {
        // Кнопка "Мои" для быстрого доступа
        const myDevicesBtn = document.getElementById('my-devices-btn');
        if (myDevicesBtn) {
            myDevicesBtn.addEventListener('click', () => {
                // Переключаем фильтр "Мои"
                if (this.currentFilter === 'my') {
                    this.currentFilter = 'all';
                    myDevicesBtn.classList.remove('active');
                } else {
                    this.currentFilter = 'my';
                    myDevicesBtn.classList.add('active');
                }
                // Синхронизируем с панелью фильтров
                const statusRadio = document.querySelector(`input[name="filter-status"][value="${this.currentFilter}"]`);
                if (statusRadio) statusRadio.checked = true;

                this.saveFiltersToStorage();
                this.updateFiltersBadge();
                this.updateMyDevicesBtn();
                this.requestSortedMainDevicesRender();
            });
        }

        const returnAllBtn = document.getElementById('return-all-devices-btn');
        if (returnAllBtn) {
            returnAllBtn.addEventListener('click', () => {
                this.returnAllMyDevices();
            });
        }

        // Панель расширенных фильтров
        this.setupFiltersPanel();
        this.updateReturnAllBtn();
    },

    /**
     * Обновление состояния кнопки "Мои"
     */
    updateMyDevicesBtn() {
        const myDevicesBtn = document.getElementById('my-devices-btn');
        const overdueIndicator = document.getElementById('my-devices-overdue-indicator');
        const hasOverdueMyDevices = this.getMyOverdueDevices().length > 0;

        if (myDevicesBtn) {
            if (this.currentFilter === 'my') {
                myDevicesBtn.classList.add('active');
            } else {
                myDevicesBtn.classList.remove('active');
            }
            myDevicesBtn.classList.toggle('has-overdue', hasOverdueMyDevices);
        }

        if (overdueIndicator) {
            overdueIndicator.classList.toggle('hidden', !hasOverdueMyDevices);
        }

        this.updateReturnAllBtn();
    },

    /**
     * Настройка панели расширенных фильтров
     */
    setupFiltersPanel() {
        const toggleBtn = document.getElementById('toggle-filters-btn');
        const panel = document.getElementById('filters-panel');
        const resetBtn = document.getElementById('filters-reset');

        if (!toggleBtn || !panel) return;

        // Загружаем сохранённые фильтры
        this.loadFiltersFromStorage();

        // Открытие/закрытие панели
        toggleBtn.addEventListener('click', (e) => {
            // Обновляем видимость секции "Состояние" при каждом открытии
            this.updateWorkingSectionVisibility();
            e.stopPropagation();
            panel.classList.toggle('hidden');
        });

        // Закрытие при клике вне панели
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filters-dropdown-wrapper')) {
                panel.classList.add('hidden');
            }
        });

        // Фильтр по статусу
        const statusRadios = document.querySelectorAll('input[name="filter-status"]');
        statusRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                if (this.currentFilter === 'unused_by_me') {
                    this.loadUserUsedDevices();
                }
                this.saveFiltersToStorage();
                this.updateFiltersBadge();
                this.updateMyDevicesBtn();
                this.requestSortedMainDevicesRender();
            });
        });

        // Фильтр по типу устройства (чек-боксы)
        const typeCheckboxes = document.querySelectorAll('input[name="filter-type"]');
        typeCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.filterTypes = Array.from(document.querySelectorAll('input[name="filter-type"]:checked'))
                    .map(cb => cb.value);
                this.saveFiltersToStorage();
                this.updateFiltersBadge();
                this.requestSortedMainDevicesRender();
            });
        });

        // Фильтр по ОС (чек-боксы)
        const osCheckboxes = document.querySelectorAll('input[name="filter-os"]');
        osCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.filterOsList = Array.from(document.querySelectorAll('input[name="filter-os"]:checked'))
                    .map(cb => cb.value);
                this.saveFiltersToStorage();
                this.updateFiltersBadge();
                this.requestSortedMainDevicesRender();
            });
        });

        // Фильтр по состоянию (рабочие/нерабочие/все)
        const workingRadios = document.querySelectorAll('input[name="filter-working"]');
        workingRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.filterWorking = e.target.value;
                this.saveFiltersToStorage();
                this.updateFiltersBadge();
                this.requestSortedMainDevicesRender();
            });
        });

        // Сброс фильтров
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetFilters();
            });
        }
    },

    /**
     * Сохранение фильтров в localStorage
     */
    saveFiltersToStorage() {
        const filters = {
            status: this.currentFilter,
            types: this.filterTypes,
            osList: this.filterOsList,
            working: this.filterWorking
        };
        localStorage.setItem('deviceFilters', JSON.stringify(filters));
    },

    /**
     * Загрузка фильтров из localStorage
     */
    loadFiltersFromStorage() {
        try {
            const saved = localStorage.getItem('deviceFilters');
            if (saved) {
                const filters = JSON.parse(saved);
                const availableStatusFilters = ['all', 'available', 'booked', 'my', 'unused_by_me', 'external'];
                this.currentFilter = availableStatusFilters.includes(filters.status) ? filters.status : 'all';
                this.filterTypes = filters.types || ['phone', 'tablet'];
                this.filterOsList = filters.osList || ['android', 'ios', 'ipados'];
                this.filterWorking = filters.working || 'working';

                // Обновляем UI
                this.applyFiltersToUI();
            }
        } catch (e) {
            console.warn('Не удалось загрузить сохранённые фильтры:', e);
        }
    },

    /**
     * Применение фильтров к UI элементам
     */
    applyFiltersToUI() {
        // Статус
        const statusRadio = document.querySelector(`input[name="filter-status"][value="${this.currentFilter}"]`);
        if (statusRadio) statusRadio.checked = true;

        // Типы (чек-боксы)
        document.querySelectorAll('input[name="filter-type"]').forEach(cb => {
            cb.checked = this.filterTypes.includes(cb.value);
        });

        // ОС (чек-боксы)
        document.querySelectorAll('input[name="filter-os"]').forEach(cb => {
            cb.checked = this.filterOsList.includes(cb.value);
        });

        // Состояние
        const workingRadio = document.querySelector(`input[name="filter-working"][value="${this.filterWorking}"]`);
        if (workingRadio) workingRadio.checked = true;

        // Обновляем бейдж и кнопку "Мои"
        this.updateFiltersBadge();
        this.updateMyDevicesBtn();
    },

    /**
     * Обновление бейджа с количеством активных фильтров
     */
    updateFiltersBadge() {
        const badge = document.getElementById('filters-badge');
        if (!badge) return;

        let activeCount = 0;
        // Статус не "все"
        if (this.currentFilter !== 'all') activeCount++;
        // Не все типы выбраны
        if (this.filterTypes.length < 2) activeCount++;
        // Не все ОС выбраны
        if (this.filterOsList.length < 3) activeCount++;
        // Состояние не "только рабочие" (только для админов)
        if (Auth.isAdmin && this.filterWorking !== 'working') activeCount++;

        if (activeCount > 0) {
            badge.textContent = activeCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    },

    /**
     * Сброс всех расширенных фильтров
     */
    resetFilters() {
        this.currentFilter = 'all';
        this.filterTypes = ['phone', 'tablet'];
        this.filterOsList = ['android', 'ios', 'ipados'];
        this.filterWorking = 'working';

        // Сбросить UI
        const statusAll = document.querySelector('input[name="filter-status"][value="all"]');
        if (statusAll) statusAll.checked = true;

        // Все типы
        document.querySelectorAll('input[name="filter-type"]').forEach(cb => cb.checked = true);

        // Все ОС
        document.querySelectorAll('input[name="filter-os"]').forEach(cb => cb.checked = true);

        // Состояние = только рабочие
        const workingRadio = document.querySelector('input[name="filter-working"][value="working"]');
        if (workingRadio) workingRadio.checked = true;

        this.saveFiltersToStorage();
        this.updateFiltersBadge();
        this.requestSortedMainDevicesRender();
    },

    /**
     * Получить отфильтрованные устройства
     */
    getFilteredDevices(options = {}) {
        const { preserveStableOrder = true } = options;
        const user = Auth.getUser();
        let filtered = this.devices;

        // Фильтр по состоянию (рабочие/нерабочие/все)
        // Для обычных пользователей всегда скрываем нерабочие
        if (!Auth.isAdmin) {
            filtered = filtered.filter(d => d.isWorking !== false);
        } else {
            switch (this.filterWorking) {
                case 'working':
                    filtered = filtered.filter(d => d.isWorking !== false);
                    break;
                case 'broken':
                    filtered = filtered.filter(d => d.isWorking === false);
                    break;
                // 'all' - показываем всё
            }
        }

        // Фильтр по типу устройства (множественный выбор)
        if (this.filterTypes.length > 0 && this.filterTypes.length < 2) {
            filtered = filtered.filter(d => this.filterTypes.includes(d.type));
        } else if (this.filterTypes.length === 0) {
            filtered = []; // Ничего не выбрано - пустой результат
        }

        // Фильтр по ОС (множественный выбор)
        if (this.filterOsList.length > 0 && this.filterOsList.length < 3) {
            filtered = filtered.filter(d => this.filterOsList.includes(d.os));
        } else if (this.filterOsList.length === 0) {
            filtered = []; // Ничего не выбрано - пустой результат
        }

        // Фильтр по статусу
        switch (this.currentFilter) {
            case 'available':
                filtered = filtered.filter(d => d.status === DEVICE_STATUS.AVAILABLE);
                break;
            case 'booked':
                filtered = filtered.filter(d => d.status === DEVICE_STATUS.BOOKED);
                break;
            case 'external':
                filtered = filtered.filter(d => d.status === DEVICE_STATUS.EXTERNAL);
                break;
            case 'my':
                filtered = filtered.filter(d => this.isDeviceOwnedByUser(d, user));
                break;
            case 'unused_by_me': {
                if (!this.usedDeviceIdsReady) {
                    if (!this.usedDeviceIdsLoading) {
                        this.loadUserUsedDevices();
                    }
                    return [];
                }

                const usedDeviceIds = new Set(this.usedDeviceIdsByCurrentUser);

                // Текущее использование также считаем "уже использованными" устройствами.
                this.devices.forEach(device => {
                    if (this.isDeviceOwnedByUser(device, user)) {
                        usedDeviceIds.add(device.id);
                    }
                });

                filtered = filtered.filter(d => !usedDeviceIds.has(d.id));
                break;
            }
        }

        // Умный поиск
        if (this.searchQuery) {
            filtered = filtered.filter(d => this.matchesSearch(d, this.searchQuery));
        }

        const sortedDevices = this.sortMainDeviceCards(filtered);
        return preserveStableOrder ? this.applyStableMainListOrder(sortedDevices) : sortedDevices;
    }
});

console.log('Devices filters module loaded');
