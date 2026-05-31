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

        modal = document.createElement('div');
        modal.id = 'qr-scanner-modal';
        modal.className = 'modal qr-scanner-modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3>Сканировать QR устройства</h3>
                    <button class="modal-close" aria-label="Закрыть">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="${this.scannerContainerId}" class="qr-scanner-area"></div>
                    <div id="qr-scanner-status" class="qr-scanner-status">
                        Наведите камеру на QR-код устройства
                    </div>
                    <div class="qr-scanner-fallback">
                        <div class="qr-scanner-fallback-row">
                            <button type="button" class="secondary-btn" id="qr-flip-camera">
                                Сменить камеру
                            </button>
                            <label class="secondary-btn qr-upload-btn" for="qr-upload-input">
                                Загрузить картинку
                                <input type="file" id="qr-upload-input" accept="image/*" hidden>
                            </label>
                        </div>
                        <div class="qr-manual-row">
                            <input type="text" id="qr-manual-input" class="form-input" placeholder="…или введите ID устройства вручную">
                            <button type="button" class="primary-btn" id="qr-manual-submit">Найти</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // wiring
        modal.querySelector('.modal-close').addEventListener('click', () => this.closeScanner());
        modal.querySelector('.modal-overlay').addEventListener('click', () => this.closeScanner());
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
        } catch (err) {
            // BR.05.23 — отказ камеры или её отсутствие → fallback
            console.warn('QR scanner camera error:', err);
            this.setStatus('Камера недоступна. Загрузите картинку или введите ID вручную.', 'warning');
        }
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
            this.onScanSuccess(decoded);
        } catch (err) {
            console.warn('QR upload error:', err);
            this.setStatus('Не удалось распознать QR на картинке. Попробуйте другое изображение.', 'error');
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
        this.onScanSuccess(value);
    },

    setStatus(text, level = 'info') {
        const status = document.getElementById('qr-scanner-status');
        if (!status) return;
        status.textContent = text;
        status.dataset.level = level;
    },

    closeScanner() {
        this.stopCamera();
        const modal = document.getElementById('qr-scanner-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
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
        await this.stopCamera();
        const payload = this.extractDeviceId(decodedText);
        if (!payload) {
            this.setStatus('QR-код не похож на ID устройства', 'error');
            await this.startCamera();
            return;
        }
        try {
            const device = await this.findDevice(payload);
            if (!device) {
                // BR.05.7 — неизвестный QR
                this.setStatus('Устройство не найдено', 'error');
                Toast.show('Устройство не найдено', 'error');
                await this.startCamera();
                return;
            }
            this.lastDevice = device;
            this.showBookingSheet(device);
        } catch (err) {
            console.error('QR lookup error:', err);
            Toast.show('Не удалось проверить устройство: ' + err.message, 'error');
            await this.startCamera();
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

        if (device.status === DEVICE_STATUS.EXTERNAL) {
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
        if (sheet) return sheet;
        sheet = document.createElement('div');
        sheet.id = 'qr-booking-sheet';
        sheet.className = 'modal qr-booking-sheet';
        sheet.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content modal-sm">
                <div class="modal-header">
                    <h3>Бронирование по QR</h3>
                    <button class="modal-close" aria-label="Закрыть">&times;</button>
                </div>
                <div class="modal-body" id="qr-booking-body"></div>
            </div>
        `;
        document.body.appendChild(sheet);
        sheet.querySelector('.modal-close').addEventListener('click', () => this.closeBookingSheet());
        sheet.querySelector('.modal-overlay').addEventListener('click', () => this.closeBookingSheet());
        return sheet;
    },

    closeBookingSheet() {
        const sheet = document.getElementById('qr-booking-sheet');
        if (sheet) sheet.classList.add('hidden');
        this.lastDevice = null;
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
     * BR.05.4 / 05.14 — шторка для available: office/home toggle + кнопка.
     */
    renderAvailableState(device) {
        const wrap = document.createElement('div');
        wrap.className = 'qr-state qr-state-available';

        // Note: проверка device.isWorking отсутствует (BR.05.17 не покрыта)

        wrap.innerHTML = `
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
                    <input type="date" id="qr-booking-until" class="form-input">
                </label>
            </div>
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
     * BR.05.19 — устройство уже у текущего пользователя: предложить «Вернуть».
     */
    renderOwnDeviceState(device) {
        const wrap = document.createElement('div');
        wrap.className = 'qr-state qr-state-own';
        wrap.innerHTML = `
            <div class="qr-info-banner">Это устройство уже у вас</div>
            <div class="form-actions">
                <button type="button" class="secondary-btn" data-qr-action="cancel">Отмена</button>
                <button type="button" class="primary-btn" data-qr-action="return">Вернуть</button>
            </div>
        `;
        wrap.querySelector('[data-qr-action="cancel"]').addEventListener('click', () => this.closeBookingSheet());
        wrap.querySelector('[data-qr-action="return"]').addEventListener('click', () => this.submitReturn());
        return wrap;
    },

    // ────────────────────────────────────────────────────────────────────
    // ДЕЙСТВИЯ С FIRESTORE
    // ────────────────────────────────────────────────────────────────────

    /**
     * BR.05.4 / 05.10 / 05.14 / 05.20 — оформление брони.
     */
    async submitBooking() {
        const device = this.lastDevice;
        const user = Auth.getUser();
        if (!device || !user) return;

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

        try {
            const deviceUpdate = {
                status: DEVICE_STATUS.BOOKED,
                bookingType: isHome ? BOOKING_TYPES.HOME : BOOKING_TYPES.OFFICE,
                currentUserId: user.uid,
                currentUserName: user.displayName || user.email,
                currentUserPhoto: user.photoURL || null,
                bookedAt: firebase.firestore.FieldValue.serverTimestamp(),
                bookedUntil,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await db.collection(COLLECTIONS.DEVICES).doc(device.id).update(deviceUpdate);

            // Запись в bookings
            const bookingRecord = {
                deviceId: device.id,
                deviceName: device.name || '',
                userId: user.uid,
                userName: user.displayName || user.email,
                userPhoto: user.photoURL || null,
                action: BOOKING_ACTIONS.TAKE,
                bookingType: isHome ? BOOKING_TYPES.HOME : BOOKING_TYPES.OFFICE,
                startDate: firebase.firestore.FieldValue.serverTimestamp(),
                endDate: bookedUntil,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                // Note: поле source не заполняется (BR.05.10 не покрыта)
            };
            await db.collection(COLLECTIONS.BOOKINGS).add(bookingRecord);

            Toast.show(
                isHome ? 'Устройство забронировано до выбранной даты' : 'Устройство забронировано на вас',
                'success'
            );
            this.closeBookingSheet();
        } catch (err) {
            console.error('QR booking error:', err);
            Toast.show('Не удалось оформить бронь: ' + err.message, 'error');
        }
    },

    /**
     * BR.05.19 — возврат устройства, занятого текущим пользователем.
     */
    async submitReturn() {
        const device = this.lastDevice;
        const user = Auth.getUser();
        if (!device || !user) return;
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
            this.closeBookingSheet();
        } catch (err) {
            console.error('QR return error:', err);
            Toast.show('Не удалось вернуть устройство: ' + err.message, 'error');
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
