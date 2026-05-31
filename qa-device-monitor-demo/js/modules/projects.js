/**
 * Projects Module
 * Управление проектами и назначениями пользователей на проекты
 */

const Projects = {
    initialized: false,
    projects: [],
    assignments: [],
    adminUsers: [],
    participantSearchQuery: '',
    profileProjectsExpanded: false,
    unsubscribeProjects: null,
    unsubscribeAssignments: null,

    isProjectContextEnabled() {
        return typeof FeatureFlags === 'undefined' || FeatureFlags.isEnabled('projectContext');
    },

    init() {
        if (this.initialized) return;
        this.setupAdminUi();
        this.setupProfileProjectsUi();
        this.loadProjects();
        this.loadAssignments();
        this.refreshFeatureVisibility();
        this.initialized = true;
    },

    setupAdminUi() {
        const createBtn = document.getElementById('project-create-btn');
        const searchInput = document.getElementById('project-participant-search');
        const projectForm = document.getElementById('project-form');
        const projectModal = document.getElementById('project-modal');

        createBtn?.addEventListener('click', () => this.openProjectModal());

        searchInput?.addEventListener('input', (event) => {
            this.participantSearchQuery = String(event.target.value || '').toLowerCase().trim();
            this.renderProjectMemberEditor(document.getElementById('project-id')?.value || '');
        });

        projectForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.saveProject();
        });

        document.getElementById('project-form-reset')?.addEventListener('click', () => {
            this.resetProjectForm();
        });

        projectModal?.querySelector('.modal-close')?.addEventListener('click', () => this.closeProjectModal());
        projectModal?.querySelector('.modal-overlay')?.addEventListener('click', () => this.closeProjectModal());
        projectModal?.querySelector('.modal-cancel')?.addEventListener('click', () => this.closeProjectModal());
    },

    setupProfileProjectsUi() {
        const toggleButton = document.getElementById('profile-projects-toggle');
        const picker = document.getElementById('profile-project-picker');

        toggleButton?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleProfileProjectsDropdown();
        });

        document.addEventListener('click', (event) => {
            if (!this.profileProjectsExpanded) return;
            if (picker?.contains(event.target)) return;
            this.closeProfileProjectsDropdown();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.profileProjectsExpanded) {
                this.closeProfileProjectsDropdown();
            }
        });
    },

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    setKnownUsers(users) {
        if (!Array.isArray(users)) return;
        this.adminUsers = [...users];
        const editingProjectId = document.getElementById('project-id')?.value || '';
        if (editingProjectId) {
            this.renderProjectMemberEditor(editingProjectId);
        }
    },

    loadProjects() {
        if (this.unsubscribeProjects) {
            this.unsubscribeProjects();
        }

        this.unsubscribeProjects = db.collection(COLLECTIONS.PROJECTS)
            .limit(200)
            .onSnapshot((snapshot) => {
                this.projects = snapshot.docs
                    .map((doc) => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));

                this.renderAdminProjects();
                this.renderProjectMemberEditor(document.getElementById('project-id')?.value || '');
                this.dispatchProjectsUpdated();
            }, (error) => {
                console.error('Projects: error loading projects', error);
            });
    },

    loadAssignments() {
        if (this.unsubscribeAssignments) {
            this.unsubscribeAssignments();
        }

        this.unsubscribeAssignments = db.collection(COLLECTIONS.PROJECT_ASSIGNMENTS)
            .limit(5000)
            .onSnapshot((snapshot) => {
                this.assignments = snapshot.docs
                    .map((doc) => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    .sort((a, b) => {
                        const projectCompare = String(a.projectName || '').localeCompare(String(b.projectName || ''), 'ru');
                        if (projectCompare !== 0) return projectCompare;
                        return String(a.userName || a.userEmail || '').localeCompare(String(b.userName || b.userEmail || ''), 'ru');
                    });

                this.renderAdminProjects();
                this.renderProjectMemberEditor(document.getElementById('project-id')?.value || '');
                this.dispatchProjectsUpdated();
            }, (error) => {
                console.error('Projects: error loading assignments', error);
            });
    },

    dispatchProjectsUpdated() {
        document.dispatchEvent(new CustomEvent('projectsUpdated'));
    },

    async ensureAdminUsersLoaded() {
        if (Array.isArray(window.Users?.users) && window.Users.users.length > 0) {
            this.adminUsers = [...window.Users.users];
            return this.adminUsers;
        }

        if (this.adminUsers.length > 0) {
            return this.adminUsers;
        }

        try {
            const snapshot = await db.collection(COLLECTIONS.USERS).limit(500).get();
            this.adminUsers = snapshot.docs
                .map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .sort((a, b) => String(a.displayName || a.email || '').localeCompare(String(b.displayName || b.email || ''), 'ru'));
            return this.adminUsers;
        } catch (error) {
            console.error('Projects: error loading users', error);
            return [];
        }
    },

    async getAllUsers() {
        if (Array.isArray(window.Users?.users) && window.Users.users.length > 0) {
            return window.Users.users;
        }

        return this.ensureAdminUsersLoaded();
    },

    async getUserById(userId) {
        if (!userId) return null;

        const cachedUsers = await this.getAllUsers();
        const cachedUser = cachedUsers.find((user) => user.id === userId);
        if (cachedUser) return cachedUser;

        try {
            const doc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
            if (!doc.exists) return null;
            const user = { id: doc.id, ...doc.data() };
            this.adminUsers = [...this.adminUsers.filter((item) => item.id !== user.id), user];
            return user;
        } catch (error) {
            console.error('Projects: error loading user by id', error);
            return null;
        }
    },

    getProjectById(projectId) {
        return this.projects.find((project) => project.id === projectId) || null;
    },

    getActiveProjects() {
        if (!this.isProjectContextEnabled()) return [];
        return this.projects.filter((project) => project.isActive !== false);
    },

    getAssignmentsForProject(projectId, options = {}) {
        if (!this.isProjectContextEnabled()) return [];
        const { activeOnly = false } = options;
        return this.assignments.filter((assignment) => {
            if (assignment.projectId !== projectId) return false;
            if (activeOnly && assignment.isActive === false) return false;
            return true;
        });
    },

    getAssignmentsForUser(userId, options = {}) {
        if (!this.isProjectContextEnabled()) return [];
        const { activeOnly = false } = options;

        return this.assignments
            .filter((assignment) => {
                if (assignment.userId !== userId) return false;
                if (activeOnly && assignment.isActive === false) return false;

                const project = this.getProjectById(assignment.projectId);
                if (!project) return false;
                if (activeOnly && project.isActive === false) return false;
                return true;
            })
            .map((assignment) => ({
                ...assignment,
                project: this.getProjectById(assignment.projectId)
            }));
    },

    getVisibleProjectsForUser(userId) {
        if (!this.isProjectContextEnabled()) return [];
        if (Auth.isAdmin) {
            return this.getActiveProjects();
        }

        const assignments = this.getAssignmentsForUser(userId, { activeOnly: true });
        if (assignments.length > 0) {
            return assignments.map((assignment) => assignment.project).filter(Boolean);
        }

        return this.getActiveProjects();
    },

    buildProjectContext(userId, projectIds) {
        if (!this.isProjectContextEnabled()) {
            return {
                projectIds: [],
                projectCodes: [],
                projectNames: [],
                projectId: null,
                projectCode: null,
                projectName: null
            };
        }

        const normalizedProjectIds = Array.isArray(projectIds)
            ? projectIds.filter(Boolean)
            : (projectIds ? [projectIds] : []);

        if (normalizedProjectIds.length === 0) {
            return {
                projectIds: [],
                projectCodes: [],
                projectNames: [],
                projectId: null,
                projectCode: null,
                projectName: null
            };
        }

        const resolvedProjects = normalizedProjectIds
            .map((projectId) => this.getProjectById(projectId))
            .filter(Boolean);

        if (resolvedProjects.length === 0) {
            return {
                projectIds: [],
                projectCodes: [],
                projectNames: [],
                projectId: null,
                projectCode: null,
                projectName: null
            };
        }

        const primaryProject = resolvedProjects[0];

        return {
            projectIds: resolvedProjects.map((project) => project.id),
            projectCodes: resolvedProjects.map((project) => project.code || null).filter(Boolean),
            projectNames: resolvedProjects.map((project) => project.name || null).filter(Boolean),
            projectId: primaryProject.id,
            projectCode: primaryProject.code || null,
            projectName: primaryProject.name || null
        };
    },

    getAssignmentRecord(userId, projectId) {
        return this.assignments.find((assignment) => assignment.userId === userId && assignment.projectId === projectId) || null;
    },

    getMinVersionEntries(project) {
        if (!project?.minOsVersions) return [];

        return [
            { key: 'android', label: 'Android', value: project.minOsVersions.android },
            { key: 'ios', label: 'iOS', value: project.minOsVersions.ios },
            { key: 'ipados', label: 'iPadOS', value: project.minOsVersions.ipados }
        ].filter((item) => item.value);
    },

    getProjectSummaryText(project) {
        const versions = this.getMinVersionEntries(project);
        if (versions.length === 0) {
            return 'Минимальные версии ОС не заданы';
        }

        return versions.map((item) => `${item.label} ${item.value}`).join(' • ');
    },

    formatParticipantsCount(count) {
        const absoluteCount = Math.abs(Number(count) || 0);
        const mod10 = absoluteCount % 10;
        const mod100 = absoluteCount % 100;

        if (mod10 === 1 && mod100 !== 11) {
            return `${absoluteCount} участник`;
        }

        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
            return `${absoluteCount} участника`;
        }

        return `${absoluteCount} участников`;
    },

    openProjectModal(projectId = '') {
        if (!this.isProjectContextEnabled()) return;
        const modal = document.getElementById('project-modal');
        if (!modal) return;

        const project = this.getProjectById(projectId);
        this.fillProjectForm(project);
        this.toggleProjectMemberEditor(Boolean(projectId), project);
        this.renderProjectMemberEditor(projectId);
        modal.classList.remove('hidden');
    },

    closeProjectModal() {
        const modal = document.getElementById('project-modal');
        if (!modal) return;

        modal.classList.add('hidden');
        this.participantSearchQuery = '';
        const searchInput = document.getElementById('project-participant-search');
        if (searchInput) {
            searchInput.value = '';
        }
        this.toggleProjectMemberEditor(false, null);
        this.resetProjectForm();
    },

    toggleProjectMemberEditor(isVisible, project) {
        const section = document.getElementById('project-edit-members-section');
        const title = document.getElementById('project-assignment-title');
        const caption = document.getElementById('project-participant-caption');
        const container = document.getElementById('project-assignment-list');
        if (!section) return;

        section.classList.toggle('hidden', !isVisible);
        if (isVisible) {
            if (title) {
                title.textContent = `Редактирование состава проекта ${project?.name || ''}`.trim();
            }
            if (caption) {
                caption.textContent = 'Здесь можно добавить пользователя в проект или убрать его из состава.';
            }
            return;
        }

        if (title) {
            title.textContent = 'Добавляйте или убирайте участников только в режиме редактирования проекта.';
        }
        if (caption) {
            caption.textContent = 'Сначала сохраните проект, затем откройте его на редактирование.';
        }
        if (container) {
            container.innerHTML = '';
        }
    },

    resetProjectForm() {
        document.getElementById('project-id').value = '';
        document.getElementById('project-name').value = '';
        document.getElementById('project-code').value = '';
        document.getElementById('project-description').value = '';
        document.getElementById('project-min-android').value = '';
        document.getElementById('project-min-ios').value = '';
        document.getElementById('project-min-ipados').value = '';
        document.getElementById('project-is-active').checked = true;
        document.getElementById('project-form-title').textContent = 'Создать проект';
    },

    fillProjectForm(project) {
        if (!project) {
            this.resetProjectForm();
            return;
        }

        document.getElementById('project-id').value = project.id || '';
        document.getElementById('project-name').value = project.name || '';
        document.getElementById('project-code').value = project.code || '';
        document.getElementById('project-description').value = project.description || '';
        document.getElementById('project-min-android').value = project.minOsVersions?.android || '';
        document.getElementById('project-min-ios').value = project.minOsVersions?.ios || '';
        document.getElementById('project-min-ipados').value = project.minOsVersions?.ipados || '';
        document.getElementById('project-is-active').checked = project.isActive !== false;
        document.getElementById('project-form-title').textContent = `Редактировать: ${project.name || 'проект'}`;
    },

    async saveProject() {
        if (!this.isProjectContextEnabled()) return;
        const projectId = document.getElementById('project-id').value.trim();
        const name = document.getElementById('project-name').value.trim();
        const code = document.getElementById('project-code').value.trim();
        const description = document.getElementById('project-description').value.trim();
        const android = document.getElementById('project-min-android').value.trim();
        const ios = document.getElementById('project-min-ios').value.trim();
        const ipados = document.getElementById('project-min-ipados').value.trim();
        const isActive = document.getElementById('project-is-active').checked;

        if (!name || !code) {
            Toast.show('Заполните название и код проекта', 'warning');
            return;
        }

        const payload = {
            name,
            code,
            description: description || '',
            isActive,
            minOsVersions: {
                android: android || '',
                ios: ios || '',
                ipados: ipados || ''
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: Auth.currentUser?.email || 'unknown'
        };

        try {
            if (projectId) {
                await db.collection(COLLECTIONS.PROJECTS).doc(projectId).update(payload);
            } else {
                await db.collection(COLLECTIONS.PROJECTS).add({
                    ...payload,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            Toast.show('Проект сохранен', 'success');
            this.closeProjectModal();
        } catch (error) {
            console.error('Projects: error saving project', error);
            Toast.show(`Ошибка сохранения проекта: ${error?.message || error}`, 'error');
        }
    },

    async upsertAssignment({ userId, projectId, isActive = true, userRecord = null }) {
        if (!this.isProjectContextEnabled()) {
            throw new Error('Проекты отключены фича-флагом');
        }
        const project = this.getProjectById(projectId);
        const user = userRecord || await this.getUserById(userId);

        if (!project || !user) {
            throw new Error('Не удалось найти проект или пользователя');
        }

        const existingAssignment = this.getAssignmentRecord(userId, projectId);
        const payload = {
            projectId: project.id,
            projectName: project.name || '',
            userId,
            userEmail: user.email || '',
            userName: user.displayName || user.email || '',
            isActive,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: Auth.currentUser?.email || 'unknown'
        };

        if (existingAssignment) {
            await db.collection(COLLECTIONS.PROJECT_ASSIGNMENTS).doc(existingAssignment.id).update(payload);
            return existingAssignment.id;
        }

        const createdRef = await db.collection(COLLECTIONS.PROJECT_ASSIGNMENTS).add({
            ...payload,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return createdRef.id;
    },

    async removeAssignment(assignmentId) {
        if (!assignmentId) return;
        await db.collection(COLLECTIONS.PROJECT_ASSIGNMENTS).doc(assignmentId).delete();
    },

    async toggleProjectForUser(userId, projectId, shouldAssign, options = {}) {
        if (!this.isProjectContextEnabled()) return;
        const assignment = this.getAssignmentRecord(userId, projectId);

        if (shouldAssign) {
            await this.upsertAssignment({
                userId,
                projectId,
                isActive: true,
                userRecord: options.userRecord || null
            });
            return;
        }

        if (assignment) {
            await this.removeAssignment(assignment.id);
        }
    },

    async syncProjectsForUser(userId, projectIds, options = {}) {
        if (!this.isProjectContextEnabled()) return;
        const desiredIds = new Set((projectIds || []).filter(Boolean));
        const currentAssignments = this.getAssignmentsForUser(userId, { activeOnly: false });
        const currentActiveIds = new Set(
            currentAssignments
                .filter((assignment) => assignment.isActive !== false)
                .map((assignment) => assignment.projectId)
        );

        const userRecord = options.userRecord || await this.getUserById(userId);

        for (const assignment of currentAssignments) {
            if (!desiredIds.has(assignment.projectId)) {
                await this.removeAssignment(assignment.id);
            }
        }

        for (const projectId of desiredIds) {
            if (!currentActiveIds.has(projectId)) {
                await this.upsertAssignment({
                    userId,
                    projectId,
                    isActive: true,
                    userRecord
                });
            }
        }
    },

    async renderAdminProjects() {
        const list = document.getElementById('admin-projects-list');
        if (!list) return;

        if (!this.isProjectContextEnabled()) {
            list.innerHTML = '';
            return;
        }

        if (this.projects.length === 0) {
            list.innerHTML = '<div class="empty-inline-state">Проектов пока нет. Создайте первый проект через кнопку «Новый проект».</div>';
            return;
        }

        list.innerHTML = this.projects.map((project) => {
            const projectAssignments = this.getAssignmentsForProject(project.id, { activeOnly: true });
            const assignmentsCount = projectAssignments.length;
            const escapedName = this.escapeHtml(project.name || 'Без названия');
            const escapedCode = this.escapeHtml(project.code || 'Без кода');
            const escapedDescription = this.escapeHtml(project.description || 'Описание проекта пока не заполнено.');
            const versionEntries = this.getMinVersionEntries(project);
            const versionsMarkup = versionEntries.length
                ? versionEntries.map((entry) => `
                    <span class="project-version-chip">${this.escapeHtml(entry.label)} ${this.escapeHtml(entry.value)}</span>
                `).join('')
                : '<span class="project-version-chip empty">Минимальные версии не заданы</span>';
            const participantsMarkup = projectAssignments.length
                ? projectAssignments.map((assignment) => `
                    <span class="admin-user-project-tag">
                        ${this.escapeHtml(assignment.userName || assignment.userEmail || assignment.userId)}
                    </span>
                `).join('')
                : '<div class="empty-inline-state">Пока никто не привязан к этому проекту.</div>';
            const participantsCountLabel = this.formatParticipantsCount(assignmentsCount);

            return `
                <article class="project-list-item project-list-card" data-project-id="${project.id}">
                    <div class="project-list-card-top">
                        <div class="project-card-heading">
                            <div class="project-list-item-header">
                                <span class="project-list-item-name">${escapedName}</span>
                                <span class="project-status-badge ${project.isActive === false ? 'inactive' : 'active'}">
                                    ${project.isActive === false ? 'Неактивен' : 'Активен'}
                                </span>
                            </div>
                            <p class="project-list-item-description">${escapedDescription}</p>
                        </div>
                        <button type="button" class="secondary-btn project-card-edit-btn" data-project-id="${project.id}">
                            Редактировать
                        </button>
                    </div>
                    <div class="project-details-meta">
                        <span class="project-detail-chip">${escapedCode}</span>
                        <span class="project-detail-chip">${participantsCountLabel}</span>
                    </div>
                    <div class="project-card-section">
                        <div class="coverage-panel-subtitle">Минимальные версии ОС</div>
                        <div class="project-version-chips">
                            ${versionsMarkup}
                        </div>
                    </div>
                    <div class="project-card-section">
                        <div class="project-card-section-header">
                            <div class="coverage-panel-subtitle">Участники</div>
                            <div class="project-inline-counter">${participantsCountLabel}</div>
                        </div>
                        <div class="admin-user-project-tags">
                            ${participantsMarkup}
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        list.querySelectorAll('.project-card-edit-btn').forEach((button) => {
            button.addEventListener('click', () => {
                this.openProjectModal(button.dataset.projectId || '');
            });
        });
    },

    async renderProjectMemberEditor(projectId) {
        const container = document.getElementById('project-assignment-list');
        const title = document.getElementById('project-assignment-title');
        const caption = document.getElementById('project-participant-caption');
        if (!container) return;

        if (!this.isProjectContextEnabled()) {
            if (title) title.textContent = 'Проекты отключены фича-флагом.';
            if (caption) caption.textContent = 'Включите фичу в админке, чтобы управлять составом проектов.';
            container.innerHTML = '';
            return;
        }

        if (!projectId) {
            if (title) title.textContent = 'Добавляйте или убирайте участников только в режиме редактирования проекта.';
            if (caption) caption.textContent = 'Сначала сохраните проект, затем откройте его на редактирование.';
            container.innerHTML = '';
            return;
        }

        const project = this.getProjectById(projectId);
        const users = await this.getAllUsers();
        const assignmentsByUserId = new Map(
            this.getAssignmentsForProject(projectId, { activeOnly: false })
                .map((assignment) => [assignment.userId, assignment])
        );

        if (title) {
            title.textContent = `Редактирование состава проекта ${project?.name || ''}`.trim();
        }

        const filteredUsers = users
            .filter((user) => {
                if (!this.participantSearchQuery) return true;
                const haystack = [
                    user.displayName,
                    user.email
                ].map((value) => String(value || '').toLowerCase());
                return haystack.some((value) => value.includes(this.participantSearchQuery));
            })
            .sort((a, b) => {
                const aAssignment = assignmentsByUserId.get(a.id);
                const bAssignment = assignmentsByUserId.get(b.id);
                const aScore = aAssignment?.isActive === false ? 1 : aAssignment ? 2 : 0;
                const bScore = bAssignment?.isActive === false ? 1 : bAssignment ? 2 : 0;
                if (aScore !== bScore) return bScore - aScore;
                return String(a.displayName || a.email || '').localeCompare(String(b.displayName || b.email || ''), 'ru');
            });

        if (caption) {
            caption.textContent = `${filteredUsers.length} ${filteredUsers.length === 1 ? 'сотрудник' : 'сотрудников'} доступно для изменения состава`;
        }

        if (filteredUsers.length === 0) {
            container.innerHTML = '<div class="empty-inline-state">По вашему запросу сотрудники не найдены.</div>';
            return;
        }

        container.innerHTML = filteredUsers.map((user) => {
            const assignment = assignmentsByUserId.get(user.id);
            const isAssigned = Boolean(assignment && assignment.isActive !== false);
            const toggleLabel = isAssigned ? 'В проекте' : 'Не в проекте';
            const escapedName = this.escapeHtml(user.displayName || user.email || user.id);
            const escapedEmail = this.escapeHtml(user.email || 'Без email');
            const avatar = this.escapeHtml(user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>');

            return `
                <article class="project-member-card" data-user-id="${user.id}">
                    <div class="project-member-main">
                        <img class="project-member-avatar" src="${avatar}" alt="">
                        <div class="project-member-content">
                            <div class="project-member-name">${escapedName}</div>
                            <div class="project-member-email">${escapedEmail}</div>
                        </div>
                    </div>
                    <div class="project-member-controls">
                        <label class="admin-toggle project-member-toggle">
                            <input
                                type="checkbox"
                                class="admin-toggle-input project-member-toggle-input"
                                data-user-id="${user.id}"
                                ${isAssigned ? 'checked' : ''}
                            >
                            <span class="admin-toggle-slider green"></span>
                            <span class="admin-toggle-label green">${toggleLabel}</span>
                        </label>
                        <div class="project-member-hint">
                            ${isAssigned ? 'Пользователь участвует в проекте.' : 'Включите переключатель, чтобы добавить пользователя в проект.'}
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        container.querySelectorAll('.project-member-toggle-input').forEach((input) => {
            input.addEventListener('change', async () => {
                const userId = input.dataset.userId;
                const shouldAssign = Boolean(input.checked);
                await this.handleProjectMemberToggle(input, userId, projectId, shouldAssign);
            });
        });
    },

    async handleProjectMemberToggle(toggleInput, userId, projectId, shouldAssign) {
        if (!toggleInput || !userId || !projectId) return;

        toggleInput.disabled = true;
        try {
            await this.toggleProjectForUser(userId, projectId, shouldAssign);
            Toast.show(
                shouldAssign ? 'Пользователь добавлен в проект' : 'Пользователь убран из проекта',
                'success'
            );
        } catch (error) {
            toggleInput.checked = !shouldAssign;
            console.error('Projects: error toggling assignment', error);
            Toast.show(`Ошибка сохранения назначения: ${error?.message || error}`, 'error');
        } finally {
            toggleInput.disabled = false;
        }
    },

    renderProfileProjectsList(userId) {
        const container = document.getElementById('profile-projects-list');
        if (!container) return;

        if (!this.isProjectContextEnabled()) {
            container.innerHTML = '';
            this.updateProfileProjectsSummary();
            this.closeProfileProjectsDropdown();
            return;
        }

        const projects = this.getActiveProjects();
        const assignedProjectIds = new Set(
            this.getAssignmentsForUser(userId, { activeOnly: true }).map((assignment) => assignment.projectId)
        );

        if (projects.length === 0) {
            container.innerHTML = '<div class="empty-inline-state">Администратор еще не добавил ни одного проекта.</div>';
            this.updateProfileProjectsSummary();
            return;
        }

        container.innerHTML = projects.map((project) => {
            const checked = assignedProjectIds.has(project.id) ? 'checked' : '';
            const escapedName = this.escapeHtml(project.name || 'Без названия');

            return `
                <label class="profile-project-option">
                    <input type="checkbox" class="profile-project-checkbox" value="${project.id}" ${checked}>
                    <div class="profile-project-option-content">
                        <strong>${escapedName}</strong>
                    </div>
                </label>
            `;
        }).join('');

        container.querySelectorAll('.profile-project-checkbox').forEach((input) => {
            input.addEventListener('change', () => this.updateProfileProjectsSummary());
        });

        this.updateProfileProjectsSummary();
        this.closeProfileProjectsDropdown();
    },

    getSelectedProfileProjectIds() {
        if (!this.isProjectContextEnabled()) return [];
        return Array.from(document.querySelectorAll('.profile-project-checkbox:checked'))
            .map((input) => input.value)
            .filter(Boolean);
    },

    getProfileProjectsSummaryLabel() {
        if (!this.isProjectContextEnabled()) {
            return 'Проекты выключены';
        }

        const selectedOptions = Array.from(document.querySelectorAll('.profile-project-checkbox:checked'))
            .map((input) => {
                const option = input.closest('.profile-project-option');
                return option?.querySelector('.profile-project-option-content strong')?.textContent?.trim() || '';
            })
            .filter(Boolean);

        if (selectedOptions.length === 0) {
            return 'Выберите проекты';
        }

        if (selectedOptions.length === 1) {
            return selectedOptions[0];
        }

        return selectedOptions[0];
    },

    updateProfileProjectsSummary() {
        const summary = document.getElementById('profile-projects-summary');
        const toggleButton = document.getElementById('profile-projects-toggle');
        if (!summary || !toggleButton) return;

        const label = this.getProfileProjectsSummaryLabel();
        summary.textContent = label;
        toggleButton.title = label;
    },

    toggleProfileProjectsDropdown(force) {
        if (!this.isProjectContextEnabled() && force !== false) return;
        const nextState = typeof force === 'boolean' ? force : !this.profileProjectsExpanded;
        this.profileProjectsExpanded = nextState;

        const popover = document.getElementById('profile-projects-popover');
        const toggleButton = document.getElementById('profile-projects-toggle');
        popover?.classList.toggle('hidden', !nextState);
        toggleButton?.setAttribute('aria-expanded', String(nextState));
    },

    closeProfileProjectsDropdown() {
        this.toggleProfileProjectsDropdown(false);
    },

    refreshFeatureVisibility() {
        const profileGroup = document.getElementById('profile-projects-group');
        const modal = document.getElementById('project-modal');
        const enabled = this.isProjectContextEnabled();

        profileGroup?.classList.toggle('hidden', !enabled);

        if (!enabled) {
            this.closeProfileProjectsDropdown();
            if (modal && !modal.classList.contains('hidden')) {
                this.closeProjectModal();
            }
        }

        this.updateProfileProjectsSummary();
    },

    cleanup() {
        if (this.unsubscribeProjects) {
            this.unsubscribeProjects();
            this.unsubscribeProjects = null;
        }

        if (this.unsubscribeAssignments) {
            this.unsubscribeAssignments();
            this.unsubscribeAssignments = null;
        }

        this.projects = [];
        this.assignments = [];
        this.adminUsers = [];
        this.participantSearchQuery = '';
        this.profileProjectsExpanded = false;
        this.initialized = false;
    }
};

window.Projects = Projects;
console.log('Projects module loaded');
