/**
 * Devices Project Context Module
 * Выбор проектного контекста в модалах бронирования
 *
 * Этот файл расширяет объект Devices методами работы с проектами в модалах.
 * Должен загружаться ПОСЛЕ devices-filters.js.
 */
Object.assign(Devices, {
    getDeviceProjectContext(device) {
        if (!device) {
            return {
                projectIds: [],
                projectCodes: [],
                projectNames: [],
                projectId: null,
                projectCode: null,
                projectName: null
            };
        }

        const projectIds = Array.isArray(device.currentProjectIds)
            ? device.currentProjectIds.filter(Boolean)
            : (device.currentProjectId ? [device.currentProjectId] : []);
        const projectCodes = Array.isArray(device.currentProjectCodes)
            ? device.currentProjectCodes.filter(Boolean)
            : (device.currentProjectCode ? [device.currentProjectCode] : []);
        const projectNames = Array.isArray(device.currentProjectNames)
            ? device.currentProjectNames.filter(Boolean)
            : (device.currentProjectName ? [device.currentProjectName] : []);

        return {
            projectIds,
            projectCodes,
            projectNames,
            projectId: projectIds[0] || null,
            projectCode: projectCodes[0] || null,
            projectName: projectNames[0] || null
        };
    },

    getProjectCheckboxName(containerId) {
        return `${containerId}-option`;
    },

    getSelectedProjectIds(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];

        return Array.from(container.querySelectorAll(`input[name="${this.getProjectCheckboxName(containerId)}"]:checked`))
            .map((input) => input.value)
            .filter(Boolean);
    },

    getTargetProjectSelection(userId, selectedProjectIds = []) {
        if (!this.isProjectContextEnabled()) {
            return {
                required: false,
                assignments: [],
                context: null
            };
        }

        if (typeof Projects === 'undefined' || !userId) {
            return {
                required: false,
                assignments: [],
                context: {
                    projectIds: [],
                    projectCodes: [],
                    projectNames: [],
                    projectId: null,
                    projectCode: null,
                    projectName: null
                }
            };
        }

        const assignments = this.getProjectAssignmentsForUser(userId);
        const required = assignments.length > 1;
        const availableProjectIds = assignments.map((assignment) => assignment.projectId).filter(Boolean);
        const resolvedProjectIds = Array.isArray(selectedProjectIds)
            ? [...new Set(selectedProjectIds.filter((projectId) => availableProjectIds.includes(projectId)))]
            : [];
        const effectiveProjectIds = resolvedProjectIds.length > 0
            ? resolvedProjectIds
            : (assignments.length === 1 ? [assignments[0].projectId] : []);

        if (required && effectiveProjectIds.length === 0) {
            return {
                required,
                assignments,
                context: null
            };
        }

        return {
            required,
            assignments,
            context: Projects.buildProjectContext(userId, effectiveProjectIds)
        };
    },

    getPreferredProjectIdsForUser(userId) {
        if (!this.isProjectContextEnabled()) {
            return [];
        }

        if (!userId || this.currentDeviceView !== 'coverage' || !this.coverageSelectedProjectId) {
            return [];
        }

        const assignments = this.getProjectAssignmentsForUser(userId);
        return assignments.some((assignment) => assignment.projectId === this.coverageSelectedProjectId)
            ? [this.coverageSelectedProjectId]
            : [];
    },

    populateProjectSelect(selectId, hintId, requiredId, userId, options = {}) {
        const container = document.getElementById(selectId);
        const hint = document.getElementById(hintId);
        const requiredMark = document.getElementById(requiredId);
        if (!container) {
            return { required: false, assignments: [] };
        }

        if (!this.isProjectContextEnabled()) {
            container.innerHTML = '';
            hint?.classList.add('hidden');
            requiredMark?.classList.add('hidden');
            return { required: false, assignments: [] };
        }

        const assignments = this.getProjectAssignmentsForUser(userId);
        const required = assignments.length > 1;
        const explicitProjectIds = Array.isArray(options.selectedProjectIds)
            ? options.selectedProjectIds
            : (options.selectedProjectId ? [options.selectedProjectId] : []);
        const preferredProjectIds = explicitProjectIds.length > 0
            ? explicitProjectIds
            : this.getPreferredProjectIdsForUser(userId);
        const selectedValues = preferredProjectIds.length > 0
            ? preferredProjectIds
            : (assignments.length === 1 ? [assignments[0].projectId] : []);
        const checkboxName = this.getProjectCheckboxName(selectId);

        if (assignments.length === 0) {
            container.innerHTML = '<div class="project-selection-empty">Без проекта</div>';
            if (hint) {
                hint.textContent = 'У пользователя нет активных назначений на проекты. Использование будет сохранено без проектного контекста.';
                hint.classList.remove('hidden');
            }
        } else {
            container.innerHTML = assignments.map((assignment) => {
                const project = assignment.project;
                if (!project) return '';
                const isChecked = selectedValues.includes(project.id);
                const isDisabled = assignments.length === 1;
                return `
                    <label class="project-selection-option${isChecked ? ' is-selected' : ''}">
                        <input
                            type="checkbox"
                            name="${checkboxName}"
                            value="${project.id}"
                            ${isChecked ? 'checked' : ''}
                            ${isDisabled ? 'disabled' : ''}
                        >
                        <span class="project-selection-label">
                            <span class="project-selection-name">${project.name}</span>
                            ${project.code ? `<span class="project-selection-code">${project.code}</span>` : ''}
                        </span>
                    </label>
                `;
            }).join('');
            if (hint) {
                hint.textContent = required
                    ? 'У сотрудника несколько активных проектов. Можно выбрать несколько.'
                    : 'Проект выбран автоматически по активному назначению сотрудника.';
                hint.classList.remove('hidden');
            }
            container.querySelectorAll(`input[name="${checkboxName}"]`).forEach((input) => {
                input.addEventListener('change', () => {
                    input.closest('.project-selection-option')?.classList.toggle('is-selected', input.checked);
                });
            });
        }

        requiredMark?.classList.toggle('hidden', !required);
        return { required, assignments };
    },

    async handleBookingTargetUserChange(modalType, userId) {
        if (!this.isProjectContextEnabled()) {
            if (modalType === 'booking') {
                document.getElementById('booking-project-select-group')?.classList.add('hidden');
                return;
            }

            document.getElementById('take-project-select-group')?.classList.add('hidden');
            return;
        }

        const currentUser = Auth.getUser();
        const effectiveUserId = userId || currentUser?.uid || '';

        if (modalType === 'booking') {
            this.populateProjectSelect('booking-project-select', 'booking-project-hint', 'booking-project-required', effectiveUserId, {
                selectedProjectIds: this.bookingProjectContextLocked?.projectIds || []
            });
            document.getElementById('booking-project-select-group')?.classList.remove('hidden');
            return;
        }

        this.takeModalTargetUserId = effectiveUserId;
        this.populateProjectSelect('take-project-select', 'take-project-hint', 'take-project-required', effectiveUserId);
        document.getElementById('take-project-select-group')?.classList.remove('hidden');
    }
});

console.log('Devices project context module loaded');
