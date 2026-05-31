/**
 * Users Module
 * Управление пользователями (для админов)
 */

const Users = {
    users: [],
    usersById: new Map(),
    unsubscribe: null,
    searchQuery: '',
    initialized: false,

    /**
     * Инициализация модуля
     */
    init() {
        if (this.initialized) return;
        this.setupAdminTabs();
        this.setupAdminViewTabs();
        this.setupUsersSearch();
        document.addEventListener('projectsUpdated', () => {
            const usersTab = document.getElementById('admin-users-tab');
            if (usersTab?.classList.contains('active')) {
                this.renderUsers();
            }
        });
        this.initialized = true;
    },

    setupAdminViewTabs() {
        const tabContainers = document.querySelectorAll('.admin-view-tabs');

        tabContainers.forEach(container => {
            if (container.dataset.listenerAdded === 'true') return;
            container.dataset.listenerAdded = 'true';

            const tabs = container.querySelectorAll('.admin-view-tab');
            const viewIds = Array.from(tabs)
                .map(tab => tab.dataset.adminView)
                .filter(Boolean);

            tabs.forEach(tab => {
                tab.addEventListener('click', async () => {
                    const viewId = tab.dataset.adminView;
                    if (!viewId) return;

                    tabs.forEach(t => t.classList.toggle('active', t === tab));
                    viewIds.forEach(id => {
                        document.getElementById(id)?.classList.toggle('active', id === viewId);
                    });

                    if (viewId === 'devices-management' && typeof Devices !== 'undefined' && typeof Devices.renderAdminDevices === 'function') {
                        Devices.renderAdminDevices();
                        Devices.adminDevicesRenderPending = false;
                    }

                    if (viewId === 'users-management') {
                        this.renderUsers();
                    }

                    if (viewId === 'devices-analysis' || viewId === 'users-analysis') {
                        if (typeof App !== 'undefined' && typeof App.ensureStatisticsReady === 'function') {
                            await App.ensureStatisticsReady();
                        }
                        if (typeof Statistics !== 'undefined' && typeof Statistics.loadStatistics === 'function') {
                            await Statistics.loadStatistics();
                        }
                    }
                });
            });
        });
    },

    /**
     * Настройка поиска пользователей
     */
    setupUsersSearch() {
        SearchUtils.setup({
            inputId:    'admin-users-search',
            wrapperId:  'admin-users-search-wrapper',
            clearBtnId: 'admin-users-search-clear',
            debounceMs: 150,
            onSearch: (query) => {
                this.searchQuery = query;
                this.renderUsers();
            },
            onClear: () => {
                this.searchQuery = '';
                this.renderUsers();
            }
        });
    },

    /**
     * Очистка поиска пользователей
     */
    clearUsersSearch() {
        SearchUtils.clear('admin-users-search', 'admin-users-search-wrapper');
        this.searchQuery = '';
        this.renderUsers();
    },

    /**
     * Настройка переключения админ-вкладок
     */
    setupAdminTabs() {
        const tabs = document.querySelectorAll('.admin-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', async () => {
                const tabName = tab.dataset.adminTab;

                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                document.querySelectorAll('.admin-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`admin-${tabName}-tab`)?.classList.add('active');

                if (tabName === 'devices') {
                    if (typeof Devices !== 'undefined' && typeof Devices.renderAdminDevices === 'function') {
                        if (typeof Devices.ensureAdminUiReady === 'function') {
                            Devices.ensureAdminUiReady();
                        }
                        Devices.renderAdminDevices();
                        Devices.adminDevicesRenderPending = false;
                    }
                    if (typeof App !== 'undefined' && typeof App.ensureStatisticsReady === 'function') {
                        await App.ensureStatisticsReady();
                    }
                    if (typeof Statistics !== 'undefined') {
                        await Statistics.loadStatistics();
                    }
                } else if (tabName === 'users') {
                    this.loadUsers();
                    if (typeof App !== 'undefined' && typeof App.ensureStatisticsReady === 'function') {
                        await App.ensureStatisticsReady();
                    }
                    if (typeof Statistics !== 'undefined') {
                        await Statistics.loadStatistics();
                    }
                } else if (tabName === 'projects') {
                    if (typeof Projects !== 'undefined' && typeof Projects.renderAdminProjects === 'function') {
                        await Projects.renderAdminProjects();
                    }
                } else if (tabName === 'statistics') {
                    if (typeof App !== 'undefined' && typeof App.ensureStatisticsReady === 'function') {
                        await App.ensureStatisticsReady();
                    }
                    if (typeof Statistics !== 'undefined') {
                        await Statistics.loadStatistics();
                    }
                } else if (tabName === 'reports') {
                    if (typeof App !== 'undefined' && typeof App.ensureExportReady === 'function') {
                        await App.ensureExportReady();
                    }
                } else if (tabName === 'import') {
                    if (typeof App !== 'undefined' && typeof App.ensureImportReady === 'function') {
                        const ready = await App.ensureImportReady();
                        if (!ready && typeof Toast !== 'undefined') {
                            Toast.show('Модуль импорта не загружен', 'error');
                        }
                    } else if (typeof Import !== 'undefined' && typeof Import.init === 'function') {
                        Import.init();
                    }
                } else if (tabName === 'updates' && typeof VersionManager !== 'undefined') {
                    VersionManager.loadForceUpdateSettings();
                } else if (tabName === 'features' && typeof FeatureFlags !== 'undefined') {
                    FeatureFlags.setupAdminToggles();
                }
            });
        });
    },

    /**
     * Загрузка пользователей из Firestore
     */
    loadUsers() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        return new Promise((resolve, reject) => {
            let firstSnapshotHandled = false;

            this.unsubscribe = db.collection(COLLECTIONS.USERS)
                .orderBy('displayName')
                .limit(500)
                .onSnapshot((snapshot) => {
                    this.users = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    this.usersById = new Map(this.users.map(u => [u.id, u]));

                    if (typeof Projects !== 'undefined' && typeof Projects.setKnownUsers === 'function') {
                        Projects.setKnownUsers(this.users);
                    }

                    this.renderUsers();
                    this.updateBookingUserSelect();

                    if (!firstSnapshotHandled) {
                        firstSnapshotHandled = true;
                        resolve(this.users);
                    }
                }, (error) => {
                    console.error('Error loading users:', error);
                    Toast.show('Ошибка загрузки пользователей', 'error');
                    if (!firstSnapshotHandled) {
                        firstSnapshotHandled = true;
                        reject(error);
                    }
                });
        });
    },

    /**
     * Отображение списка пользователей
     */
    renderUsers() {
        const list = document.getElementById('admin-users-list');
        const countEl = document.getElementById('users-count');

        if (!list) return;

        let filteredUsers = this.users;
        const isProjectContextEnabled = typeof Projects !== 'undefined'
            && typeof Projects.isProjectContextEnabled === 'function'
            && Projects.isProjectContextEnabled();
        if (this.searchQuery) {
            const query = this.searchQuery;
            filteredUsers = this.users.filter(user => {
                const projectAssignments = isProjectContextEnabled && typeof Projects !== 'undefined' && typeof Projects.getAssignmentsForUser === 'function'
                    ? Projects.getAssignmentsForUser(user.id, { activeOnly: true })
                    : [];
                const searchFields = [
                    user.displayName,
                    user.email,
                    ...projectAssignments.map(assignment => assignment.project?.name),
                    ...projectAssignments.map(assignment => assignment.project?.code)
                ].map(f => (f || '').toLowerCase());

                return searchFields.some(f => f.includes(query));
            });
        }

        if (countEl) {
            if (this.searchQuery && filteredUsers.length !== this.users.length) {
                countEl.textContent = `Найдено: ${filteredUsers.length} из ${this.users.length}`;
            } else {
                countEl.textContent = `Всего: ${this.users.length}`;
            }
        }

        if (filteredUsers.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <p>${this.searchQuery ? 'Пользователи не найдены' : 'Нет зарегистрированных пользователей'}</p>
                </div>
            `;
            return;
        }

        const currentUserId = Auth.getUser()?.uid;

        list.innerHTML = filteredUsers.map(user => {
            const lastLogin = user.lastLogin?.toDate();
            const lastLoginStr = lastLogin ? this.formatDate(lastLogin) : 'Неизвестно';
            const createdAt = user.createdAt?.toDate();
            const createdAtStr = createdAt ? this.formatDate(createdAt) : 'Неизвестно';
            const isCurrentUser = user.id === currentUserId;
            const isSharedAccount = user.isSharedAccount === true;
            const projectAssignments = isProjectContextEnabled && typeof Projects !== 'undefined' && typeof Projects.getAssignmentsForUser === 'function'
                ? Projects.getAssignmentsForUser(user.id, { activeOnly: true })
                : [];
            const availableProjects = isProjectContextEnabled && typeof Projects !== 'undefined' && typeof Projects.getActiveProjects === 'function'
                ? Projects.getActiveProjects().filter(project => !projectAssignments.some(assignment => assignment.projectId === project.id))
                : [];

            return `
                <div class="admin-user-item" data-user-id="${user.id}">
                    <img class="admin-user-avatar" src="${user.photoURL || 'data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 24 24\\" fill=\\"%2394a3b8\\"><circle cx=\\"12\\" cy=\\"8\\" r=\\"4\\"/><path d=\\"M20 21a8 8 0 0 0-16 0\\"/></svg>'}" alt="">
                    <div class="admin-user-info">
                        <div class="admin-user-name">
                            ${user.displayName || 'Без имени'}
                            ${user.isAdmin ? '<span class="admin-user-badge admin">Админ</span>' : ''}
                            ${isSharedAccount ? '<span class="admin-user-badge shared">Общий</span>' : ''}
                        </div>
                        <div class="admin-user-email">${user.email || '—'}</div>
                        <div class="admin-user-meta">
                            <span>Регистрация: ${createdAtStr}</span>
                            <span>Последний вход: ${lastLoginStr}</span>
                        </div>
                        ${isProjectContextEnabled ? `
                        <div class="admin-user-projects">
                            <div class="admin-user-project-tags">
                                ${projectAssignments.length > 0 ? projectAssignments.map((assignment) => `
                                    <span class="admin-user-project-tag">
                                        ${Projects.escapeHtml(assignment.project?.name || assignment.projectName || 'Проект')}
                                        <button
                                            type="button"
                                            class="admin-user-project-remove"
                                            data-assignment-id="${assignment.id}"
                                            title="Убрать проект"
                                        >
                                            ×
                                        </button>
                                    </span>
                                `).join('') : '<span class="admin-user-project-empty">Проекты не выбраны</span>'}
                            </div>
                            <div class="admin-user-project-toolbar">
                                <select class="form-input admin-user-project-select" data-user-id="${user.id}">
                                    <option value="">Добавить проект</option>
                                    ${availableProjects.map((project) => `
                                        <option value="${project.id}">${Projects.escapeHtml(project.name || project.code || 'Проект')}</option>
                                    `).join('')}
                                </select>
                                <button
                                    type="button"
                                    class="secondary-btn admin-user-project-add-btn"
                                    data-user-id="${user.id}"
                                    ${availableProjects.length === 0 ? 'disabled' : ''}
                                >
                                    Добавить
                                </button>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                    <div class="admin-user-actions">
                        <label class="admin-toggle" title="${isSharedAccount ? 'Отключить общий аккаунт' : 'Сделать общим аккаунтом'}">
                            <input type="checkbox" class="shared-toggle-input" data-user-id="${user.id}" ${isSharedAccount ? 'checked' : ''}>
                            <span class="admin-toggle-slider shared"></span>
                            <span class="admin-toggle-label">Общий</span>
                        </label>
                        <label class="admin-toggle ${isCurrentUser ? 'disabled' : ''}" title="${isCurrentUser ? 'Нельзя изменить свои права' : (user.isAdmin ? 'Снять права админа' : 'Сделать админом')}">
                            <input type="checkbox" class="admin-toggle-input" data-user-id="${user.id}" ${user.isAdmin ? 'checked' : ''} ${isCurrentUser ? 'disabled' : ''}>
                            <span class="admin-toggle-slider"></span>
                            <span class="admin-toggle-label">Админ</span>
                        </label>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.admin-toggle-input').forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const userId = e.target.dataset.userId;
                const isAdmin = e.target.checked;

                e.target.disabled = true;

                const success = await Auth.setAdmin(userId, isAdmin);
                if (!success) {
                    e.target.checked = !isAdmin;
                }

                e.target.disabled = false;
            });
        });

        list.querySelectorAll('.shared-toggle-input').forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const userId = e.target.dataset.userId;
                const isShared = e.target.checked;

                e.target.disabled = true;

                const success = await Auth.setSharedAccount(userId, isShared);
                if (!success) {
                    e.target.checked = !isShared;
                }

                e.target.disabled = false;
            });
        });

        if (isProjectContextEnabled) {
            list.querySelectorAll('.admin-user-project-add-btn').forEach((button) => {
                button.addEventListener('click', async () => {
                    const userId = button.dataset.userId;
                    const card = button.closest('.admin-user-item');
                    const select = card?.querySelector('.admin-user-project-select');
                    const projectId = select?.value;
                    if (!userId || !projectId) {
                        Toast.show('Выберите проект для добавления', 'warning');
                        return;
                    }

                    button.disabled = true;
                    try {
                        await Projects.toggleProjectForUser(userId, projectId, true, {
                            userRecord: this.getUserById(userId)
                        });
                        Toast.show('Проект добавлен пользователю', 'success');
                    } catch (error) {
                        console.error('Error adding project to user:', error);
                        Toast.show(`Ошибка сохранения: ${error?.message || error}`, 'error');
                    } finally {
                        button.disabled = false;
                    }
                });
            });

            list.querySelectorAll('.admin-user-project-remove').forEach((button) => {
                button.addEventListener('click', async () => {
                    const assignmentId = button.dataset.assignmentId;
                    if (!assignmentId) return;

                    button.disabled = true;
                    try {
                        await Projects.removeAssignment(assignmentId);
                        Toast.show('Проект отвязан от пользователя', 'success');
                    } catch (error) {
                        console.error('Error removing project from user:', error);
                        Toast.show(`Ошибка удаления: ${error?.message || error}`, 'error');
                    } finally {
                        button.disabled = false;
                    }
                });
            });
        }
    },

    /**
     * Обновить выпадающий список пользователей в форме бронирования
     */
    updateBookingUserSelect() {
        this.renderBookingUserList('', 'booking');
        this.setupBookingUserDropdown();
    },

    /**
     * Обновить dropdown выбора пользователя для модала "Использую"
     */
    updateTakeUserSelect() {
        this.renderBookingUserList('', 'take');
        this.setupTakeUserDropdown();
    },

    /**
     * Настроить dropdown выбора пользователя для модала "Использую"
     */
    setupTakeUserDropdown() {
        const btn = document.getElementById('take-user-btn');
        const dropdown = document.getElementById('take-user-dropdown');
        const searchInput = document.getElementById('take-user-search');

        if (!btn || !dropdown) return;

        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
            if (!dropdown.classList.contains('hidden')) {
                searchInput?.focus();
            }
        });

        if (searchInput) {
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);

            newSearchInput.addEventListener('input', (e) => {
                this.renderBookingUserList(e.target.value, 'take');
            });

            newSearchInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    },

    /**
     * Отрисовать список пользователей в dropdown
     * @param {string} filter - строка поиска
     * @param {string} modalType - тип модального окна: 'booking' или 'take'
     */
    renderBookingUserList(filter = '', modalType = 'booking') {
        const listContainerId = modalType === 'take' ? 'take-user-list' : 'booking-user-list';
        const listContainer = document.getElementById(listContainerId);
        if (!listContainer) return;

        const currentUserId = Auth.getUser()?.uid;
        const filterLower = filter.toLowerCase();

        const filteredUsers = this.users.filter(user => {
            if (user.id === currentUserId) return false;
            if (!filter) return true;
            const name = (user.displayName || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            return name.includes(filterLower) || email.includes(filterLower);
        });

        let html = '';
        if (!Auth.isSharedAccount()) {
            html = `
                <div class="user-select-option for-self" data-user-id="" data-user-name="Для себя">
                    <span class="user-name">Для себя</span>
                </div>
            `;
        }

        filteredUsers.forEach(user => {
            const name = user.displayName || user.email;
            html += `
                <div class="user-select-option"
                     data-user-id="${user.id}"
                     data-user-name="${name}"
                     data-user-photo="${user.photoURL || ''}">
                    <span class="user-name">${name}</span>
                    ${user.email ? `<span class="user-email">${user.email}</span>` : ''}
                </div>
            `;
        });

        if (filteredUsers.length === 0 && filter) {
            html += `<div class="user-select-option" style="color: var(--text-secondary); cursor: default;">Ничего не найдено</div>`;
        }

        listContainer.innerHTML = html;

        const userInputId = modalType === 'take' ? 'take-user' : 'booking-user';
        const userLabelId = modalType === 'take' ? 'take-user-label' : 'booking-user-label';
        const dropdownId = modalType === 'take' ? 'take-user-dropdown' : 'booking-user-dropdown';
        const searchInputId = modalType === 'take' ? 'take-user-search' : 'booking-user-search';

        listContainer.querySelectorAll('.user-select-option[data-user-id]').forEach(option => {
            option.addEventListener('click', () => {
                const userId = option.dataset.userId;
                const userName = option.dataset.userName;

                document.getElementById(userInputId).value = userId;
                document.getElementById(userLabelId).textContent = userName;
                document.getElementById(dropdownId).classList.add('hidden');
                document.getElementById(searchInputId).value = '';

                listContainer.querySelectorAll('.user-select-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');

                if (typeof Devices !== 'undefined' && typeof Devices.handleBookingTargetUserChange === 'function') {
                    Devices.handleBookingTargetUserChange(modalType, userId);
                }
            });
        });
    },

    /**
     * Настроить dropdown выбора пользователя
     */
    setupBookingUserDropdown() {
        const btn = document.getElementById('booking-user-btn');
        const dropdown = document.getElementById('booking-user-dropdown');
        const searchInput = document.getElementById('booking-user-search');

        if (!btn || !dropdown) return;

        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
            if (!dropdown.classList.contains('hidden')) {
                searchInput?.focus();
            }
        });

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderBookingUserList(e.target.value);
            });

            searchInput.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-select-wrapper')) {
                dropdown.classList.add('hidden');
            }
        });
    },

    /**
     * Получить пользователя по ID
     */
    getUserById(userId) {
        return this.usersById.get(userId);
    },

    /**
     * Форматирование даты
     */
    formatDate(date) {
        return new Intl.DateTimeFormat('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(date);
    }
};

window.Users = Users;
console.log('Users module loaded');
