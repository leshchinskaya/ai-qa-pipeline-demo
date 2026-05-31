/**
 * Devices Module
 * Управление устройствами и бронированием
 */

const Devices = {
    initialized: false,
    devices: [],
    devicesById: new Map(),
    currentFilter: 'all',
    searchQuery: '',
    
    // Расширенные фильтры
    filterTypes: ['phone', 'tablet'],           // массив выбранных типов
    filterOsList: ['android', 'ios', 'ipados'], // массив выбранных ОС
    filterWorking: 'working',                   // working, broken, all
    
    selectedDevice: null,
    unsubscribe: null,
    unsubscribeUserBookings: null,
    unsubscribeCoverageBookings: null,
    usedDeviceIdsByCurrentUser: new Set(),
    usedDeviceIdsReady: false,
    usedDeviceIdsLoading: false,
    coverageBookings: [],
    coverageBookingsLoaded: false,
    currentDeviceView: 'catalog',
    currentCoverageTab: 'recommendations',
    coverageSelectedProjectId: '',
    coverageProjectSelectionTouched: false,
    coverageStaleDays: 30,
    coverageStaleDayPresets: [14, 30, 45, 60, 90],
    coverageSummaryFilter: '',
    coverageUsageSearchQuery: '',
    coverageUsageSort: 'recent',
    devicePromptMetaById: new Map(),
    takeModalTargetUserId: '',
    takeModalTargetUserName: '',
    bookingProjectContextLocked: null,
    isBulkReturnInProgress: false,
    pendingDeviceActions: new Set(),
    
    // Поиск в админ-панели
    adminDevicesSearchQuery: '',
    
    // Сортировка таблицы
    sortColumn: null,
    sortDirection: 'asc',
    
    // Порядок колонок
    columnOrder: null,
    adminDevicesRenderPending: false,
    adminUiInitialized: false,
    isDeviceMatcherLoading: false,
    devicesIsLoading: false,
    deviceRenderFrameId: null,
    deviceRenderToken: 0,
    deviceRenderInitialBatchSize: 48,
    deviceRenderBatchSize: 96,
    stableMainListOrderIds: null,
    stableMainListContextKey: null,
    stableMainListUntil: 0,
    stableMainListDurationMs: 6000,

    isProjectContextEnabled() {
        if (typeof FeatureFlags === 'undefined') return true;
        if (typeof FeatureFlags.isHydrated === 'function' && !FeatureFlags.isHydrated()) {
            return false;
        }
        return FeatureFlags.isEnabled('projectContext');
    },

    isDeviceActivityPromptsEnabled() {
        if (typeof FeatureFlags === 'undefined') return true;
        if (typeof FeatureFlags.isHydrated === 'function' && !FeatureFlags.isHydrated()) {
            return false;
        }
        return FeatureFlags.isEnabled('deviceActivityPrompts');
    },

    /**
     * Инициализация модуля
     */
    init() {
        if (this.initialized) return;
        this.setupFilterButtons();
        this.setupSearch();
        this.setupBookingModal();
        this.setupTakeModal();
        this.setupEditDateModal();
        this.setupDeviceDetailsModal();
        this.setupDeviceModal();
        this.setupDeviceMatcher();
        this.setupDeviceViewTabs();
        this.setupCoverageMatrix();
        this.syncProjectContextVisibility();
        this.initialized = true;
    },

    ensureAdminUiReady() {
        if (this.adminUiInitialized) return;
        this.setupAdminDevicesSearch();
        this.setupColumnsPanel();
        this.setupOsTabs();
        this.loadColumnSettings();
        this.adminUiInitialized = true;
    },

    /**
     * Получить список забронированных устройств текущего пользователя
     */
    getMyBookedDevices(userOrId = Auth.getUser()) {
        const user = this.resolveOwnershipUser(userOrId);
        if (!user?.uid) return [];

        return this.devices.filter(device =>
            device.status === DEVICE_STATUS.BOOKED &&
            this.isDeviceOwnedByUser(device, user)
        );
    },

    resolveOwnershipUser(userOrId) {
        if (!userOrId) return null;
        if (typeof userOrId === 'string') {
            return { uid: userOrId };
        }
        return userOrId;
    },

    /**
     * Получить отображаемое имя пользователя с фоллбеком на email
     */
    resolveDisplayName(user) {
        if (!user) return null;
        return user.displayName || user.email || null;
    },

    normalizeIdentity(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    },

    isDeviceOwnedByUser(device, userOrId = Auth.getUser()) {
        const user = this.resolveOwnershipUser(userOrId);
        if (!device || !user?.uid) return false;

        if (device.currentUserId && device.currentUserId === user.uid) {
            return true;
        }

        if (device.pendingReceipt === true && device.bookedFor && device.bookedFor === user.uid) {
            return true;
        }

        if (device.currentUserId) {
            return false;
        }

        const deviceName = this.normalizeIdentity(device.currentUserName);
        if (!deviceName) return false;

        const knownUserNames = [
            user.displayName,
            user.email,
            Auth.userProfile?.displayName,
            Auth.userProfile?.email
        ]
            .map(value => this.normalizeIdentity(value))
            .filter(Boolean);

        return knownUserNames.includes(deviceName);
    },

    /**
     * Преобразовать значение даты устройства в объект Date
     */
    getDeviceDateValue(value) {
        if (!value) return null;
        if (value instanceof Date) return value;

        if (typeof value?.toDate === 'function') {
            const date = value.toDate();
            return Number.isNaN(date?.getTime?.()) ? null : date;
        }

        if (typeof value === 'object' && typeof value.value === 'string') {
            const fromValue = new Date(value.value);
            return Number.isNaN(fromValue.getTime()) ? null : fromValue;
        }

        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    },

    /**
     * Проверить, просрочено ли устройство по дате возврата
     */
    isDeviceOverdue(device) {
        if (!device || device.status !== DEVICE_STATUS.BOOKED || !device.bookedUntil) {
            return false;
        }

        const bookedUntilDate = this.getDeviceDateValue(device.bookedUntil);
        if (!bookedUntilDate) {
            return false;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const returnDate = new Date(bookedUntilDate);
        returnDate.setHours(0, 0, 0, 0);

        const daysOverdue = Math.floor((today.getTime() - returnDate.getTime()) / (24 * 60 * 60 * 1000));
        return daysOverdue >= 1;
    },

    /**
     * Получить просроченные устройства текущего пользователя
     */
    getMyOverdueDevices(userOrId = Auth.getUser()) {
        return this.getMyBookedDevices(userOrId).filter(device => this.isDeviceOverdue(device));
    },

    /**
     * Обновить кнопку массового возврата устройств
     */
    updateReturnAllBtn() {
        const returnAllBtn = document.getElementById('return-all-devices-btn');
        if (!returnAllBtn) return;

        const shouldShow = this.currentFilter === 'my';
        returnAllBtn.classList.toggle('hidden', !shouldShow);

        const myDevicesCount = this.getMyBookedDevices().length;
        returnAllBtn.disabled = this.isBulkReturnInProgress || myDevicesCount === 0;

        const label = document.getElementById('return-all-devices-btn-label');
        if (label) {
            label.textContent = myDevicesCount > 0
                ? `Вернуть все (${myDevicesCount})`
                : 'Вернуть все';
        }
    },

    setupDeviceViewTabs() {
        const tabs = document.querySelectorAll('.device-view-tab');
        tabs.forEach((tab) => {
            if (tab.dataset.listenerAdded === 'true') return;
            tab.dataset.listenerAdded = 'true';
            tab.addEventListener('click', () => {
                const view = tab.dataset.deviceView || 'catalog';
                this.switchDeviceView(view);
            });
        });
    },

    switchDeviceView(view) {
        if (view === 'coverage' && !this.isProjectContextEnabled()) {
            view = 'catalog';
        }

        this.currentDeviceView = view;
        document.querySelectorAll('.device-view-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.deviceView === view);
        });
        document.querySelectorAll('.device-view-content').forEach((content) => {
            content.classList.toggle('active', content.id === `devices-${view}-view`);
        });

        if (view === 'coverage') {
            this.renderCoverageMatrix();
        } else {
            this.requestSortedMainDevicesRender();
        }
    },

    syncProjectContextVisibility() {
        const enabled = this.isProjectContextEnabled();
        const bookingProjectGroup = document.getElementById('booking-project-select-group');
        const takeProjectGroup = document.getElementById('take-project-select-group');
        const deviceViewTabs = document.querySelector('.device-view-tabs');

        deviceViewTabs?.classList.toggle('hidden', !enabled);

        if (!enabled) {
            bookingProjectGroup?.classList.add('hidden');
            takeProjectGroup?.classList.add('hidden');
            this.bookingProjectContextLocked = null;
            if (this.currentDeviceView === 'coverage') {
                this.switchDeviceView('catalog');
                return;
            }
        }

        if (enabled && this.currentDeviceView === 'coverage') {
            this.renderCoverageMatrix();
        }
    },

    /**
     * Загрузка устройств из Firestore (realtime)
     */
    loadDevices() {
        // Отписываемся от предыдущего listener
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        this.devicesIsLoading = true;
        this.renderDevices();
        
        // Флаг первой загрузки для автоопределения
        let isFirstLoad = true;

        // Подписываемся на изменения в реальном времени
        this.unsubscribe = db.collection(COLLECTIONS.DEVICES)
            .orderBy('name')
            .limit(500)
            .onSnapshot((snapshot) => {
                this.devicesIsLoading = false;
                this.devices = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.devicesById = new Map(this.devices.map(device => [device.id, device]));
                this.renderDevices();
                if (this.currentDeviceView === 'coverage') {
                    this.renderCoverageMatrix();
                }
                this.renderAdminDevicesWhenVisible();
                
                // Запускаем автоопределение устройства при первой загрузке
                if (isFirstLoad && typeof App !== 'undefined') {
                    isFirstLoad = false;
                    // Небольшая задержка для полной инициализации UI
                    setTimeout(() => {
                        void App.runDeviceDetection();
                    }, 200);
                }
                
                // Обновляем карточку определённого устройства если активен этот режим
                if (typeof App !== 'undefined' && App.detectedDeviceMode) {
                    App.refreshDetectedDevice();
                }
                
                // Обновляем занятые устройства если активен соответствующий таб
                if (typeof App !== 'undefined' && App.currentTab === 'history' && App.historyActiveTab === 'occupied') {
                    App.refreshOccupiedDevices();
                }
            }, (error) => {
                this.devicesIsLoading = false;
                console.error('Error loading devices:', error);
                this.renderDevices();
                Toast.show('Ошибка загрузки устройств', 'error');
            });
    },

    getDeviceById(deviceId) {
        if (!deviceId) return null;
        return this.devicesById.get(deviceId) || null;
    },

    beginDeviceAction(deviceId) {
        if (!deviceId || this.pendingDeviceActions.has(deviceId)) {
            return false;
        }

        this.pendingDeviceActions.add(deviceId);
        return true;
    },

    endDeviceAction(deviceId) {
        if (!deviceId) return;
        this.pendingDeviceActions.delete(deviceId);
    },

    syncDeviceUiState() {
        this.renderDevices();
        this.renderAdminDevicesWhenVisible();
        this.updateReturnAllBtn();
        if (this.currentDeviceView === 'coverage') {
            this.renderCoverageMatrix();
        }
    },

    clearStableMainListOrder() {
        this.stableMainListOrderIds = null;
        this.stableMainListContextKey = null;
        this.stableMainListUntil = 0;
    },

    getMainListContextKey() {
        const isMatcherMode = typeof DeviceMatcher !== 'undefined' && DeviceMatcher.isActive;
        return JSON.stringify({
            matcher: isMatcherMode,
            filter: this.currentFilter,
            search: this.searchQuery,
            types: [...this.filterTypes].sort(),
            osList: [...this.filterOsList].sort(),
            working: Auth.isAdmin ? this.filterWorking : 'working'
        });
    },

    preserveCurrentMainListOrder(ttlMs = this.stableMainListDurationMs) {
        const isMatcherMode = typeof DeviceMatcher !== 'undefined' && DeviceMatcher.isActive;
        if (isMatcherMode) {
            return;
        }

        const currentDevices = this.getFilteredDevices({ preserveStableOrder: false });
        if (currentDevices.length === 0) {
            this.clearStableMainListOrder();
            return;
        }

        this.stableMainListOrderIds = currentDevices.map((device) => device.id);
        this.stableMainListContextKey = this.getMainListContextKey();
        this.stableMainListUntil = Date.now() + ttlMs;
    },

    shouldPreserveMainListOrder() {
        if (!Array.isArray(this.stableMainListOrderIds) || this.stableMainListOrderIds.length === 0) {
            return false;
        }

        if (Date.now() > this.stableMainListUntil) {
            this.clearStableMainListOrder();
            return false;
        }

        if (this.stableMainListContextKey !== this.getMainListContextKey()) {
            return false;
        }

        return true;
    },

    applyStableMainListOrder(devices) {
        if (!this.shouldPreserveMainListOrder()) {
            return devices;
        }

        const orderMap = new Map(this.stableMainListOrderIds.map((deviceId, index) => [deviceId, index]));

        return [...devices].sort((a, b) => {
            const indexA = orderMap.get(a.id);
            const indexB = orderMap.get(b.id);

            if (indexA !== undefined && indexB !== undefined) {
                return indexA - indexB;
            }
            if (indexA !== undefined) {
                return -1;
            }
            if (indexB !== undefined) {
                return 1;
            }
            return 0;
        });
    },

    requestSortedMainDevicesRender() {
        this.clearStableMainListOrder();
        if (this.currentDeviceView === 'coverage') {
            this.renderCoverageMatrix();
            return;
        }

        this.renderDevices();
    },

    setLocalDevice(nextDevice) {
        if (!nextDevice?.id) return null;

        let found = false;
        this.devices = this.devices.map((device) => {
            if (device.id !== nextDevice.id) {
                return device;
            }

            found = true;
            return nextDevice;
        });

        if (!found) {
            return null;
        }

        this.devicesById.set(nextDevice.id, nextDevice);

        if (this.selectedDevice?.id === nextDevice.id) {
            this.selectedDevice = nextDevice;
        }

        this.syncDeviceUiState();
        return nextDevice;
    },

    applyLocalDevicePatch(deviceId, patch) {
        const device = this.getDeviceById(deviceId);
        if (!device) return null;
        return this.setLocalDevice({
            ...device,
            ...patch
        });
    },

    cancelPendingDeviceRender() {
        if (this.deviceRenderFrameId !== null) {
            cancelAnimationFrame(this.deviceRenderFrameId);
            this.deviceRenderFrameId = null;
        }
        this.deviceRenderToken += 1;
    },

    isAdminDevicesTabActive() {
        if (!Auth?.isAdmin) return false;
        const adminSection = document.getElementById('admin-section');
        const adminDevicesTab = document.getElementById('admin-devices-tab');
        return !!adminSection && !!adminDevicesTab &&
            adminSection.classList.contains('active') &&
            adminDevicesTab.classList.contains('active');
    },

    renderAdminDevicesWhenVisible() {
        if (this.isAdminDevicesTabActive()) {
            this.adminDevicesRenderPending = false;
            this.renderAdminDevices();
            return;
        }
        this.adminDevicesRenderPending = true;
    },

    async openDeviceCalendar(deviceId) {
        if (typeof FeatureFlags !== 'undefined' && !FeatureFlags.isEnabled('calendar')) {
            if (typeof Toast !== 'undefined') {
                Toast.show('Функция календаря отключена', 'warning');
            }
            return;
        }

        let calendarReady = typeof Calendar !== 'undefined';
        if (!calendarReady && typeof App !== 'undefined' && typeof App.ensureCalendarReady === 'function') {
            calendarReady = await App.ensureCalendarReady();
        }

        if (!calendarReady || typeof Calendar === 'undefined') {
            console.error('Devices: Calendar module not available');
            if (typeof Toast !== 'undefined') {
                Toast.show('Модуль календаря не загружен', 'error');
            }
            return;
        }

        try {
            await Calendar.openDeviceTimeline(deviceId);
        } catch (error) {
            console.error('Devices: Error opening calendar:', error);
            if (typeof Toast !== 'undefined') {
                Toast.show('Ошибка открытия календаря: ' + error.message, 'error');
            }
        }
    },

    openDeviceHistory(deviceId) {
        const device = this.getDeviceById(deviceId);
        if (!device) {
            if (typeof Toast !== 'undefined') {
                Toast.show('Устройство не найдено', 'error');
            }
            return;
        }

        const appInstance = globalThis?.App || (typeof App !== 'undefined' ? App : null);
        if (!appInstance || typeof appInstance.openDeviceHistory !== 'function') {
            console.error('Devices: App.openDeviceHistory is not available');
            if (typeof Toast !== 'undefined') {
                Toast.show('Переход в историю недоступен', 'error');
            }
            return;
        }

        appInstance.openDeviceHistory(deviceId, device.name || '');
    },

    async ensureDeviceMatcherReady() {
        if (typeof DeviceMatcher !== 'undefined') return true;
        if (this.isDeviceMatcherLoading) return false;

        this.isDeviceMatcherLoading = true;
        try {
            // Модуль подбора устройств отсутствует в демо-сборке
            return typeof DeviceMatcher !== 'undefined';
        } finally {
            this.isDeviceMatcherLoading = false;
        }
    },

    async ensureUsersModuleLoaded() {
        if (typeof Users !== 'undefined') return true;

        if (typeof LibraryLoader !== 'undefined' && typeof LibraryLoader.ensureUsersModule === 'function') {
            try {
                await LibraryLoader.ensureUsersModule();
            } catch (error) {
                console.error('Devices: failed to load Users module', error);
                return false;
            }
            return typeof Users !== 'undefined';
        }

        if (typeof App !== 'undefined' && typeof App.ensureUsersReady === 'function') {
            return App.ensureUsersReady();
        }

        return false;
    },

    /**
     * Загрузка списка устройств, которые пользователь уже использовал
     */
    loadUserUsedDevices() {
        if (this.unsubscribeUserBookings) {
            return;
        }

        this.usedDeviceIdsByCurrentUser = new Set();
        this.usedDeviceIdsReady = false;
        this.usedDeviceIdsLoading = true;

        const user = Auth.getUser();
        if (!user?.uid) {
            this.usedDeviceIdsLoading = false;
            return;
        }

        this.unsubscribeUserBookings = db.collection(COLLECTIONS.BOOKINGS)
            .where('userId', '==', user.uid)
            .limit(500)
            .onSnapshot((snapshot) => {
                const usedDeviceIds = new Set();

                snapshot.forEach((doc) => {
                    const booking = doc.data();
                    if (booking.deviceId) {
                        usedDeviceIds.add(booking.deviceId);
                    }
                });

                this.usedDeviceIdsByCurrentUser = usedDeviceIds;
                this.usedDeviceIdsReady = true;
                this.usedDeviceIdsLoading = false;
                if (this.currentFilter === 'unused_by_me') {
                    this.renderDevices();
                }
            }, (error) => {
                console.error('Error loading used devices for current user:', error);
                this.usedDeviceIdsLoading = false;
            });
    },

    /**
     * Сброс данных по использованным устройствам (при выходе пользователя)
     */
    resetUsedDevicesState() {
        if (this.unsubscribeUserBookings) {
            this.unsubscribeUserBookings();
            this.unsubscribeUserBookings = null;
        }
        if (this.unsubscribeCoverageBookings) {
            this.unsubscribeCoverageBookings();
            this.unsubscribeCoverageBookings = null;
        }
        this.usedDeviceIdsByCurrentUser = new Set();
        this.usedDeviceIdsReady = false;
        this.usedDeviceIdsLoading = false;
        this.coverageBookings = [];
        this.coverageBookingsLoaded = false;
    },

    /**
     * Быстрое взятие устройства
     */
    async quickTake(deviceId) {
        const user = Auth.getUser();
        if (!user) return;

        // Для общего аккаунта показываем модальное окно выбора пользователя
        if (Auth.isSharedAccount()) {
            this.openTakeModal(deviceId);
            return;
        }

        const assignments = this.getProjectAssignmentsForUser(user.uid);
        if (assignments.length > 1) {
            this.openTakeModal(deviceId);
            return;
        }

        const projectSelection = this.getTargetProjectSelection(user.uid, assignments[0]?.projectId ? [assignments[0].projectId] : []);
        const projectContext = projectSelection.context;

        if (!this.beginDeviceAction(deviceId)) {
            return;
        }

        let previousDevice = null;

        try {
            const device = this.getDeviceById(deviceId);
            if (!device || device.status !== DEVICE_STATUS.AVAILABLE) {
                Toast.show('Устройство недоступно', 'error');
                return;
            }

            previousDevice = { ...device };
            this.preserveCurrentMainListOrder();
            const userOffice = Auth.userProfile?.office || '';
            const userName = this.resolveDisplayName(user);
            this.applyLocalDevicePatch(deviceId, {
                status: DEVICE_STATUS.BOOKED,
                bookingType: BOOKING_TYPES.OFFICE,
                currentUserId: user.uid,
                currentUserName: userName,
                currentUserPhoto: user.photoURL,
                currentUserOffice: userOffice,
                currentUserHomeAddress: '',
                bookedAt: new Date(),
                bookedUntil: null,
                currentProjectIds: projectContext?.projectIds || null,
                currentProjectCodes: projectContext?.projectCodes || null,
                currentProjectNames: projectContext?.projectNames || null,
                currentProjectId: projectContext?.projectId || null,
                currentProjectCode: projectContext?.projectCode || null,
                currentProjectName: projectContext?.projectName || null,
                pendingReceipt: null,
                bookedBy: null,
                bookedByName: null,
                bookedFor: null
            });

            // Обновляем устройство
            await db.collection(COLLECTIONS.DEVICES).doc(deviceId).update({
                status: DEVICE_STATUS.BOOKED,
                bookingType: BOOKING_TYPES.OFFICE,  // Использую в офисе
                currentUserId: user.uid,
                currentUserName: userName,
                currentUserPhoto: user.photoURL,
                currentUserOffice: userOffice,
                currentUserHomeAddress: '',
                bookedAt: firebase.firestore.FieldValue.serverTimestamp(),
                bookedUntil: null,
                currentProjectIds: projectContext?.projectIds || null,
                currentProjectCodes: projectContext?.projectCodes || null,
                currentProjectNames: projectContext?.projectNames || null,
                currentProjectId: projectContext?.projectId || null,
                currentProjectCode: projectContext?.projectCode || null,
                currentProjectName: projectContext?.projectName || null
            });

            // Записываем в историю
            await this.addBookingRecord(
                deviceId, 
                device.name, 
                BOOKING_ACTIONS.TAKE,
                null,
                null,
                null,
                userOffice,
                null,
                null,
                projectContext
            );

            Toast.show(`Устройство "${device.name}" взято`, 'success');
        } catch (error) {
            if (previousDevice) {
                this.setLocalDevice(previousDevice);
            }
            console.error('Error taking device:', error);
            Toast.show('Ошибка: ' + error.message, 'error');
        } finally {
            this.endDeviceAction(deviceId);
        }
    },

    /**
     * Открыть модальное окно для "Использую" с выбором пользователя
     * (для общего аккаунта qatest@test.dev)
     */
    async openTakeModal(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        this.selectedDevice = device;
        this.takeModalTargetUserId = '';
        this.takeModalTargetUserName = '';

        const modal = document.getElementById('take-user-modal');
        const deviceInfo = document.getElementById('take-device-info');
        const userSelect = document.getElementById('take-user');
        const userGroup = document.getElementById('take-user-select-group');
        const projectGroup = document.getElementById('take-project-select-group');
        
        if (!modal || !deviceInfo) return;

        deviceInfo.innerHTML = `
            <div class="booking-device-icon">
                ${this.getDeviceIcon(device.type)}
            </div>
            <div class="booking-device-details">
                <h4>${device.name}</h4>
                <p>${DEVICE_TYPES[device.type]?.label || device.type}${device.os ? ' • ' + (OS_TYPES[device.os]?.label || device.os) : ''}</p>
            </div>
        `;

        // Сбрасываем выбор пользователя
        if (userSelect) {
            userSelect.value = '';
        }
        const userLabel = document.getElementById('take-user-label');
        if (userLabel) {
            userLabel.textContent = 'Выберите пользователя';
        }
        const userSearch = document.getElementById('take-user-search');
        if (userSearch) {
            userSearch.value = '';
        }

        const currentUser = Auth.getUser();
        const showUserSelect = Auth.isSharedAccount();
        userGroup?.classList.toggle('hidden', !showUserSelect);

        if (!this.isProjectContextEnabled()) {
            projectGroup?.classList.add('hidden');
        } else if (showUserSelect) {
            this.takeModalTargetUserId = '';
            if (projectGroup) {
                projectGroup.classList.add('hidden');
            }
        } else {
            this.takeModalTargetUserId = currentUser?.uid || '';
            this.takeModalTargetUserName = currentUser?.displayName || currentUser?.email || '';
            this.handleBookingTargetUserChange('take', this.takeModalTargetUserId);
        }

        if (showUserSelect) {
            const usersModuleReady = await this.ensureUsersModuleLoaded();
            if (!usersModuleReady || typeof Users === 'undefined') {
                Toast.show('Модуль пользователей не загружен', 'error');
                return;
            }

            // Загружаем пользователей
            if (Users.users.length === 0) {
                Users.loadUsers()
                    .then(() => Users.updateTakeUserSelect())
                    .catch(() => {
                        Toast.show('Не удалось загрузить список пользователей', 'error');
                    });
            } else {
                Users.updateTakeUserSelect();
            }
        }

        modal.classList.remove('hidden');
    }

};

console.log('Devices module loaded');
