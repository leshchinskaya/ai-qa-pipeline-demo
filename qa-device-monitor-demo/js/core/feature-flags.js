/**
 * Feature Flags Module
 * Управление функциональностью приложения через Firestore
 */

const FeatureFlags = {
    // Состояние флагов (по умолчанию все включены)
    flags: {
        calendar: false,
        deviceDetection: false,
        deviceMatcher: false,
        deviceActivityPrompts: false,
        projectContext: true,
        reports: false,
        bookForOthers: true,
        occupiedDevices: true,
        chat: false,
        userActivityRank: false,
        pretextTextLayoutPilot: false
    },
    
    // Real-time подписка
    unsubscribe: null,
    
    // Callbacks при изменении
    listeners: [],
    
    // Флаг инициализации
    initialized: false,
    hydrated: false,
    
    // Предыдущее состояние календаря для отслеживания изменений
    previousCalendarState: undefined,

    /**
     * Инициализация модуля с подпиской на Firestore
     */
    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.hydrated = false;
        
        console.log('FeatureFlags: initializing...');
        
        // Подписываемся на изменения документа config/features
        this.unsubscribe = db.collection(COLLECTIONS.CONFIG).doc('features')
            .onSnapshot(
                (doc) => {
                    this.hydrated = true;
                    if (doc.exists) {
                        const data = doc.data();
                        // Обновляем только известные флаги
                        if (typeof data.calendar === 'boolean') {
                            this.flags.calendar = data.calendar;
                        }
                        if (typeof data.deviceDetection === 'boolean') {
                            this.flags.deviceDetection = data.deviceDetection;
                        }
                        if (typeof data.deviceMatcher === 'boolean') {
                            this.flags.deviceMatcher = data.deviceMatcher;
                        }
                        if (typeof data.deviceActivityPrompts === 'boolean') {
                            this.flags.deviceActivityPrompts = data.deviceActivityPrompts;
                        }
                        if (typeof data.projectContext === 'boolean') {
                            this.flags.projectContext = data.projectContext;
                        }
                        if (typeof data.reports === 'boolean') {
                            this.flags.reports = data.reports;
                        }
                        if (typeof data.bookForOthers === 'boolean') {
                            this.flags.bookForOthers = data.bookForOthers;
                        }
                        if (typeof data.occupiedDevices === 'boolean') {
                            this.flags.occupiedDevices = data.occupiedDevices;
                        }
                        if (typeof data.chat === 'boolean') {
                            this.flags.chat = data.chat;
                        }
                        if (typeof data.userActivityRank === 'boolean') {
                            this.flags.userActivityRank = data.userActivityRank;
                        }
                        if (typeof data.pretextTextLayoutPilot === 'boolean') {
                            this.flags.pretextTextLayoutPilot = data.pretextTextLayoutPilot;
                        }
                        console.log('FeatureFlags: loaded from Firestore', this.flags);
                    } else {
                        console.log('FeatureFlags: no config found, using defaults');
                    }
                    
                    // Применяем флаги к UI
                    this.applyFlags();
                    
                    // Уведомляем слушателей
                    this.listeners.forEach(cb => cb(this.flags));
                },
                (error) => {
                    this.hydrated = true;
                    console.error('FeatureFlags: error loading', error);
                    this.applyFlags();
                    this.listeners.forEach(cb => cb(this.flags));
                }
            );
    },
    
    /**
     * Проверка, включена ли фича
     * @param {string} featureName - имя фичи (calendar, deviceDetection)
     * @returns {boolean}
     */
    isEnabled(featureName) {
        return this.flags[featureName] ?? true;
    },

    isHydrated() {
        return this.hydrated;
    },
    
    /**
     * Установить состояние фичи (для админов)
     * @param {string} featureName - имя фичи
     * @param {boolean} enabled - включить/выключить
     */
    async setEnabled(featureName, enabled) {
        if (!Auth.isAdmin) {
            console.warn('FeatureFlags: only admins can change flags');
            return false;
        }

        const previousValue = this.flags[featureName];
        this.flags[featureName] = enabled;
        this.applyFlags();
        this.listeners.forEach(cb => cb(this.flags));

        try {
            const updateData = {
                [featureName]: enabled,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: Auth.currentUser?.email || 'unknown'
            };
            
            await db.collection(COLLECTIONS.CONFIG).doc('features').set(updateData, { merge: true });
            console.log(`FeatureFlags: ${featureName} set to ${enabled}`);
            Toast.show(`Фича "${this.getFeatureLabel(featureName)}" ${enabled ? 'включена' : 'выключена'}`, 'success');
            return true;
        } catch (error) {
            console.error('FeatureFlags: error saving', error);
            this.flags[featureName] = previousValue;
            this.applyFlags();
            this.listeners.forEach(cb => cb(this.flags));
            Toast.show('Ошибка сохранения настроек', 'error');
            return false;
        }
    },
    
    /**
     * Получить человекочитаемое название фичи
     */
    getFeatureLabel(featureName) {
        const labels = {
            calendar: 'Календарь занятости',
            deviceDetection: 'Автоопределение устройства',
            deviceMatcher: 'Подбор похожих устройств',
            deviceActivityPrompts: 'Подсказки в каталоге устройств',
            projectContext: 'Проекты и матрица покрытия',
            reports: 'Отчеты и экспорт данных',
            bookForOthers: 'Бронирование на других пользователей',
            occupiedDevices: 'Занятые устройства',
            chat: 'Чат',
            userActivityRank: 'Подсказки у профиля пользователя',
            pretextTextLayoutPilot: 'Pilot: точная обрезка текста (pretext)'
        };
        return labels[featureName] || featureName;
    },
    
    /**
     * Подписаться на изменения флагов
     * @param {Function} callback - функция обратного вызова
     * @returns {Function} - функция отписки
     */
    onFlagsChange(callback) {
        this.listeners.push(callback);
        // Возвращаем функцию отписки
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    },
    
    /**
     * Применить флаги к UI элементам
     */
    applyFlags() {
        // === Календарь ===
        const calendarTab = document.querySelector('.nav-tab[data-tab="calendar"]');
        const calendarSection = document.getElementById('calendar-section');
        const wasCalendarEnabled = this.previousCalendarState !== undefined ? this.previousCalendarState : this.flags.calendar;
        const isCalendarNowEnabled = this.flags.calendar;
        
        if (calendarTab) {
            calendarTab.classList.toggle('hidden', !this.flags.calendar);
        }
        if (calendarSection) {
            // Показываем или скрываем секцию календаря
            if (this.flags.calendar) {
                calendarSection.classList.remove('hidden');
            } else {
                calendarSection.classList.add('hidden');
            }
        }
        
        // Обновляем кнопки календаря на карточках устройств
        document.querySelectorAll('.calendar-btn').forEach(btn => {
            btn.classList.toggle('hidden', !this.flags.calendar);
        });
        
        // Перерисовываем устройства, чтобы кнопки календаря появились/исчезли
        if (typeof Devices !== 'undefined' && Devices.renderDevices) {
            Devices.renderDevices();
        }
        
        // Если календарь только что включили - инициализируем и загружаем данные
        if (isCalendarNowEnabled && !wasCalendarEnabled) {
            if (typeof Calendar !== 'undefined') {
                // Сначала показываем секцию календаря, затем инициализируем
                // Используем небольшую задержку чтобы DOM успел обновиться
                setTimeout(() => {
                    try {
                        // Используем метод reinit() для переинициализации
                        if (Calendar.reinit) {
                            Calendar.reinit();
                        } else {
                            // Fallback на обычный init если reinit не доступен
                            Calendar.init();
                            if (typeof App !== 'undefined' && App.currentTab === 'calendar') {
                                setTimeout(() => {
                                    Calendar.loadGanttData();
                                }, 100);
                            }
                        }
                    } catch (error) {
                        console.error('FeatureFlags: Error initializing calendar:', error);
                    }
                }, 50);
            }
        }
        
        // Если текущая вкладка - календарь, но фича отключена, переключаемся на устройства
        if (!this.flags.calendar && typeof App !== 'undefined' && App.currentTab === 'calendar') {
            App.switchTab('devices');
        }
        
        // Сохраняем текущее состояние для следующего вызова
        this.previousCalendarState = this.flags.calendar;
        
        // === Подбор похожих устройств ===
        const deviceMatcherBtn = document.getElementById('device-matcher-btn');
        const deviceMatcherPanel = document.getElementById('device-matcher-panel');
        const deviceMatcherActive = document.getElementById('device-matcher-active');
        const deviceMatcherResults = document.getElementById('device-matcher-results');
        
        if (deviceMatcherBtn) {
            deviceMatcherBtn.classList.toggle('hidden', !this.flags.deviceMatcher);
        }
        if (!this.flags.deviceMatcher) {
            // Скрываем панель
            if (deviceMatcherPanel) {
                deviceMatcherPanel.classList.add('hidden');
            }
            // Скрываем индикатор активного режима
            if (deviceMatcherActive) {
                deviceMatcherActive.classList.add('hidden');
            }
            // Скрываем результаты подбора
            if (deviceMatcherResults) {
                deviceMatcherResults.classList.add('hidden');
            }
            // Показываем обычную сетку устройств
            const devicesGrid = document.getElementById('devices-grid');
            if (devicesGrid) {
                devicesGrid.classList.remove('hidden');
            }
            // Деактивируем режим подбора если фича отключена
            if (typeof DeviceMatcher !== 'undefined' && DeviceMatcher.isActive) {
                DeviceMatcher.deactivate();
                // Перерисовываем устройства в обычном режиме
                if (typeof Devices !== 'undefined') {
                    Devices.matcherResults = null;
                    Devices.renderDevices();
                }
            }
        }

        // === Проекты и матрица покрытия ===
        const projectContextEnabled = this.flags.projectContext;
        const projectsAdminTab = document.querySelector('.admin-tab[data-admin-tab="projects"]');
        const projectsAdminSection = document.getElementById('admin-projects-tab');
        const deviceCoverageTab = document.querySelector('.device-view-tab[data-device-view="coverage"]');
        const deviceCoverageView = document.getElementById('devices-coverage-view');
        const profileProjectsGroup = document.getElementById('profile-projects-group');

        if (projectsAdminTab) {
            projectsAdminTab.classList.toggle('hidden', !projectContextEnabled);
        }
        if (projectsAdminSection) {
            projectsAdminSection.classList.toggle('hidden', !projectContextEnabled);
        }
        if (deviceCoverageTab) {
            deviceCoverageTab.classList.toggle('hidden', !projectContextEnabled);
        }
        if (deviceCoverageView) {
            deviceCoverageView.classList.toggle('hidden', !projectContextEnabled);
        }
        if (profileProjectsGroup) {
            profileProjectsGroup.classList.toggle('hidden', !projectContextEnabled);
        }

        if (!projectContextEnabled) {
            const activeProjectsTab = document.querySelector('.admin-tab.active[data-admin-tab="projects"]');
            if (activeProjectsTab) {
                const firstVisibleAdminTab = document.querySelector('.admin-tab:not(.hidden)');
                if (firstVisibleAdminTab) {
                    firstVisibleAdminTab.click();
                }
            }
        }

        if (typeof Devices !== 'undefined') {
            if (!projectContextEnabled && Devices.currentDeviceView === 'coverage' && typeof Devices.switchDeviceView === 'function') {
                Devices.switchDeviceView('catalog');
            } else if (typeof Devices.syncProjectContextVisibility === 'function') {
                Devices.syncProjectContextVisibility();
            }
        }

        if (typeof Projects !== 'undefined' && typeof Projects.refreshFeatureVisibility === 'function') {
            Projects.refreshFeatureVisibility();
        }

        if (typeof Users !== 'undefined' && typeof Users.renderUsers === 'function') {
            const usersTab = document.getElementById('admin-users-tab');
            if (usersTab?.classList.contains('active')) {
                Users.renderUsers();
            }
        }

        // === Отчеты ===
        const reportsTab = document.querySelector('.admin-tab[data-admin-tab="reports"]');
        const reportsSection = document.getElementById('admin-reports-tab');
        
        if (reportsTab) {
            reportsTab.classList.toggle('hidden', !this.flags.reports);
        }
        if (reportsSection) {
            if (this.flags.reports) {
                reportsSection.classList.remove('hidden');
            } else {
                reportsSection.classList.add('hidden');
            }
        }
        
        // Если текущая вкладка - отчеты, но фича отключена, переключаемся на первую доступную
        if (!this.flags.reports) {
            const activeReportsTab = document.querySelector('.admin-tab.active[data-admin-tab="reports"]');
            if (activeReportsTab) {
                const firstTab = document.querySelector('.admin-tab:not(.hidden)');
                if (firstTab) {
                    firstTab.click();
                }
            }
        }
        
        // === Бронирование на других пользователей ===
        // Обновляем модальное окно бронирования, если оно открыто
        const bookingModal = document.getElementById('booking-modal');
        if (bookingModal && !bookingModal.classList.contains('hidden')) {
            const userSelectGroup = document.getElementById('booking-user-select');
            const isBookForOthersEnabled = this.flags.bookForOthers;
            const showUserSelect = (typeof Auth !== 'undefined' && (Auth.isAdmin || Auth.isSharedAccount())) && isBookForOthersEnabled;
            
            if (userSelectGroup) {
                if (showUserSelect) {
                    userSelectGroup.classList.remove('hidden');
                } else {
                    userSelectGroup.classList.add('hidden');
                    // Сбрасываем выбор пользователя, если флаг отключен
                    const userSelect = document.getElementById('booking-user');
                    if (userSelect) {
                        userSelect.value = '';
                    }
                }
            }
        }
        
        // === Занятые устройства ===
        const historyTabs = document.getElementById('history-tabs');
        if (historyTabs) {
            if (this.flags.occupiedDevices) {
                historyTabs.classList.remove('hidden');
            } else {
                historyTabs.classList.add('hidden');
                // Если фича отключена и активен таб "Занятые устройства", переключаемся на "Хронология"
                if (typeof App !== 'undefined' && App.historyActiveTab === 'occupied' && App.switchHistoryTab) {
                    // Используем setTimeout для гарантии, что DOM готов и App полностью инициализирован
                    // Это важно, так как applyFlags() может вызываться до полной инициализации App
                    setTimeout(() => {
                        if (typeof App !== 'undefined' && App.switchHistoryTab && App.historyActiveTab === 'occupied') {
                            App.switchHistoryTab('timeline');
                        }
                    }, 10);
                }
            }
        }
        
        // === Чат ===
        const chatTab = document.querySelector('.nav-tab[data-tab="chat"]');
        const chatSection = document.getElementById('chat-section');
        
        if (chatTab) {
            chatTab.classList.toggle('hidden', !this.flags.chat);
        }
        if (chatSection) {
            if (this.flags.chat) {
                chatSection.classList.remove('hidden');
            } else {
                chatSection.classList.add('hidden');
            }
        }
        
        // Если текущая вкладка - чат, но фича отключена, переключаемся на устройства
        if (!this.flags.chat && typeof App !== 'undefined' && App.currentTab === 'chat') {
            App.switchTab('devices');
        }
        
        // Управление чатом в зависимости от feature flag
        if (typeof Chat !== 'undefined') {
            if (this.flags.chat && !Chat.initialized) {
                Chat.init();
            } else if (!this.flags.chat && Chat.initialized) {
                Chat.destroy();
            }
        }

        // === Подсказки по рейтингу устройств ===
        if (typeof Devices !== 'undefined') {
            if (!this.flags.deviceActivityPrompts) {
                Devices.devicePromptMetaById = new Map();
            }
            if (typeof Devices.renderDevices === 'function' && Devices.currentDeviceView === 'catalog') {
                Devices.renderDevices();
            }
        }

        // === Подсказки у профиля пользователя ===
        if (typeof Auth !== 'undefined' && typeof Auth.syncUserRankHighlight === 'function') {
            Auth.syncUserRankHighlight();
        }

        // === Обновляем текущий экран приложения ===
        if (typeof App !== 'undefined' && typeof App.refreshCurrentTab === 'function') {
            App.refreshCurrentTab();
        }

        // === Обновляем чекбоксы в админке ===
        this.updateAdminToggles();
    },
    
    /**
     * Обновить состояние переключателей в админ-панели
     */
    updateAdminToggles() {
        const calendarToggle = document.getElementById('feature-calendar');
        const deviceDetectionToggle = document.getElementById('feature-device-detection');
        const deviceMatcherToggle = document.getElementById('feature-device-matcher');
        const deviceActivityPromptsToggle = document.getElementById('feature-device-activity-prompts');
        const projectContextToggle = document.getElementById('feature-project-context');
        const reportsToggle = document.getElementById('feature-reports');
        const bookForOthersToggle = document.getElementById('feature-book-for-others');
        const occupiedDevicesToggle = document.getElementById('feature-occupied-devices');
        const chatToggle = document.getElementById('feature-chat');
        const userActivityRankToggle = document.getElementById('feature-user-activity-rank');
        const pretextTextLayoutPilotToggle = document.getElementById('feature-pretext-text-layout-pilot');
        
        if (calendarToggle) {
            calendarToggle.checked = this.flags.calendar;
        }
        if (deviceDetectionToggle) {
            deviceDetectionToggle.checked = this.flags.deviceDetection;
        }
        if (deviceMatcherToggle) {
            deviceMatcherToggle.checked = this.flags.deviceMatcher;
        }
        if (deviceActivityPromptsToggle) {
            deviceActivityPromptsToggle.checked = this.flags.deviceActivityPrompts;
        }
        if (projectContextToggle) {
            projectContextToggle.checked = this.flags.projectContext;
        }
        if (reportsToggle) {
            reportsToggle.checked = this.flags.reports;
        }
        if (bookForOthersToggle) {
            bookForOthersToggle.checked = this.flags.bookForOthers;
        }
        if (occupiedDevicesToggle) {
            occupiedDevicesToggle.checked = this.flags.occupiedDevices;
        }
        if (chatToggle) {
            chatToggle.checked = this.flags.chat;
        }
        if (userActivityRankToggle) {
            userActivityRankToggle.checked = this.flags.userActivityRank;
        }
        if (pretextTextLayoutPilotToggle) {
            pretextTextLayoutPilotToggle.checked = this.flags.pretextTextLayoutPilot;
        }
    },
    
    /**
     * Настройка обработчиков для админ-панели
     */
    setupAdminToggles() {
        const calendarToggle = document.getElementById('feature-calendar');
        const deviceDetectionToggle = document.getElementById('feature-device-detection');
        const deviceMatcherToggle = document.getElementById('feature-device-matcher');
        const deviceActivityPromptsToggle = document.getElementById('feature-device-activity-prompts');
        const projectContextToggle = document.getElementById('feature-project-context');
        const reportsToggle = document.getElementById('feature-reports');
        const bookForOthersToggle = document.getElementById('feature-book-for-others');
        const occupiedDevicesToggle = document.getElementById('feature-occupied-devices');
        const pretextTextLayoutPilotToggle = document.getElementById('feature-pretext-text-layout-pilot');
        
        if (calendarToggle && !calendarToggle.dataset.initialized) {
            calendarToggle.dataset.initialized = 'true';
            calendarToggle.addEventListener('change', async (e) => {
                await this.setEnabled('calendar', e.target.checked);
            });
        }
        
        if (deviceDetectionToggle && !deviceDetectionToggle.dataset.initialized) {
            deviceDetectionToggle.dataset.initialized = 'true';
            deviceDetectionToggle.addEventListener('change', async (e) => {
                await this.setEnabled('deviceDetection', e.target.checked);
            });
        }
        
        if (deviceMatcherToggle && !deviceMatcherToggle.dataset.initialized) {
            deviceMatcherToggle.dataset.initialized = 'true';
            deviceMatcherToggle.addEventListener('change', async (e) => {
                await this.setEnabled('deviceMatcher', e.target.checked);
            });
        }

        if (deviceActivityPromptsToggle && !deviceActivityPromptsToggle.dataset.initialized) {
            deviceActivityPromptsToggle.dataset.initialized = 'true';
            deviceActivityPromptsToggle.addEventListener('change', async (e) => {
                await this.setEnabled('deviceActivityPrompts', e.target.checked);
            });
        }

        if (projectContextToggle && !projectContextToggle.dataset.initialized) {
            projectContextToggle.dataset.initialized = 'true';
            projectContextToggle.addEventListener('change', async (e) => {
                await this.setEnabled('projectContext', e.target.checked);
            });
        }
        
        if (reportsToggle && !reportsToggle.dataset.initialized) {
            reportsToggle.dataset.initialized = 'true';
            reportsToggle.addEventListener('change', async (e) => {
                await this.setEnabled('reports', e.target.checked);
            });
        }
        
        if (bookForOthersToggle && !bookForOthersToggle.dataset.initialized) {
            bookForOthersToggle.dataset.initialized = 'true';
            bookForOthersToggle.addEventListener('change', async (e) => {
                await this.setEnabled('bookForOthers', e.target.checked);
            });
        }
        
        if (occupiedDevicesToggle && !occupiedDevicesToggle.dataset.initialized) {
            occupiedDevicesToggle.dataset.initialized = 'true';
            occupiedDevicesToggle.addEventListener('change', async (e) => {
                await this.setEnabled('occupiedDevices', e.target.checked);
            });
        }
        
        const chatToggle = document.getElementById('feature-chat');
        if (chatToggle && !chatToggle.dataset.initialized) {
            chatToggle.dataset.initialized = 'true';
            chatToggle.addEventListener('change', async (e) => {
                await this.setEnabled('chat', e.target.checked);
            });
        }

        const userActivityRankToggle = document.getElementById('feature-user-activity-rank');
        if (userActivityRankToggle && !userActivityRankToggle.dataset.initialized) {
            userActivityRankToggle.dataset.initialized = 'true';
            userActivityRankToggle.addEventListener('change', async (e) => {
                await this.setEnabled('userActivityRank', e.target.checked);
            });
        }

        if (pretextTextLayoutPilotToggle && !pretextTextLayoutPilotToggle.dataset.initialized) {
            pretextTextLayoutPilotToggle.dataset.initialized = 'true';
            pretextTextLayoutPilotToggle.addEventListener('change', async (e) => {
                await this.setEnabled('pretextTextLayoutPilot', e.target.checked);
            });
        }
        
        // Обновляем состояние переключателей
        this.updateAdminToggles();
    },
    
    /**
     * Отписка от Firestore при выходе
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.listeners = [];
        this.initialized = false;
        this.hydrated = false;
    }
};

console.log('FeatureFlags module loaded');
