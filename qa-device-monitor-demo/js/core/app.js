/**
 * QA Device Monitor - Main Application
 * Главный модуль приложения
 */

const LibraryLoader = {
    scriptPromises: {},

    getAppVersion() {
        return typeof APP_VERSION !== 'undefined' ? APP_VERSION : '1.25.1';
    },

    loadScript(src, isAlreadyLoaded) {
        if (typeof isAlreadyLoaded === 'function' && isAlreadyLoaded()) {
            return Promise.resolve();
        }

        if (this.scriptPromises[src]) {
            return this.scriptPromises[src];
        }

        this.scriptPromises[src] = new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.defer = true;
            script.dataset.dynamicSrc = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });

        return this.scriptPromises[src];
    },

    ensureUsersModule() {
        return this.loadScript(
            `js/modules/users.js?v=${this.getAppVersion()}`,
            () => typeof Users !== 'undefined'
        );
    }
};

window.LibraryLoader = LibraryLoader;

const SearchClear = {
    initialized: false,
    selector: [
        'input[type="search"]',
        'input[type="text"][id*="search"]',
        'input[type="text"][placeholder*="Поиск"]',
        'input[type="text"][placeholder*="поиск"]'
    ].join(', '),
    excludedIds: new Set([
        'chat-search-input'
    ]),

    init(root = document) {
        this.attachToRoot(root);
        this.initialized = true;
    },

    attachToRoot(root = document) {
        const inputs = root.querySelectorAll(this.selector);
        inputs.forEach((input) => this.attachToInput(input));
    },

    attachToInput(input) {
        if (!input || input.dataset.clearableSearchInitialized === 'true') return;
        if (this.excludedIds.has(input.id)) return;
        if (input.disabled || input.readOnly) return;

        const wrapper = input.closest('.search-wrapper');
        if (wrapper?.querySelector('.search-clear')) {
            return;
        }

        const host = wrapper || input.parentElement;
        if (!host) return;

        host.classList.add('search-clear-host');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = wrapper ? 'search-clear' : 'search-clear search-clear-inline';
        button.title = 'Очистить';
        button.setAttribute('aria-label', 'Очистить поиск');
        button.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;

        input.classList.add('search-clearable-input');
        host.appendChild(button);

        const update = () => {
            const hasValue = input.value.trim().length > 0;
            host.classList.toggle('has-value', hasValue);
            button.disabled = !hasValue;
        };

        input.addEventListener('input', update);
        input.addEventListener('change', update);
        button.addEventListener('click', () => {
            if (!input.value) return;
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            update();
            input.focus();
        });

        input.dataset.clearableSearchInitialized = 'true';
        update();
    },

    sync(input) {
        if (!input) return;
        const host = input.closest('.search-wrapper') || input.parentElement;
        if (!host) return;
        const hasValue = input.value.trim().length > 0;
        host.classList.toggle('has-value', hasValue);
        const clearButton = host.querySelector('.search-clear');
        if (clearButton) {
            clearButton.disabled = !hasValue;
        }
    }
};

window.SearchClear = SearchClear;

const App = {
    currentTab: 'devices',
    historyUnsubscribe: null,
    bookings: [],
    historyActionFilter: 'all',
    pendingRoute: null, // Маршрут, на который нужно перейти после авторизации
    
    // Пагинация истории
    historyPageSize: 50,
    historyCurrentPage: 1,
    historyTotalPages: 1,
    allBookings: [],             // Все записи истории
    historyDefaultDays: 30,      // Базовый период первой загрузки истории
    historyBatchSize: 200,       // Размер пачки при догрузке
    historyOldestLoadedDate: null,
    historyHasOlderRecords: false,
    historyIsLoading: false,
    historyIsLoadingOlder: false,
    historyUiInitialized: false,
    
    // Табы истории
    historyActiveTab: 'timeline', // 'timeline' или 'occupied'
    historyDeviceFilterId: null,
    
    // Режим автоопределения устройства
    detectedDeviceMode: false,
    currentDetectedDevice: null,
    // Режим выбора устройства (когда несколько устройств подходят)
    deviceSelectionMode: false,
    selectionMatchedIds: [],
    selectionOtherIds: [],
    activityModuleInitialized: false,
    statisticsModuleInitialized: false,
    calendarModuleInitialized: false,
    importModuleInitialized: false,
    exportModuleInitialized: false,
    usersModuleInitialized: false,

    // Допустимые маршруты
    validRoutes: ['devices', 'history', 'activity', 'calendar', 'chat', 'admin'],

    /**
     * Инициализация приложения
     */
    init() {
        console.log('Initializing QA Device Monitor...');
        SearchClear.init();
        
        // Инициализация модулей
        Toast.init();
        Auth.init();
        if (typeof Activity !== 'undefined') {
            Activity.init();
            this.activityModuleInitialized = true;
        }
        if (typeof Statistics !== 'undefined') {
            Statistics.init();
            this.statisticsModuleInitialized = true;
        }
        if (typeof Calendar !== 'undefined') {
            Calendar.init();
            this.calendarModuleInitialized = true;
        }
        if (typeof FeatureFlags !== 'undefined') {
            FeatureFlags.init();
            // Подписываемся на изменения флагов для инициализации чата
            FeatureFlags.onFlagsChange((flags) => {
                if (flags.chat && typeof Chat !== 'undefined' && !Chat.initialized) {
                    Chat.init();
                }
            });
        }
        if (typeof Export !== 'undefined') {
            Export.init();
            this.exportModuleInitialized = true;
        }
        if (typeof Projects !== 'undefined') {
            Projects.init();
        }
        
        // Настройка навигации
        this.setupNavigation();
        
        // Настройка роутинга
        this.setupRouter();
        
        // Настройка автоопределения устройства
        this.setupDeviceDetection();
        
        console.log('App initialized');
    },
    
    /**
     * Настройка автоопределения устройства
     */
    setupDeviceDetection() {
        // Кнопки "Все устройства" для возврата к обычному режиму
        const showAllBtn1 = document.getElementById('show-all-devices-btn');
        const showAllBtn2 = document.getElementById('show-all-devices-btn-2');
        
        showAllBtn1?.addEventListener('click', () => this.exitDetectedDeviceMode());
        showAllBtn2?.addEventListener('click', () => this.exitDetectedDeviceMode());
    },
    
    /**
     * Запуск автоопределения устройства после загрузки данных
     */
    async runDeviceDetection() {
        // Проверяем, включена ли фича автоопределения
        if (typeof FeatureFlags !== 'undefined' && !FeatureFlags.isEnabled('deviceDetection')) {
            console.log('Device detection skipped: feature disabled');
            return;
        }

        // Проверяем, открыто ли с мобильного
        if (typeof DeviceDetector === 'undefined' || !DeviceDetector.isMobile()) {
            console.log('Device detection skipped: not a mobile device');
            return;
        }
        
        // Получаем устройства отсортированные по релевантности
        const { matched, other } = DeviceDetector.getDevicesByRelevance(Devices.devices);
        
        if (matched.length === 0 && other.length === 0) {
            console.log('Device detection: no devices found for this OS');
            return;
        }
        
        if (matched.length === 1 && other.length === 0) {
            // Точно одно совпадение - показываем карточку устройства
            this.showDetectedDevice(matched[0]);
        } else {
            // Несколько совпадений или есть другие устройства - показываем список
            this.showDeviceSelection(matched, other);
        }
    },
    
    /**
     * Показать карточку определённого устройства
     * @param {Object} device - устройство для отображения
     */
    showDetectedDevice(device) {
        this.detectedDeviceMode = true;
        this.currentDetectedDevice = device;
        // Сбрасываем режим выбора
        this.deviceSelectionMode = false;
        this.selectionMatchedIds = [];
        this.selectionOtherIds = [];
        
        // Скрываем все секции
        document.querySelectorAll('.tab-content').forEach(section => {
            section.classList.remove('active');
        });
        
        // Показываем секцию карточки устройства
        const section = document.getElementById('detected-device-section');
        if (section) {
            section.classList.add('active');
        }
        
        // Обновляем заголовок
        const title = document.getElementById('detected-device-title');
        if (title) {
            title.textContent = 'Ваше устройство';
        }
        
        // Рендерим карточку
        Devices.renderSingleDevice(device);
        
        // Скрываем навигацию для упрощённого режима (опционально)
        // document.querySelector('.nav-tabs')?.classList.add('hidden');
    },
    
    /**
     * Показать список устройств для выбора
     * @param {Array} matchedDevices - похожие устройства
     * @param {Array} otherDevices - остальные устройства той же ОС
     */
    showDeviceSelection(matchedDevices, otherDevices = []) {
        this.detectedDeviceMode = true;
        this.currentDetectedDevice = null;
        // Включаем режим выбора и сохраняем ID устройств для обновления
        this.deviceSelectionMode = true;
        this.selectionMatchedIds = matchedDevices.map(d => d.id);
        this.selectionOtherIds = otherDevices.map(d => d.id);
        
        // Скрываем все секции
        document.querySelectorAll('.tab-content').forEach(section => {
            section.classList.remove('active');
        });
        
        // Показываем секцию выбора устройства
        const section = document.getElementById('device-selection-section');
        if (section) {
            section.classList.add('active');
        }
        
        // Рендерим список устройств с разделением на похожие и остальные
        Devices.renderDeviceSelection(matchedDevices, otherDevices);
    },
    
    /**
     * Выход из режима автоопределения - показать все устройства
     */
    exitDetectedDeviceMode() {
        this.detectedDeviceMode = false;
        this.currentDetectedDevice = null;
        this.deviceSelectionMode = false;
        this.selectionMatchedIds = [];
        this.selectionOtherIds = [];
        
        // Переключаемся на обычную вкладку устройств
        this.switchTab('devices');
    },
    
    /**
     * Обновить карточку определённого устройства (после действий)
     */
    refreshDetectedDevice() {
        if (!this.detectedDeviceMode) return;
        
        // Режим выбора устройства - обновляем список
        if (this.deviceSelectionMode) {
            // Получаем актуальные данные устройств по сохранённым ID
            const matchedDevices = this.selectionMatchedIds
                .map(id => Devices.devices.find(d => d.id === id))
                .filter(Boolean);
            const otherDevices = this.selectionOtherIds
                .map(id => Devices.devices.find(d => d.id === id))
                .filter(Boolean);
            
            // Перерисовываем список
            Devices.renderDeviceSelection(matchedDevices, otherDevices);
            return;
        }
        
        // Режим одного устройства
        if (!this.currentDetectedDevice) return;
        
        // Находим актуальные данные устройства
        const updatedDevice = Devices.devices.find(d => d.id === this.currentDetectedDevice.id);
        if (updatedDevice) {
            this.currentDetectedDevice = updatedDevice;
            Devices.renderSingleDevice(updatedDevice);
        }
    },

    /**
     * Настройка роутера (History API)
     */
    setupRouter() {
        // Обрабатываем начальный маршрут
        this.handleRoute();
        
        // Слушаем изменения истории браузера (кнопки назад/вперёд)
        window.addEventListener('popstate', () => {
            this.handleRoute();
        });
    },

    /**
     * Обработка текущего маршрута
     */
    handleRoute() {
        // Получаем путь из URL (убираем начальный слэш)
        let path = window.location.pathname.slice(1);
        
        // Если путь пустой или index.html, используем devices
        if (!path || path === 'index.html') {
            path = 'devices';
        }
        
        // Проверяем валидность маршрута
        const route = this.validRoutes.includes(path) ? path : 'devices';
        
        // Если пользователь авторизован — переключаем вкладку
        if (Auth.isAuthenticated()) {
            this.switchTab(route, false); // false = не обновлять URL (уже правильный)
        } else {
            // Запоминаем маршрут для перехода после авторизации
            this.pendingRoute = route;
        }
    },

    /**
     * Навигация на указанный маршрут
     */
    navigateTo(route) {
        if (!this.validRoutes.includes(route)) {
            route = 'devices';
        }
        
        // Обновляем URL
        const newUrl = '/' + route;
        if (window.location.pathname !== newUrl) {
            window.history.pushState({ route }, '', newUrl);
        }
        
        // Переключаем вкладку
        this.switchTab(route, false);
    },

    /**
     * Настройка навигации по вкладкам
     */
    setupNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = tab.dataset.tab;
                this.navigateTo(tabName);
            });
        });
    },

    async ensureUsersReady() {
        if (typeof Users !== 'undefined' && this.usersModuleInitialized) {
            return true;
        }

        try {
            await LibraryLoader.ensureUsersModule();
            if (typeof Users === 'undefined') return false;
            if (typeof Users.init === 'function') {
                Users.init();
            }
            this.usersModuleInitialized = true;
            return true;
        } catch (error) {
            console.error('App: failed to load users module', error);
            return false;
        }
    },

    /**
     * Переключение вкладок
     * @param {string} tabName - имя вкладки
     * @param {boolean} updateUrl - обновлять ли URL (по умолчанию true)
     */
    switchTab(tabName, updateUrl = true) {
        // Проверка прав для админ-вкладки
        if (tabName === 'admin' && !Auth.isAdmin) {
            Toast.show('Недостаточно прав для доступа к админ-панели', 'warning');
            // Перенаправляем на devices
            this.navigateTo('devices');
            return;
        }

        this.currentTab = tabName;

        // Обновляем URL если нужно
        if (updateUrl) {
            const newUrl = '/' + tabName;
            if (window.location.protocol !== 'file:' && window.location.pathname !== newUrl) {
                try {
                    window.history.pushState({ route: tabName }, '', newUrl);
                } catch (error) {
                    console.warn('App: failed to update URL via pushState', error);
                }
            }
        }

        // Обновляем активную вкладку в навигации
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Показываем соответствующий контент
        document.querySelectorAll('.tab-content').forEach(section => {
            section.classList.toggle('active', section.id === `${tabName}-section`);
        });

        // Загружаем данные при переключении на историю
        if (tabName === 'history') {
            this.ensureHistoryUiReady();
            this.loadHistory();
            // Если активен таб "Занятые устройства", загружаем их
            if (this.historyActiveTab === 'occupied') {
                this.loadOccupiedDevices();
            }
        }

        // Календарь отключён в демо-сборке
        if (tabName === 'calendar') {
            Toast.show('Функция календаря отключена', 'warning');
            this.switchTab('devices');
            return;
        }

        // Чат отключён в демо-сборке
        if (tabName === 'chat') {
            Toast.show('Функция чата отключена', 'warning');
            this.switchTab('devices');
            return;
        }

        if (tabName === 'admin') {
            this.ensureUsersReady().then((ready) => {
                if (!ready) {
                    Toast.show('Модуль пользователей не загружен', 'error');
                }
            });
            if (typeof Projects !== 'undefined' && typeof Projects.renderAdminProjects === 'function') {
                Projects.renderAdminProjects();
            }
            if (typeof Devices !== 'undefined' && typeof Devices.ensureAdminUiReady === 'function') {
                Devices.ensureAdminUiReady();
            }
            if (typeof Devices !== 'undefined' && typeof Devices.renderAdminDevicesWhenVisible === 'function') {
                Devices.renderAdminDevicesWhenVisible();
            }
        }
    },

    refreshCurrentTab() {
        if (!Auth?.isAuthenticated?.()) {
            return;
        }

        if (this.currentTab === 'devices') {
            if (typeof Devices !== 'undefined' && typeof Devices.renderDevices === 'function') {
                Devices.renderDevices();
            }
            return;
        }

        if (this.currentTab === 'history') {
            this.ensureHistoryUiReady();
            if (this.historyActiveTab === 'occupied') {
                this.loadOccupiedDevices();
            } else {
                this.loadHistory();
            }
            return;
        }

        if (this.currentTab === 'admin') {
            const activeAdminTab = document.querySelector('.admin-tab.active')?.dataset.adminTab;

            if (activeAdminTab === 'users' && typeof Users !== 'undefined' && typeof Users.renderUsers === 'function') {
                Users.renderUsers();
                return;
            }

            if (activeAdminTab === 'devices' && typeof Devices !== 'undefined' && typeof Devices.renderAdminDevicesWhenVisible === 'function') {
                Devices.renderAdminDevicesWhenVisible();
                return;
            }

            if (activeAdminTab === 'projects' && typeof Projects !== 'undefined' && typeof Projects.renderAdminProjects === 'function') {
                Projects.renderAdminProjects();
                return;
            }
        }
    },

    openDeviceHistory(deviceId, deviceName = '') {
        if (!deviceId) return;

        this.historyDeviceFilterId = deviceId;
        this.historyCurrentPage = 1;
        this.switchTab('history');

        const searchValue = (deviceName || '').trim();
        const applyHistoryFilter = () => {
            const searchInput = document.getElementById('history-search');
            if (searchInput) {
                searchInput.value = searchValue;
                SearchClear.sync(searchInput);
            }
            this.renderHistory();
            this.updateHistoryPagination();
        };

        applyHistoryFilter();
        setTimeout(applyHistoryFilter, 0);
    },

    ensureHistoryUiReady() {
        if (this.historyUiInitialized) return;
        this.setupHistory();
        this.setupHistoryPagination();
        this.setupHistoryTabs();
        this.historyUiInitialized = true;
    },

    /**
     * Настройка страницы истории
     */
    setupHistory() {
        const searchInput = document.getElementById('history-search');
        const searchWrapper = document.getElementById('history-search-wrapper');
        const loadMoreBtn = document.getElementById('history-load-more-btn');
        
        const applySearch = () => {
            this.historyDeviceFilterId = null;
            this.historyCurrentPage = 1;
            this.renderHistory();
            this.updateHistoryPagination();
        };

        // Поиск с debounce
        let searchTimeout;
        searchInput?.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                applySearch();
            }, 300);
        });
        searchInput?.addEventListener('change', applySearch);
        searchWrapper?.addEventListener('click', (event) => {
            if (!event.target.closest('.search-clear')) return;
            clearTimeout(searchTimeout);
            if (searchInput) {
                searchInput.value = '';
                SearchClear.sync(searchInput);
            }
            applySearch();
        });

        loadMoreBtn?.addEventListener('click', () => {
            this.loadOlderHistory();
        });

        // Dropdown фильтра действий
        this.setupHistoryFilterDropdown();
    },
    
    /**
     * Настройка dropdown фильтра истории
     */
    setupHistoryFilterDropdown() {
        const toggleBtn = document.getElementById('history-filter-btn');
        const panel = document.getElementById('history-filter-panel');
        const label = document.getElementById('history-filter-label');
        
        if (!toggleBtn || !panel) return;
        
        // Открытие/закрытие
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('hidden');
        });
        
        // Закрытие при клике вне
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#history-filter-btn') && !e.target.closest('#history-filter-panel')) {
                panel.classList.add('hidden');
            }
        });
        
        // Выбор действия
        const actionRadios = document.querySelectorAll('input[name="history-action"]');
        actionRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.historyActionFilter = e.target.value;
                // Обновить текст кнопки
                const labels = {
                    'all': 'Все действия',
                    'take': 'Использую',
                    'return': 'Вернул',
                    'book': 'Взято домой',
                    'date_change': 'Изменил дату'
                };
                if (label) label.textContent = labels[e.target.value] || 'Все действия';
                panel.classList.add('hidden');
                // Сбрасываем на первую страницу при смене фильтра
                this.historyCurrentPage = 1;
                this.renderHistory();
                this.updateHistoryPagination();
            });
        });
    },

    getHistoryInitialCutoffDate() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.historyDefaultDays);
        return cutoffDate;
    },

    async checkHasOlderHistory(beforeDate) {
        if (!beforeDate) return false;

        const olderSnapshot = await db.collection(COLLECTIONS.BOOKINGS)
            .where('createdAt', '<', beforeDate)
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        return olderSnapshot.size > 0;
    },

    /**
     * Загрузка истории бронирований (по умолчанию последние 30 дней)
     */
    async loadHistory() {
        // Отписываемся от предыдущего listener если есть
        if (this.historyUnsubscribe) {
            this.historyUnsubscribe();
            this.historyUnsubscribe = null;
        }

        this.historyIsLoading = true;
        this.historyCurrentPage = 1;
        this.allBookings = [];
        this.bookings = [];
        this.historyOldestLoadedDate = null;
        this.historyHasOlderRecords = false;
        this.renderHistory();
        this.updateHistoryLoadMoreState();

        try {
            const cutoffDate = this.getHistoryInitialCutoffDate();
            const snapshot = await db.collection(COLLECTIONS.BOOKINGS)
                .where('createdAt', '>=', cutoffDate)
                .orderBy('createdAt', 'desc')
                .limit(this.historyBatchSize)
                .get();

            this.allBookings = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (this.allBookings.length > 0) {
                const oldestBooking = this.allBookings[this.allBookings.length - 1];
                this.historyOldestLoadedDate = oldestBooking.createdAt?.toDate?.() || null;
                this.historyHasOlderRecords = await this.checkHasOlderHistory(this.historyOldestLoadedDate || cutoffDate);
            } else {
                this.historyHasOlderRecords = await this.checkHasOlderHistory(cutoffDate);
            }
        } catch (error) {
            console.error('Error loading history:', error);
            this.allBookings = [];
            this.bookings = [];
            this.historyHasOlderRecords = false;
            Toast.show('Ошибка загрузки истории', 'error');
        } finally {
            this.historyIsLoading = false;
            this.renderHistory();
            this.updateHistoryPagination();
            this.updateHistoryLoadMoreState();
        }
    },

    /**
     * Догрузка более ранних записей истории
     */
    async loadOlderHistory() {
        if (this.historyIsLoading || this.historyIsLoadingOlder || !this.historyHasOlderRecords) {
            return;
        }

        this.historyIsLoadingOlder = true;
        this.updateHistoryLoadMoreState();

        try {
            const cursorDate = this.historyOldestLoadedDate || this.getHistoryInitialCutoffDate();
            const snapshot = await db.collection(COLLECTIONS.BOOKINGS)
                .where('createdAt', '<', cursorDate)
                .orderBy('createdAt', 'desc')
                .limit(this.historyBatchSize)
                .get();

            const olderBookings = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            if (olderBookings.length === 0) {
                this.historyHasOlderRecords = false;
                return;
            }

            const existingIds = new Set(this.allBookings.map(booking => booking.id));
            const uniqueOlderBookings = olderBookings.filter(booking => !existingIds.has(booking.id));

            if (uniqueOlderBookings.length > 0) {
                this.allBookings = [...this.allBookings, ...uniqueOlderBookings];
            }

            const oldestBooking = olderBookings[olderBookings.length - 1];
            this.historyOldestLoadedDate = oldestBooking.createdAt?.toDate?.() || this.historyOldestLoadedDate;
            this.historyHasOlderRecords = await this.checkHasOlderHistory(this.historyOldestLoadedDate);

            this.renderHistory();
            this.updateHistoryPagination();
        } catch (error) {
            console.error('Error loading older history:', error);
            Toast.show('Ошибка догрузки истории', 'error');
        } finally {
            this.historyIsLoadingOlder = false;
            this.updateHistoryLoadMoreState();
        }
    },

    updateHistoryLoadMoreState() {
        const wrapper = document.getElementById('history-load-more-wrapper');
        const hint = document.getElementById('history-load-more-hint');
        const button = document.getElementById('history-load-more-btn');

        if (!wrapper || !hint || !button) return;

        if (this.historyIsLoading) {
            wrapper.classList.remove('hidden');
            hint.textContent = 'Загрузка последних записей...';
            button.disabled = true;
            button.textContent = 'Загрузка...';
            return;
        }

        if (!this.historyHasOlderRecords) {
            wrapper.classList.add('hidden');
            return;
        }

        wrapper.classList.remove('hidden');
        button.disabled = this.historyIsLoadingOlder;
        button.textContent = this.historyIsLoadingOlder
            ? 'Загрузка...'
            : 'Загрузить более ранние записи';

        if (this.historyOldestLoadedDate) {
            hint.textContent = `Показаны записи до ${this.formatDate(this.historyOldestLoadedDate)}.`;
        } else {
            hint.textContent = `Показаны записи за последние ${this.historyDefaultDays} дней.`;
        }
    },

    /**
     * Обновить состояние кнопок пагинации
     */
    updateHistoryPagination() {
        const pagination = document.getElementById('history-pagination');
        const prevBtn = document.getElementById('history-prev-btn');
        const nextBtn = document.getElementById('history-next-btn');
        const pageNumbers = document.getElementById('history-page-numbers');

        if (!pagination) return;

        // Вычисляем общее количество страниц (из отфильтрованных записей)
        const totalItems = this.bookings.length || this.allBookings.length;
        this.historyTotalPages = Math.ceil(totalItems / this.historyPageSize);
        
        // Показываем пагинацию только если больше 1 страницы
        if (this.historyTotalPages > 1) {
            pagination.classList.remove('hidden');
        } else {
            pagination.classList.add('hidden');
            return;
        }

        // Обновляем состояние стрелок
        if (prevBtn) {
            prevBtn.disabled = this.historyCurrentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = this.historyCurrentPage >= this.historyTotalPages;
        }

        // Генерируем номера страниц
        if (pageNumbers) {
            pageNumbers.innerHTML = this.generatePageNumbers();
            this.setupPageNumberHandlers();
        }
    },

    /**
     * Генерация HTML для номеров страниц
     */
    generatePageNumbers() {
        const total = this.historyTotalPages;
        const current = this.historyCurrentPage;
        let html = '';

        // Если страниц мало (до 7), показываем все
        if (total <= 7) {
            for (let i = 1; i <= total; i++) {
                html += this.getPageButton(i, current);
            }
        } else {
            // Всегда показываем первую страницу
            html += this.getPageButton(1, current);

            if (current > 3) {
                html += '<span class="pagination-ellipsis">...</span>';
            }

            // Показываем страницы вокруг текущей
            const start = Math.max(2, current - 1);
            const end = Math.min(total - 1, current + 1);

            for (let i = start; i <= end; i++) {
                html += this.getPageButton(i, current);
            }

            if (current < total - 2) {
                html += '<span class="pagination-ellipsis">...</span>';
            }

            // Всегда показываем последнюю страницу
            html += this.getPageButton(total, current);
        }

        return html;
    },

    /**
     * Создать HTML кнопки страницы
     */
    getPageButton(page, current) {
        const isActive = page === current ? ' active' : '';
        return `<button class="pagination-number${isActive}" data-page="${page}">${page}</button>`;
    },

    /**
     * Настройка обработчиков для номеров страниц
     */
    setupPageNumberHandlers() {
        const pageNumbers = document.getElementById('history-page-numbers');
        if (!pageNumbers) return;

        pageNumbers.querySelectorAll('.pagination-number').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                if (page !== this.historyCurrentPage) {
                    this.goToHistoryPage(page);
                }
            });
        });
    },

    /**
     * Перейти на указанную страницу истории
     */
    goToHistoryPage(page) {
        if (page < 1 || page > this.historyTotalPages) return;
        this.historyCurrentPage = page;
        this.renderHistory();
        this.updateHistoryPagination();
    },

    /**
     * Настройка обработчиков пагинации
     */
    setupHistoryPagination() {
        const prevBtn = document.getElementById('history-prev-btn');
        const nextBtn = document.getElementById('history-next-btn');

        prevBtn?.addEventListener('click', () => {
            if (this.historyCurrentPage > 1) {
                this.goToHistoryPage(this.historyCurrentPage - 1);
            }
        });

        nextBtn?.addEventListener('click', () => {
            if (this.historyCurrentPage < this.historyTotalPages) {
                this.goToHistoryPage(this.historyCurrentPage + 1);
            }
        });
    },

    /**
     * Отображение истории
     */
    renderHistory() {
        const tbody = document.getElementById('history-tbody');
        const emptyState = document.getElementById('no-history');
        const searchInput = document.getElementById('history-search');

        if (!tbody) return;

        if (this.historyIsLoading) {
            this.renderHistorySkeleton();
            return;
        }

        const searchQuery = searchInput?.value.toLowerCase() || '';
        const actionFilter = this.historyActionFilter || 'all';

        // Фильтрация по всем записям
        let filteredBookings = this.allBookings.filter(booking => {
            // Точечный фильтр по конкретному устройству из карточки
            if (this.historyDeviceFilterId && booking.deviceId !== this.historyDeviceFilterId) {
                return false;
            }

            // Фильтр по действию
            if (actionFilter !== 'all' && booking.action !== actionFilter) {
                return false;
            }

            // Поиск
            if (searchQuery) {
                const searchFields = [
                    booking.deviceId,
                    booking.deviceName,
                    booking.userName
                ].map(f => (f || '').toLowerCase());
                
                if (!searchFields.some(f => f.includes(searchQuery))) {
                    return false;
                }
            }

            return true;
        });

        // Сохраняем список после фильтрации для пагинации
        this.bookings = filteredBookings;

        if (filteredBookings.length === 0) {
            tbody.innerHTML = '';
            emptyState?.classList.remove('hidden');
            // Скрываем пагинацию если нет результатов
            document.getElementById('history-pagination')?.classList.add('hidden');
            return;
        }

        emptyState?.classList.add('hidden');

        // Применяем пагинацию
        const startIndex = (this.historyCurrentPage - 1) * this.historyPageSize;
        const endIndex = startIndex + this.historyPageSize;
        const pageBookings = filteredBookings.slice(startIndex, endIndex);
        
        // Показываем/скрываем колонку "Действия" для админов
        const actionsHeader = document.getElementById('history-actions-header');
        if (actionsHeader) {
            if (Auth.isAdmin) {
                actionsHeader.classList.remove('hidden');
            } else {
                actionsHeader.classList.add('hidden');
            }
        }

        tbody.innerHTML = pageBookings.map(booking => {
            const createdAt = booking.createdAt?.toDate();
            const dateStr = createdAt ? this.formatDateTime(createdAt) : '—';
            const deviceLabel = this.getHistoryDeviceLabel(booking);
            const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23a0a0b0"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>';
            const userPhoto = this.escapeHtml(booking.userPhoto || defaultAvatar);
            const userName = this.escapeHtml(this.normalizeHistoryUserName(booking.userName));
            const transferredByPhoto = this.escapeHtml(booking.transferredByPhoto || defaultAvatar);
            const transferredByName = this.escapeHtml(this.normalizeHistoryUserName(booking.transferredByName));
            const bookingId = this.escapeHtml(booking.id || '');
            
            let periodStr = '—';
            if (booking.startDate && booking.endDate) {
                const start = booking.startDate.toDate();
                const end = booking.endDate.toDate();
                periodStr = `${this.formatDate(start)} — ${this.formatDate(end)}`;
            } else if (booking.endDate) {
                // Для DATE_CHANGE или когда есть только дата окончания
                const end = booking.endDate.toDate();
                periodStr = `до ${this.formatDate(end)}`;
            } else if (booking.startDate) {
                // Когда есть только дата начала
                const start = booking.startDate.toDate();
                periodStr = `с ${this.formatDate(start)}`;
            }

            const actionBadge = this.getActionBadge(booking.action);
            
            // Иконки для мест
            const officeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
            const homeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
            
            // Определяем место: кабинет для "Использую", адрес для "Взято домой", для date_change - по bookingType
            let locationStr = '—';
            if (booking.action === 'take') {
                const officeText = this.escapeHtml(booking.office || 'В офисе');
                locationStr = `<span style="display: inline-flex; align-items: center; gap: 4px;">${officeIcon}${officeText}</span>`;
            } else if (booking.action === 'book' || booking.action === 'transferred' || booking.action === 'receipt_confirmed') {
                // Для "Забрал домой", "Передано" и "Подтверждено получение" показываем адрес или "Дома"
                const homeText = this.escapeHtml(booking.homeAddress || 'Дома');
                locationStr = `<span style="display: inline-flex; align-items: center; gap: 4px;">${homeIcon}${homeText}</span>`;
            } else if (booking.action === 'date_change') {
                // Для изменения даты определяем по bookingType
                if (booking.bookingType === 'home') {
                    const homeText = this.escapeHtml(booking.homeAddress || 'Дома');
                    locationStr = `<span style="display: inline-flex; align-items: center; gap: 4px;">${homeIcon}${homeText}</span>`;
                } else if (booking.bookingType === 'office') {
                    const officeText = this.escapeHtml(booking.office || 'В офисе');
                    locationStr = `<span style="display: inline-flex; align-items: center; gap: 4px;">${officeIcon}${officeText}</span>`;
                } else if (booking.homeAddress) {
                    // Fallback для старых записей без bookingType
                    locationStr = `<span style="display: inline-flex; align-items: center; gap: 4px;">${homeIcon}${this.escapeHtml(booking.homeAddress)}</span>`;
                } else if (booking.office) {
                    locationStr = `<span style="display: inline-flex; align-items: center; gap: 4px;">${officeIcon}${this.escapeHtml(booking.office)}</span>`;
                }
            }
            
            // Кнопка удаления для админов
            const deleteButton = Auth.isAdmin ? `
                <td>
                    <button class="icon-btn delete-history-btn" data-booking-id="${bookingId}" title="Удалить запись">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </td>
            ` : '';

            // Для действия "Передано" показываем кто передал и кому
            let userDisplay = '';
            const normalizedName = this.normalizeHistoryUserName(booking.userName);
            const hasUser = normalizedName !== 'Неизвестен';
            if (booking.action === BOOKING_ACTIONS.TRANSFERRED && booking.transferredByName) {
                userDisplay = `
                    <div class="booking-user" style="margin: 0;">
                        <img src="${transferredByPhoto}" alt="" style="width: 24px; height: 24px;">
                        <span>${transferredByName} → ${userName}</span>
                    </div>
                `;
            } else if (!hasUser && Auth.isAdmin) {
                userDisplay = `
                    <div class="booking-user history-assign-user" style="margin: 0;">
                        <button class="assign-user-btn" data-booking-id="${bookingId}" title="Назначить пользователя">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="8.5" cy="7" r="4"/>
                                <line x1="20" y1="8" x2="20" y2="14"/>
                                <line x1="23" y1="11" x2="17" y2="11"/>
                            </svg>
                            <span>Назначить</span>
                        </button>
                    </div>
                `;
            } else {
                userDisplay = `
                    <div class="booking-user" style="margin: 0;">
                        <img src="${userPhoto}" alt="" style="width: 24px; height: 24px;">
                        <span>${userName}</span>
                    </div>
                `;
            }

            return `
                <tr>
                    <td>${dateStr}</td>
                    <td>${deviceLabel}</td>
                    <td>${userDisplay}</td>
                    <td>${actionBadge}</td>
                    <td>${locationStr}</td>
                    <td>${periodStr}</td>
                    ${deleteButton}
                </tr>
            `;
        }).join('');
        
        // Добавляем обработчики для кнопок удаления (только для админов)
        if (Auth.isAdmin) {
            tbody.querySelectorAll('.delete-history-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const bookingId = e.currentTarget.dataset.bookingId;
                    if (bookingId && confirm('Вы уверены, что хотите удалить эту запись из истории?')) {
                        await this.deleteHistoryRecord(bookingId);
                    }
                });
            });

            // Обработчики для кнопок назначения пользователя
            tbody.querySelectorAll('.assign-user-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const bookingId = e.currentTarget.dataset.bookingId;
                    if (bookingId) {
                        await this.showAssignUserModal(bookingId);
                    }
                });
            });
        }
    },

    getHistoryDeviceLabel(booking) {
        const rawName = this.escapeHtml(booking?.deviceName || '—');
        const rawOsVersion = booking?.deviceOsVersion;

        let osVersion = rawOsVersion;
        if (!osVersion && typeof Devices !== 'undefined' && typeof Devices.getDeviceById === 'function') {
            osVersion = Devices.getDeviceById(booking?.deviceId)?.osVersion || '';
        }

        const normalizedVersion = this.escapeHtml(String(osVersion || '').trim());
        if (!normalizedVersion) {
            return `<span>${rawName}</span>`;
        }

        return `
            <span class="history-device-label">
                <span class="history-device-name">${rawName}</span>
                <span class="history-os-badge">ОС ${normalizedVersion}</span>
            </span>
        `;
    },

    renderHistorySkeleton(rowCount = 8) {
        const tbody = document.getElementById('history-tbody');
        const emptyState = document.getElementById('no-history');
        const pagination = document.getElementById('history-pagination');
        if (!tbody) return;

        const columnCount = Auth.isAdmin ? 7 : 6;
        const rows = Array.from({ length: rowCount }, () => {
            const cells = Array.from({ length: columnCount }, (_, cellIndex) => {
                const widthClass = cellIndex === 0
                    ? 'skeleton-w-30'
                    : cellIndex === 1
                        ? 'skeleton-w-60'
                        : cellIndex === 2
                            ? 'skeleton-w-80'
                            : 'skeleton-w-50';
                return `<td><span class="table-skeleton-block skeleton-block ${widthClass}"></span></td>`;
            }).join('');

            return `<tr class="table-skeleton-row" aria-hidden="true">${cells}</tr>`;
        }).join('');

        tbody.innerHTML = rows;
        emptyState?.classList.add('hidden');
        pagination?.classList.add('hidden');
    },
    
    /**
     * Удалить запись из истории (только для админов)
     */
    async deleteHistoryRecord(bookingId) {
        if (!Auth.isAdmin) {
            Toast.show('Недостаточно прав', 'error');
            return;
        }
        
        try {
            await db.collection(COLLECTIONS.BOOKINGS).doc(bookingId).delete();
            Toast.show('Запись удалена', 'success');
            // Перезагружаем историю для обновления списка
            await this.loadHistory();
        } catch (error) {
            console.error('Error deleting history record:', error);
            Toast.show('Ошибка удаления: ' + error.message, 'error');
        }
    },

    /**
     * Показать модальное окно назначения пользователя на запись истории
     */
    async showAssignUserModal(bookingId) {
        if (!Auth.isAdmin) return;

        // Загружаем модуль пользователей
        if (typeof Users === 'undefined') {
            Toast.show('Модуль пользователей не загружен', 'error');
            return;
        }

        if (Users.users.length === 0) {
            try {
                await Users.loadUsers();
            } catch {
                Toast.show('Не удалось загрузить список пользователей', 'error');
                return;
            }
        }

        // Удаляем предыдущее модальное окно если есть
        document.querySelector('.assign-user-modal-overlay')?.remove();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay assign-user-modal-overlay';
        modal.innerHTML = `
            <div class="modal-content assign-user-modal-content">
                <div class="modal-header">
                    <h2>Назначить пользователя</h2>
                    <button class="modal-close assign-user-modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Поиск пользователя</label>
                        <input type="text" class="form-input assign-user-search" placeholder="Имя или email...">
                    </div>
                    <div class="assign-user-list"></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => modal.remove();
        modal.querySelector('.assign-user-modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        const searchInput = modal.querySelector('.assign-user-search');
        const listContainer = modal.querySelector('.assign-user-list');

        const renderUsers = (filter = '') => {
            const filterLower = filter.toLowerCase();
            const filtered = Users.users.filter(user => {
                if (!filter) return true;
                const name = (user.displayName || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                return name.includes(filterLower) || email.includes(filterLower);
            });

            if (filtered.length === 0) {
                listContainer.innerHTML = `<div class="assign-user-empty">Ничего не найдено</div>`;
                return;
            }

            listContainer.innerHTML = filtered.map(user => {
                const name = user.displayName || user.email || 'Неизвестно';
                const photo = user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23a0a0b0"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>';
                return `
                    <div class="assign-user-option" data-user-id="${user.id}" data-user-name="${name}" data-user-photo="${user.photoURL || ''}">
                        <img src="${photo}" alt="" class="assign-user-avatar">
                        <div class="assign-user-info">
                            <span class="assign-user-name">${name}</span>
                            ${user.email ? `<span class="assign-user-email">${user.email}</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            listContainer.querySelectorAll('.assign-user-option').forEach(option => {
                option.addEventListener('click', async () => {
                    const userId = option.dataset.userId;
                    const userName = option.dataset.userName;
                    const userPhoto = option.dataset.userPhoto;
                    closeModal();
                    await this.assignUserToBooking(bookingId, userId, userName, userPhoto);
                });
            });
        };

        searchInput.addEventListener('input', (e) => renderUsers(e.target.value));
        renderUsers();
        searchInput.focus();
    },

    /**
     * Назначить пользователя на запись бронирования и обновить устройство
     */
    async assignUserToBooking(bookingId, userId, userName, userPhoto) {
        if (!Auth.isAdmin) {
            Toast.show('Недостаточно прав', 'error');
            return;
        }

        try {
            const bookingUpdateData = {
                userId: userId,
                userName: userName,
            };
            if (userPhoto) {
                bookingUpdateData.userPhoto = userPhoto;
            }

            // Находим запись бронирования для получения deviceId
            const booking = this.allBookings.find(b => b.id === bookingId);
            const deviceId = booking?.deviceId;

            // Обновляем запись в истории
            await db.collection(COLLECTIONS.BOOKINGS).doc(bookingId).update(bookingUpdateData);

            // Обновляем устройство если оно ещё занято и без пользователя
            if (deviceId && typeof Devices !== 'undefined') {
                const device = Devices.getDeviceById(deviceId);
                if (device && device.status === DEVICE_STATUS.BOOKED && !device.currentUserId) {
                    const deviceUpdateData = {
                        currentUserId: userId,
                        currentUserName: userName,
                    };
                    if (userPhoto) {
                        deviceUpdateData.currentUserPhoto = userPhoto;
                    }
                    await db.collection(COLLECTIONS.DEVICES).doc(deviceId).update(deviceUpdateData);

                    // Обновляем локальные данные устройства
                    Devices.applyLocalDevicePatch(deviceId, deviceUpdateData);
                }
            }

            // Обновляем локальные данные бронирования
            if (booking) {
                booking.userId = userId;
                booking.userName = userName;
                if (userPhoto) booking.userPhoto = userPhoto;
            }

            Toast.show(`Пользователь ${userName} назначен`, 'success');
            this.renderHistory();
        } catch (error) {
            console.error('Error assigning user to booking:', error);
            Toast.show('Ошибка назначения: ' + error.message, 'error');
        }
    },

    /**
     * Получить бейдж действия
     */
    getActionBadge(action) {
        const actions = {
            [BOOKING_ACTIONS.TAKE]: { label: 'Использую', class: 'take' },
            [BOOKING_ACTIONS.RETURN]: { label: 'Вернул', class: 'return' },
            [BOOKING_ACTIONS.BOOK]: { label: 'Забрал домой', class: 'book' },
            [BOOKING_ACTIONS.DATE_CHANGE]: { label: 'Изменил дату', class: 'date-change' },
            [BOOKING_ACTIONS.TRANSFERRED]: { label: 'Передано', class: 'transferred' },
            [BOOKING_ACTIONS.RECEIPT_CONFIRMED]: { label: 'Подтверждено получение', class: 'receipt-confirmed' }
        };

        const actionInfo = actions[action] || { label: action, class: '' };
        return `<span class="action-badge ${actionInfo.class}">${actionInfo.label}</span>`;
    },

    /**
     * Форматирование даты и времени
     */
    formatDateTime(date) {
        return new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    },

    /**
     * Форматирование даты
     */
    formatDate(date) {
        return new Intl.DateTimeFormat('ru-RU', {
            day: 'numeric',
            month: 'short'
        }).format(date);
    },

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    normalizeHistoryUserName(value) {
        const normalized = String(value ?? '').trim();
        if (!normalized) return 'Неизвестен';

        // Отсекаем очевидно битые строки, которые выглядят как обрывок HTML-атрибутов.
        if (/(?:^|[\s"'])(?:alt|style|src|class|onerror)\s*=|<|>/i.test(normalized)) {
            return 'Неизвестен';
        }

        return normalized;
    },

    /**
     * Настройка табов истории
     */
    setupHistoryTabs() {
        const tabs = document.querySelectorAll('.history-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.historyTab;
                if (tabName) {
                    this.switchHistoryTab(tabName);
                }
            });
        });

        // Подписка на изменения feature flag
        // Логика скрытия/показа табов обрабатывается в FeatureFlags.applyFlags()
        // Здесь только обновляем состояние при инициализации
        if (typeof FeatureFlags !== 'undefined') {
            FeatureFlags.onFlagsChange((flags) => {
                // Дополнительная проверка: если фича отключена и мы на табе "Занятые устройства",
                // переключаемся на "Хронология" (на случай, если applyFlags() не успел это сделать)
                if (!flags.occupiedDevices && this.historyActiveTab === 'occupied') {
                    this.switchHistoryTab('timeline');
                }
            });
        }

        // Подписка на изменения устройств для обновления занятых устройств
        if (typeof Devices !== 'undefined') {
            // Используем событие, которое Devices может генерировать при обновлении
            // Или проверяем при каждом переключении на вкладку истории
            document.addEventListener('devicesUpdated', () => {
                if (this.currentTab === 'history' && this.historyActiveTab === 'occupied') {
                    this.loadOccupiedDevices();
                }
            });
        }

        // Инициализация видимости табов
        this.updateHistoryTabsVisibility();
    },

    /**
     * Переключение таба истории
     */
    switchHistoryTab(tabName) {
        this.historyActiveTab = tabName;

        // Обновляем активный таб
        document.querySelectorAll('.history-tab').forEach(tab => {
            if (tab.dataset.historyTab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Показываем соответствующий контент
        document.querySelectorAll('.history-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        if (tabName === 'timeline') {
            const timelineTab = document.getElementById('history-timeline-tab');
            if (timelineTab) {
                timelineTab.classList.add('active');
            }
            // Перерисовываем историю если нужно
            this.renderHistory();
        } else if (tabName === 'occupied') {
            const occupiedTab = document.getElementById('history-occupied-tab');
            if (occupiedTab) {
                occupiedTab.classList.add('active');
            }
            // Загружаем занятые устройства
            this.loadOccupiedDevices();
        }
    },

    /**
     * Обновление видимости табов в зависимости от feature flag
     * Вызывается только при инициализации, основная логика в FeatureFlags.applyFlags()
     */
    updateHistoryTabsVisibility() {
        const historyTabs = document.getElementById('history-tabs');
        const isEnabled = typeof FeatureFlags !== 'undefined' && FeatureFlags.isEnabled('occupiedDevices');

        if (historyTabs) {
            if (isEnabled) {
                historyTabs.classList.remove('hidden');
            } else {
                historyTabs.classList.add('hidden');
                // Если фича отключена и активен таб "Занятые устройства", переключаемся на "Хронология"
                if (this.historyActiveTab === 'occupied') {
                    this.switchHistoryTab('timeline');
                }
            }
        }
    },

    /**
     * Загрузка занятых устройств
     */
    async loadOccupiedDevices() {
        // Проверяем feature flag
        if (typeof FeatureFlags !== 'undefined' && !FeatureFlags.isEnabled('occupiedDevices')) {
            return;
        }

        try {
            // Получаем устройства из модуля Devices
            if (typeof Devices === 'undefined' || !Devices.devices || Devices.devices.length === 0) {
                await Devices.loadDevices();
            }

            const bookedDevices = Devices.devices.filter(device => 
                device.status === DEVICE_STATUS.BOOKED && 
                device.currentUserId &&
                device.isWorking !== false
            );

            // Группируем по пользователям
            const groupedDevices = this.groupDevicesByUser(bookedDevices);

            // Отображаем
            this.renderOccupiedDevices(groupedDevices);
        } catch (error) {
            console.error('Error loading occupied devices:', error);
            Toast.show('Ошибка загрузки занятых устройств', 'error');
        }
    },

    /**
     * Группировка устройств по пользователям
     */
    groupDevicesByUser(devices) {
        const grouped = {};

        devices.forEach(device => {
            const userId = device.currentUserId;
            if (!userId) return;

            if (!grouped[userId]) {
                grouped[userId] = {
                    userId: userId,
                    userName: device.currentUserName || 'Неизвестно',
                    userPhoto: device.currentUserPhoto || '',
                    devices: []
                };
            }

            grouped[userId].devices.push(device);
        });

        // Преобразуем в массив и сортируем по имени пользователя
        return Object.values(grouped).sort((a, b) => {
            return a.userName.localeCompare(b.userName, 'ru');
        });
    },

    /**
     * Отображение занятых устройств
     */
    renderOccupiedDevices(groupedDevices) {
        const container = document.getElementById('occupied-devices-container');
        const emptyState = document.getElementById('no-occupied-devices');

        if (!container) return;

        if (groupedDevices.length === 0) {
            container.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
            }
            return;
        }

        if (emptyState) {
            emptyState.classList.add('hidden');
        }

        // Проверяем, что Devices.createDeviceCard доступен
        if (typeof Devices === 'undefined' || !Devices.createDeviceCard) {
            console.error('Devices.createDeviceCard is not available');
            return;
        }

        container.innerHTML = groupedDevices.map(group => {
            const devicesHtml = group.devices.map(device => {
                return Devices.createDeviceCard(device);
            }).join('');

            return `
                <div class="occupied-user-group" data-user-id="${group.userId}">
                    <div class="occupied-user-header">
                        <img src="${group.userPhoto || 'data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 24 24\\" fill=\\"%2394a3b8\\"><circle cx=\\"12\\" cy=\\"8\\" r=\\"4\\"/><path d=\\"M20 21a8 8 0 0 0-16 0\\"/></svg>'}" alt="" class="occupied-user-avatar">
                        <div class="occupied-user-info">
                            <h3 class="occupied-user-name">${group.userName}</h3>
                            <span class="occupied-devices-count">${group.devices.length} ${this.pluralize(group.devices.length, 'устройство', 'устройства', 'устройств')}</span>
                        </div>
                    </div>
                    <div class="occupied-devices-grid">
                        ${devicesHtml}
                    </div>
                </div>
            `;
        }).join('');

        const groupedDevicesById = new Map(
            groupedDevices.flatMap(group => group.devices).map(device => [device.id, device])
        );

        // Настраиваем обработчики событий для карточек устройств
        // Используем делегирование событий для всех карточек в контейнере
        container.querySelectorAll('.device-card').forEach(card => {
            const deviceId = card.dataset.deviceId;
            const device = groupedDevicesById.get(deviceId);
            
            if (!device) return;

            // Клик по карточке - открыть модалку устройства
            card.addEventListener('click', (e) => {
                // Не открываем модалку при клике на кнопки
                if (e.target.closest('button')) return;
                if (typeof Devices !== 'undefined' && Devices.openDeviceModal) {
                    Devices.openDeviceModal(device);
                }
            });

            // Обработчики кнопок
            card.querySelector('.btn-take')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof Devices !== 'undefined' && Devices.quickTake) {
                    Devices.quickTake(deviceId);
                }
            });

            card.querySelector('.btn-return')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof Devices !== 'undefined' && Devices.returnDevice) {
                    Devices.returnDevice(deviceId);
                }
            });

            card.querySelector('.btn-book')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof Devices !== 'undefined' && Devices.openBookingModal) {
                    Devices.openBookingModal(deviceId);
                }
            });

            card.querySelector('.btn-edit-date')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof Devices !== 'undefined' && Devices.openEditDateModal) {
                    Devices.openEditDateModal(deviceId);
                }
            });

            card.querySelector('.btn-take-home')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof Devices !== 'undefined' && Devices.takeHomeFromOffice) {
                    Devices.takeHomeFromOffice(deviceId);
                }
            });

            card.querySelector('.btn-return-to-office')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof Devices !== 'undefined' && Devices.returnToOffice) {
                    Devices.returnToOffice(deviceId);
                }
            });

            card.querySelector('.btn-confirm-receipt')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof Devices !== 'undefined' && Devices.confirmReceipt) {
                    Devices.confirmReceipt(deviceId);
                }
            });

            // Кнопка истории
            card.querySelector('.history-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openDeviceHistory(deviceId, device.name || '');
            });
        });
    },

    /**
     * Склонение слов
     */
    pluralize(count, one, few, many) {
        const mod10 = count % 10;
        const mod100 = count % 100;

        if (mod100 >= 11 && mod100 <= 19) {
            return many;
        }
        if (mod10 === 1) {
            return one;
        }
        if (mod10 >= 2 && mod10 <= 4) {
            return few;
        }
        return many;
    }
};

window.App = App;

// Запуск приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Обработка ошибок
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

console.log('App module loaded');
