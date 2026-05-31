/**
 * Authentication Module
 * Управление авторизацией через Google
 */

const Auth = {
    currentUser: null,
    isAdmin: false,
    authChecked: false, // Флаг: авторизация уже проверена
    userProfile: null,  // Данные профиля (office, homeAddress, theme, accentScheme)
    unsubscribeRankBookings: null,
    THEME_STORAGE_KEY: 'qa_device_monitor_theme',
    ACCENT_SCHEME_STORAGE_KEY: 'qa_device_monitor_accent_scheme',
    DEFAULT_ACCENT_SCHEME: 'blue',

    /**
     * Инициализация модуля авторизации
     */
    init() {
        this.applyCachedAppearance();

        // Слушатель изменения состояния авторизации
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                await this.handleSignIn(user);
            } else {
                this.handleSignOut();
            }
            
            // Скрываем loading screen после показа нужного экрана
            if (!this.authChecked) {
                this.authChecked = true;
                this.hideLoadingScreen();
            }
        });

        // Обработчик кнопки входа
        const signInBtn = document.getElementById('google-signin-btn');
        if (signInBtn) {
            signInBtn.addEventListener('click', () => this.signInWithGoogle());
        }

        // Обработчик кнопки выхода
        const signOutBtn = document.getElementById('signout-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => this.signOut());
        }
        
        // Настройка модального окна профиля
        this.setupProfileModal();
        
        // Настройка переключателя темы
        this.setupThemeToggle();

        // Настройка выбора акцентной схемы
        this.setupAccentSchemeControl();
    },

    applyCachedAppearance() {
        try {
            const cachedTheme = localStorage.getItem(this.THEME_STORAGE_KEY);
            if (cachedTheme === 'dark' || cachedTheme === 'light') {
                this.applyTheme(cachedTheme);
            }

            const cachedAccentScheme = this.normalizeAccentScheme(
                localStorage.getItem(this.ACCENT_SCHEME_STORAGE_KEY)
            );
            this.applyAccentScheme(cachedAccentScheme);
        } catch (error) {
            console.warn('Failed to apply cached appearance:', error);
        }
    },

    normalizeAccentScheme(scheme) {
        if (scheme === 'green' || scheme === 'blue' || scheme === 'violet') {
            return scheme;
        }

        return this.DEFAULT_ACCENT_SCHEME;
    },

    applyAccentScheme(accentScheme) {
        const normalizedScheme = this.normalizeAccentScheme(accentScheme);
        if (normalizedScheme === 'green') {
            document.documentElement.removeAttribute('data-accent-scheme');
        } else {
            document.documentElement.setAttribute('data-accent-scheme', normalizedScheme);
        }
    },

    syncAccentSchemeControl(accentScheme) {
        const normalizedScheme = this.normalizeAccentScheme(accentScheme);
        const toggle = document.getElementById('accent-scheme-toggle-btn');
        if (toggle) {
            toggle.dataset.accentScheme = normalizedScheme;
        }

        document.querySelectorAll('.accent-scheme-option').forEach((button) => {
            const isActive = button.dataset.accentScheme === normalizedScheme;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    },

    setAccentSchemeMenuVisibility(isOpen) {
        const toggle = document.getElementById('accent-scheme-toggle-btn');
        const menu = document.getElementById('accent-scheme-menu');
        if (!toggle || !menu) return;

        toggle.setAttribute('aria-expanded', String(isOpen));
        menu.classList.toggle('hidden', !isOpen);
    },

    applyAccentSchemeState(accentScheme) {
        const normalizedScheme = this.normalizeAccentScheme(accentScheme);
        this.applyAccentScheme(normalizedScheme);
        this.syncAccentSchemeControl(normalizedScheme);
        localStorage.setItem(this.ACCENT_SCHEME_STORAGE_KEY, normalizedScheme);

        if (this.userProfile) {
            this.userProfile.accentScheme = normalizedScheme;
        }
    },

    setProfileSavingState(isSaving) {
        const form = document.getElementById('profile-form');
        const saveButton = form?.querySelector('button[type="submit"]');
        if (!saveButton) return;

        if (!saveButton.dataset.defaultLabel) {
            saveButton.dataset.defaultLabel = saveButton.textContent.trim();
        }

        saveButton.disabled = isSaving;
        saveButton.classList.toggle('is-loading', isSaving);
        form?.classList.toggle('profile-form-saving', isSaving);
        saveButton.textContent = isSaving ? 'Сохранение' : saveButton.dataset.defaultLabel;
    },

    /**
     * Показать экран загрузки
     */
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
        }
    },

    /**
     * Вход через Google
     */
    async signInWithGoogle() {
        try {
            // Показываем загрузку перед началом входа
            this.showLoadingScreen();
            const result = await auth.signInWithPopup(googleProvider);
            console.log('Successfully signed in');
        } catch (error) {
            console.error('Sign in error:', error);
            this.hideLoadingScreen();
            Toast.show('Ошибка входа: ' + error.message, 'error');
        }
    },

    /**
     * Проверка разрешённого домена email
     */
    isAllowedDomain(email) {
        const allowedDomain = '@test.dev';
        return email && email.toLowerCase().endsWith(allowedDomain);
    },

    /**
     * Обработка успешного входа
     */
    async handleSignIn(user) {
        // Проверяем домен email
        if (!this.isAllowedDomain(user.email)) {
            Toast.show('Доступ разрешён только для аккаунтов @test.dev', 'error');
            await this.signOut();
            return;
        }

        this.currentUser = user;
        
        const pendingRoute = typeof App !== 'undefined' ? App.pendingRoute : null;
        const routeFromPath = window.location.pathname.replace(/^\/+/, '') || 'devices';
        const currentRoute = (typeof App !== 'undefined' && App.validRoutes?.includes(routeFromPath))
            ? routeFromPath
            : 'devices';
        const requestedRoute = pendingRoute || currentRoute;
        const shouldWaitForAdminCheck = requestedRoute === 'admin';

        // Для обычного старта не блокируем первый рендер проверкой прав.
        const adminCheckPromise = this.checkAdminStatus(user.uid).then(() => {
            this.syncRoleDependentUI();
        });
        const saveUserPromise = this.saveUserToFirestore(user);
        if (shouldWaitForAdminCheck) {
            await adminCheckPromise;
        }
        
        // Обновляем UI
        this.syncRoleDependentUI();
        
        // Показываем основное приложение
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        
        // Загружаем данные и переинициализируем поиск
        if (typeof Devices !== 'undefined') {
            if (typeof Devices.init === 'function') {
                Devices.init();
            }
            Devices.loadDevices();
            // Переинициализируем поиск после того, как приложение стало видимым
            setTimeout(() => {
                Devices.setupSearch();
            }, 100);
        }
        
        // Проверяем Force Update после успешной авторизации
        if (typeof VersionManager !== 'undefined') {
            VersionManager.checkForceUpdate();
            // Запускаем real-time слушатель для мгновенных уведомлений
            VersionManager.startConfigListener();
        }
        
        // Переходим на сохранённый маршрут после авторизации
        if (typeof App !== 'undefined' && App.pendingRoute) {
            App.navigateTo(App.pendingRoute);
            App.pendingRoute = null;
        } else {
            // Обрабатываем текущий URL
            if (typeof App !== 'undefined') {
                App.handleRoute();
            }
        }
        
        // Скрываем loading screen
        this.hideLoadingScreen();

        // Логин-апдейт профиля не должен блокировать первый рендер
        saveUserPromise.catch((error) => {
            console.error('Background user save failed:', error);
        });

        if (!shouldWaitForAdminCheck) {
            adminCheckPromise.catch((error) => {
                console.error('Background admin check failed:', error);
            });
        }
        
        // Показываем приветствие только при новом входе, не при перезагрузке
        if (!this.authChecked) {
            Toast.show(`Добро пожаловать, ${user.displayName}!`, 'success');
        }
    },

    /**
     * Проверка, что ошибка связана с отсутствием документа
     */
    isMissingDocError(error) {
        const code = String(error?.code || '').toLowerCase();
        const message = String(error?.message || '').toLowerCase();
        return code.includes('not-found') ||
            code.includes('no-document') ||
            message.includes('no document to update');
    },

    /**
     * Сохранение пользователя в Firestore
     */
    async saveUserToFirestore(user) {
        try {
            const userRef = db.collection(COLLECTIONS.USERS).doc(user.uid);
            const updateData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Быстрый путь для существующего пользователя без предварительного чтения.
            await userRef.update(updateData);
        } catch (error) {
            // Если пользователя ещё нет, создаём документ с дефолтными полями.
            if (this.isMissingDocError(error)) {
                try {
                    const userRef = db.collection(COLLECTIONS.USERS).doc(user.uid);
                    await userRef.set({
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        photoURL: user.photoURL,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                        isAdmin: false,
                        accentScheme: this.DEFAULT_ACCENT_SCHEME
                    });
                    return;
                } catch (createError) {
                    console.error('Error creating user:', createError);
                    return;
                }
            }
            console.error('Error saving user:', error);
        }
    },

    /**
     * Проверка статуса администратора и загрузка профиля
     */
    async checkAdminStatus(uid) {
        try {
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                this.isAdmin = data.isAdmin === true;
                this.userProfile = {
                    office: data.office || '',
                    homeAddress: data.homeAddress || '',
                    isSharedAccount: data.isSharedAccount === true,
                    theme: data.theme || 'light',
                    accentScheme: this.normalizeAccentScheme(data.accentScheme)
                };
                // BR.05.18 / 05.30 — поднимаем isSharedAccount на уровень
                // currentUser, чтобы shared-flow в QR-бронировании не зависел
                // от того, успел ли резолвиться userProfile.
                if (this.currentUser && this.currentUser.uid === uid) {
                    this.currentUser.isSharedAccount = data.isSharedAccount === true;
                }
                // Применяем сохранённую тему
                this.applyTheme(this.userProfile.theme);
                localStorage.setItem(this.THEME_STORAGE_KEY, this.userProfile.theme);
                this.applyAccentSchemeState(this.userProfile.accentScheme);
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            this.isAdmin = false;
            this.userProfile = null;
        }
    },

    syncRoleDependentUI() {
        if (!this.currentUser) return;

        if (this.isAdmin) {
            if (typeof App !== 'undefined' && typeof App.ensureUsersReady === 'function') {
                App.ensureUsersReady().catch((error) => {
                    console.error('Auth: failed to initialize users module', error);
                });
            } else if (typeof Users !== 'undefined' && typeof Users.init === 'function') {
                Users.init();
            }
        }

        if (typeof Projects !== 'undefined') {
            if (typeof Projects.init === 'function' && !Projects.initialized) {
                Projects.init();
            } else {
                if (typeof Projects.loadProjects === 'function') {
                    Projects.loadProjects();
                }
                if (typeof Projects.loadAssignments === 'function') {
                    Projects.loadAssignments();
                }
            }
        }

        this.updateUserUI(this.currentUser);

        const adminTab = document.getElementById('admin-tab');
        if (adminTab) {
            adminTab.style.display = this.isAdmin ? 'flex' : 'none';
        }

        if (!this.isAdmin && typeof App !== 'undefined' && App.currentTab === 'admin') {
            App.switchTab('devices');
        }
    },

    /**
     * Обновление UI с данными пользователя
     */
    updateUserUI(user) {
        const avatar = document.getElementById('user-avatar');
        const name = document.getElementById('user-name');
        const role = document.getElementById('user-role');
        
        if (avatar) {
            avatar.src = user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23a0a0b0"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>';
        }
        if (name) {
            name.textContent = user.displayName || user.email;
        }
        if (role) {
            role.textContent = this.isAdmin ? 'Администратор' : 'Пользователь';
        }

        this.subscribeUserRankHighlight();
    },

    isUserRankHighlightEnabled() {
        if (typeof FeatureFlags === 'undefined') {
            return true;
        }

        if (typeof FeatureFlags.isHydrated === 'function' && !FeatureFlags.isHydrated()) {
            return false;
        }

        return FeatureFlags.isEnabled('userActivityRank');
    },

    syncUserRankHighlight() {
        if (this.unsubscribeRankBookings) {
            this.unsubscribeRankBookings();
            this.unsubscribeRankBookings = null;
        }

        if (!this.currentUser?.uid || !this.isUserRankHighlightEnabled()) {
            this.updateUserRankHighlight(null);
            return;
        }

        const rankCutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        this.unsubscribeRankBookings = db.collection(COLLECTIONS.BOOKINGS)
            .where('createdAt', '>=', rankCutoffDate)
            .limit(5000)
            .onSnapshot((snapshot) => {
                const bookings = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                }));
                const rankContext = this.calculateCurrentUserRank(bookings, this.currentUser.uid);
                this.updateUserRankHighlight(rankContext);
            }, (error) => {
                console.error('Auth: failed to load rank highlight', error);
                this.updateUserRankHighlight(null);
            });
    },

    subscribeUserRankHighlight() {
        this.syncUserRankHighlight();
    },

    calculateCurrentUserRank(bookings, currentUserId) {
        const rankingActions = new Set([BOOKING_ACTIONS.TAKE, BOOKING_ACTIONS.BOOK]);
        const periodValue = typeof Activity !== 'undefined' ? Activity.currentPeriod : 30;
        const cutoffDate = periodValue === 'all'
            ? null
            : new Date(Date.now() - (parseInt(periodValue, 10) || 30) * 24 * 60 * 60 * 1000);
        const statsByUser = {};

        bookings.forEach((booking) => {
            if (!rankingActions.has(booking.action) || !booking.userId) return;

            const createdAt = booking.createdAt?.toDate ? booking.createdAt.toDate() : (booking.createdAt ? new Date(booking.createdAt) : null);
            if (cutoffDate && (!createdAt || createdAt < cutoffDate)) return;

            if (!statsByUser[booking.userId]) {
                statsByUser[booking.userId] = {
                    userId: booking.userId,
                    bookingCount: 0,
                    uniqueDeviceIds: new Set()
                };
            }

            statsByUser[booking.userId].bookingCount += 1;
            if (booking.deviceId) {
                statsByUser[booking.userId].uniqueDeviceIds.add(booking.deviceId);
            }
        });

        if (currentUserId && !statsByUser[currentUserId]) {
            statsByUser[currentUserId] = {
                userId: currentUserId,
                bookingCount: 0,
                uniqueDeviceIds: new Set()
            };
        }

        const rankedUsers = Object.values(statsByUser)
            .map((user) => ({
                userId: user.userId,
                bookingCount: user.bookingCount,
                uniqueDeviceCount: user.uniqueDeviceIds.size,
                rank: null
            }))
            .sort((a, b) => {
                if (b.uniqueDeviceCount !== a.uniqueDeviceCount) {
                    return b.uniqueDeviceCount - a.uniqueDeviceCount;
                }
                return b.bookingCount - a.bookingCount;
            });

        let currentRank = 1;
        let previousUniqueDevices = null;
        let previousBookingCount = null;

        for (let index = 0; index < rankedUsers.length; index += 1) {
            const user = rankedUsers[index];
            if (
                previousUniqueDevices !== null &&
                (user.uniqueDeviceCount !== previousUniqueDevices || user.bookingCount !== previousBookingCount)
            ) {
                currentRank = index + 1;
            }
            user.rank = currentRank;

            if (user.userId === currentUserId) {
                const leader = rankedUsers[0] || null;
                const nextHigher = index > 0 ? rankedUsers[index - 1] : null;
                const topFiveTarget = rankedUsers.length >= 5 ? rankedUsers[4] : rankedUsers[rankedUsers.length - 1] || null;
                return {
                    rank: currentRank,
                    index,
                    uniqueDeviceCount: user.uniqueDeviceCount,
                    bookingCount: user.bookingCount,
                    leaderUniqueDeviceCount: leader?.uniqueDeviceCount || user.uniqueDeviceCount,
                    leaderBookingCount: leader?.bookingCount || user.bookingCount,
                    periodLabel: this.getActivityPeriodLabel(periodValue),
                    nextHigher,
                    topFiveTarget
                };
            }

            previousUniqueDevices = user.uniqueDeviceCount;
            previousBookingCount = user.bookingCount;
        }

        return null;
    },

    getActivityPeriodLabel(periodValue) {
        if (periodValue === 'all') {
            return 'за всё время';
        }

        const days = parseInt(periodValue, 10) || 30;
        return `за ${days} дн.`;
    },

    formatRankAction(rankContext) {
        if (!rankContext) return null;

        const buildGap = (target) => {
            if (!target) return null;
            const value = Math.max((target.uniqueDeviceCount - rankContext.uniqueDeviceCount) + 1, 1);
            const noun = value === 1 ? 'устройство' : value < 5 ? 'устройства' : 'устройств';
            return `${value} ${noun}`;
        };

        const nextHigherGap = buildGap(rankContext.nextHigher);
        const topFiveGap = buildGap(rankContext.topFiveTarget);

        if (rankContext.rank === 1) {
            return {
                type: 'leader',
                badgeText: '#1',
                title: 'Первое место твоё',
                rows: [
                    {
                        label: 'Сейчас ты лидер',
                        emphasis: 'так держать'
                    }
                ]
            };
        }

        if (rankContext.rank <= 5) {
            return {
                type: 'top-five',
                badgeText: `#${rankContext.rank}`,
                title: rankContext.rank <= 3 ? `Топ-${rankContext.rank}` : 'Топ-5',
                rows: rankContext.nextHigher && nextHigherGap
                    ? [{
                        label: `До #${rankContext.nextHigher.rank}`,
                        emphasis: nextHigherGap
                    }]
                    : [{
                        label: 'Ты уже в топ-5',
                        emphasis: 'держи темп'
                    }]
            };
        }

        const rows = [];
        if (rankContext.nextHigher && nextHigherGap) {
            rows.push({
                label: `Чтобы обогнать #${rankContext.nextHigher.rank}`,
                emphasis: nextHigherGap
            });
        }
        if (rankContext.rank > 5 && rankContext.topFiveTarget && topFiveGap && rankContext.topFiveTarget.rank <= 5 && rankContext.nextHigher?.rank !== 5) {
            rows.push({
                label: 'Чтобы войти в топ-5, возьми:',
                emphasis: topFiveGap
            });
        }

        return rows.length > 0 ? {
            type: 'rising',
            badgeText: '↗',
            title: 'Чтобы подняться выше, бери устройства, которые еще не брал(а)',
            rows: rows.map((row) => ({
                ...row,
                label: row.label.startsWith('Чтобы обогнать')
                    ? row.label.replace('Чтобы обогнать', 'Чтобы обогнать').replace(',', '') + (row.label.endsWith(':') ? '' : ', возьми:')
                    : row.label
            }))
        } : null;
    },

    updateUserRankHighlight(rankContext) {
        const widget = document.getElementById('user-rank-widget');
        const badge = document.getElementById('user-rank-badge');
        const popover = document.getElementById('user-rank-popover');
        const profileButton = document.getElementById('user-profile-btn');
        if (!widget || !badge || !popover || !profileButton) return;
        const rankBadge = this.formatRankAction(rankContext);

        if (rankBadge?.type) {
            widget.className = `user-rank-widget is-${rankBadge.type}`;
            widget.classList.remove('hidden');
            badge.textContent = rankBadge.badgeText;
            badge.dataset.rankMessage = rankBadge.type;
            badge.dataset.rank = rankContext?.rank ? String(rankContext.rank) : '';
            badge.setAttribute('title', rankBadge.title);
            badge.setAttribute('aria-expanded', 'false');
            popover.innerHTML = `
                <div class="user-rank-popover-line user-rank-popover-title">${rankBadge.title}</div>
                <div class="user-rank-popover-list">
                    ${rankBadge.rows.map((row) => `
                        <div class="user-rank-popover-line user-rank-popover-progress">
                            <span>${row.label}</span>
                            <strong>${row.emphasis}</strong>
                        </div>
                    `).join('')}
                </div>
            `;
            popover.classList.add('hidden');
            profileButton.classList.toggle('is-rank-leader', rankBadge.type === 'leader');
            profileButton.classList.toggle('is-rank-chaser', rankBadge.type === 'top-five' || rankBadge.type === 'rising');
            if (!badge.dataset.initialized) {
                badge.dataset.initialized = 'true';
                const togglePopover = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const isOpen = !popover.classList.contains('hidden');
                    popover.classList.toggle('hidden', isOpen);
                    badge.setAttribute('aria-expanded', String(!isOpen));
                };
                badge.addEventListener('click', togglePopover);
                badge.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        togglePopover(event);
                    }
                });
                widget.addEventListener('mouseenter', () => {
                    popover.classList.remove('hidden');
                    badge.setAttribute('aria-expanded', 'true');
                });
                widget.addEventListener('mouseleave', () => {
                    popover.classList.add('hidden');
                    badge.setAttribute('aria-expanded', 'false');
                });
                badge.addEventListener('focus', () => {
                    popover.classList.remove('hidden');
                    badge.setAttribute('aria-expanded', 'true');
                });
                badge.addEventListener('blur', () => {
                    popover.classList.add('hidden');
                    badge.setAttribute('aria-expanded', 'false');
                });
                document.addEventListener('click', (event) => {
                    if (!widget.contains(event.target)) {
                        popover.classList.add('hidden');
                        badge.setAttribute('aria-expanded', 'false');
                    }
                });
            }
            return;
        }

        widget.className = 'user-rank-widget hidden';
        badge.textContent = '';
        badge.dataset.rankMessage = '';
        badge.dataset.rank = '';
        badge.setAttribute('aria-expanded', 'false');
        popover.textContent = '';
        popover.classList.add('hidden');
        profileButton.classList.remove('is-rank-leader', 'is-rank-chaser');
    },

    /**
     * Выход из системы
     */
    async signOut() {
        try {
            await auth.signOut();
            Toast.show('Вы вышли из системы', 'success');
        } catch (error) {
            console.error('Sign out error:', error);
            Toast.show('Ошибка выхода: ' + error.message, 'error');
        }
    },

    /**
     * Обработка выхода
     */
    handleSignOut() {
        this.currentUser = null;
        this.isAdmin = false;
        if (this.unsubscribeRankBookings) {
            this.unsubscribeRankBookings();
            this.unsubscribeRankBookings = null;
        }
        this.updateUserRankHighlight(null);

        // Отписываемся через SubscriptionManager (централизованный реестр)
        if (typeof SubscriptionManager !== 'undefined') {
            SubscriptionManager.unsubscribeAll();
        }

        // Ручная отписка для модулей, ещё не перешедших на SubscriptionManager
        if (typeof Devices !== 'undefined' && Devices.unsubscribe) {
            Devices.unsubscribe();
            Devices.unsubscribe = null;
        }
        if (typeof Devices !== 'undefined' && Devices.resetUsedDevicesState) {
            Devices.resetUsedDevicesState();
        }
        if (typeof Users !== 'undefined' && Users.unsubscribe) {
            Users.unsubscribe();
            Users.unsubscribe = null;
        }
        if (typeof Projects !== 'undefined' && typeof Projects.cleanup === 'function') {
            Projects.cleanup();
        }
        if (typeof App !== 'undefined' && App.historyUnsubscribe) {
            App.historyUnsubscribe();
            App.historyUnsubscribe = null;
        }
        if (typeof Statistics !== 'undefined' && Statistics.unsubscribe) {
            Statistics.unsubscribe();
            Statistics.unsubscribe = null;
            Statistics.bookingsScope = null;
            Statistics.bookings = [];
        }
        
        // Скрываем loading screen и показываем экран авторизации
        this.hideLoadingScreen();
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    },

    /**
     * Получить текущего пользователя
     */
    getUser() {
        return this.currentUser;
    },

    /**
     * Проверить, авторизован ли пользователь
     */
    isAuthenticated() {
        return this.currentUser !== null;
    },

    /**
     * Проверить, является ли текущий аккаунт общим (shared)
     * Общий аккаунт не может бронировать устройства на себя
     */
    isSharedAccount() {
        return this.userProfile?.isSharedAccount === true;
    },

    /**
     * Установить/снять флаг общего аккаунта (только для администраторов)
     */
    async setSharedAccount(uid, isShared) {
        if (!this.isAdmin) {
            Toast.show('Недостаточно прав', 'error');
            return false;
        }
        
        try {
            await db.collection(COLLECTIONS.USERS).doc(uid).update({
                isSharedAccount: isShared
            });
            Toast.show(isShared ? 'Общий аккаунт включен' : 'Общий аккаунт отключен', 'success');
            return true;
        } catch (error) {
            console.error('Error setting shared account:', error);
            Toast.show('Ошибка: ' + error.message, 'error');
            return false;
        }
    },

    /**
     * Скрыть экран загрузки
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    },

    /**
     * Назначить администратора (только для других администраторов)
     */
    async setAdmin(uid, isAdmin) {
        if (!this.isAdmin) {
            Toast.show('Недостаточно прав', 'error');
            return false;
        }
        
        try {
            await db.collection(COLLECTIONS.USERS).doc(uid).update({
                isAdmin: isAdmin
            });
            Toast.show(isAdmin ? 'Права администратора выданы' : 'Права администратора сняты', 'success');
            return true;
        } catch (error) {
            console.error('Error setting admin:', error);
            Toast.show('Ошибка: ' + error.message, 'error');
            return false;
        }
    },
    
    /**
     * Открыть модальное окно профиля
     */
    openProfileModal() {
        const modal = document.getElementById('profile-modal');
        if (!modal || !this.currentUser) return;
        
        // Заполняем данные
        document.getElementById('profile-avatar').src = this.currentUser.photoURL || '';
        document.getElementById('profile-name').textContent = this.currentUser.displayName || 'Пользователь';
        document.getElementById('profile-email').textContent = this.currentUser.email || '';
        document.getElementById('profile-office').value = this.userProfile?.office || '';
        document.getElementById('profile-home-address').value = this.userProfile?.homeAddress || '';

        if (
            typeof Projects !== 'undefined' &&
            typeof Projects.renderProfileProjectsList === 'function' &&
            typeof Projects.isProjectContextEnabled === 'function' &&
            Projects.isProjectContextEnabled()
        ) {
            Projects.renderProfileProjectsList(this.currentUser.uid);
        }
        
        modal.classList.remove('hidden');
    },
    
    /**
     * Закрыть модальное окно профиля
     */
    closeProfileModal() {
        const modal = document.getElementById('profile-modal');
        if (modal) modal.classList.add('hidden');
    },
    
    /**
     * Сохранить профиль
     */
    async saveProfile() {
        if (!this.currentUser) return;
        
        const office = document.getElementById('profile-office').value.trim();
        const homeAddress = document.getElementById('profile-home-address').value.trim();
        const selectedProjectIds = typeof Projects !== 'undefined' && typeof Projects.getSelectedProfileProjectIds === 'function'
            ? Projects.getSelectedProfileProjectIds()
            : [];

        this.setProfileSavingState(true);
        
        try {
            // Обновляем профиль пользователя
            await db.collection(COLLECTIONS.USERS).doc(this.currentUser.uid).update({
                office: office,
                homeAddress: homeAddress
            });
            
            // Обновляем все забронированные устройства пользователя
            const devicesSnapshot = await db.collection(COLLECTIONS.DEVICES)
                .where('currentUserId', '==', this.currentUser.uid)
                .get();
            
            if (devicesSnapshot.docs.length > 0) {
                const deviceBatch = db.batch();
                devicesSnapshot.docs.forEach(doc => {
                    deviceBatch.update(doc.ref, {
                        currentUserOffice: office,
                        currentUserHomeAddress: homeAddress
                    });
                });
                await deviceBatch.commit();
            }

            if (
                typeof Projects !== 'undefined' &&
                typeof Projects.syncProjectsForUser === 'function' &&
                typeof Projects.isProjectContextEnabled === 'function' &&
                Projects.isProjectContextEnabled()
            ) {
                await Projects.syncProjectsForUser(this.currentUser.uid, selectedProjectIds, {
                    userRecord: {
                        id: this.currentUser.uid,
                        displayName: this.currentUser.displayName,
                        email: this.currentUser.email,
                        photoURL: this.currentUser.photoURL
                    }
                });
            }
            
            this.userProfile = { 
                ...this.userProfile,
                office, 
                homeAddress
            };
            
            const updatedCount = devicesSnapshot.docs.length;
            Toast.show(
                `Профиль сохранён${updatedCount > 0 ? `, обновлено ${updatedCount} устройств` : ''}`, 
                'success'
            );
            this.closeProfileModal();
        } catch (error) {
            console.error('Error saving profile:', error);
            Toast.show('Ошибка сохранения', 'error');
        } finally {
            this.setProfileSavingState(false);
        }
    },
    
    /**
     * Настройка модального окна профиля
     */
    setupProfileModal() {
        const modal = document.getElementById('profile-modal');
        const form = document.getElementById('profile-form');
        const profileBtn = document.getElementById('user-profile-btn');
        
        if (!modal) return;
        
        // Открытие профиля
        profileBtn?.addEventListener('click', () => this.openProfileModal());
        
        // Закрытие
        modal.querySelector('.modal-close')?.addEventListener('click', () => this.closeProfileModal());
        modal.querySelector('.modal-overlay')?.addEventListener('click', () => this.closeProfileModal());
        modal.querySelector('.modal-cancel')?.addEventListener('click', () => this.closeProfileModal());
        
        // Сохранение
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });
    },
    
    /**
     * Настройка переключателя темы
     */
    setupThemeToggle() {
        const toggleBtn = document.getElementById('theme-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleTheme());
        }
    },

    setupAccentSchemeControl() {
        const toggleBtn = document.getElementById('accent-scheme-toggle-btn');
        const menu = document.getElementById('accent-scheme-menu');
        if (!toggleBtn || !menu) return;

        toggleBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const shouldOpen = toggleBtn.getAttribute('aria-expanded') !== 'true';
            this.setAccentSchemeMenuVisibility(shouldOpen);
        });

        menu.querySelectorAll('.accent-scheme-option').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.stopPropagation();
                await this.saveAccentScheme(button.dataset.accentScheme);
            });
        });

        document.addEventListener('click', (event) => {
            if (!menu.classList.contains('hidden') &&
                !menu.contains(event.target) &&
                !toggleBtn.contains(event.target)) {
                this.setAccentSchemeMenuVisibility(false);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.setAccentSchemeMenuVisibility(false);
            }
        });

        this.syncAccentSchemeControl(this.getAccentScheme());
    },
    
    /**
     * Применить тему
     * @param {string} theme - 'light' или 'dark'
     */
    applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    },
    
    /**
     * Переключить тему и сохранить в Firestore
     */
    async toggleTheme() {
        const currentTheme = this.userProfile?.theme || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        // Применяем тему сразу
        this.applyTheme(newTheme);
        localStorage.setItem(this.THEME_STORAGE_KEY, newTheme);
        
        // Обновляем локальный профиль
        if (this.userProfile) {
            this.userProfile.theme = newTheme;
        }
        
        // Сохраняем в Firestore если пользователь авторизован
        if (this.currentUser) {
            try {
                await db.collection(COLLECTIONS.USERS).doc(this.currentUser.uid).update({
                    theme: newTheme
                });
            } catch (error) {
                console.error('Error saving theme:', error);
                // Не показываем ошибку пользователю, тема уже применена локально
            }
        }
    },

    async saveAccentScheme(accentScheme) {
        const normalizedScheme = this.normalizeAccentScheme(accentScheme);
        const previousScheme = this.getAccentScheme();

        this.applyAccentSchemeState(normalizedScheme);
        this.setAccentSchemeMenuVisibility(false);

        if (!this.currentUser) {
            return;
        }

        try {
            await db.collection(COLLECTIONS.USERS).doc(this.currentUser.uid).update({
                accentScheme: normalizedScheme
            });
        } catch (error) {
            console.error('Error saving accent scheme:', error);
            this.applyAccentSchemeState(previousScheme);
            Toast.show('Ошибка сохранения цветовой схемы', 'error');
        }
    },
    
    /**
     * Получить текущую тему
     * @returns {string} 'light' или 'dark'
     */
    getTheme() {
        return this.userProfile?.theme || 'light';
    },

    getAccentScheme() {
        return this.normalizeAccentScheme(
            this.userProfile?.accentScheme || localStorage.getItem(this.ACCENT_SCHEME_STORAGE_KEY)
        );
    }
};

// Уведомления (Toast)
const Toast = {
    container: null,

    init() {
        this.container = document.getElementById('toast-container');
    },

    show(message, type = 'success', duration = 4000) {
        if (!this.container) {
            this.init();
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = this.getIcon(type);
        
        toast.innerHTML = `
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${icon}
            </svg>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;

        this.container.appendChild(toast);

        // Обработчик закрытия
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.remove(toast);
        });

        // Автоматическое удаление
        setTimeout(() => {
            this.remove(toast);
        }, duration);
    },

    getIcon(type) {
        switch (type) {
            case 'info':
                return '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>';
            case 'success':
                return '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
            case 'error':
                return '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
            case 'warning':
                return '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>';
            default:
                return '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>';
        }
    },

    remove(toast) {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
};

// Добавляем анимацию выхода в стили
const style = document.createElement('style');
style.textContent = `
    @keyframes toastOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100%); }
    }
`;
document.head.appendChild(style);

console.log('Auth module loaded');
