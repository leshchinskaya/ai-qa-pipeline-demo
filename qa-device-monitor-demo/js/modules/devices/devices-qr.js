/**
 * Devices QR Module — CL-05 QR-бронирование
 *
 * Сканирование QR-кода устройства камерой телефона/ноутбука и оформление
 * быстрой брони на текущего авторизованного пользователя.
 *
 * Зависит от: firebase, Auth, Toast, Devices, html5-qrcode (CDN).
 */
const DevicesQR = {
    /** @type {Html5Qrcode|null} активный экземпляр сканера */
    scannerInstance: null,
    /** контейнер сканера в DOM */
    scannerContainerId: 'qr-scanner-area',
    /** выбранный режим камеры */
    facingMode: 'environment',
    /** последнее распознанное устройство (для повторного открытия) */
    lastDevice: null,
    /** тип брони, выбранный в шторке */
    selectedBookingType: 'office',

    // ────────────────────────────────────────────────────────────────────
    // ИНИЦИАЛИЗАЦИЯ
    // ────────────────────────────────────────────────────────────────────

    init() {
        this.setupScanButton();
        this.setupAuthVisibility();
    },

    setupScanButton() {
        const btn = document.getElementById('qr-scan-btn');
        if (btn) {
            btn.addEventListener('click', () => this.openScanner());
        }
    },

    /**
     * BR.05.2 — кнопка скрыта на неавторизованной сессии.
     */
    setupAuthVisibility() {
        if (typeof firebase === 'undefined' || !firebase.auth) return;
        firebase.auth().onAuthStateChanged((user) => {
            const btn = document.getElementById('qr-scan-btn');
            if (!btn) return;
            btn.classList.toggle('hidden', !user);
        });
    },

    // ────────────────────────────────────────────────────────────────────
    // СКАНЕР
    // ────────────────────────────────────────────────────────────────────

    /**
     * BR.05.2 / 05.3 — открыть модалку сканера и запустить камеру.
     */
    async openScanner() {
        if (!Auth.isAuthenticated || !Auth.isAuthenticated()) {
            Toast.show('Войдите в аккаунт, чтобы сканировать QR', 'warning');
            return;
        }
        this.renderScannerModal();
        await this.startCamera();
    },

    renderScannerModal() {
        let modal = document.getElementById('qr-scanner-modal');
        if (modal) {
            modal.classList.remove('hidden');
            return;
        }

        this._lastFocusedBeforeScanner = document.activeElement;

        modal = document.createElement('div');
        modal.id = 'qr-scanner-modal';
        modal.className = 'modal qr-scanner-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'qr-scanner-title');
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="qr-scanner-title">Сканировать QR устройства</h3>
                    <button class="modal-close" aria-label="Закрыть">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="${this.scannerContainerId}" class="qr-scanner-area" role="region" aria-label="Область сканирования QR"></div>
                    <div id="qr-scanner-status" class="qr-scanner-status" role="status" aria-live="polite">
                        Наведите камеру на QR-код устройства
                    </div>
                    <div id="qr-scanner-timeout-hint" class="qr-scanner-timeout-hint hidden" role="status" aria-live="polite">
                        <span class="qr-scanner-timeout-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                                <circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12.01" y2="16.5"/>
                            </svg>
                        </span>
                        <span class="qr-scanner-timeout-text">
                            <strong>Не удалось распознать QR</strong>
                            <span>Загрузите картинку или введите ID вручную</span>
                        </span>
                    </div>
                    <div class="qr-scanner-fallback">
                        <div class="qr-scanner-fallback-row">
                            <button type="button" class="secondary-btn" id="qr-flip-camera" aria-label="Сменить камеру">
                                Сменить камеру
                            </button>
                            <label class="secondary-btn qr-upload-btn" for="qr-upload-input" aria-label="Загрузить картинку с QR-кодом">
                                Загрузить картинку
                                <input type="file" id="qr-upload-input" accept="image/*" hidden>
                            </label>
                        </div>
                        <div class="qr-manual-row">
                            <input type="text" id="qr-manual-input" class="form-input" placeholder="…или введите ID" aria-label="ID устройства">
                            <button type="button" class="primary-btn" id="qr-manual-submit">Найти</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // wiring
        modal.querySelector('.modal-close').addEventListener('click', () => this.closeScanner());
        // Любой клик за пределами .modal-content закрывает модалку.
        modal.addEventListener('click', (e) => {
            if (!e.target.closest('.modal-content')) {
                this.closeScanner();
            }
        });
        modal.querySelector('#qr-flip-camera').addEventListener('click', () => this.flipCamera());
        modal.querySelector('#qr-upload-input').addEventListener('change', (e) => this.handleImageUpload(e));
        modal.querySelector('#qr-manual-submit').addEventListener('click', () => this.handleManualInput());
        modal.querySelector('#qr-manual-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleManualInput();
            }
        });
        document.addEventListener('keydown', this._escHandler = (e) => {
            if (e.key === 'Escape' && !document.getElementById('qr-scanner-modal')?.classList.contains('hidden')) {
                this.closeScanner();
            }
        });

        // BR.05.29 — focus-trap внутри модалки.
        modal.addEventListener('keydown', this._trapHandler = (e) => {
            if (e.key !== 'Tab') return;
            const focusable = modal.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]):not([hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });

        // Перевести фокус на первый интерактивный контрол.
        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) closeBtn.focus();
    },

    /**
     * BR.05.3 / 05.11 / 05.23 — запуск камеры с обработкой отказа.
     */
    async startCamera() {
        if (typeof Html5Qrcode === 'undefined') {
            this.setStatus('Сканер недоступен: библиотека не загрузилась', 'error');
            return;
        }
        try {
            // освободить предыдущую сессию если была
            await this.stopCamera();
            this.scannerInstance = new Html5Qrcode(this.scannerContainerId);
            await this.scannerInstance.start(
                { facingMode: this.facingMode },
                { fps: 10, qrbox: { width: 240, height: 240 } },
                (decodedText) => this.onScanSuccess(decodedText),
                () => {} // ignore per-frame errors
            );
            this.setStatus('Наведите камеру на QR-код устройства');
            this.startScanTimeout();
        } catch (err) {
            // BR.05.23 — отказ камеры или её отсутствие → fallback
            console.warn('QR scanner camera error:', err);
            this.setStatus('Камера недоступна. Загрузите картинку или введите ID вручную.', 'warning');
        }
    },

    /**
     * BR.05.12 — 10 секунд без распознавания → подсказка пользователю.
     */
    startScanTimeout() {
        this.clearScanTimeout();
        this._scanTimeoutId = setTimeout(() => this.showTimeoutHint(), 10000);
    },

    clearScanTimeout() {
        if (this._scanTimeoutId) {
            clearTimeout(this._scanTimeoutId);
            this._scanTimeoutId = null;
        }
    },

    showTimeoutHint() {
        const hint = document.getElementById('qr-scanner-timeout-hint');
        if (hint) hint.classList.remove('hidden');
        const manual = document.getElementById('qr-manual-input');
        if (manual) manual.focus();
    },

    async stopCamera() {
        if (this.scannerInstance) {
            try {
                await this.scannerInstance.stop();
                this.scannerInstance.clear();
            } catch (e) {
                // already stopped
            }
            this.scannerInstance = null;
        }
    },

    async flipCamera() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        await this.startCamera();
    },

    /**
     * BR.05.11 — fallback: загрузка картинки с QR.
     */
    async handleImageUpload(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (typeof Html5Qrcode === 'undefined') {
            Toast.show('Сканер не загрузился', 'error');
            return;
        }
        try {
            await this.stopCamera();
            const tmp = new Html5Qrcode(this.scannerContainerId);
            const decoded = await tmp.scanFile(file, true);
            tmp.clear();
            this._lastScanSource = 'image';
            this.onScanSuccess(decoded);
        } catch (err) {
            console.warn('QR upload error:', err);
            this.setStatus('Не удалось распознать QR на картинке. Попробуйте другое изображение.', 'error');
            this.logScanEvent({ source: 'image', deviceId: null, result: 'error' });
        } finally {
            event.target.value = '';
        }
    },

    /**
     * BR.05.24 — ручной ввод deviceId.
     */
    handleManualInput() {
        const input = document.getElementById('qr-manual-input');
        const value = input && input.value && input.value.trim();
        if (!value) {
            Toast.show('Введите ID устройства', 'warning');
            return;
        }
        this._lastScanSource = 'manual';
        this.onScanSuccess(value);
    },

    setStatus(text, level = 'info') {
        const status = document.getElementById('qr-scanner-status');
        if (!status) return;
        status.textContent = text;
        status.dataset.level = level;
    },

    closeScanner() {
        this.clearScanTimeout();
        this.stopCamera();
        const modal = document.getElementById('qr-scanner-modal');
        if (modal) {
            modal.classList.add('hidden');
            const hint = modal.querySelector('#qr-scanner-timeout-hint');
            if (hint) hint.classList.add('hidden');
            if (this._trapHandler) {
                modal.removeEventListener('keydown', this._trapHandler);
                this._trapHandler = null;
            }
        }
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        // BR.05.29 — вернуть фокус на исходный триггер сканера.
        if (this._lastFocusedBeforeScanner && typeof this._lastFocusedBeforeScanner.focus === 'function') {
            try { this._lastFocusedBeforeScanner.focus(); } catch (e) { /* ignore */ }
            this._lastFocusedBeforeScanner = null;
        }
    },

    // ────────────────────────────────────────────────────────────────────
    // LOOKUP + ШТОРКА БРОНИ
    // ────────────────────────────────────────────────────────────────────

    /**
     * BR.05.1 / 05.7 — извлекаем deviceId из payload (deviceId или /#device/{id})
     * и ищем устройство в Firestore.
     */
    async onScanSuccess(decodedText) {
        this.clearScanTimeout();
        await this.stopCamera();
        const payload = this.extractDeviceId(decodedText);
        const source = this._lastScanSource || 'camera';
        this._lastScanSource = null;
        if (!payload) {
            this.setStatus('QR-код не похож на ID устройства', 'error');
            this.logScanEvent({ source, deviceId: null, result: 'invalid_payload' });
            await this.startCamera();
            return;
        }
        try {
            const device = await this.findDevice(payload);
            if (!device) {
                // BR.05.7 — неизвестный QR
                this.setStatus('Устройство не найдено', 'error');
                Toast.show('Устройство не найдено', 'error');
                this.logScanEvent({ source, deviceId: payload, result: 'device_not_found' });
                await this.startCamera();
                return;
            }
            this.lastDevice = device;
            this.logScanEvent({ source, deviceId: device.id, result: 'device_found' });
            this.showBookingSheet(device);
        } catch (err) {
            console.error('QR lookup error:', err);
            Toast.show('Не удалось проверить устройство: ' + err.message, 'error');
            this.logScanEvent({ source, deviceId: payload, result: 'error' });
            await this.startCamera();
        }
    },

    logScanEvent(payload) {
        if (typeof Analytics === 'undefined' || !Analytics || typeof Analytics.log !== 'function') return;
        try {
            Analytics.log('qr_scan', payload);
        } catch (e) {
            // ignore
        }
    },

    /**
     * Ищет устройство сначала по Firestore document.id (как генерирует QR в админке),
     * затем по полю deviceId (как в реальных данных, где docId автогенерируется).
     */
    async findDevice(payload) {
        // 1) пробуем как document.id
        const direct = await db.collection(COLLECTIONS.DEVICES).doc(payload).get();
        if (direct.exists) {
            return { id: direct.id, ...direct.data() };
        }
        // 2) пробуем как поле deviceId
        const query = await db.collection(COLLECTIONS.DEVICES)
            .where('deviceId', '==', payload)
            .limit(1)
            .get();
        if (!query.empty) {
            const doc = query.docs[0];
            return { id: doc.id, ...doc.data() };
        }
        return null;
    },

    extractDeviceId(raw) {
        if (!raw) return null;
        const trimmed = String(raw).trim();
        // Формат "/#device/{id}" — берём хвост
        const hashMatch = trimmed.match(/#device\/([\w\-_.]+)/i);
        if (hashMatch) return hashMatch[1];
        // Иначе считаем что это сам deviceId
        if (/^[\w\-_.]+$/.test(trimmed)) return trimmed;
        return null;
    },

    /**
     * Показывает шторку с разной разметкой в зависимости от состояния устройства.
     * BR.05.4 (available) / 05.5 (booked) / 05.6 (external) / 05.19 (own)
     */
    showBookingSheet(device) {
        // закрываем сканер, открываем шторку
        const scanner = document.getElementById('qr-scanner-modal');
        if (scanner) scanner.classList.add('hidden');

        this.selectedBookingType = BOOKING_TYPES.OFFICE;
        const sheet = this.ensureBookingSheet();
        const body = sheet.querySelector('#qr-booking-body');
        const currentUser = Auth.getUser();
        const isOwn = device.currentUserId === (currentUser && currentUser.uid);

        body.innerHTML = '';
        body.appendChild(this.renderDeviceHeader(device));

        const pendingReceiptForMe = device.pendingReceipt && device.currentUserId === (currentUser && currentUser.uid);

        if (device.isWorking === false) {
            body.appendChild(this.renderBrokenDeviceState(device));
        } else if (pendingReceiptForMe) {
            body.appendChild(this.renderPendingReceiptState(device));
        } else if (device.status === DEVICE_STATUS.EXTERNAL) {
            body.appendChild(this.renderExternalState(device));
        } else if (device.status === DEVICE_STATUS.BOOKED && !isOwn) {
            body.appendChild(this.renderBookedByOtherState(device));
        } else if (isOwn) {
            body.appendChild(this.renderOwnDeviceState(device));
        } else {
            body.appendChild(this.renderAvailableState(device));
        }

        sheet.classList.remove('hidden');
    },

    ensureBookingSheet() {
        let sheet = document.getElementById('qr-booking-sheet');
        if (sheet) {
            this._lastFocusedBeforeBookingSheet = document.activeElement;
            return sheet;
        }
        sheet = document.createElement('div');
        sheet.id = 'qr-booking-sheet';
        sheet.className = 'modal qr-booking-sheet';
        // BR.05.27 — a11y: шторка должна вести себя как модальный диалог.
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.setAttribute('aria-labelledby', 'qr-booking-title');
        sheet.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3 id="qr-booking-title">Бронирование по QR</h3>
                    <button class="modal-close" aria-label="Закрыть">&times;</button>
                </div>
                <div class="modal-body" id="qr-booking-body"></div>
            </div>
        `;
        document.body.appendChild(sheet);
        sheet.querySelector('.modal-close').addEventListener('click', () => this.closeBookingSheet());
        sheet.addEventListener('click', (e) => {
            if (!e.target.closest('.modal-content')) {
                this.closeBookingSheet();
            }
        });
        // BR.05.27 — focus-trap для шторки брони. Tab/Shift+Tab закольцованы внутри
        // .modal-content; список focusable пересчитывается на каждое нажатие, чтобы
        // учитывать динамическое автокомплит-меню #qr-user-suggest.
        sheet.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;
            const focusable = sheet.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]):not([hidden]), select:not([disabled]), textarea:not([disabled]), [role="option"], [tabindex]:not([tabindex="-1"])'
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
        // BR.05.27 — сохранить триггер открытия, чтобы вернуть фокус при закрытии.
        this._lastFocusedBeforeBookingSheet = document.activeElement;
        // Перевести фокус на первый интерактивный контрол при отображении шторки.
        queueMicrotask(() => {
            if (sheet.classList.contains('hidden')) return;
            const closeBtn = sheet.querySelector('.modal-close');
            if (closeBtn) closeBtn.focus();
        });
        return sheet;
    },

    closeBookingSheet() {
        const sheet = document.getElementById('qr-booking-sheet');
        if (sheet) sheet.classList.add('hidden');
        this.lastDevice = null;
        // BR.05.27 — вернуть фокус на элемент, который инициировал открытие шторки.
        if (this._lastFocusedBeforeBookingSheet && typeof this._lastFocusedBeforeBookingSheet.focus === 'function') {
            try { this._lastFocusedBeforeBookingSheet.focus(); } catch (e) { /* ignore */ }
            this._lastFocusedBeforeBookingSheet = null;
        }
    },

    renderDeviceHeader(device) {
        const wrap = document.createElement('div');
        wrap.className = 'qr-device-card';
        wrap.innerHTML = `
            <div class="qr-device-card-name">${this.escape(device.name || device.id)}</div>
            <div class="qr-device-card-meta">
                ${device.os ? `<span>${this.escape(device.os)}</span>` : ''}
                ${device.type ? `<span>${this.escape(device.type)}</span>` : ''}
                ${device.description ? `<span>${this.escape(device.description)}</span>` : ''}
            </div>
        `;
        return wrap;
    },

    /**
     * BR.05.4 / 05.14 / 05.30 / 05.31 — шторка для available: office/home toggle,
     * выбор пользователя (shared-аккаунт), выбор проектов и кнопка.
     */
    renderAvailableState(device) {
        const wrap = document.createElement('div');
        wrap.className = 'qr-state qr-state-available';
        this._selectedSharedUserId = null;

        const today = new Date().toISOString().slice(0, 10);
        const projectContextEnabled = typeof Devices !== 'undefined' && typeof Devices.isProjectContextEnabled === 'function' && Devices.isProjectContextEnabled();
        const isShared = typeof Auth.isSharedAccount === 'function' && Auth.isSharedAccount();
        // BR.05.18 / 05.30 — фиксируем shared-режим на момент рендера шторки,
        // чтобы submitBooking не зависел от потенциальной гонки с asyncchecks.
        this._sharedFlow = isShared === true;
        // Бронирование на другого человека: для shared-аккаунта пользователь
        // обязателен, для обычного — опционален (по умолчанию «на себя»).
        const bookForOthers = (typeof FeatureFlags === 'undefined') || FeatureFlags.isEnabled('bookForOthers');
        const showUserPicker = isShared || bookForOthers;
        const actor = Auth.getUser() || (Auth.currentUser ?? null);
        this._sharedActorUid = actor?.uid || null;
        this._sharedActorName = (actor?.displayName || actor?.email) || null;

        wrap.innerHTML = `
            ${showUserPicker ? `
            <div class="form-group qr-user-picker">
                <label>${isShared ? 'Выбрать пользователя' : 'На кого бронируем'}</label>
                <div class="user-select-wrapper">
                    <button type="button" id="qr-user-btn" class="user-select-btn" aria-haspopup="listbox" aria-expanded="false">
                        <span id="qr-user-label">${isShared ? 'Выберите пользователя' : 'На себя'}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <input type="hidden" id="qr-user" value="">
                    <div id="qr-user-dropdown" class="user-select-dropdown hidden">
                        <div class="user-select-search">
                            <input type="text" id="qr-user-search" class="form-input" placeholder="Поиск пользователя..." autocomplete="off">
                        </div>
                        <div id="qr-user-list" class="user-select-list" role="listbox"></div>
                    </div>
                </div>
            </div>` : ''}
            <div class="qr-booking-type-switch" role="group" aria-label="Тип брони">
                <button type="button" class="qr-type-btn active" data-type="${BOOKING_TYPES.OFFICE}">
                    <strong>Использую</strong>
                    <span>в офисе</span>
                </button>
                <button type="button" class="qr-type-btn" data-type="${BOOKING_TYPES.HOME}">
                    <strong>Забрать домой</strong>
                    <span>с датой возврата</span>
                </button>
            </div>
            <div class="qr-home-fields hidden">
                <label class="form-group">
                    <span class="form-label">Дата возврата</span>
                    <input type="date" id="qr-booking-until" class="form-input" min="${today}">
                </label>
            </div>
            ${projectContextEnabled ? `
            <div id="qr-booking-project-select-group" class="form-group">
                <label for="qr-booking-project-select">Проекты <span id="qr-booking-project-required" class="hidden" style="color: var(--danger);">*</span></label>
                <div id="qr-booking-project-select" class="project-selection-list" role="group" aria-label="Выбор проектов"></div>
                <small id="qr-booking-project-hint" class="form-hint hidden"></small>
            </div>` : ''}
            <div class="form-actions">
                <button type="button" class="secondary-btn" data-qr-action="cancel">Отмена</button>
                <button type="button" class="primary-btn" data-qr-action="confirm">Подтвердить</button>
            </div>
        `;
        // type switch
        wrap.querySelectorAll('.qr-type-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                wrap.querySelectorAll('.qr-type-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedBookingType = btn.dataset.type;
                wrap.querySelector('.qr-home-fields').classList.toggle('hidden', this.selectedBookingType !== BOOKING_TYPES.HOME);
            });
        });
        wrap.querySelector('[data-qr-action="cancel"]').addEventListener('click', () => this.closeBookingSheet());
        wrap.querySelector('[data-qr-action="confirm"]').addEventListener('click', () => this.submitBooking());

        // BR.05.30 — выбор пользователя (поиск + dropdown, как в реальном приложении).
        if (showUserPicker) {
            const btn = wrap.querySelector('#qr-user-btn');
            const dropdown = wrap.querySelector('#qr-user-dropdown');
            const searchInput = wrap.querySelector('#qr-user-search');
            const listEl = wrap.querySelector('#qr-user-list');
            const labelEl = wrap.querySelector('#qr-user-label');
            const hiddenEl = wrap.querySelector('#qr-user');
            const selfUid = this._sharedActorUid;

            // Перерисовать список проектов под выбранного пользователя (его назначения).
            const refreshProjects = (uid) => {
                if (!projectContextEnabled) return;
                Devices.populateProjectSelect(
                    'qr-booking-project-select',
                    'qr-booking-project-hint',
                    'qr-booking-project-required',
                    uid || selfUid
                );
            };

            const closeDropdown = () => {
                dropdown.classList.add('hidden');
                btn.setAttribute('aria-expanded', 'false');
            };

            const selectUser = (id, name) => {
                this._selectedSharedUserId = id || null;
                if (hiddenEl) hiddenEl.value = id || '';
                if (labelEl) labelEl.textContent = name;
                if (searchInput) searchInput.value = '';
                closeDropdown();
                refreshProjects(id || selfUid);
            };

            const renderList = (filter = '') => {
                const q = String(filter || '').trim().toLowerCase();
                const candidates = (typeof Users !== 'undefined' && Array.isArray(Users.users) ? Users.users : [])
                    .filter((u) => !u.isSharedAccount && u.id !== selfUid)
                    .filter((u) => !q
                        || (u.displayName || '').toLowerCase().includes(q)
                        || (u.email || '').toLowerCase().includes(q));

                let html = '';
                // «На себя» — только для обычного аккаунта и без активного поиска.
                if (!isShared && !q) {
                    html += `<div class="user-select-option" data-user-id="" data-user-name="На себя"><span class="user-name">На себя</span></div>`;
                }
                candidates.forEach((u) => {
                    const name = u.displayName || u.email;
                    html += `
                        <div class="user-select-option" data-user-id="${this.escape(u.id)}" data-user-name="${this.escape(name)}">
                            <span class="user-name">${this.escape(name)}</span>
                            ${u.email ? `<span class="user-email">${this.escape(u.email)}</span>` : ''}
                        </div>`;
                });
                if (!candidates.length && q) {
                    html += `<div class="user-select-option" style="color: var(--text-secondary); cursor: default;">Ничего не найдено</div>`;
                }
                listEl.innerHTML = html;

                listEl.querySelectorAll('.user-select-option[data-user-id]').forEach((opt) => {
                    opt.addEventListener('click', () => {
                        selectUser(opt.dataset.userId, opt.dataset.userName);
                    });
                });
            };

            // Подгрузка пользователей, если ещё не загружены.
            if (typeof Users === 'undefined') {
                if (typeof Toast !== 'undefined') Toast.show('Модуль пользователей не загружен', 'error');
            } else if (Array.isArray(Users.users) && Users.users.length === 0 && typeof Users.loadUsers === 'function') {
                Users.loadUsers()
                    .catch(() => { if (typeof Toast !== 'undefined') Toast.show('Не удалось загрузить список пользователей', 'error'); })
                    .finally(() => { if (document.body.contains(listEl)) renderList(searchInput ? searchInput.value : ''); });
            }
            renderList('');

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = dropdown.classList.contains('hidden');
                dropdown.classList.toggle('hidden');
                btn.setAttribute('aria-expanded', String(willOpen));
                if (willOpen && searchInput) searchInput.focus();
            });
            if (searchInput) {
                searchInput.addEventListener('input', (e) => renderList(e.target.value));
                searchInput.addEventListener('click', (e) => e.stopPropagation());
            }
            // Закрытие по клику вне виджета (снимаем прошлый обработчик при пересоздании шторки).
            if (this._qrUserOutsideHandler) {
                document.removeEventListener('click', this._qrUserOutsideHandler);
            }
            this._qrUserOutsideHandler = (e) => {
                if (!document.body.contains(dropdown)) {
                    document.removeEventListener('click', this._qrUserOutsideHandler);
                    this._qrUserOutsideHandler = null;
                    return;
                }
                if (!e.target.closest('.user-select-wrapper')) closeDropdown();
            };
            document.addEventListener('click', this._qrUserOutsideHandler);
        }

        // Заполняем список проектов после монтирования (контейнер должен быть в DOM).
        if (projectContextEnabled) {
            queueMicrotask(() => {
                const user = Auth.getUser();
                if (!user) return;
                Devices.populateProjectSelect(
                    'qr-booking-project-select',
                    'qr-booking-project-hint',
                    'qr-booking-project-required',
                    user.uid
                );
            });
        }
        return wrap;
    },

    /**
     * BR.05.5 — устройство занято другим: показать кто и до какого срока, без действий.
     */
    renderBookedByOtherState(device) {
        const wrap = document.createElement('div');
        wrap.className = 'qr-state qr-state-blocked';
        const until = device.bookedUntil && device.bookedUntil.toDate
            ? device.bookedUntil.toDate().toLocaleDateString('ru-RU')
            : null;
        wrap.innerHTML = `
            <div class="qr-blocked-banner" role="status">
                Устройство уже занято
            </div>
            <div class="qr-blocked-info">
                <div><strong>${this.escape(device.currentUserName || 'неизвестно')}</strong></div>
                ${until ? `<div>до ${until}</div>` : ''}
            </div>
            <div class="form-actions">
                <button type="button" class="secondary-btn" data-qr-action="close">Понятно</button>
            </div>
        `;
        wrap.querySelector('[data-qr-action="close"]').addEventListener('click', () => this.closeBookingSheet());
        return wrap;
    },

    /**
     * BR.05.6 — external: видим комментарий, действий нет.
     */
    renderExternalState(device) {
        const wrap = document.createElement('div');
        wrap.className = 'qr-state qr-state-external';
        wrap.innerHTML = `
            <div class="qr-blocked-banner">Устройство передано во внешний отдел</div>
            <div class="qr-blocked-info">
                ${device.externalDepartment ? `<div><strong>${this.escape(device.externalDepartment)}</strong></div>` : ''}
                ${device.externalComment ? `<div>${this.escape(device.externalComment)}</div>` : ''}
            </div>
            <div class="form-actions">
                <button type="button" class="secondary-btn" data-qr-action="close">Закрыть</button>
            </div>
        `;
        wrap.querySelector('[data-qr-action="close"]').addEventListener('click', () => this.closeBookingSheet());
        return wrap;
    },

    /**
     * BR.05.19 / 05.26 — устройство уже у текущего пользователя: «Вернуть» + «Изменить дату возврата».
     */
    renderOwnDeviceState(device) {
        const wrap = document.createElement('div');
        wrap.className = 'qr-state qr-state-own';
        const today = new Date().toISOString().slice(0, 10);
        wrap.innerHTML = `
            <div class="qr-info-banner">Это устройство уже у вас</div>
            <div class="qr-change-date-fields hidden">
                <label class="form-group">
                    <span class="form-label">Новая дата возврата</span>
                    <input type="date" id="qr-change-until" class="form-input" min="${today}">
                </label>
                <div class="form-actions">
                    <button type="button" class="secondary-btn" data-qr-action="change-date-cancel">Отмена</button>
                    <button type="button" class="primary-btn" data-qr-action="change-date-save">Сохранить дату</button>
                </div>
            </div>
            <div class="form-actions qr-own-actions">
                <button type="button" class="secondary-btn" data-qr-action="cancel">Отмена</button>
                <button type="button" class="secondary-btn" data-qr-action="change-date">Изменить дату возврата</button>
                <button type="button" class="primary-btn" data-qr-action="return">Вернуть</button>
            </div>
        `;
        const changeFields = wrap.querySelector('.qr-change-date-fields');
        const ownActions = wrap.querySelector('.qr-own-actions');
        wrap.querySelector('[data-qr-action="cancel"]').addEventListener('click', () => this.closeBookingSheet());
        wrap.querySelector('[data-qr-action="return"]').addEventListener('click', () => this.submitReturn());
        wrap.querySelector('[data-qr-action="change-date"]').addEventListener('click', () => {
            changeFields.classList.remove('hidden');
            ownActions.classList.add('hidden');
        });
        wrap.querySelector('[data-qr-action="change-date-cancel"]').addEventListener('click', () => {
            changeFields.classList.add('hidden');
            ownActions.classList.remove('hidden');
        });
        wrap.querySelector('[data-qr-action="change-date-save"]').addEventListener('click', () => this.submitDateChange());
        return wrap;
    },

    /**
     * BR.05.17 — устройство неисправно: отдельный стейт без формы бронирования.
     */
    renderBrokenDeviceState(device) {
        const wrap = document.createElement('div');
        wrap.className = 'qr-state qr-state-broken';
        const isAdmin = Auth.currentUser && Auth.currentUser.isAdmin;
        wrap.innerHTML = `
            <div class="qr-broken-banner" role="status">Устройство неисправно</div>
            <div class="qr-blocked-info">
                ${device.description ? `<div>${this.escape(device.description)}</div>` : ''}
            </div>
            <div class="form-actions">
                <button type="button" class="secondary-btn" data-qr-action="close">Закрыть</button>
                ${isAdmin ? '<button type="button" class="primary-btn" data-qr-action="open-admin">Открыть карточку устройства</button>' : ''}
            </div>
        `;
        wrap.querySelector('[data-qr-action="close"]').addEventListener('click', () => this.closeBookingSheet());
        const adminBtn = wrap.querySelector('[data-qr-action="open-admin"]');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                this.closeBookingSheet();
                if (typeof App !== 'undefined' && typeof App.navigateTo === 'function') {
                    App.navigateTo('admin?device=' + encodeURIComponent(device.id));
                }
            });
        }
        return wrap;
    },

    /**
     * BR.05.28 — устройство передаётся текущему пользователю и ожидает подтверждения получения.
     */
    renderPendingReceiptState(device) {
        const wrap = document.createElement('div');
        wrap.className = 'qr-state qr-state-pending-receipt';
        wrap.innerHTML = `
            <div class="qr-info-banner">Подтвердите получение устройства</div>
            <div class="qr-blocked-info">
                ${device.bookedByName ? `<div>Передал: <strong>${this.escape(device.bookedByName)}</strong></div>` : ''}
            </div>
            <div class="form-actions">
                <button type="button" class="secondary-btn" data-qr-action="cancel">Отмена</button>
                <button type="button" class="primary-btn" data-qr-action="confirm-receipt">Подтвердить получение</button>
            </div>
        `;
        wrap.querySelector('[data-qr-action="cancel"]').addEventListener('click', () => this.closeBookingSheet());
        wrap.querySelector('[data-qr-action="confirm-receipt"]').addEventListener('click', () => this.submitReceiptConfirmation());
        return wrap;
    },

    // ────────────────────────────────────────────────────────────────────
    // ДЕЙСТВИЯ С FIRESTORE
    // ────────────────────────────────────────────────────────────────────

    /**
     * BR.05.4 / 05.10 / 05.14 / 05.20 — оформление брони.
     */
    async submitBooking() {
        if (this._bookingInProgress) return;
        const device = this.lastDevice;
        const user = Auth.getUser();
        if (!device || !user) return;

        // BR.05.18 / 05.30 — для shared-аккаунта выбор пользователя обязателен.
        // Бронь оформляется на выбранного пользователя; bookedBy/bookedByName указывают на shared.
        // Используем флаг, зафиксированный на момент рендера шторки (renderAvailableState),
        // плюс live-проверку Auth.isSharedAccount как страховку от потери состояния.
        const isShared = this._sharedFlow === true
            || (typeof Auth.isSharedAccount === 'function' && Auth.isSharedAccount());
        const actorUid = user?.uid || Auth.currentUser?.uid || this._sharedActorUid || null;
        const actorName = (user?.displayName || user?.email)
            || (Auth.currentUser?.displayName || Auth.currentUser?.email)
            || this._sharedActorName
            || null;
        let targetUser = user;
        // Shared-аккаунт обязан выбрать пользователя; обычный — опционально
        // бронирует на другого, иначе по умолчанию на себя.
        if (isShared && !this._selectedSharedUserId) {
            Toast.show('Выберите пользователя для брони', 'warning');
            return;
        }
        if (this._selectedSharedUserId) {
            const sel = (typeof Users !== 'undefined' && Array.isArray(Users.users))
                ? Users.users.find((u) => u.id === this._selectedSharedUserId)
                : null;
            if (!sel) {
                Toast.show('Выбранный пользователь не найден', 'error');
                return;
            }
            targetUser = {
                uid: sel.id,
                displayName: sel.displayName || sel.email,
                email: sel.email,
                photoURL: sel.photoURL || null
            };
        }
        const bookingForOther = !!this._selectedSharedUserId && targetUser.uid !== actorUid;

        const isHome = this.selectedBookingType === BOOKING_TYPES.HOME;
        let bookedUntil = null;
        if (isHome) {
            const input = document.getElementById('qr-booking-until');
            const value = input && input.value;
            if (!value) {
                Toast.show('Укажите дату возврата', 'warning');
                return;
            }
            const date = new Date(value);
            if (!isFinite(date.getTime())) {
                Toast.show('Некорректная дата', 'warning');
                return;
            }
            bookedUntil = firebase.firestore.Timestamp.fromDate(date);
        }

        this._bookingInProgress = true;
        const confirmBtn = document.querySelector('#qr-booking-sheet [data-qr-action="confirm"]');
        if (confirmBtn) confirmBtn.disabled = true;

        // BR.05.31 — выбранные проекты записываются в device и bookings.
        let projectContext = null;
        if (typeof Devices !== 'undefined' && typeof Devices.isProjectContextEnabled === 'function' && Devices.isProjectContextEnabled()) {
            const selectedIds = Devices.getSelectedProjectIds('qr-booking-project-select');
            const projectSelection = Devices.getTargetProjectSelection(targetUser.uid, selectedIds);
            if (projectSelection.required && !projectSelection.context) {
                Toast.show('Выберите хотя бы один проект', 'warning');
                if (confirmBtn) confirmBtn.disabled = false;
                this._bookingInProgress = false;
                return;
            }
            projectContext = projectSelection.context;
        }

        try {
            const deviceUpdate = {
                status: DEVICE_STATUS.BOOKED,
                bookingType: isHome ? BOOKING_TYPES.HOME : BOOKING_TYPES.OFFICE,
                currentUserId: targetUser.uid,
                currentUserName: targetUser.displayName || targetUser.email,
                currentUserPhoto: targetUser.photoURL || null,
                bookedAt: firebase.firestore.FieldValue.serverTimestamp(),
                bookedUntil,
                currentProjectIds: projectContext?.projectIds || null,
                currentProjectCodes: projectContext?.projectCodes || null,
                currentProjectNames: projectContext?.projectNames || null,
                currentProjectId: projectContext?.projectId || null,
                currentProjectCode: projectContext?.projectCode || null,
                currentProjectName: projectContext?.projectName || null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            // BR.05.* — атомарное бронирование: транзакция гарантирует, что
            // только один QR-скан переведёт устройство из available в booked.
            const deviceRef = db.collection(COLLECTIONS.DEVICES).doc(device.id);
            if (typeof db.runTransaction === 'function') {
                await db.runTransaction(async (tx) => {
                    const snap = await tx.get(deviceRef);
                    if (!snap.exists) {
                        throw new Error('Устройство не найдено');
                    }
                    const fresh = snap.data();
                    if (fresh.status !== DEVICE_STATUS.AVAILABLE) {
                        const err = new Error('Устройство уже занято');
                        err.code = 'qr/device-busy';
                        throw err;
                    }
                    tx.update(deviceRef, deviceUpdate);
                });
            } else {
                await deviceRef.update(deviceUpdate);
            }

            // Запись в bookings
            const bookingRecord = {
                deviceId: device.id,
                deviceName: device.name || '',
                userId: targetUser.uid,
                userName: targetUser.displayName || targetUser.email,
                userPhoto: targetUser.photoURL || null,
                action: BOOKING_ACTIONS.TAKE,
                bookingType: isHome ? BOOKING_TYPES.HOME : BOOKING_TYPES.OFFICE,
                startDate: firebase.firestore.FieldValue.serverTimestamp(),
                endDate: bookedUntil,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                source: 'qr',
                // BR.05.18 — фиксируем, кто оформлял бронь (shared-аккаунт или бронь на другого).
                bookedBy: (isShared || bookingForOther) ? actorUid : null,
                bookedByName: (isShared || bookingForOther) ? actorName : null,
                currentProjectIds: projectContext?.projectIds || null,
                currentProjectCodes: projectContext?.projectCodes || null,
                currentProjectNames: projectContext?.projectNames || null,
                currentProjectId: projectContext?.projectId || null,
                currentProjectCode: projectContext?.projectCode || null,
                currentProjectName: projectContext?.projectName || null
            };
            await db.collection(COLLECTIONS.BOOKINGS).add(bookingRecord);

            // BR.05.* — уведомление предыдущего владельца при смене ownership через QR.
            if (typeof Notifications !== 'undefined' && device.currentUserId && device.currentUserId !== targetUser.uid) {
                try {
                    await Notifications.notify({
                        userId: device.currentUserId,
                        type: 'device_taken',
                        deviceId: device.id,
                        deviceName: device.name || '',
                        by: targetUser.uid,
                        byName: targetUser.displayName || targetUser.email
                    });
                } catch (_) { /* ignore */ }
            }

            const who = bookingForOther ? `на ${targetUser.displayName || targetUser.email}` : 'на вас';
            Toast.show(
                isHome
                    ? `Устройство забронировано ${who} до выбранной даты`
                    : `Устройство забронировано ${who}`,
                'success'
            );
            setTimeout(() => this.closeBookingSheet(), 0);
        } catch (err) {
            console.error('QR booking error:', err);
            if (err && err.code === 'qr/device-busy') {
                Toast.show('Устройство уже занято', 'warning');
            } else {
                Toast.show('Не удалось оформить бронь: ' + err.message, 'error');
            }
            if (confirmBtn) confirmBtn.disabled = false;
        } finally {
            this._bookingInProgress = false;
        }
    },

    /**
     * BR.05.19 — возврат устройства, занятого текущим пользователем.
     */
    async submitReturn() {
        if (this._returnInProgress) return;
        const device = this.lastDevice;
        const user = Auth.getUser();
        if (!device || !user) return;
        this._returnInProgress = true;
        const returnBtn = document.querySelector('#qr-booking-sheet [data-qr-action="return"]');
        if (returnBtn) returnBtn.disabled = true;
        try {
            await db.collection(COLLECTIONS.DEVICES).doc(device.id).update({
                status: DEVICE_STATUS.AVAILABLE,
                bookingType: null,
                currentUserId: null,
                currentUserName: null,
                currentUserPhoto: null,
                bookedAt: null,
                bookedUntil: null,
                currentProjectIds: [],
                currentProjectCodes: [],
                currentProjectNames: [],
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection(COLLECTIONS.BOOKINGS).add({
                deviceId: device.id,
                deviceName: device.name || '',
                userId: user.uid,
                userName: user.displayName || user.email,
                userPhoto: user.photoURL || null,
                action: BOOKING_ACTIONS.RETURN,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                source: 'qr'
            });
            Toast.show('Устройство возвращено', 'success');
            setTimeout(() => this.closeBookingSheet(), 0);
        } catch (err) {
            console.error('QR return error:', err);
            Toast.show('Не удалось вернуть устройство: ' + err.message, 'error');
            if (returnBtn) returnBtn.disabled = false;
        } finally {
            this._returnInProgress = false;
        }
    },

    /**
     * BR.05.26 — изменение даты возврата уже забронированного устройства.
     */
    async submitDateChange() {
        if (this._dateChangeInProgress) return;
        const device = this.lastDevice;
        const user = Auth.getUser();
        if (!device || !user) return;

        const input = document.getElementById('qr-change-until');
        const value = input && input.value;
        if (!value) {
            Toast.show('Укажите новую дату возврата', 'warning');
            return;
        }
        const date = new Date(value);
        if (!isFinite(date.getTime())) {
            Toast.show('Некорректная дата', 'warning');
            return;
        }
        const today = new Date().toISOString().slice(0, 10);
        if (value < today) {
            Toast.show('Дата не может быть раньше сегодня', 'warning');
            return;
        }

        this._dateChangeInProgress = true;
        const saveBtn = document.querySelector('#qr-booking-sheet [data-qr-action="change-date-save"]');
        if (saveBtn) saveBtn.disabled = true;

        const bookedUntil = firebase.firestore.Timestamp.fromDate(date);
        try {
            await db.collection(COLLECTIONS.DEVICES).doc(device.id).update({
                bookedUntil,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection(COLLECTIONS.BOOKINGS).add({
                deviceId: device.id,
                deviceName: device.name || '',
                userId: user.uid,
                userName: user.displayName || user.email,
                userPhoto: user.photoURL || null,
                action: 'date_change',
                endDate: bookedUntil,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                source: 'qr'
            });
            Toast.show('Дата возврата обновлена', 'success');
            setTimeout(() => this.closeBookingSheet(), 0);
        } catch (err) {
            console.error('QR date change error:', err);
            Toast.show('Не удалось изменить дату: ' + err.message, 'error');
            if (saveBtn) saveBtn.disabled = false;
        } finally {
            this._dateChangeInProgress = false;
        }
    },

    /**
     * BR.05.28 — подтверждение получения устройства (pendingReceipt → false).
     */
    async submitReceiptConfirmation() {
        if (this._receiptInProgress) return;
        const device = this.lastDevice;
        const user = Auth.getUser();
        if (!device || !user) return;
        this._receiptInProgress = true;
        const confirmBtn = document.querySelector('#qr-booking-sheet [data-qr-action="confirm-receipt"]');
        if (confirmBtn) confirmBtn.disabled = true;
        try {
            await db.collection(COLLECTIONS.DEVICES).doc(device.id).update({
                pendingReceipt: false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection(COLLECTIONS.BOOKINGS).add({
                deviceId: device.id,
                deviceName: device.name || '',
                userId: user.uid,
                userName: user.displayName || user.email,
                userPhoto: user.photoURL || null,
                action: 'receipt_confirmed',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                source: 'qr'
            });
            Toast.show('Получение подтверждено', 'success');
            setTimeout(() => this.closeBookingSheet(), 0);
        } catch (err) {
            console.error('QR receipt confirm error:', err);
            Toast.show('Не удалось подтвердить получение: ' + err.message, 'error');
            if (confirmBtn) confirmBtn.disabled = false;
        } finally {
            this._receiptInProgress = false;
        }
    },

    // ────────────────────────────────────────────────────────────────────
    // УТИЛИТЫ
    // ────────────────────────────────────────────────────────────────────

    escape(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};

// Авто-инициализация после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DevicesQR.init());
} else {
    DevicesQR.init();
}

window.DevicesQR = DevicesQR;
