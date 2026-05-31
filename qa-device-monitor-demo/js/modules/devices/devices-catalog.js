/**
 * Devices Catalog Module
 * Рендеринг карточек устройств, поиск, сортировка каталога
 *
 * Этот файл расширяет объект Devices методами отображения каталога.
 * Должен загружаться ПОСЛЕ devices.js.
 */
Object.assign(Devices, {
    /**
     * Отображение устройств
     */
    renderDevices() {
        const grid = document.getElementById('devices-grid');
        const emptyState = document.getElementById('no-devices');
        const countEl = document.getElementById('devices-count');
        const emptyText = emptyState?.querySelector('p');

        if (!grid) return;
        this.cancelPendingDeviceRender();
        const renderToken = this.deviceRenderToken;
        const isDeviceActivityPromptsEnabled = this.isDeviceActivityPromptsEnabled();
        if (isDeviceActivityPromptsEnabled) {
            this.ensureCoverageBookingsLoaded();
            if (this.coverageBookingsLoaded) {
                this.updateDevicePromptMeta();
            }
        } else {
            this.devicePromptMetaById = new Map();
        }

        if (this.devicesIsLoading && this.devices.length === 0) {
            if (countEl) {
                countEl.textContent = 'Загрузка устройств...';
            }
            emptyState?.classList.add('hidden');
            this.renderDevicesSkeleton();
            return;
        }

        // Проверяем режим подбора устройств
        const isMatcherMode = typeof DeviceMatcher !== 'undefined' && DeviceMatcher.isActive;
        if (isMatcherMode && DeviceMatcher.criteria) {
            const matcherResults = DeviceMatcher.getCategorizedResults(
                DeviceMatcher.criteria,
                this.devices,
                {
                    minScore: 10,
                    onlyWorking: !Auth.isAdmin || this.filterWorking === 'working'
                }
            );
            this.matcherResults = matcherResults;
            this.renderMatcherResults(matcherResults);
            return;
        }

        let filteredDevices = this.getFilteredDevices();

        // Обновляем счётчик
        if (countEl) {
            if (isMatcherMode) {
                // В режиме подбора показываем количество найденных совпадений
                countEl.innerHTML = `Найдено похожих: <span class="highlight">${filteredDevices.length}</span>`;
            } else {
                // Считаем базовое количество - для обычных пользователей исключаем нерабочие
                let baseCount = this.devices.length;
                if (!Auth.isAdmin) {
                    // Для обычных пользователей считаем только рабочие устройства
                    baseCount = this.devices.filter(d => d.isWorking !== false).length;
                }

                const hasActiveFilters = this.searchQuery ||
                                         this.currentFilter !== 'all' ||
                                         this.filterTypes.length < 2 ||
                                         this.filterOsList.length < 3 ||
                                         (Auth.isAdmin && this.filterWorking !== 'working');

                if (hasActiveFilters) {
                    countEl.innerHTML = `Найдено: <span class="highlight">${filteredDevices.length}</span> из ${baseCount}`;
                } else {
                    countEl.innerHTML = `Всего устройств: <span class="highlight">${filteredDevices.length}</span>`;
                }
            }
        }

        this.updateMyDevicesBtn();

        if (emptyText) {
            emptyText.textContent = this.currentFilter === 'unused_by_me' && this.usedDeviceIdsLoading
                ? 'Загружаем историю использования устройств...'
                : 'Устройства не найдены';
        }

        if (filteredDevices.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');

        const shouldHighlightOverdue = this.currentFilter === 'my' && !isMatcherMode;
        const renderDeviceCard = (device) => {
            if (isMatcherMode && device.matchScore !== undefined) {
                return this.createDeviceCard(device, {
                    showMatchScore: true,
                    matchScore: device.matchScore,
                    matchDetails: device.matchDetails,
                    highlightOverdue: false
                });
            }
            return this.createDeviceCard(device, {
                highlightOverdue: shouldHighlightOverdue,
                showPrompt: isDeviceActivityPromptsEnabled
            });
        };

        if (filteredDevices.length <= this.deviceRenderInitialBatchSize) {
            grid.innerHTML = filteredDevices.map(renderDeviceCard).join('');
            this.attachCardEventHandlers(grid);
            return;
        }

        const initialCount = Math.min(this.deviceRenderInitialBatchSize, filteredDevices.length);
        grid.innerHTML = filteredDevices.slice(0, initialCount).map(renderDeviceCard).join('');
        this.attachCardEventHandlers(grid);

        const appendChunk = (startIndex) => {
            if (renderToken !== this.deviceRenderToken) return;

            const endIndex = Math.min(startIndex + this.deviceRenderBatchSize, filteredDevices.length);
            const chunk = filteredDevices.slice(startIndex, endIndex);
            if (chunk.length > 0) {
                grid.insertAdjacentHTML('beforeend', chunk.map(renderDeviceCard).join(''));
                this.attachCardEventHandlers(grid);
            }

            if (endIndex < filteredDevices.length) {
                this.deviceRenderFrameId = requestAnimationFrame(() => appendChunk(endIndex));
            } else {
                this.deviceRenderFrameId = null;
            }
        };

        this.deviceRenderFrameId = requestAnimationFrame(() => appendChunk(initialCount));
    },

    renderDevicesSkeleton(cardsCount = 8) {
        const grid = document.getElementById('devices-grid');
        if (!grid) return;

        const cards = Array.from({ length: cardsCount }, () => `
            <article class="device-card device-card-skeleton" aria-hidden="true">
                <div class="device-card-header">
                    <div class="device-icon skeleton-block"></div>
                    <div class="device-card-skeleton-badges">
                        <span class="skeleton-block skeleton-pill"></span>
                        <span class="skeleton-block skeleton-pill skeleton-pill-sm"></span>
                    </div>
                </div>
                <div class="device-card-skeleton-line skeleton-block"></div>
                <div class="device-card-skeleton-line skeleton-block skeleton-w-70"></div>
                <div class="device-card-skeleton-line skeleton-block skeleton-w-40"></div>
                <div class="device-card-skeleton-actions">
                    <span class="skeleton-block skeleton-btn"></span>
                    <span class="skeleton-block skeleton-btn"></span>
                </div>
            </article>
        `).join('');

        grid.innerHTML = cards;
    },

    sortMainDeviceCards(devices) {
        return [...devices].sort((a, b) => {
            const groupDiff = this.getMainCardSortGroup(a) - this.getMainCardSortGroup(b);
            if (groupDiff !== 0) return groupDiff;

            const versionDiff = this.compareOsVersionsDesc(a.osVersion, b.osVersion);
            if (versionDiff !== 0) return versionDiff;

            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB, 'ru');
        });
    },

    getMainCardSortGroup(device) {
        const isAvailable = device.status === DEVICE_STATUS.AVAILABLE;
        const isPhone = device.type === 'phone';
        const isTablet = device.type === 'tablet';

        if (isAvailable && isPhone) return 0;
        if (isAvailable && isTablet) return 1;
        if (!isAvailable && (isPhone || isTablet)) return 2;
        return 3;
    },

    compareOsVersionsDesc(versionA, versionB) {
        const partsA = this.parseOsVersion(versionA);
        const partsB = this.parseOsVersion(versionB);
        const maxLength = Math.max(partsA.length, partsB.length);

        for (let i = 0; i < maxLength; i += 1) {
            const a = partsA[i] || 0;
            const b = partsB[i] || 0;
            if (a !== b) return b - a;
        }

        return 0;
    },

    parseOsVersion(version) {
        if (!version) return [];

        return String(version)
            .split(/[^0-9]+/)
            .filter(Boolean)
            .map(part => parseInt(part, 10))
            .filter(Number.isFinite);
    },

    /**
     * Проверка соответствия устройства поисковому запросу
     */
    matchesSearch(device, query) {
        // Нормализуем запрос
        const q = query.toLowerCase().trim();

        // Специальный поиск по "ОС + версия" (например "android 15", "ios 17")
        const osVersionMatch = q.match(/^(android|ios|ipados)\s*(\d+)$/);
        if (osVersionMatch) {
            const osName = osVersionMatch[1];
            const version = osVersionMatch[2];
            const deviceOs = (device.os || '').toLowerCase();
            const deviceOsVersion = (device.osVersion || '').toString();

            // Проверяем ОС
            const osMatches = deviceOs === osName ||
                              (osName === 'ios' && deviceOs === 'ipados') ||
                              (osName === 'ipados' && deviceOs === 'ios');

            // Проверяем версию (начинается с указанной цифры)
            const versionMatches = deviceOsVersion.startsWith(version) ||
                                   deviceOsVersion.startsWith(version + '.') ||
                                   deviceOsVersion === version;

            return osMatches && versionMatches;
        }

        // Поля для поиска
        const searchableFields = [
            device.name,
            device.description,
            device.type,
            device.os,
            device.osVersion,
            device.deviceId,
            device.screen,
            device.shell,
            device.serial,
            device.mac,
            device.bluetooth,
            device.udid,
            device.features,
            DEVICE_TYPES[device.type]?.label,
            OS_TYPES[device.os]?.label,
            device.currentUserName,
            // Добавляем комбинацию ОС + версия для обычного поиска
            device.os && device.osVersion ? `${device.os} ${device.osVersion}` : null
        ].filter(Boolean).map(f => String(f).toLowerCase());

        // Проверяем каждое слово из запроса
        const queryWords = q.split(/\s+/);

        return queryWords.every(word => {
            // Обычный поиск по всем полям
            return searchableFields.some(field => field.includes(word));
        });
    },

    /**
     * Создание карточки устройства
     * @param {Object} device - данные устройства
     * @param {Object} options - опции отображения
     * @param {boolean} options.showMatchBadge - показывать бейдж "Подходит"
     * @param {boolean} options.showMatchScore - показывать процент совместимости
     * @param {number} options.matchScore - процент совместимости (0-100)
     * @param {Object} options.matchDetails - детали совместимости
     * @param {boolean} options.highlightOverdue - подсветить просрочку
     * @param {string} options.contextCaption - дополнительное короткое описание карточки
     * @param {Array<{ text: string, tone?: string }>} options.contextTags - короткие контекстные теги
     */
    createDeviceCard(device, options = {}) {
        const {
            showMatchBadge = false,
            showMatchScore = false,
            matchScore = 0,
            matchDetails = null,
            highlightOverdue = false,
            contextCaption = '',
            contextTags = [],
            showPrompt = false
        } = options;
        const user = Auth.getUser();
        const isMyDevice = this.isDeviceOwnedByUser(device, user);
        const isExternal = device.status === DEVICE_STATUS.EXTERNAL;
        const isAvailable = device.status === DEVICE_STATUS.AVAILABLE;
        const isOverdue = highlightOverdue && isMyDevice && this.isDeviceOverdue(device);

        // Проверяем, ожидает ли устройство подтверждения получения
        const isPendingReceipt = device.pendingReceipt === true;
        const isPendingForMe = isPendingReceipt && device.bookedFor === user?.uid;

        // Определяем тип занятости по полю bookingType (с миграцией для старых данных)
        const bookingType = this.getBookingType(device);
        const isHome = bookingType === BOOKING_TYPES.HOME;

        let statusClass, statusText;
        if (isAvailable) {
            statusClass = 'available';
            statusText = 'Свободно';
        } else if (isExternal) {
            statusClass = 'external';
            statusText = 'Вне отдела';
        } else if (isPendingReceipt) {
            statusClass = 'booked-pending';
            statusText = 'Ожидает получения';
        } else if (isHome) {
            statusClass = 'booked-home';
            statusText = 'Взято домой';
        } else {
            statusClass = 'booked-office';
            statusText = 'Использую';
        }

        let bookingInfo = '';
        if (isExternal) {
            const externalDepartment = device.externalDepartment?.trim() || 'Не указано';
            const externalComment = device.externalComment?.trim() || '';
            bookingInfo = `
                <div class="device-booking-info external-info">
                    <div class="booking-user">
                        <span class="booking-user-name">Долгосрочно вне отдела</span>
                    </div>
                    <div class="booking-meta">
                        <span class="booking-location">Подразделение: ${externalDepartment}</span>
                    </div>
                    ${externalComment ? `<div class="booking-meta"><span>${externalComment}</span></div>` : ''}
                </div>
            `;
        } else if (!isAvailable && !device.currentUserName && !isExternal) {
            // Устройство занято, но пользователь не указан
            if (Auth.isAdmin) {
                bookingInfo = `
                    <div class="device-booking-info">
                        <div class="booking-user history-assign-user">
                            <button class="assign-user-btn" data-device-id="${device.id}" title="Назначить пользователя">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                    <circle cx="8.5" cy="7" r="4"/>
                                    <line x1="20" y1="8" x2="20" y2="14"/>
                                    <line x1="23" y1="11" x2="17" y2="11"/>
                                </svg>
                                <span>Назначить пользователя</span>
                            </button>
                        </div>
                    </div>
                `;
            } else {
                bookingInfo = `
                    <div class="device-booking-info">
                        <div class="booking-user">
                            <span class="booking-user-name">Неизвестен</span>
                        </div>
                    </div>
                `;
            }
        } else if (!isAvailable && device.currentUserName) {
            const bookedUntilDate = this.getDeviceDateValue(device.bookedUntil);
            const untilText = bookedUntilDate
                ? `до ${this.formatDate(bookedUntilDate)}`
                : '';

            // Если ожидает подтверждения получения
            if (isPendingReceipt) {
                let bookingInfoText = '';
                if (isPendingForMe) {
                    // Для целевого пользователя показываем, кто забронировал
                    bookingInfoText = `
                        <div class="booking-user">
                            <img src="${device.currentUserPhoto || 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27%23a0a0b0%27%3E%3Ccircle%20cx=%2712%27%20cy=%278%27%20r=%274%27/%3E%3Cpath%20d=%27M20%2021a8%208%200%200%200-16%200%27/%3E%3C/svg%3E'}" alt="">
                            <span class="booking-user-name">Забронировано: ${device.bookedByName || device.currentUserName}</span>
                        </div>
                    `;
                } else {
                    // Для других пользователей показываем, кто забронировал и для кого
                    let bookedForName = device.currentUserName;
                    if (typeof Users !== 'undefined' && Users.getUserById) {
                        const bookedForUser = Users.getUserById(device.bookedFor);
                        bookedForName = bookedForUser ? (bookedForUser.displayName || bookedForUser.email) : device.currentUserName;
                    }
                    bookingInfoText = `
                        <div class="booking-user">
                            <img src="${device.currentUserPhoto || 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27%23a0a0b0%27%3E%3Ccircle%20cx=%2712%27%20cy=%278%27%20r=%274%27/%3E%3Cpath%20d=%27M20%2021a8%208%200%200%200-16%200%27/%3E%3C/svg%3E'}" alt="">
                            <span class="booking-user-name">${device.bookedByName || 'Неизвестно'} → ${bookedForName}</span>
                        </div>
                    `;
                }

                bookingInfo = `
                    <div class="device-booking-info pending-receipt">
                        ${bookingInfoText}
                        ${untilText ? `<div class="booking-meta"><span class="booking-until">${untilText}</span></div>` : ''}
                    </div>
                `;
            } else {
                // Обычное отображение информации о бронировании
                let locationText = '';
                if (isHome) {
                    // Взято домой - показываем адрес
                    const homeAddress = device.currentUserHomeAddress?.trim();
                    if (homeAddress) {
                        locationText = `<span class="booking-location"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>${homeAddress}</span>`;
                    }
                } else {
                    // Использую - показываем кабинет
                    const office = device.currentUserOffice?.trim();
                    if (office) {
                        locationText = `<span class="booking-location"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${office}</span>`;
                    }
                }

                // Объединяем локацию и дату в одну строку
                let locationAndDate = '';
                if (locationText || untilText) {
                    locationAndDate = `<div class="booking-meta">${locationText}${locationText && untilText ? ' • ' : ''}${untilText ? `<span class="booking-until">${untilText}</span>` : ''}</div>`;
                }

                bookingInfo = `
                    <div class="device-booking-info">
                        <div class="booking-user">
                            <img src="${device.currentUserPhoto || 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27%23a0a0b0%27%3E%3Ccircle%20cx=%2712%27%20cy=%278%27%20r=%274%27/%3E%3Cpath%20d=%27M20%2021a8%208%200%200%200-16%200%27/%3E%3C/svg%3E'}" alt="">
                            <span class="booking-user-name">${device.currentUserName}</span>
                        </div>
                        ${locationAndDate}
                    </div>
                `;
            }
        }

        let actions = '';
        if (isAvailable) {
            actions = `
                <button class="primary-btn btn-take">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14"/>
                        <path d="M12 5l7 7-7 7"/>
                    </svg>
                    <span class="btn-text">Использую</span>
                </button>
                <button class="secondary-btn btn-book">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span class="btn-text">Забрать домой</span>
                </button>
            `;
        } else if (isPendingForMe) {
            // Если устройство ожидает подтверждения и текущий пользователь - целевой
            actions = `
                <button class="primary-btn btn-confirm-receipt">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span class="btn-text">Подтвердить получение</span>
                </button>
            `;
        } else if (isMyDevice) {
            // Кнопка смены типа: "Забрать домой" или "Вернуть в офис"
            const changeTypeBtn = isHome
                ? `<button class="secondary-btn btn-return-to-office">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span class="btn-text">Вернуть в офис</span>
                </button>`
                : `<button class="secondary-btn btn-take-home">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span class="btn-text">Забрать домой</span>
                </button>`;
            actions = `
                ${changeTypeBtn}
                <button class="secondary-btn btn-edit-date">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span class="btn-text">Изменить дату</span>
                </button>
                <button class="primary-btn btn-return">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 10 4 15 9 20"/>
                        <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
                    </svg>
                    <span class="btn-text">Вернуть</span>
                </button>
            `;
        } else if (isExternal && Auth.isAdmin) {
            actions = `
                <button class="secondary-btn btn-return-from-external">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 10 4 15 9 20"/>
                        <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
                    </svg>
                    <span class="btn-text">Вернуть в отдел</span>
                </button>
            `;
        } else if (Auth.isAdmin) {
            // Админ может вернуть любое устройство
            actions = `
                <button class="secondary-btn btn-return">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 10 4 15 9 20"/>
                        <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
                    </svg>
                    <span class="btn-text">Вернуть (админ)</span>
                </button>
            `;
        }

        const osLabel = device.os ? (OS_TYPES[device.os]?.label || device.os) : '';
        const typeLabel = DEVICE_TYPES[device.type]?.label || device.type || '';
        const isBroken = device.isWorking === false;

        // Бейдж "Подходит" для режима автоопределения
        const matchBadge = showMatchBadge
            ? '<span class="device-badge match-badge">Подходит</span>'
            : '';

        // Бейдж процента совместимости для режима подбора
        let matchScoreBadge = '';
        if (showMatchScore && matchScore > 0) {
            const scoreClass = matchScore >= 80 ? 'score-high' :
                              matchScore >= 50 ? 'score-medium' : 'score-low';
            matchScoreBadge = `<span class="match-score-badge ${scoreClass}">${matchScore}%</span>`;
        }

        const historyBtnHtml = `<button class="icon-btn history-btn" data-history-device="${device.id}" title="История устройства">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <path d="M3 12a9 9 0 1 0 3-6.7"/>
                            <polyline points="3 3 3 9 9 9"/>
                            <polyline points="12 7 12 12 16 14"/>
                        </svg>
                    </button>`;

        // Кнопка календаря (скрыта если фича отключена)
        const isCalendarEnabled = typeof FeatureFlags === 'undefined' || FeatureFlags.isEnabled('calendar');
        const calendarBtnHtml = isCalendarEnabled
            ? `<button class="icon-btn calendar-btn" data-calendar-device="${device.id}" title="Календарь занятости">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                    </button>`
            : '';

        const contextCaptionHtml = contextCaption
            ? `<p class="device-context-caption">${contextCaption}</p>`
            : '';
        const devicePrompt = showPrompt ? this.getDevicePromptMeta(device) : null;
        const contextTagsHtml = Array.isArray(contextTags) && contextTags.length > 0
            ? `
                <div class="match-details coverage-context-tags">
                    ${contextTags.map((tag) => {
                        const toneClass = tag.tone === 'high'
                            ? 'match-high'
                            : tag.tone === 'medium'
                                ? 'match-medium'
                                : tag.tone === 'low'
                                    ? 'match-low'
                                    : '';
                        return `<span class="match-detail-tag ${toneClass}">${tag.text}</span>`;
                    }).join('')}
                </div>
            `
            : '';
        const devicePromptHtml = devicePrompt
            ? `
                <div class="device-prompt device-prompt-${devicePrompt.type}" data-device-prompt="${devicePrompt.type}">
                    <span class="device-prompt-label">${devicePrompt.label}</span>
                    <p class="device-prompt-text">${devicePrompt.text}</p>
                </div>
            `
            : '';

        return `
            <div class="device-card ${statusClass}${isBroken ? ' broken' : ''}${isOverdue ? ' overdue' : ''}${showMatchBadge ? ' matched' : ''}${showMatchScore ? ' matcher-mode' : ''}" data-device-id="${device.id}" data-status="${device.status || ''}">
                <div class="device-card-header">
                    <div class="device-icon">
                        ${this.getDeviceIcon(device.type)}
                    </div>
                    <div class="device-badges">
                        ${matchBadge}
                        ${isOverdue ? '<span class="device-badge overdue">Просрочено</span>' : ''}
                        ${isBroken ? '<span class="device-badge broken">Не работает</span>' : ''}
                        ${historyBtnHtml}
                        <div class="device-status ${statusClass}">
                            <span class="status-dot"></span>
                            ${statusText}
                        </div>
                    </div>
                    ${matchScoreBadge ? `<div class="match-score-position">${matchScoreBadge}</div>` : ''}
                    ${calendarBtnHtml}
                </div>
                <h3 class="device-name">${device.name}</h3>
                <div class="device-type">
                    ${typeLabel}${osLabel ? ' • ' + osLabel + (device.osVersion ? ' ' + device.osVersion : '') : ''}
                </div>
                <div class="device-id-label">${device.deviceId || 'ID устройства не указан'}</div>
                ${devicePromptHtml}
                ${contextCaptionHtml}
                ${contextTagsHtml}
                ${device.description ? `<p class="device-description">${device.description}</p>` : ''}
                ${bookingInfo}
                <div class="device-actions">
                    ${actions}
                </div>
            </div>
        `;
    },

    /**
     * Получить иконку устройства
     */
    getDeviceIcon(type) {
        switch (type) {
            case 'phone':
                return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>';
            case 'tablet':
                return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>';
            case 'laptop':
                return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>';
            default:
                return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>';
        }
    }
});

console.log('Devices catalog module loaded');
