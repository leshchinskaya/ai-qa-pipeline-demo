/**
 * Devices Coverage Module
 * Матрица покрытия устройств по проектам
 * 
 * Этот файл расширяет объект Devices методами для работы с матрицей покрытия.
 * Должен загружаться ПОСЛЕ devices.js.
 */
Object.assign(Devices, {
    setupCoverageMatrix() {
        const projectSelect = document.getElementById('coverage-project-select');
        const staleDaysInput = document.getElementById('coverage-stale-days');
        const staleDaysCustomInput = document.getElementById('coverage-stale-days-custom');
        const usageSearchInput = document.getElementById('coverage-usage-search');
        const usageSortSelect = document.getElementById('coverage-usage-sort');
        const projectFilterBtn = document.getElementById('coverage-project-filter-btn');
        const staleFilterBtn = document.getElementById('coverage-stale-filter-btn');
        const projectFilterPanel = document.getElementById('coverage-project-filter-panel');
        const staleFilterPanel = document.getElementById('coverage-stale-filter-panel');

        projectSelect?.addEventListener('change', () => {
            this.coverageSelectedProjectId = projectSelect.value;
            this.coverageProjectSelectionTouched = true;
            this.coverageSummaryFilter = '';
            this.switchCoverageTab(this.coverageSelectedProjectId ? 'recommendations' : 'stats');
            this.updateCoverageFilterLabels();
            this.closeCoverageDropdowns();
            this.renderCoverageMatrix();
        });

        staleDaysInput?.addEventListener('input', () => {
            const value = parseInt(staleDaysInput.value, 10);
            this.coverageStaleDays = Number.isFinite(value) && value > 0 ? value : 30;
            if (staleDaysCustomInput) {
                staleDaysCustomInput.value = String(this.coverageStaleDays);
            }
            this.updateCoverageFilterLabels();
            this.renderCoverageMatrix();
        });

        staleDaysCustomInput?.addEventListener('input', () => {
            const value = parseInt(staleDaysCustomInput.value, 10);
            this.coverageStaleDays = Number.isFinite(value) && value > 0 ? value : 30;
            if (staleDaysInput) {
                staleDaysInput.value = String(this.coverageStaleDays);
            }
            this.updateCoverageStaleFilterOptions();
            this.updateCoverageFilterLabels();
            this.renderCoverageMatrix();
        });

        projectFilterBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggleCoverageDropdown('project');
        });

        staleFilterBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggleCoverageDropdown('stale');
        });

        usageSearchInput?.addEventListener('input', (event) => {
            this.coverageUsageSearchQuery = String(event.target.value || '').toLowerCase().trim();
            this.renderCoverageUsage(this.coverageSelectedProjectId
                ? this.buildCoverageDataset(this.coverageSelectedProjectId)
                : this.buildAggregateCoverageDataset(Projects.getVisibleProjectsForUser(Auth.getUser()?.uid || '')));
        });

        usageSortSelect?.addEventListener('change', (event) => {
            this.coverageUsageSort = event.target.value || 'recent';
            this.renderCoverageUsage(this.coverageSelectedProjectId
                ? this.buildCoverageDataset(this.coverageSelectedProjectId)
                : this.buildAggregateCoverageDataset(Projects.getVisibleProjectsForUser(Auth.getUser()?.uid || '')));
        });

        const copyBtn = document.getElementById('coverage-copy-btn');
        copyBtn?.addEventListener('click', () => this.copyCoverageMatrix());

        document.querySelectorAll('.coverage-analysis-tab').forEach((tab) => {
            if (tab.dataset.listenerAdded === 'true') return;
            tab.dataset.listenerAdded = 'true';
            tab.addEventListener('click', () => {
                this.switchCoverageTab(tab.dataset.coverageTab || 'recommendations');
            });
        });

        document.addEventListener('projectsUpdated', () => {
            if (this.currentDeviceView === 'coverage') {
                this.renderCoverageMatrix();
            }
        });

        document.addEventListener('click', (event) => {
            if (
                projectFilterPanel?.contains(event.target) ||
                staleFilterPanel?.contains(event.target) ||
                projectFilterBtn?.contains(event.target) ||
                staleFilterBtn?.contains(event.target)
            ) {
                return;
            }

            this.closeCoverageDropdowns();
        });

        this.renderCoverageStaleFilterOptions();
        this.updateCoverageFilterLabels();
    },

    toggleCoverageDropdown(type) {
        const projectPanel = document.getElementById('coverage-project-filter-panel');
        const stalePanel = document.getElementById('coverage-stale-filter-panel');
        const shouldOpenProject = type === 'project' && projectPanel?.classList.contains('hidden');
        const shouldOpenStale = type === 'stale' && stalePanel?.classList.contains('hidden');

        this.closeCoverageDropdowns();

        if (shouldOpenProject) {
            projectPanel?.classList.remove('hidden');
        }
        if (shouldOpenStale) {
            stalePanel?.classList.remove('hidden');
        }
    },

    closeCoverageDropdowns() {
        document.getElementById('coverage-project-filter-panel')?.classList.add('hidden');
        document.getElementById('coverage-stale-filter-panel')?.classList.add('hidden');
    },

    updateCoverageFilterLabels() {
        const projectLabel = document.getElementById('coverage-project-filter-label');
        const staleLabel = document.getElementById('coverage-stale-filter-label');
        const projectSelect = document.getElementById('coverage-project-select');

        if (projectLabel && projectSelect) {
            const selectedOption = projectSelect.options[projectSelect.selectedIndex];
            projectLabel.textContent = selectedOption?.textContent || 'Все проекты';
        }

        if (staleLabel) {
            staleLabel.textContent = `${this.coverageStaleDays} дней`;
        }
    },

    renderCoverageProjectFilterOptions(projects) {
        const optionsContainer = document.getElementById('coverage-project-filter-options');
        if (!optionsContainer) return;

        const visibleProjects = projects || [];
        optionsContainer.innerHTML = [
            '<div class="filters-options">',
            `
                <label class="filter-option">
                    <input type="radio" name="coverage-project-filter" value="" ${this.coverageSelectedProjectId ? '' : 'checked'}>
                    <span>Все проекты</span>
                </label>
            `,
            ...visibleProjects.map((project) => `
                <label class="filter-option">
                    <input type="radio" name="coverage-project-filter" value="${project.id}" ${project.id === this.coverageSelectedProjectId ? 'checked' : ''}>
                    <span>${project.name}</span>
                </label>
            `),
            '</div>'
        ].join('');

        optionsContainer.querySelectorAll('input[name="coverage-project-filter"]').forEach((input) => {
            input.addEventListener('change', () => {
                const projectSelect = document.getElementById('coverage-project-select');
                this.coverageSelectedProjectId = input.value || '';
                this.coverageProjectSelectionTouched = true;
                if (projectSelect) {
                    projectSelect.value = this.coverageSelectedProjectId;
                }
                this.switchCoverageTab(this.coverageSelectedProjectId ? 'recommendations' : 'stats');
                this.updateCoverageFilterLabels();
                this.closeCoverageDropdowns();
                this.renderCoverageMatrix();
            });
        });
    },

    renderCoverageStaleFilterOptions() {
        const optionsContainer = document.getElementById('coverage-stale-filter-options');
        if (!optionsContainer) return;

        optionsContainer.innerHTML = this.coverageStaleDayPresets.map((days) => `
            <label class="filter-option">
                <input type="radio" name="coverage-stale-filter" value="${days}" ${this.coverageStaleDays === days ? 'checked' : ''}>
                <span>${days} дней</span>
            </label>
        `).join('');

        optionsContainer.querySelectorAll('input[name="coverage-stale-filter"]').forEach((input) => {
            input.addEventListener('change', () => {
                const value = parseInt(input.value, 10);
                if (!Number.isFinite(value) || value <= 0) return;
                this.coverageStaleDays = value;
                const staleDaysInput = document.getElementById('coverage-stale-days');
                const staleDaysCustomInput = document.getElementById('coverage-stale-days-custom');
                if (staleDaysInput) {
                    staleDaysInput.value = String(value);
                }
                if (staleDaysCustomInput) {
                    staleDaysCustomInput.value = String(value);
                }
                this.updateCoverageFilterLabels();
                this.closeCoverageDropdowns();
                this.renderCoverageMatrix();
            });
        });
    },

    switchCoverageTab(tabId) {
        this.currentCoverageTab = tabId;
        document.querySelectorAll('.coverage-analysis-tab').forEach((item) => {
            item.classList.toggle('active', item.dataset.coverageTab === tabId);
        });
        ['recommendations', 'usage'].forEach((id) => {
            document.getElementById(`coverage-${id}`)?.classList.toggle('active', id === tabId);
        });
    },

    ensureCoverageBookingsLoaded() {
        if (this.unsubscribeCoverageBookings) return;

        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        this.unsubscribeCoverageBookings = db.collection(COLLECTIONS.BOOKINGS)
            .where('createdAt', '>=', ninetyDaysAgo)
            .limit(5000)
            .onSnapshot((snapshot) => {
                this.coverageBookings = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.coverageBookingsLoaded = true;
                this.updateDevicePromptMeta();
                if (this.currentDeviceView === 'coverage') {
                    this.renderCoverageMatrix();
                } else {
                    this.renderDevices();
                }
            }, (error) => {
                console.error('Devices: error loading coverage bookings', error);
                this.coverageBookingsLoaded = true;
                this.devicePromptMetaById = new Map();
            });
    },

    getProjectAssignmentsForUser(userId) {
        if (typeof Projects === 'undefined' || !userId) return [];
        return Projects.getAssignmentsForUser(userId, { activeOnly: true });
    },

    compareOsVersions(versionA, versionB) {
        const partsA = this.parseOsVersion(versionA);
        const partsB = this.parseOsVersion(versionB);
        const maxLength = Math.max(partsA.length, partsB.length);

        for (let i = 0; i < maxLength; i += 1) {
            const a = partsA[i] || 0;
            const b = partsB[i] || 0;
            if (a > b) return 1;
            if (a < b) return -1;
        }

        return 0;
    },

    getActivityRankingPeriod() {
        const period = typeof Activity !== 'undefined' && Activity?.currentPeriod !== undefined
            ? Activity.currentPeriod
            : 30;
        return period === 'all' ? 'all' : parseInt(period, 10) || 30;
    },

    getDevicePromptActions() {
        return new Set([BOOKING_ACTIONS.TAKE, BOOKING_ACTIONS.BOOK]);
    },

    isPromptEligibleDevice(device) {
        if (!device || device.isWorking === false || device.status === DEVICE_STATUS.EXTERNAL) {
            return false;
        }

        if (device.os === 'android') {
            return this.compareOsVersions(device.osVersion, '10') >= 0;
        }

        if (device.os === 'ios') {
            return this.compareOsVersions(device.osVersion, '16') >= 0;
        }

        return false;
    },

    updateDevicePromptMeta() {
        const promptMeta = new Map();
        const usageActions = this.getDevicePromptActions();
        const period = this.getActivityRankingPeriod();
        const now = Date.now();
        const cutoffTime = period === 'all'
            ? null
            : now - period * 24 * 60 * 60 * 1000;
        const countsByDeviceId = new Map();
        const eligibleDevices = this.devices.filter((device) => this.isPromptEligibleDevice(device));

        eligibleDevices.forEach((device) => {
            countsByDeviceId.set(device.id, 0);
        });

        this.coverageBookings.forEach((booking) => {
            if (!usageActions.has(booking.action) || !countsByDeviceId.has(booking.deviceId)) {
                return;
            }

            const createdAt = booking.createdAt?.toDate ? booking.createdAt.toDate() : (booking.createdAt ? new Date(booking.createdAt) : null);
            if (!createdAt || Number.isNaN(createdAt.getTime())) {
                return;
            }
            if (cutoffTime !== null && createdAt.getTime() < cutoffTime) {
                return;
            }

            countsByDeviceId.set(booking.deviceId, (countsByDeviceId.get(booking.deviceId) || 0) + 1);
        });

        const rankedDevices = eligibleDevices
            .map((device) => ({
                deviceId: device.id,
                count: countsByDeviceId.get(device.id) || 0
            }))
            .sort((a, b) => {
                if (b.count !== a.count) return b.count - a.count;
                return a.deviceId.localeCompare(b.deviceId);
            });

        const topDeviceIds = new Set(
            rankedDevices
                .filter((item) => item.count > 0)
                .slice(0, 3)
                .map((item) => item.deviceId)
        );

        const positiveCounts = rankedDevices
            .map((item) => item.count)
            .filter((count) => count > 0);
        const minPositiveCount = positiveCounts.length > 0 ? Math.min(...positiveCounts) : null;

        rankedDevices.forEach((item) => {
            if (topDeviceIds.has(item.deviceId)) {
                promptMeta.set(item.deviceId, {
                    type: 'popular',
                    label: item.count > 1 ? `Топ по бронированиям · ${item.count}` : 'Топ по бронированиям',
                    text: 'Это устройство берут чаще всего.'
                });
                return;
            }

            if (item.count === 0) {
                promptMeta.set(item.deviceId, {
                    type: 'unused',
                    label: 'Никто не брал',
                    text: 'Это устройство никто не брал, возьми его.'
                });
                return;
            }

            if (minPositiveCount !== null && item.count === minPositiveCount && item.deviceId) {
                promptMeta.set(item.deviceId, {
                    type: 'underused',
                    label: `Редко берут · ${item.count}`,
                    text: 'Это устройство берут реже остальных, присмотрись к нему.'
                });
            }
        });

        this.devicePromptMetaById = promptMeta;
    },

    getDevicePromptMeta(device) {
        if (!device || this.currentDeviceView !== 'catalog' || !this.isDeviceActivityPromptsEnabled()) {
            return null;
        }

        return this.devicePromptMetaById.get(device.id) || null;
    },

    isDeviceCompatibleWithProject(device, project) {
        if (!project) return false;
        if (device.isWorking === false) return false;
        if (device.status === DEVICE_STATUS.EXTERNAL) return false;

        const minVersion = project.minOsVersions?.[device.os];
        if (!minVersion) return true;

        return this.compareOsVersions(device.osVersion, minVersion) >= 0;
    },

    getCoverageUsageActions() {
        return new Set([BOOKING_ACTIONS.TAKE, BOOKING_ACTIONS.BOOK, BOOKING_ACTIONS.TRANSFERRED]);
    },

    inferLegacyBookingProjectIds(booking) {
        if (Array.isArray(booking?.projectIds) && booking.projectIds.length > 0) {
            return booking.projectIds.filter(Boolean);
        }

        if (booking?.projectId) {
            return [booking.projectId];
        }

        const userId = booking?.userId;
        if (!userId) return [];

        const assignments = this.getProjectAssignmentsForUser(userId);
        return assignments
            .map((assignment) => assignment.projectId)
            .filter(Boolean);
    },

    buildCoverageDataset(projectId) {
        const project = typeof Projects !== 'undefined' ? Projects.getProjectById(projectId) : null;
        if (!project) return null;

        const eligibleDevices = this.devices.filter((device) => this.isDeviceCompatibleWithProject(device, project));
        const usageActions = this.getCoverageUsageActions();
        const relevantBookings = this.coverageBookings.filter((booking) => (
            this.inferLegacyBookingProjectIds(booking).includes(projectId) && usageActions.has(booking.action)
        ));

        const statsByDevice = new Map();
        relevantBookings.forEach((booking) => {
            const createdAt = booking.createdAt?.toDate ? booking.createdAt.toDate() : (booking.createdAt ? new Date(booking.createdAt) : null);
            const current = statsByDevice.get(booking.deviceId) || {
                count: 0,
                lastUsed: null,
                lastUserName: ''
            };

            current.count += 1;
            if (createdAt && (!current.lastUsed || createdAt > current.lastUsed)) {
                current.lastUsed = createdAt;
                current.lastUserName = booking.userName || '';
            }

            statsByDevice.set(booking.deviceId, current);
        });

        const deviceRows = eligibleDevices.map((device) => {
            const deviceStats = statsByDevice.get(device.id) || {
                count: 0,
                lastUsed: null,
                lastUserName: ''
            };
            const recentBookings = relevantBookings
                .filter((booking) => booking.deviceId === device.id)
                .sort((a, b) => {
                    const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
                    const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
                    return bTime - aTime;
                })
                .slice(0, 3);
            const daysSinceLastUse = deviceStats.lastUsed
                ? Math.floor((Date.now() - deviceStats.lastUsed.getTime()) / (1000 * 60 * 60 * 24))
                : null;

            return {
                device,
                count: deviceStats.count,
                lastUsed: deviceStats.lastUsed,
                lastUserName: deviceStats.lastUserName,
                recentBookings,
                daysSinceLastUse,
                isNeverUsed: deviceStats.count === 0,
                isStale: deviceStats.count === 0 || (daysSinceLastUse !== null && daysSinceLastUse >= this.coverageStaleDays)
            };
        });

        return {
            scope: 'project',
            project,
            eligibleDevices,
            relevantBookings,
            deviceRows
        };
    },

    buildAggregateCoverageDataset(projects) {
        const visibleProjects = (projects || []).filter(Boolean);
        const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));
        const usageActions = this.getCoverageUsageActions();
        const recentThreshold = new Date(Date.now() - this.coverageStaleDays * 24 * 60 * 60 * 1000);
        const relevantBookings = this.coverageBookings.filter((booking) => {
            const inferredProjectIds = this.inferLegacyBookingProjectIds(booking);
            return inferredProjectIds.some((projectId) => visibleProjectIds.has(projectId)) && usageActions.has(booking.action);
        });

        const projectStats = new Map(
            visibleProjects.map((project) => ([
                project.id,
                {
                    projectId: project.id,
                    projectName: project.name || 'Проект',
                    projectCode: project.code || '',
                    count: 0,
                    lastUsed: null,
                    eligibleDevicesCount: this.devices.filter((device) => this.isDeviceCompatibleWithProject(device, project)).length,
                    membersCount: typeof Projects !== 'undefined'
                        ? Projects.getAssignmentsForProject(project.id, { activeOnly: true }).length
                        : 0,
                    uniqueDeviceIds: new Set(),
                    recentDeviceIds: new Set(),
                    userIds: new Set()
                }
            ]))
        );
        const deviceStats = new Map();
        const userStats = new Map();

        relevantBookings.forEach((booking) => {
            const createdAt = booking.createdAt?.toDate ? booking.createdAt.toDate() : (booking.createdAt ? new Date(booking.createdAt) : null);
            const inferredProjectIds = this.inferLegacyBookingProjectIds(booking)
                .filter((projectId) => visibleProjectIds.has(projectId));
            const device = this.devices.find((item) => item.id === booking.deviceId);

            inferredProjectIds.forEach((projectId) => {
                if (!projectStats.has(projectId)) {
                    return;
                }

                const currentProjectStats = projectStats.get(projectId);
                currentProjectStats.count += 1;
                if (booking.deviceId) {
                    currentProjectStats.uniqueDeviceIds.add(booking.deviceId);
                }
                if (booking.userId) {
                    currentProjectStats.userIds.add(booking.userId);
                }
                if (createdAt && createdAt >= recentThreshold && booking.deviceId) {
                    currentProjectStats.recentDeviceIds.add(booking.deviceId);
                }
                if (createdAt && (!currentProjectStats.lastUsed || createdAt > currentProjectStats.lastUsed)) {
                    currentProjectStats.lastUsed = createdAt;
                }
                projectStats.set(projectId, currentProjectStats);
            });

            const currentDeviceStats = deviceStats.get(booking.deviceId) || {
                deviceId: booking.deviceId,
                deviceName: device?.name || booking.deviceName || 'Устройство',
                device,
                count: 0,
                lastUsed: null,
                lastUserName: ''
            };
            currentDeviceStats.count += 1;
            if (createdAt && (!currentDeviceStats.lastUsed || createdAt > currentDeviceStats.lastUsed)) {
                currentDeviceStats.lastUsed = createdAt;
                currentDeviceStats.lastUserName = booking.userName || '';
            }
            deviceStats.set(booking.deviceId, currentDeviceStats);

            const currentUserStats = userStats.get(booking.userId) || {
                userId: booking.userId,
                userName: booking.userName || 'Пользователь',
                count: 0,
                uniqueDeviceIds: new Set(),
                projectIds: new Set(),
                lastUsed: null
            };
            currentUserStats.count += 1;
            currentUserStats.uniqueDeviceIds.add(booking.deviceId);
            inferredProjectIds.forEach((projectId) => currentUserStats.projectIds.add(projectId));
            if (createdAt && (!currentUserStats.lastUsed || createdAt > currentUserStats.lastUsed)) {
                currentUserStats.lastUsed = createdAt;
            }
            userStats.set(booking.userId, currentUserStats);
        });

        const freshUsesCount = relevantBookings.filter((booking) => {
            const createdAt = booking.createdAt?.toDate ? booking.createdAt.toDate() : (booking.createdAt ? new Date(booking.createdAt) : null);
            return createdAt && createdAt >= recentThreshold;
        }).length;

        return {
            scope: 'all',
            projects: visibleProjects,
            relevantBookings,
            deviceRows: Array.from(deviceStats.values()),
            userRows: Array.from(userStats.values()).map((row) => ({
                ...row,
                uniqueDevicesCount: row.uniqueDeviceIds.size,
                projectCount: row.projectIds.size
            })),
            projectRows: Array.from(projectStats.values()).map((row) => ({
                projectId: row.projectId,
                projectName: row.projectName,
                projectCode: row.projectCode,
                count: row.count,
                lastUsed: row.lastUsed,
                eligibleDevicesCount: row.eligibleDevicesCount,
                membersCount: row.membersCount,
                uniqueDevicesCount: row.uniqueDeviceIds.size,
                recentDevicesCount: row.recentDeviceIds.size,
                activeUsersCount: row.userIds.size,
                uncoveredDevicesCount: Math.max(row.eligibleDevicesCount - row.uniqueDeviceIds.size, 0),
                freshnessPercent: row.eligibleDevicesCount > 0
                    ? Math.round((row.recentDeviceIds.size / row.eligibleDevicesCount) * 100)
                    : 0
            })),
            totalUniqueDevices: deviceStats.size,
            totalUsers: userStats.size,
            freshUsesCount
        };
    },

    updateCoverageStatsHeaders(dataset) {
        const overviewTitle = document.getElementById('coverage-overview-title');
        const overviewDescription = document.getElementById('coverage-overview-description');
        const topDevicesTitle = document.getElementById('coverage-top-devices-title');
        const topDevicesDescription = document.getElementById('coverage-top-devices-description');
        const secondaryTitle = document.getElementById('coverage-secondary-title');
        const secondaryDescription = document.getElementById('coverage-secondary-description');
        const extraTitle = document.getElementById('coverage-extra-title');
        const extraDescription = document.getElementById('coverage-extra-description');

        if (dataset.scope === 'all') {
            if (overviewTitle) overviewTitle.textContent = 'Сравнение проектов';
            if (overviewDescription) overviewDescription.textContent = 'По каждому проекту видно объём использования, ширину покрытия и свежесть по совместимым устройствам.';
            if (topDevicesTitle) topDevicesTitle.textContent = 'Топ проектов по активности';
            if (topDevicesDescription) topDevicesDescription.textContent = 'Где устройства используются чаще всего.';
            if (secondaryTitle) secondaryTitle.textContent = 'Топ проектов по покрытию';
            if (secondaryDescription) secondaryDescription.textContent = `Где шире охват совместимых устройств за последние ${this.coverageStaleDays} дней.`;
            if (extraTitle) extraTitle.textContent = 'Где нужен фокус';
            if (extraDescription) extraDescription.textContent = 'Проекты без истории или со слабой свежестью покрытия.';
            return;
        }

        if (overviewTitle) overviewTitle.textContent = 'Общая картина';
        if (overviewDescription) overviewDescription.textContent = 'Насколько равномерно проект покрывает совместимые устройства.';
        if (topDevicesTitle) topDevicesTitle.textContent = 'Топ устройств';
        if (topDevicesDescription) topDevicesDescription.textContent = 'Какие модели используются чаще всего.';
        if (secondaryTitle) secondaryTitle.textContent = 'Платформы';
        if (secondaryDescription) secondaryDescription.textContent = 'Разбивка по совместимым платформам и активности на них.';
        if (extraTitle) extraTitle.textContent = 'На что обратить внимание';
        if (extraDescription) extraDescription.textContent = 'Самые важные сигналы для выбора следующего устройства.';
    },

    renderCoverageMatrix() {
        if (!this.isProjectContextEnabled()) {
            if (this.currentDeviceView === 'coverage') {
                this.switchDeviceView('catalog');
            }
            return;
        }

        if (typeof Projects === 'undefined') return;

        this.ensureCoverageBookingsLoaded();

        const projectSelect = document.getElementById('coverage-project-select');
        const emptyState = document.getElementById('coverage-empty-state');
        const content = document.getElementById('coverage-content');
        const detailTabs = document.getElementById('coverage-detail-tabs');
        const recommendationsView = document.getElementById('coverage-recommendations');
        const usageView = document.getElementById('coverage-usage');
        const statsView = document.getElementById('coverage-stats');

        const currentUserId = Auth.getUser()?.uid || '';
        const visibleProjects = Projects.getVisibleProjectsForUser(currentUserId);
        const userAssignments = this.getProjectAssignmentsForUser(currentUserId);

        if (this.coverageSelectedProjectId && !visibleProjects.some((project) => project.id === this.coverageSelectedProjectId)) {
            this.coverageSelectedProjectId = '';
        }

        if (
            !this.coverageProjectSelectionTouched &&
            !this.coverageSelectedProjectId &&
            userAssignments.length > 0
        ) {
            this.coverageSelectedProjectId = userAssignments[0].projectId || '';
        }

        if (projectSelect) {
            projectSelect.innerHTML = [
                `<option value="" ${this.coverageSelectedProjectId ? '' : 'selected'}>Все проекты</option>`,
                ...visibleProjects.map((project) => (
                    `<option value="${project.id}" ${project.id === this.coverageSelectedProjectId ? 'selected' : ''}>${project.name}</option>`
                ))
            ].join('');
        }

        this.renderCoverageProjectFilterOptions(visibleProjects);
        this.renderCoverageStaleFilterOptions();
        this.updateCoverageFilterLabels();

        const staleDaysInput = document.getElementById('coverage-stale-days');
        const staleDaysCustomInput = document.getElementById('coverage-stale-days-custom');
        if (staleDaysInput) {
            staleDaysInput.value = String(this.coverageStaleDays);
        }
        if (staleDaysCustomInput) {
            staleDaysCustomInput.value = String(this.coverageStaleDays);
        }

        const hasProjects = visibleProjects.length > 0;
        emptyState?.classList.toggle('hidden', hasProjects);
        content?.classList.toggle('hidden', !hasProjects);
        if (!hasProjects) return;

        if (!this.coverageBookingsLoaded) {
            const summary = document.getElementById('coverage-summary');
            if (summary) {
                summary.innerHTML = '<div class="empty-inline-state">Загрузка матрицы покрытия...</div>';
            }
            return;
        }

        const dataset = this.coverageSelectedProjectId
            ? this.buildCoverageDataset(this.coverageSelectedProjectId)
            : this.buildAggregateCoverageDataset(visibleProjects);
        if (!dataset) return;

        if (!this.coverageSelectedProjectId) {
            detailTabs?.classList.add('hidden');
            recommendationsView?.classList.remove('active');
            usageView?.classList.remove('active');
            statsView?.classList.remove('hidden');
        } else {
            detailTabs?.classList.remove('hidden');
            statsView?.classList.add('hidden');
            this.switchCoverageTab(this.currentCoverageTab === 'usage' ? 'usage' : 'recommendations');
        }

        this.renderCoverageSummary(dataset);
        this.renderCoverageStats(dataset);
        if (dataset.scope === 'project') {
            this.renderCoverageRecommendations(dataset);
            this.renderCoverageUsage(dataset);
        }
    },

    copyCoverageMatrix() {
        const label = document.getElementById('coverage-copy-label');
        const defaultLabel = 'Скопировать список';

        if (!this.coverageSelectedProjectId) {
            if (label) {
                label.textContent = 'Выберите проект';
                setTimeout(() => { label.textContent = defaultLabel; }, 2000);
            }
            return;
        }

        const dataset = this.buildCoverageDataset(this.coverageSelectedProjectId);

        if (!dataset || !dataset.deviceRows || dataset.deviceRows.length === 0) {
            if (label) {
                label.textContent = 'Нет данных';
                setTimeout(() => { label.textContent = defaultLabel; }, 2000);
            }
            return;
        }

        const filteredDeviceIds = new Set(
            this.getFilteredDevices({ preserveStableOrder: false }).map((device) => device.id)
        );

        const summaryFilter = this.coverageSummaryFilter;
        const sorted = [...dataset.deviceRows]
            .filter((row) => filteredDeviceIds.has(row.device.id))
            .filter((row) => {
                if (!summaryFilter || summaryFilter === 'all') return true;
                if (summaryFilter === 'never') return row.isNeverUsed;
                if (summaryFilter === 'stale') return !row.isNeverUsed && row.isStale;
                return true;
            })
            .sort((a, b) => {
                if (a.isNeverUsed !== b.isNeverUsed) return a.isNeverUsed ? -1 : 1;
                if (a.device.status !== b.device.status) {
                    return a.device.status === DEVICE_STATUS.AVAILABLE ? -1 : 1;
                }
                const aTime = a.lastUsed ? a.lastUsed.getTime() : 0;
                const bTime = b.lastUsed ? b.lastUsed.getTime() : 0;
                return aTime - bTime;
            });

        if (sorted.length === 0) {
            if (label) {
                label.textContent = 'Нет данных';
                setTimeout(() => { label.textContent = defaultLabel; }, 2000);
            }
            return;
        }

        const header = `Рекомендации: ${dataset.project.name}\n`;

        const lines = sorted.map((row) => {
            const name = row.device.name || row.device.model || 'Без названия';
            const osLabel = OS_TYPES[row.device.os]?.label || row.device.os || '';
            const osVersion = row.device.osVersion || '';
            const os = [osLabel, osVersion].filter(Boolean).join(' ');
            const count = row.count;
            let lastUsed;
            if (row.isNeverUsed) {
                lastUsed = 'никогда';
            } else if (row.lastUsed) {
                lastUsed = this.formatDate(row.lastUsed);
            } else {
                lastUsed = '—';
            }
            return `${name} — ${os} — ${count} — ${lastUsed}`;
        });

        const text = header + lines.join('\n');

        navigator.clipboard.writeText(text).then(() => {
            if (label) {
                label.textContent = 'Скопировано!';
                setTimeout(() => { label.textContent = defaultLabel; }, 2000);
            }
        }).catch(() => {
            if (label) {
                label.textContent = 'Ошибка';
                setTimeout(() => { label.textContent = defaultLabel; }, 2000);
            }
        });
    },

    renderCoverageSummary(dataset) {
        const summary = document.getElementById('coverage-summary');
        if (!summary) return;

        if (dataset.scope === 'all') {
            const projectsWithUsage = dataset.projectRows.filter((row) => row.count > 0).length;
            const sortedByActivity = [...dataset.projectRows]
                .sort((a, b) => b.count - a.count || b.uniqueDevicesCount - a.uniqueDevicesCount);
            const mostActiveProject = sortedByActivity[0]?.count > 0
                ? sortedByActivity[0]
                : null;
            const bestCoverageProject = [...dataset.projectRows]
                .filter((row) => row.eligibleDevicesCount > 0)
                .sort((a, b) => b.freshnessPercent - a.freshnessPercent || b.uniqueDevicesCount - a.uniqueDevicesCount)[0];
            summary.innerHTML = `
                <article class="coverage-summary-card">
                    <span class="coverage-summary-label">Проектов в сравнении</span>
                    <strong>${dataset.projects.length}</strong>
                    <small>Все проекты, доступные в матрице покрытия для текущего пользователя.</small>
                </article>
                <article class="coverage-summary-card">
                    <span class="coverage-summary-label">Проектов с историей</span>
                    <strong>${projectsWithUsage}</strong>
                    <small>По этим проектам уже есть зафиксированные использования устройств.</small>
                </article>
                <article class="coverage-summary-card">
                    <span class="coverage-summary-label">Самый активный проект</span>
                    <strong>${mostActiveProject?.projectName || '—'}</strong>
                    <small>${mostActiveProject ? `${mostActiveProject.count} использований и ${mostActiveProject.uniqueDevicesCount} разных устройств.` : 'Истории использования пока нет.'}</small>
                </article>
                <article class="coverage-summary-card">
                    <span class="coverage-summary-label">Лучшее свежее покрытие</span>
                    <strong>${bestCoverageProject?.projectName || '—'}</strong>
                    <small>${bestCoverageProject ? `${bestCoverageProject.recentDevicesCount} из ${bestCoverageProject.eligibleDevicesCount} совместимых устройств использовались недавно.` : 'Сравнение появится после истории использования.'}</small>
                </article>
            `;
            return;
        }

        const freshCount = dataset.deviceRows.filter((row) => !row.isNeverUsed && !row.isStale).length;
        const neverUsed = dataset.deviceRows.filter((row) => row.isNeverUsed).length;
        const stale = dataset.deviceRows.filter((row) => !row.isNeverUsed && row.isStale).length;
        const percent = dataset.eligibleDevices.length > 0
            ? Math.round((freshCount / dataset.eligibleDevices.length) * 100)
            : 0;

        const activeFilter = this.coverageSummaryFilter;
        summary.innerHTML = `
            <article class="coverage-summary-card coverage-summary-clickable${activeFilter === 'all' ? ' active' : ''}" data-coverage-filter="all">
                <span class="coverage-summary-label">Совместимых устройств</span>
                <strong>${dataset.eligibleDevices.length}</strong>
                <small>Это устройства, которые подходят проекту по версии ОС и доступны для использования.</small>
            </article>
            <article class="coverage-summary-card coverage-summary-clickable${activeFilter === 'never' ? ' active' : ''}" data-coverage-filter="never">
                <span class="coverage-summary-label">Никогда не использовались</span>
                <strong>${neverUsed}</strong>
                <small>Хорошие кандидаты, если нужно расширить покрытие, а не гонять одни и те же модели.</small>
            </article>
            <article class="coverage-summary-card coverage-summary-clickable${activeFilter === 'stale' ? ' active' : ''}" data-coverage-filter="stale">
                <span class="coverage-summary-label">Давно не использовались</span>
                <strong>${stale}</strong>
                <small>Устройства, которые не участвовали в проекте последние ${this.coverageStaleDays} дней и дольше.</small>
            </article>
            <article class="coverage-summary-card">
                <span class="coverage-summary-label">Свежесть покрытия</span>
                <strong>${percent}%</strong>
                <small>Доля совместимых устройств, которые уже использовались на проекте недавно.</small>
            </article>
        `;

        summary.querySelectorAll('[data-coverage-filter]').forEach((card) => {
            card.addEventListener('click', () => {
                const filter = card.dataset.coverageFilter;
                this.coverageSummaryFilter = this.coverageSummaryFilter === filter ? '' : filter;
                this.switchCoverageTab('recommendations');
                const ds = this.buildCoverageDataset(this.coverageSelectedProjectId);
                if (ds) {
                    this.renderCoverageSummary(ds);
                    this.renderCoverageRecommendations(ds);
                }
            });
        });
    },

    renderCoverageRecommendations(dataset) {
        const container = document.getElementById('coverage-recommendations-list');
        if (!container) return;

        const filteredDeviceIds = new Set(
            this.getFilteredDevices({ preserveStableOrder: false }).map((device) => device.id)
        );

        const summaryFilter = this.coverageSummaryFilter;
        const sortedRows = [...dataset.deviceRows]
            .filter((row) => filteredDeviceIds.has(row.device.id))
            .filter((row) => {
                if (!summaryFilter || summaryFilter === 'all') return true;
                if (summaryFilter === 'never') return row.isNeverUsed;
                if (summaryFilter === 'stale') return !row.isNeverUsed && row.isStale;
                return true;
            })
            .sort((a, b) => {
            if (a.isNeverUsed !== b.isNeverUsed) return a.isNeverUsed ? -1 : 1;
            if (a.device.status !== b.device.status) {
                return a.device.status === DEVICE_STATUS.AVAILABLE ? -1 : 1;
            }
            const aTime = a.lastUsed ? a.lastUsed.getTime() : 0;
            const bTime = b.lastUsed ? b.lastUsed.getTime() : 0;
            return aTime - bTime;
        });

        container.className = 'coverage-card-list coverage-card-grid';
        if (sortedRows.length === 0) {
            container.innerHTML = this.currentFilter === 'unused_by_me' && !this.usedDeviceIdsReady
                ? '<div class="empty-inline-state">Загружаем историю ваших устройств для фильтра рекомендаций...</div>'
                : '<div class="empty-inline-state">По текущим фильтрам подходящих рекомендаций не найдено.</div>';
            return;
        }

        container.innerHTML = sortedRows.map((row) => {
            const reason = row.isNeverUsed
                ? 'Новое для проекта'
                : `${row.daysSinceLastUse} дн. без запусков`;
            const lastUsed = row.lastUsed ? this.formatDate(row.lastUsed) : '—';
            const caption = row.isNeverUsed
                ? 'Подходит по версии ОС и еще не участвовало в этом проекте.'
                : `Подходит по версии ОС и давно не использовалось на проекте.`;
            const contextTags = [
                {
                    text: reason,
                    tone: row.isNeverUsed ? 'high' : 'medium'
                },
                {
                    text: row.count === 0 ? '0 использований' : `${row.count} использ.`,
                    tone: 'default'
                }
            ];

            if (row.lastUserName) {
                contextTags.push({
                    text: row.lastUserName,
                    tone: 'default'
                });
            }

            if (!row.isNeverUsed && row.lastUsed) {
                contextTags.push({
                    text: lastUsed,
                    tone: 'default'
                });
            }

            return `
                <article class="coverage-grid-item">
                    ${this.createDeviceCard(row.device, {
                        contextCaption: caption,
                        contextTags
                    })}
                </article>
            `;
        }).join('');

        this.attachCardEventHandlers(container);
    },

    renderCoverageUsage(dataset) {
        const container = document.getElementById('coverage-usage-list');
        const meta = document.getElementById('coverage-usage-meta');
        if (!container) return;

        const query = this.coverageUsageSearchQuery;
        const historyRows = dataset.deviceRows.filter((row) => row.count > 0);
        let rows = [...historyRows].filter((row) => this.matchesCoverageUsageSearch(row, query));

        rows.sort((a, b) => {
            if (this.coverageUsageSort === 'count') {
                const countDiff = b.count - a.count;
                if (countDiff !== 0) return countDiff;
                const lastDiff = (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0);
                if (lastDiff !== 0) return lastDiff;
                return String(a.device.name || '').localeCompare(String(b.device.name || ''), 'ru');
            }

            if (this.coverageUsageSort === 'name') {
                return String(a.device.name || '').localeCompare(String(b.device.name || ''), 'ru');
            }

            const lastDiff = (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0);
            if (lastDiff !== 0) return lastDiff;
            const countDiff = b.count - a.count;
            if (countDiff !== 0) return countDiff;
            return String(a.device.name || '').localeCompare(String(b.device.name || ''), 'ru');
        });

        if (meta) {
            meta.textContent = query
                ? `Найдено устройств: ${rows.length} из ${historyRows.length}`
                : `Устройств в истории проекта: ${historyRows.length}`;
        }

        if (rows.length === 0) {
            container.innerHTML = query
                ? '<div class="empty-inline-state">По вашему запросу использования не найдены.</div>'
                : '<div class="empty-inline-state">Для этого проекта ещё нет истории использования устройств.</div>';
            return;
        }

        container.innerHTML = rows.map((row) => {
            const recentEvents = row.recentBookings.length > 0
                ? row.recentBookings.map((booking) => {
                    const date = booking.createdAt?.toDate ? booking.createdAt.toDate() : new Date(booking.createdAt || Date.now());
                    const actionInfo = this.getCoverageUsageActionInfo(booking);
                    return `
                        <div class="coverage-usage-event">
                            <span class="coverage-usage-event-date">${this.formatDate(date)}</span>
                            <div class="coverage-usage-event-main">
                                <span class="coverage-usage-event-user">${booking.userName || '—'}</span>
                                <span class="coverage-usage-event-detail">${actionInfo.detail}</span>
                            </div>
                            <span class="coverage-usage-event-badge ${actionInfo.tone}">${actionInfo.label}</span>
                        </div>
                    `;
                }).join('')
                : '<div class="empty-inline-state">Для этого устройства на проекте пока нет зафиксированных использований.</div>';

            return `
                <article class="coverage-usage-card">
                    <div class="coverage-usage-card-header">
                        <div>
                            <h4>${row.device.name}</h4>
                            <p>${OS_TYPES[row.device.os]?.label || row.device.os} ${row.device.osVersion || ''}${row.device.deviceId ? ` • ${row.device.deviceId}` : ''}</p>
                        </div>
                        <span class="project-status-badge ${row.device.status === DEVICE_STATUS.AVAILABLE ? 'active' : 'inactive'}">
                            ${row.device.status === DEVICE_STATUS.AVAILABLE ? 'Свободно' : 'Занято'}
                        </span>
                    </div>
                    <div class="coverage-usage-metrics">
                        <div class="coverage-usage-metric"><span>Использований</span><strong>${row.count}</strong></div>
                        <div class="coverage-usage-metric"><span>Последний пользователь</span><strong>${row.lastUserName || '—'}</strong></div>
                        <div class="coverage-usage-metric"><span>Покрытие</span><strong>${row.count > 0 ? 'Устройство уже участвовало' : 'Новое для проекта'}</strong></div>
                        <div class="coverage-usage-metric"><span>Последнее использование</span><strong>${row.lastUsed ? this.formatDate(row.lastUsed) : 'Никогда'}</strong></div>
                    </div>
                    <div class="coverage-usage-events">
                        <div class="coverage-panel-subtitle">Последние использования</div>
                        ${recentEvents}
                    </div>
                </article>
            `;
        }).join('');
    },

    matchesCoverageUsageSearch(row, query) {
        if (!query) return true;

        const searchParts = [
            row.device.name,
            row.device.deviceId,
            OS_TYPES[row.device.os]?.label || row.device.os,
            row.device.osVersion,
            row.lastUserName,
            ...row.recentBookings.map((booking) => booking.userName),
            ...row.recentBookings.map((booking) => this.getCoverageUsageActionInfo(booking).label),
            ...row.recentBookings.map((booking) => this.getCoverageUsageActionInfo(booking).detail)
        ].map((value) => String(value || '').toLowerCase());

        return searchParts.some((value) => value.includes(query));
    },

    getCoverageUsageActionInfo(booking) {
        if (booking.action === BOOKING_ACTIONS.TRANSFERRED) {
            return {
                label: 'Передано',
                tone: 'transfer',
                detail: booking.homeAddress || booking.office || 'Передано сотруднику'
            };
        }

        if (booking.action === BOOKING_ACTIONS.BOOK || booking.bookingType === BOOKING_TYPES.HOME) {
            return {
                label: 'Домой',
                tone: 'home',
                detail: booking.homeAddress || 'Взято домой'
            };
        }

        return {
            label: 'Офис',
            tone: 'office',
            detail: booking.office || 'Использование в офисе'
        };
    },

    renderCoverageStats(dataset) {
        const topDevices = document.getElementById('coverage-top-devices');
        const distribution = document.getElementById('coverage-platform-distribution');
        const extra = document.getElementById('coverage-extra-stats');
        const overview = document.getElementById('coverage-overview-stats');
        if (!topDevices || !distribution || !extra || !overview) return;

        this.updateCoverageStatsHeaders(dataset);

        if (dataset.scope === 'all') {
            overview.className = 'coverage-project-comparison-grid';

            const projectRows = [...dataset.projectRows]
                .sort((a, b) => b.count - a.count || b.freshnessPercent - a.freshnessPercent || String(a.projectName || '').localeCompare(String(b.projectName || ''), 'ru'));
            const topProjectRows = projectRows
                .filter((row) => row.count > 0)
                .slice(0, 5);
            const topCoverageRows = [...dataset.projectRows]
                .filter((row) => row.eligibleDevicesCount > 0)
                .sort((a, b) => b.freshnessPercent - a.freshnessPercent || b.uniqueDevicesCount - a.uniqueDevicesCount || b.count - a.count)
                .slice(0, 5);
            const noHistoryProjects = dataset.projectRows.filter((row) => row.count === 0);
            const lowFreshnessProjects = [...dataset.projectRows]
                .filter((row) => row.eligibleDevicesCount > 0 && row.freshnessPercent < 35)
                .sort((a, b) => a.freshnessPercent - b.freshnessPercent || a.count - b.count)
                .slice(0, 3);
            const strongestCoverageProject = topCoverageRows[0];

            overview.innerHTML = projectRows.length > 0
                ? projectRows.map((row) => `
                    <article class="coverage-project-comparison-card">
                        <div class="coverage-project-comparison-header">
                            <div>
                                <div class="coverage-stat-title">${row.projectName}</div>
                                <div class="coverage-stat-hint">${row.projectCode || 'Без кода'} • ${row.lastUsed ? `Последнее использование ${this.formatDate(row.lastUsed)}` : 'Истории пока нет'}</div>
                            </div>
                            <span class="project-inline-counter">${row.membersCount} участ.</span>
                        </div>
                        <div class="coverage-project-card-metrics">
                            <div class="coverage-project-card-metric">
                                <span>Использований</span>
                                <strong>${row.count}</strong>
                            </div>
                            <div class="coverage-project-card-metric">
                                <span>Устройств</span>
                                <strong>${row.uniqueDevicesCount}/${row.eligibleDevicesCount}</strong>
                            </div>
                            <div class="coverage-project-card-metric">
                                <span>Пользователей</span>
                                <strong>${row.activeUsersCount}</strong>
                            </div>
                            <div class="coverage-project-card-metric">
                                <span>Свежесть</span>
                                <strong>${row.freshnessPercent}%</strong>
                            </div>
                        </div>
                        <div class="coverage-project-progress-meta">
                            <span class="coverage-overview-label">Свежие устройства за ${this.coverageStaleDays} дней</span>
                            <strong>${row.recentDevicesCount} / ${row.eligibleDevicesCount || 0}</strong>
                        </div>
                        <div class="coverage-progress">
                            <div class="coverage-progress-bar" style="width: ${row.freshnessPercent}%"></div>
                        </div>
                        <small class="coverage-stat-hint">${row.count > 0 ? `${row.uncoveredDevicesCount} совместимых устройств ещё не использовались на проекте.` : 'Истории использования пока нет, проект можно начать закрывать новыми устройствами.'}</small>
                    </article>
                `).join('')
                : '<div class="empty-inline-state">Пока нет проектов для сравнения.</div>';

            topDevices.innerHTML = topProjectRows.length > 0
                ? topProjectRows.map((row) => `
                    <div class="coverage-stat-row">
                        <div>
                            <div class="coverage-stat-title">${row.projectName}</div>
                            <div class="coverage-stat-hint">${row.uniqueDevicesCount} устройств • ${row.activeUsersCount} пользователей • ${row.lastUsed ? `последний запуск ${this.formatDate(row.lastUsed)}` : 'без истории'}</div>
                        </div>
                        <strong>${row.count} использ.</strong>
                    </div>
                `).join('')
                : '<div class="empty-inline-state">Пока нет проектной истории использования устройств.</div>';

            distribution.innerHTML = topCoverageRows.length > 0
                ? topCoverageRows.map((row) => `
                    <div class="coverage-stat-row">
                        <div>
                            <div class="coverage-stat-title">${row.projectName}</div>
                            <div class="coverage-stat-hint">${row.recentDevicesCount} свежих устройств из ${row.eligibleDevicesCount} совместимых • ${row.uncoveredDevicesCount} ещё не покрыты</div>
                        </div>
                        <strong>${row.freshnessPercent}%</strong>
                    </div>
                `).join('')
                : '<div class="empty-inline-state">Пока нет проектов с совместимыми устройствами.</div>';

            extra.innerHTML = `
                <div class="coverage-insight-item">
                    <span class="coverage-stat-title">Без истории использования</span>
                    <div class="coverage-stat-hint">${noHistoryProjects.length > 0 ? noHistoryProjects.map((row) => row.projectName).slice(0, 3).join(', ') + (noHistoryProjects.length > 3 ? ` и ещё ${noHistoryProjects.length - 3}` : '') : 'У всех проектов уже есть история использования устройств.'}</div>
                </div>
                <div class="coverage-insight-item">
                    <span class="coverage-stat-title">Низкая свежесть покрытия</span>
                    <div class="coverage-stat-hint">${lowFreshnessProjects.length > 0 ? lowFreshnessProjects.map((row) => `${row.projectName} (${row.freshnessPercent}%)`).join(', ') : `Все проекты держат минимум 35% свежего покрытия за ${this.coverageStaleDays} дней.`}</div>
                </div>
                <div class="coverage-insight-item">
                    <span class="coverage-stat-title">Лучшее текущее покрытие</span>
                    <div class="coverage-stat-hint">${strongestCoverageProject ? `${strongestCoverageProject.projectName}: ${strongestCoverageProject.recentDevicesCount} свежих устройств из ${strongestCoverageProject.eligibleDevicesCount} совместимых.` : 'Пока недостаточно данных для сравнения покрытия.'}</div>
                </div>
            `;
            return;
        }

        overview.className = 'coverage-overview-stats';

        const top = [...dataset.deviceRows]
            .filter((row) => row.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const freshCount = dataset.deviceRows.filter((row) => !row.isNeverUsed && !row.isStale).length;
        const staleCount = dataset.deviceRows.filter((row) => row.isStale).length;
        const neverUsed = dataset.deviceRows.filter((row) => row.isNeverUsed).length;
        const freshnessPercent = dataset.eligibleDevices.length > 0
            ? Math.round((freshCount / dataset.eligibleDevices.length) * 100)
            : 0;

        overview.innerHTML = `
            <div class="coverage-overview-item coverage-overview-item-accent">
                <span class="coverage-overview-label">Свежесть покрытия</span>
                <strong>${freshnessPercent}%</strong>
                <div class="coverage-progress">
                    <div class="coverage-progress-bar" style="width: ${freshnessPercent}%"></div>
                </div>
                <small>${freshCount} из ${dataset.eligibleDevices.length} совместимых устройств использовались недавно.</small>
            </div>
            <div class="coverage-overview-item">
                <span class="coverage-overview-label">Никогда не использовались</span>
                <strong>${neverUsed}</strong>
                <small>Это резерв для расширения покрытия.</small>
            </div>
            <div class="coverage-overview-item">
                <span class="coverage-overview-label">Требуют внимания</span>
                <strong>${staleCount}</strong>
                <small>Не использовались ${this.coverageStaleDays}+ дней или не использовались вообще.</small>
            </div>
        `;

        topDevices.innerHTML = top.length > 0
            ? top.map((row) => `
                <div class="coverage-stat-row">
                    <div>
                        <div class="coverage-stat-title">${row.device.name}</div>
                        <div class="coverage-stat-hint">${row.lastUsed ? `Последнее использование ${this.formatDate(row.lastUsed)}` : 'Еще не использовалось'}</div>
                    </div>
                    <strong>${row.count}</strong>
                </div>
            `).join('')
            : '<div class="empty-inline-state">У проекта еще нет истории использования.</div>';

        const platformStats = dataset.deviceRows.reduce((acc, row) => {
            const key = row.device.os || 'other';
            if (!acc[key]) {
                acc[key] = { devices: 0, uses: 0, neverUsed: 0 };
            }
            acc[key].devices += 1;
            acc[key].uses += row.count;
            if (row.isNeverUsed) {
                acc[key].neverUsed += 1;
            }
            return acc;
        }, {});

        distribution.innerHTML = Object.entries(platformStats).map(([platform, stats]) => `
            <div class="coverage-stat-row">
                <div>
                    <div class="coverage-stat-title">${OS_TYPES[platform]?.label || platform}</div>
                    <div class="coverage-stat-hint">Совместимых устройств: ${stats.devices} • Никогда не использовались: ${stats.neverUsed}</div>
                </div>
                <strong>${stats.uses} использований</strong>
            </div>
        `).join('');

        const availableRecommended = dataset.deviceRows.filter((row) => row.isStale && row.device.status === DEVICE_STATUS.AVAILABLE).length;
        extra.innerHTML = `
            <div class="coverage-insight-item">
                <span class="coverage-stat-title">Лучший момент расширить покрытие</span>
                <div class="coverage-stat-hint">${availableRecommended} свободных устройств уже подходят проекту и давно не использовались.</div>
            </div>
            <div class="coverage-insight-item">
                <span class="coverage-stat-title">Общий объём использования</span>
                <div class="coverage-stat-hint">На проекте зафиксировано ${dataset.relevantBookings.length} использований совместимых устройств.</div>
            </div>
            <div class="coverage-insight-item">
                <span class="coverage-stat-title">Риск перекоса</span>
                <div class="coverage-stat-hint">${top[0] ? `Самое часто используемое устройство — ${top[0].device.name} (${top[0].count} раз).` : 'Пока нет лидирующих устройств.'}</div>
            </div>
        `;
    },
    
    /**
     * Обновить видимость секции "Состояние" в зависимости от роли
     */
    updateWorkingSectionVisibility() {
        const workingSection = document.getElementById('filter-working-section');
        if (workingSection) {
            if (Auth.isAdmin) {
                workingSection.classList.remove('hidden');
            } else {
                workingSection.classList.add('hidden');
                // Для не-админов всегда "только рабочие"
                this.filterWorking = 'working';
            }
        }
    }
});
