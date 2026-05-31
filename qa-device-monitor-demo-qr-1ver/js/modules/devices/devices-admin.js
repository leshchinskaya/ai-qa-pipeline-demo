/**
 * Devices Admin Module
 * Административные функции: CRUD устройств, таблица, Device Matcher
 *
 * Этот файл расширяет объект Devices методами для admin-панели.
 * Должен загружаться ПОСЛЕ devices.js.
 */
Object.assign(Devices, {

    /**
     * Настройка модального окна устройства (добавление/редактирование)
     */
    setupDeviceModal() {
        const modal = document.getElementById('device-modal');
        const form = document.getElementById('device-form');
        const addBtn = document.getElementById('add-device-btn');
        const externalCheckbox = document.getElementById('device-external');

        // Открытие модального окна для добавления
        addBtn?.addEventListener('click', () => {
            this.openDeviceModal();
        });

        // Обработка отправки формы
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleDeviceSave();
        });

        // Закрытие модального окна
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        modal.querySelector('.modal-cancel').addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        modal.querySelector('.modal-overlay').addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        externalCheckbox?.addEventListener('change', () => {
            this.updateExternalDeviceFieldsVisibility();
        });
    },

    /**
     * Управление видимостью полей статуса "Вне отдела"
     */
    updateExternalDeviceFieldsVisibility() {
        const externalCheckbox = document.getElementById('device-external');
        const externalFields = document.getElementById('device-external-fields');
        const externalDepartment = document.getElementById('device-external-department');
        const externalComment = document.getElementById('device-external-comment');

        if (!externalCheckbox || !externalFields || !externalDepartment || !externalComment) return;

        const isExternal = externalCheckbox.checked;
        externalFields.classList.toggle('hidden', !isExternal);
        externalDepartment.required = isExternal;
        externalComment.required = isExternal;
    },

    /**
     * Открыть модальное окно устройства
     */
    openDeviceModal(device = null) {
        const modal = document.getElementById('device-modal');
        const title = document.getElementById('device-modal-title');
        const form = document.getElementById('device-form');

        if (device) {
            title.textContent = 'Редактировать устройство';
            document.getElementById('device-id').value = device.id;
            document.getElementById('device-name').value = device.name || '';
            document.getElementById('device-type').value = device.type || '';
            document.getElementById('device-os').value = device.os || '';
            document.getElementById('device-version').value = device.osVersion || '';
            document.getElementById('device-screen').value = device.screen || '';
            document.getElementById('device-shell').value = device.shell || '';
            document.getElementById('device-device-id').value = device.deviceId || '';
            document.getElementById('device-serial').value = device.serial || '';
            document.getElementById('device-mac').value = device.mac || '';
            document.getElementById('device-imei').value = device.imei || '';
            document.getElementById('device-bluetooth').value = device.bluetooth || '';
            document.getElementById('device-udid').value = device.udid || '';
            document.getElementById('device-working').checked = device.isWorking !== false;
            document.getElementById('device-external').checked = device.status === DEVICE_STATUS.EXTERNAL;
            document.getElementById('device-external-department').value = device.externalDepartment || '';
            document.getElementById('device-external-comment').value = device.externalComment || '';
        } else {
            title.textContent = 'Добавить устройство';
            form.reset();
            document.getElementById('device-id').value = '';
            document.getElementById('device-working').checked = true;
            document.getElementById('device-external').checked = false;
            document.getElementById('device-external-department').value = '';
            document.getElementById('device-external-comment').value = '';
        }

        this.updateExternalDeviceFieldsVisibility();
        modal.classList.remove('hidden');
    },

    /**
     * Сохранение устройства
     */
    async handleDeviceSave() {
        if (!Auth.isAdmin) {
            Toast.show('Недостаточно прав', 'error');
            return;
        }

        const deviceId = document.getElementById('device-id').value;
        const name = document.getElementById('device-name').value.trim();
        const type = document.getElementById('device-type').value;
        const os = document.getElementById('device-os').value;
        const osVersion = document.getElementById('device-version').value.trim();
        const screen = document.getElementById('device-screen').value.trim();
        const shell = document.getElementById('device-shell').value.trim();
        const deviceIdField = document.getElementById('device-device-id').value.trim();
        const serial = document.getElementById('device-serial').value.trim();
        const mac = document.getElementById('device-mac').value.trim();
        const imei = document.getElementById('device-imei').value.trim();
        const bluetooth = document.getElementById('device-bluetooth').value.trim();
        const udid = document.getElementById('device-udid').value.trim();
        const isWorking = document.getElementById('device-working').checked;
        const isExternal = document.getElementById('device-external').checked;
        const externalDepartment = document.getElementById('device-external-department').value.trim();
        const externalComment = document.getElementById('device-external-comment').value.trim();

        if (!name || !type) {
            Toast.show('Заполните обязательные поля', 'warning');
            return;
        }

        if (isExternal && (!externalDepartment || !externalComment)) {
            Toast.show('Для статуса "Вне отдела" заполните подразделение и комментарий', 'warning');
            return;
        }

        const currentUser = Auth.getUser();
        const currentDevice = deviceId ? this.devices.find(d => d.id === deviceId) : null;

        try {
            const deviceData = {
                name,
                type,
                os: os || null,
                osVersion: osVersion || null,
                screen: screen || null,
                shell: shell || null,
                deviceId: deviceIdField || null,
                serial: serial || null,
                mac: mac || null,
                imei: imei || null,
                bluetooth: bluetooth || null,
                udid: udid || null,
                isWorking: isWorking,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser?.uid || null,
                updatedByName: currentUser?.displayName || currentUser?.email || null
            };

            if (isExternal) {
                deviceData.status = DEVICE_STATUS.EXTERNAL;
                deviceData.externalDepartment = externalDepartment;
                deviceData.externalComment = externalComment;
                deviceData.externalUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
                deviceData.externalUpdatedBy = currentUser?.uid || null;
                deviceData.externalUpdatedByName = currentUser?.displayName || currentUser?.email || 'Администратор';
                deviceData.bookingType = null;
                deviceData.currentUserId = null;
                deviceData.currentUserName = null;
                deviceData.currentUserPhoto = null;
                deviceData.currentUserOffice = null;
                deviceData.currentUserHomeAddress = null;
                deviceData.bookedAt = null;
                deviceData.bookedUntil = null;
                deviceData.pendingReceipt = null;
                deviceData.bookedBy = null;
                deviceData.bookedByName = null;
                deviceData.bookedFor = null;
            } else {
                deviceData.externalDepartment = null;
                deviceData.externalComment = null;
                deviceData.externalUpdatedAt = null;
                deviceData.externalUpdatedBy = null;
                deviceData.externalUpdatedByName = null;

                if (currentDevice?.status === DEVICE_STATUS.EXTERNAL) {
                    deviceData.status = DEVICE_STATUS.AVAILABLE;
                    deviceData.bookingType = null;
                    deviceData.currentUserId = null;
                    deviceData.currentUserName = null;
                    deviceData.currentUserPhoto = null;
                    deviceData.currentUserOffice = null;
                    deviceData.currentUserHomeAddress = null;
                    deviceData.bookedAt = null;
                    deviceData.bookedUntil = null;
                    deviceData.pendingReceipt = null;
                    deviceData.bookedBy = null;
                    deviceData.bookedByName = null;
                    deviceData.bookedFor = null;
                }
            }

            if (deviceId) {
                // Обновление
                await db.collection(COLLECTIONS.DEVICES).doc(deviceId).update(deviceData);

                // Оптимистичное обновление локального состояния
                // (onSnapshot может прийти с задержкой)
                const localPatch = { ...deviceData };
                delete localPatch.updatedAt;
                delete localPatch.externalUpdatedAt;
                this.applyLocalDevicePatch(deviceId, localPatch);

                Toast.show('Устройство обновлено', 'success');
            } else {
                // Создание
                deviceData.status = isExternal ? DEVICE_STATUS.EXTERNAL : DEVICE_STATUS.AVAILABLE;
                deviceData.currentUserId = null;
                deviceData.currentUserName = null;
                deviceData.currentUserPhoto = null;
                deviceData.bookedAt = null;
                deviceData.bookedUntil = null;
                deviceData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                deviceData.createdBy = currentUser?.uid || null;
                deviceData.createdByName = currentUser?.displayName || currentUser?.email || null;
                if (!isExternal) {
                    deviceData.externalDepartment = null;
                    deviceData.externalComment = null;
                    deviceData.externalUpdatedAt = null;
                    deviceData.externalUpdatedBy = null;
                    deviceData.externalUpdatedByName = null;
                }
                
                await db.collection(COLLECTIONS.DEVICES).add(deviceData);
                Toast.show('Устройство добавлено', 'success');
            }

            document.getElementById('device-modal').classList.add('hidden');
        } catch (error) {
            console.error('Error saving device:', error);
            Toast.show('Ошибка: ' + error.message, 'error');
        }
    },

    /**
     * Удаление устройства
     */
    async deleteDevice(deviceId) {
        if (!Auth.isAdmin) {
            Toast.show('Недостаточно прав', 'error');
            return;
        }

        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;
        if (device.status === DEVICE_STATUS.BOOKED || device.status === DEVICE_STATUS.EXTERNAL) {
            Toast.show('Нельзя удалить занятое или выведенное из отдела устройство', 'warning');
            return;
        }

        if (!confirm(`Удалить устройство "${device.name}"?`)) {
            return;
        }

        try {
            await db.collection(COLLECTIONS.DEVICES).doc(deviceId).delete();
            Toast.show('Устройство удалено', 'success');
        } catch (error) {
            console.error('Error deleting device:', error);
            Toast.show('Ошибка: ' + error.message, 'error');
        }
    },

    /**
     * Настройка модального окна деталей устройства
     */
    setupDeviceDetailsModal() {
        const modal = document.getElementById('device-details-modal');
        if (!modal) return;

        // Закрытие модального окна
        modal.querySelector('.modal-close')?.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        modal.querySelector('.modal-cancel')?.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
        modal.querySelector('.modal-overlay')?.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    },

    /**
     * Открыть модальное окно деталей устройства
     */
    openDeviceDetails(device) {
        const modal = document.getElementById('device-details-modal');
        const title = document.getElementById('device-details-title');
        const content = document.getElementById('device-details-content');
        
        if (!modal || !content) return;

        title.textContent = device.name;

        // Определяем текст статуса по bookingType
        const bookingType = this.getBookingType(device);
        let statusText;
        if (device.status === DEVICE_STATUS.AVAILABLE) {
            statusText = 'Свободно';
        } else if (device.status === DEVICE_STATUS.EXTERNAL) {
            statusText = 'Вне отдела';
        } else if (bookingType === BOOKING_TYPES.HOME) {
            statusText = 'Взято домой';
        } else {
            statusText = 'Использую';
        }
        const osLabel = device.os ? (OS_TYPES[device.os]?.label || device.os) : null;
        const isWorking = device.isWorking !== false;
        const screenCharacteristics = this.getDeviceScreenCharacteristics(device);
        
        const detailItem = (label, value) => {
            const isEmpty = !value;
            return `
                <div class="device-detail-item">
                    <div class="device-detail-label">${label}</div>
                    <div class="device-detail-value ${isEmpty ? 'empty' : ''}">${value || 'Не указано'}</div>
                </div>
            `;
        };

        content.innerHTML = `
            <div class="device-details-header">
                <div class="device-details-icon">
                    ${this.getDeviceIcon(device.type)}
                </div>
                <div class="device-details-title">
                    <div class="device-details-name-row">
                        <h4>${device.name}</h4>
                        ${Auth.isAdmin ? `
                            <button type="button" class="icon-btn-small device-details-edit-btn" title="Редактировать">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                    <div class="device-details-badges">
                        <span class="device-status ${device.status}">${statusText}</span>
                        <span class="device-working-badge ${isWorking ? 'working' : 'not-working'}">${isWorking ? 'Рабочее' : 'Не работает'}</span>
                    </div>
                </div>
            </div>
            <div class="device-details-grid">
                ${detailItem('Тип устройства', DEVICE_TYPES[device.type]?.label || device.type)}
                ${detailItem('Операционная система', osLabel)}
                ${detailItem('Версия ОС', device.osVersion)}
                ${detailItem('ID устройства', device.deviceId)}
                ${detailItem('Разрешение экрана', screenCharacteristics.resolution)}
                ${detailItem('Соотношение сторон', screenCharacteristics.aspectRatio)}
                ${detailItem('Плотность пикселей (PPI)', screenCharacteristics.ppi)}
                ${detailItem('Оболочка', device.shell)}
                ${detailItem('Серийный номер', device.serial)}
                ${detailItem('MAC-адрес Wi-Fi', device.mac)}
                ${detailItem('Версия Bluetooth', device.bluetooth)}
                ${device.udid ? detailItem('UDID', device.udid) : ''}
                ${device.status === DEVICE_STATUS.EXTERNAL ? detailItem('Передано в подразделение', device.externalDepartment) : ''}
                ${device.status === DEVICE_STATUS.EXTERNAL ? detailItem('Комментарий администратора', device.externalComment) : ''}
            </div>
            ${device.currentUserName ? `
                <div class="device-detail-item full-width" style="margin-top: var(--spacing-md);">
                    <div class="device-detail-label">Забронировано</div>
                    <div class="device-detail-value">${device.currentUserName}</div>
                </div>
            ` : ''}
            <div class="device-detail-item full-width device-qr-block" style="margin-top: var(--spacing-md);">
                <div class="device-detail-label">QR-код устройства</div>
                <div class="device-qr-row">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(device.id)}"
                         alt="QR-код устройства ${device.name || device.id}"
                         class="device-qr-image"
                         width="180" height="180" loading="lazy"/>
                    <div class="device-qr-meta">
                        <div class="device-qr-payload">payload: <code>${device.id}</code></div>
                        <div class="device-qr-hint">Распечатайте и наклейте на устройство. При сканировании автоматически открывается экран бронирования.</div>
                    </div>
                </div>
            </div>
        `;

        // Обработчик для иконки редактирования
        const editBtn = content.querySelector('.device-details-edit-btn');
        editBtn?.addEventListener('click', () => {
            modal.classList.add('hidden');
            this.openDeviceModal(device);
        });

        modal.classList.remove('hidden');
    },

    // Конфигурация колонок для таблицы
    tableColumns: {
        android: [
            { id: 'manufacturer', label: 'Производитель', default: false },
            { id: 'name', label: 'Устройство', default: true },
            { id: 'osVersion', label: 'Версия', default: true },
            { id: 'deviceId', label: 'ID устройства', default: true },
            { id: 'screenWidth', label: 'Ширина экрана', default: false },
            { id: 'screenHeight', label: 'Высота экрана', default: false },
            { id: 'diagonal', label: 'Диагональ', default: false },
            { id: 'gms', label: 'Google Services', default: false },
            { id: 'shell', label: 'Оболочка', default: false },
            { id: 'serial', label: 'Серийный номер', default: true },
            { id: 'udid', label: 'UDID', default: false },
            { id: 'mac', label: 'MAC-адрес Wi-Fi', default: false },
            { id: 'status', label: 'Состояние', default: true },
            { id: 'actions', label: 'Действия', default: true }
        ],
        ios: [
            { id: 'manufacturer', label: 'Производитель', default: false },
            { id: 'name', label: 'Устройство', default: true },
            { id: 'osVersion', label: 'Версия', default: true },
            { id: 'deviceId', label: 'ID устройства', default: true },
            { id: 'screenWidth', label: 'Ширина экрана', default: false },
            { id: 'screenHeight', label: 'Высота экрана', default: false },
            { id: 'diagonal', label: 'Диагональ', default: false },
            { id: 'features', label: 'Особенности', default: false },
            { id: 'serial', label: 'Серийный номер', default: false },
            { id: 'udid', label: 'UDID', default: true },
            { id: 'mac', label: 'MAC-адрес Wi-Fi', default: false },
            { id: 'status', label: 'Состояние', default: true },
            { id: 'actions', label: 'Действия', default: true }
        ]
    },

    visibleColumns: null,
    currentOsTab: 'android',

    /**
     * Загрузить настройки колонок из localStorage
     */
    loadColumnSettings() {
        const saved = localStorage.getItem('adminDevicesColumns');
        if (saved) {
            this.visibleColumns = JSON.parse(saved);
        } else {
            // Установить значения по умолчанию
            this.visibleColumns = {
                android: this.tableColumns.android.filter(c => c.default).map(c => c.id),
                ios: this.tableColumns.ios.filter(c => c.default).map(c => c.id)
            };
        }
    },

    /**
     * Сохранить настройки колонок в localStorage
     */
    saveColumnSettings() {
        localStorage.setItem('adminDevicesColumns', JSON.stringify(this.visibleColumns));
    },

    /**
     * Загрузить порядок колонок из localStorage
     */
    loadColumnOrder() {
        const saved = localStorage.getItem('adminDevicesColumnOrder');
        if (saved) {
            this.columnOrder = JSON.parse(saved);
        } else {
            // Порядок по умолчанию из tableColumns
            this.columnOrder = this.tableColumns.android.map(c => c.id);
        }
    },

    /**
     * Сохранить порядок колонок в localStorage
     */
    saveColumnOrder() {
        localStorage.setItem('adminDevicesColumnOrder', JSON.stringify(this.columnOrder));
    },

    /**
     * Сортировка устройств
     */
    sortDevices(devices, columnId, direction) {
        if (!columnId) return devices;
        
        return [...devices].sort((a, b) => {
            let valA = this.getSortValue(a, columnId);
            let valB = this.getSortValue(b, columnId);
            
            // Числовая сортировка для некоторых колонок
            if (['screenWidth', 'screenHeight', 'diagonal', 'osVersion'].includes(columnId)) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }
            
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    },

    /**
     * Получить значение для сортировки
     */
    getSortValue(device, columnId) {
        switch (columnId) {
            case 'manufacturer':
                return this.extractManufacturer(device.name, device.os);
            case 'name':
                return device.name || '';
            case 'osVersion':
                return device.osVersion || '';
            case 'deviceId':
                return device.deviceId || '';
            case 'serialOrUdid':
                return device.os === 'ios' ? (device.udid || device.serial || '') : (device.serial || '');
            case 'screenWidth':
                return device.screenWidth || 0;
            case 'screenHeight':
                return device.screenHeight || 0;
            case 'diagonal':
                return device.diagonal || 0;
            case 'gms':
                return device.hasGoogleServices ? 'да' : 'нет';
            case 'shell':
                return device.shell || '';
            case 'features':
                return device.features || '';
            case 'mac':
                return device.mac || '';
            case 'status':
                return device.isWorking !== false ? 'рабочее' : 'не работает';
            default:
                return '';
        }
    },

    /**
     * Обработчик клика по заголовку для сортировки
     */
    handleSortClick(columnId) {
        if (this.sortColumn === columnId) {
            // Переключаем направление
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = columnId;
            this.sortDirection = 'asc';
        }
        this.renderAdminDevices();
    },

    /**
     * Настройка табов iOS/Android
     */
    setupOsTabs() {
        const tabs = document.querySelectorAll('.os-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const os = tab.dataset.os;
                this.currentOsTab = os;
                
                // Обновляем активный таб
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Перерисовываем таблицу
                this.renderAdminDevices();
            });
        });
    },

    /**
     * Настройка панели колонок
     */
    setupColumnsPanel() {
        const toggleBtn = document.getElementById('toggle-columns-btn');
        const panel = document.getElementById('columns-panel');

        if (!toggleBtn || !panel) return;

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) {
                this.renderColumnsCheckboxes();
            }
        });

        // Закрытие при клике вне dropdown
        document.addEventListener('click', (e) => {
            if (!panel.classList.contains('hidden') && 
                !panel.contains(e.target) && 
                !toggleBtn.contains(e.target)) {
                panel.classList.add('hidden');
            }
        });

        // Предотвращаем закрытие при клике внутри panel
        panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    },

    /**
     * Настройка панели подбора похожих устройств
     */
    setupDeviceMatcher() {
        const toggleBtn = document.getElementById('device-matcher-btn');
        const panel = document.getElementById('device-matcher-panel');
        const resetBtn = document.getElementById('device-matcher-reset');
        const searchBtn = document.getElementById('device-matcher-search');
        const closeBtn = document.getElementById('device-matcher-close');
        const activeIndicator = document.getElementById('device-matcher-active');
        
        if (!toggleBtn || !panel) {
            console.log('DeviceMatcher: UI elements not found');
            return;
        }
        
        // Открытие/закрытие панели
        toggleBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const shouldOpen = panel.classList.contains('hidden');
            panel.classList.toggle('hidden');
            toggleBtn.classList.toggle('active', !panel.classList.contains('hidden'));
            
            // При открытии панели заполняем select'ы
            if (shouldOpen) {
                const ready = await this.ensureDeviceMatcherReady();
                if (!ready) {
                    panel.classList.add('hidden');
                    toggleBtn.classList.remove('active');
                    if (typeof Toast !== 'undefined') {
                        Toast.show('Модуль подбора устройств не загружен', 'error');
                    }
                    return;
                }
                this.populateMatcherSelects();
            }
        });
        
        // Закрытие при клике вне панели
        document.addEventListener('click', (e) => {
            if (!panel.classList.contains('hidden') && 
                !panel.contains(e.target) && 
                !toggleBtn.contains(e.target)) {
                panel.classList.add('hidden');
                toggleBtn.classList.remove('active');
            }
        });
        
        // Сброс формы
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetMatcherForm();
            });
        }
        
        // Поиск похожих устройств
        if (searchBtn) {
            searchBtn.addEventListener('click', async () => {
                const ready = await this.ensureDeviceMatcherReady();
                if (!ready) {
                    if (typeof Toast !== 'undefined') {
                        Toast.show('Модуль подбора устройств не загружен', 'error');
                    }
                    return;
                }
                this.executeDeviceMatch();
            });
        }
        
        // Закрытие режима подбора
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.exitMatcherMode();
            });
        }
        
        // При изменении ОС обновляем список оболочек
        const osSelect = document.getElementById('matcher-os');
        if (osSelect) {
            osSelect.addEventListener('change', () => {
                this.updateMatcherShells(osSelect.value);
            });
        }
    },
    
    /**
     * Заполнить select'ы в форме подбора и восстановить сохранённые значения
     */
    populateMatcherSelects() {
        if (typeof DeviceMatcher === 'undefined') return;
        
        // Производители
        const manufacturerSelect = document.getElementById('matcher-manufacturer');
        if (manufacturerSelect) {
            const manufacturers = DeviceMatcher.getUniqueManufacturers(this.devices);
            manufacturerSelect.innerHTML = '<option value="">Любой</option>' +
                manufacturers.map(m => `<option value="${m}">${m}</option>`).join('');
        }
        
        // Оболочки (зависят от выбранной ОС)
        const osSelect = document.getElementById('matcher-os');
        if (osSelect) {
            this.updateMatcherShells(osSelect.value);
        }
        
        // Восстанавливаем сохранённые данные формы
        this.restoreMatcherFormData();
    },
    
    /**
     * Восстановить сохранённые данные формы подбора
     */
    restoreMatcherFormData() {
        if (typeof DeviceMatcher === 'undefined') return;
        
        const savedData = DeviceMatcher.getFormData();
        if (!savedData) return;
        
        // Восстанавливаем значения полей
        const fieldMapping = {
            'matcher-os': 'os',
            'matcher-version': 'osVersion',
            'matcher-screen': 'screen',
            'matcher-aspect-ratio': 'aspectRatio',
            'matcher-exact-screen': 'exactScreen',
            'matcher-manufacturer': 'manufacturer',
            'matcher-shell': 'shell',
            'matcher-bluetooth': 'bluetooth'
        };
        
        for (const [elementId, dataKey] of Object.entries(fieldMapping)) {
            const el = document.getElementById(elementId);
            const value = savedData[dataKey];
            
            if (!el) continue;
            if (value === null || value === undefined || value === '') continue;

            if (el.type === 'checkbox') {
                el.checked = Boolean(value);
                continue;
            }
            
            if (el.tagName === 'SELECT') {
                // Для select ищем опцию
                const option = Array.from(el.options).find(
                    o => o.value.toLowerCase() === value.toLowerCase()
                );
                if (option) {
                    el.value = option.value;
                }
            } else {
                el.value = value;
            }
        }
        
        // Обновляем оболочки если была выбрана ОС
        if (savedData.os) {
            this.updateMatcherShells(savedData.os);
            
            // Восстанавливаем shell после обновления списка
            if (savedData.shell) {
                setTimeout(() => {
                    const shellSelect = document.getElementById('matcher-shell');
                    if (shellSelect) {
                        const option = Array.from(shellSelect.options).find(
                            o => o.value.toLowerCase() === savedData.shell.toLowerCase()
                        );
                        if (option) {
                            shellSelect.value = option.value;
                        }
                    }
                }, 50);
            }
        }
    },
    
    /**
     * Обновить список оболочек для выбранной ОС
     */
    updateMatcherShells(os) {
        if (typeof DeviceMatcher === 'undefined') return;
        
        const shellSelect = document.getElementById('matcher-shell');
        if (!shellSelect) return;
        
        // Для iOS/iPadOS оболочки не актуальны
        if (os === 'ios' || os === 'ipados') {
            shellSelect.innerHTML = '<option value="">Не применимо</option>';
            shellSelect.disabled = true;
        } else {
            shellSelect.disabled = false;
            const shells = DeviceMatcher.getUniqueShells(this.devices, os || null);
            shellSelect.innerHTML = '<option value="">Любая</option>' +
                shells.map(s => `<option value="${s}">${s}</option>`).join('');
        }
    },
    
    /**
     * Сбросить форму подбора
     */
    resetMatcherForm() {
        const fields = ['matcher-os', 'matcher-version', 'matcher-screen', 'matcher-aspect-ratio',
            'matcher-exact-screen', 'matcher-manufacturer', 'matcher-shell', 'matcher-bluetooth'];
        
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.tagName === 'SELECT') {
                    el.selectedIndex = 0;
                } else if (el.type === 'checkbox') {
                    el.checked = false;
                } else {
                    el.value = '';
                }
            }
        });
        
        // Сбрасываем disabled для shell
        const shellSelect = document.getElementById('matcher-shell');
        if (shellSelect) {
            shellSelect.disabled = false;
            this.updateMatcherShells(null);
        }
        
        // Очищаем сохранённые данные формы
        if (typeof DeviceMatcher !== 'undefined') {
            DeviceMatcher.saveFormData(null);
        }
        
        // Выходим из режима подбора если он был активен
        if (typeof DeviceMatcher !== 'undefined' && DeviceMatcher.isActive) {
            this.exitMatcherMode();
        }
    },
    
    /**
     * Выполнить поиск похожих устройств
     */
    executeDeviceMatch() {
        if (typeof DeviceMatcher === 'undefined') {
            Toast.show('Модуль подбора не загружен', 'error');
            return;
        }
        
        // Проверка фичи
        if (typeof FeatureFlags !== 'undefined' && !FeatureFlags.isEnabled('deviceMatcher')) {
            Toast.show('Функция подбора отключена', 'error');
            return;
        }
        
        // Собираем критерии
        const osSelect = document.getElementById('matcher-os');
        const os = osSelect?.value;
        
        if (!os) {
            Toast.show('Выберите операционную систему', 'warning');
            osSelect?.focus();
            return;
        }
        
        const criteria = {
            os: os,
            osVersion: document.getElementById('matcher-version')?.value || null,
            screen: document.getElementById('matcher-screen')?.value || null,
            aspectRatio: document.getElementById('matcher-aspect-ratio')?.value || null,
            exactScreen: Boolean(document.getElementById('matcher-exact-screen')?.checked),
            manufacturer: document.getElementById('matcher-manufacturer')?.value || null,
            shell: document.getElementById('matcher-shell')?.value || null,
            bluetooth: document.getElementById('matcher-bluetooth')?.value || null
        };

        if (criteria.screen && !DeviceMatcher.parseScreen(criteria.screen)) {
            Toast.show('Неверный формат разрешения. Используйте, например, 1080x2400', 'warning');
            document.getElementById('matcher-screen')?.focus();
            return;
        }
        if (criteria.aspectRatio && !DeviceMatcher.parseAspectRatio(criteria.aspectRatio)) {
            Toast.show('Неверный формат соотношения. Используйте, например, 20:9', 'warning');
            document.getElementById('matcher-aspect-ratio')?.focus();
            return;
        }
        
        console.log('DeviceMatcher: searching with criteria', criteria);
        
        // Сохраняем данные формы
        DeviceMatcher.saveFormData(criteria);
        
        // Активируем режим подбора
        DeviceMatcher.activate(criteria);
        
        // Получаем категоризированные результаты
        const results = DeviceMatcher.getCategorizedResults(criteria, this.devices, {
            onlyWorking: !Auth.isAdmin || this.filterWorking === 'working'
        });
        
        // Сохраняем результаты для отображения
        this.matcherResults = results;
        
        // Скрываем панель
        const panel = document.getElementById('device-matcher-panel');
        const toggleBtn = document.getElementById('device-matcher-btn');
        if (panel) panel.classList.add('hidden');
        if (toggleBtn) toggleBtn.classList.remove('active');
        
        // Показываем индикатор активного режима
        this.showMatcherActiveIndicator(criteria);
        
        // Отображаем результаты с табами
        this.renderMatcherResults(results);
        
        const totalFound = results.exactMatches.length + results.categories.system.length;
        Toast.show(`Найдено ${totalFound} устройств`, 'success');
    },
    
    /**
     * Показать индикатор активного режима подбора
     */
    showMatcherActiveIndicator(criteria) {
        const indicator = document.getElementById('device-matcher-active');
        const summary = document.getElementById('matcher-criteria-summary');
        
        if (!indicator) return;
        
        // Формируем краткое описание критериев
        const parts = [];
        
        // ОС и версия
        if (criteria.os) {
            const osLabel = criteria.os === 'android' ? 'Android' : 
                           criteria.os === 'ios' ? 'iOS' : 'iPadOS';
            parts.push(osLabel + (criteria.osVersion ? ' ' + criteria.osVersion : ''));
        }
        
        // Производитель
        if (criteria.manufacturer) {
            parts.push(criteria.manufacturer);
        }
        
        // Экран
        if (criteria.screen) {
            parts.push(criteria.screen);
        }

        if (criteria.aspectRatio) {
            parts.push(`AR ${criteria.aspectRatio}`);
        }

        if (criteria.exactScreen) {
            parts.push('точное разрешение');
        }
        
        // Оболочка
        if (criteria.shell) {
            parts.push(criteria.shell);
        }
        
        // Bluetooth
        if (criteria.bluetooth) {
            parts.push('BT ' + criteria.bluetooth);
        }
        
        if (summary) {
            summary.textContent = parts.length > 0 ? '• ' + parts.join(', ') : '';
        }
        
        indicator.classList.remove('hidden');
    },
    
    /**
     * Выйти из режима подбора
     */
    exitMatcherMode() {
        if (typeof DeviceMatcher !== 'undefined') {
            DeviceMatcher.deactivate();
        }
        
        // Скрываем индикатор
        const indicator = document.getElementById('device-matcher-active');
        if (indicator) {
            indicator.classList.add('hidden');
        }
        
        // Скрываем результаты подбора
        const resultsContainer = document.getElementById('device-matcher-results');
        if (resultsContainer) {
            resultsContainer.classList.add('hidden');
        }
        
        // Показываем обычную сетку
        const grid = document.getElementById('devices-grid');
        if (grid) {
            grid.classList.remove('hidden');
        }
        
        // Перерисовываем устройства в обычном режиме
        this.matcherResults = null;
        this.renderDevices();
    },
    
    /**
     * Отобразить результаты подбора с табами
     * @param {Object} results - результаты из getCategorizedResults
     */
    renderMatcherResults(results) {
        const resultsContainer = document.getElementById('device-matcher-results');
        const devicesGrid = document.getElementById('devices-grid');
        const countEl = document.getElementById('devices-count');
        
        if (!resultsContainer) {
            console.warn('device-matcher-results container not found');
            // Fallback к обычному рендерингу
            this.renderDevices();
            return;
        }
        
        // Скрываем обычную сетку устройств
        if (devicesGrid) {
            devicesGrid.classList.add('hidden');
        }
        
        // Показываем контейнер результатов
        resultsContainer.classList.remove('hidden');
        
        // Обновляем счётчик
        const totalCount = results.exactMatches.length + results.categories.system.length;
        if (countEl) {
            countEl.innerHTML = `Найдено похожих: <span class="highlight">${totalCount}</span>`;
        }
        
        // Отображаем точные совпадения
        this.renderExactMatches(results.exactMatches);
        
        // Настраиваем табы
        this.setupMatcherTabs();
        
        // Отображаем первый таб (по системе) по умолчанию
        this.renderCategoryTab('system', results.categories.system);
        
        // Сохраняем результаты для переключения табов
        this.matcherResults = results;
    },
    
    /**
     * Отобразить блок точных совпадений
     * @param {Array} devices - устройства с точным совпадением
     */
    renderExactMatches(devices) {
        const container = document.getElementById('matcher-exact-matches');
        const grid = document.getElementById('exact-matches-grid');
        
        if (!container || !grid) return;
        
        if (devices.length === 0) {
            container.classList.add('hidden');
            return;
        }
        
        container.classList.remove('hidden');
        
        grid.innerHTML = devices.map(device => 
            this.createDeviceCard(device, {
                showMatchScore: true,
                matchScore: device.matchScore,
                matchDetails: device.matchDetails
            })
        ).join('');
        
        // Добавляем обработчики
        this.attachCardEventHandlers(grid);
    },
    
    /**
     * Настроить переключение табов
     */
    setupMatcherTabs() {
        const tabsHeader = document.querySelector('.matcher-tabs-header');
        if (!tabsHeader) return;
        
        tabsHeader.querySelectorAll('.matcher-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.target.dataset.tab;
                if (!tabId || !this.matcherResults) return;
                
                // Убираем active со всех табов
                tabsHeader.querySelectorAll('.matcher-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                // Скрываем все панели и показываем нужную
                document.querySelectorAll('.matcher-tab-panel').forEach(panel => {
                    panel.classList.remove('active');
                });
                
                const targetPanel = document.getElementById(`tab-${tabId}`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
                
                // Рендерим содержимое таба
                const devices = this.matcherResults.categories[tabId] || [];
                this.renderCategoryTab(tabId, devices);
            });
        });
    },
    
    /**
     * Отобразить устройства в табе категории
     * @param {string} tabId - ID таба (system, manufacturer, screen)
     * @param {Array} devices - устройства для отображения
     */
    renderCategoryTab(tabId, devices) {
        const panel = document.getElementById(`tab-${tabId}`);
        if (!panel) return;
        
        if (devices.length === 0) {
            panel.innerHTML = '<div class="empty-state"><p>Нет устройств для отображения</p></div>';
            return;
        }
        
        // Создаём сетку устройств
        panel.innerHTML = `<div class="devices-grid">${
            devices.map(device => 
                this.createDeviceCard(device, {
                    showMatchScore: true,
                    matchScore: device.matchScore,
                    matchDetails: device.matchDetails
                })
            ).join('')
        }</div>`;
        
        // Добавляем обработчики
        this.attachCardEventHandlers(panel.querySelector('.devices-grid'));
    },

    async handleCardAction(actionButton, deviceId) {
        if (!actionButton || !deviceId) {
            return false;
        }

        if (actionButton.classList.contains('btn-take')) {
            await this.quickTake(deviceId);
            return true;
        }
        if (actionButton.classList.contains('btn-return')) {
            await this.returnDevice(deviceId);
            return true;
        }
        if (actionButton.classList.contains('btn-return-from-external')) {
            await this.returnFromExternal(deviceId);
            return true;
        }
        if (actionButton.classList.contains('btn-edit-date')) {
            this.openEditDateModal(deviceId);
            return true;
        }
        if (actionButton.classList.contains('btn-book')) {
            await this.openBookingModal(deviceId);
            return true;
        }
        if (actionButton.classList.contains('btn-take-home')) {
            this.takeHomeFromOffice(deviceId);
            return true;
        }
        if (actionButton.classList.contains('btn-return-to-office')) {
            await this.returnToOffice(deviceId);
            return true;
        }
        if (actionButton.classList.contains('btn-confirm-receipt')) {
            await this.confirmReceipt(deviceId);
            return true;
        }
        if (actionButton.classList.contains('calendar-btn')) {
            await this.openDeviceCalendar(deviceId);
            return true;
        }
        if (actionButton.classList.contains('history-btn')) {
            this.openDeviceHistory(deviceId);
            return true;
        }
        if (actionButton.classList.contains('assign-user-btn')) {
            await this.showAssignUserToDeviceModal(deviceId);
            return true;
        }

        return false;
    },

    /**
     * Показать модальное окно назначения пользователя на устройство
     */
    async showAssignUserToDeviceModal(deviceId) {
        if (!Auth.isAdmin) return;

        if (typeof Users === 'undefined') {
            Toast.show('Модуль пользователей не загружен', 'error');
            return;
        }

        if (Users.users.length === 0) {
            try {
                await Users.loadUsers();
            } catch {
                Toast.show('Не удалось загрузить список пользователей', 'error');
                return;
            }
        }

        document.querySelector('.assign-user-modal-overlay')?.remove();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay assign-user-modal-overlay';
        modal.innerHTML = `
            <div class="modal-content assign-user-modal-content">
                <div class="modal-header">
                    <h2>Назначить пользователя</h2>
                    <button class="modal-close assign-user-modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Поиск пользователя</label>
                        <input type="text" class="form-input assign-user-search" placeholder="Имя или email...">
                    </div>
                    <div class="assign-user-list"></div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => modal.remove();
        modal.querySelector('.assign-user-modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        const searchInput = modal.querySelector('.assign-user-search');
        const listContainer = modal.querySelector('.assign-user-list');

        const renderUsers = (filter = '') => {
            const filterLower = filter.toLowerCase();
            const filtered = Users.users.filter(user => {
                if (!filter) return true;
                const name = (user.displayName || '').toLowerCase();
                const email = (user.email || '').toLowerCase();
                return name.includes(filterLower) || email.includes(filterLower);
            });

            if (filtered.length === 0) {
                listContainer.innerHTML = `<div class="assign-user-empty">Ничего не найдено</div>`;
                return;
            }

            listContainer.innerHTML = filtered.map(user => {
                const name = user.displayName || user.email || 'Неизвестно';
                const photo = user.photoURL || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23a0a0b0"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>';
                return `
                    <div class="assign-user-option" data-user-id="${user.id}" data-user-name="${name}" data-user-photo="${user.photoURL || ''}">
                        <img src="${photo}" alt="" class="assign-user-avatar">
                        <div class="assign-user-info">
                            <span class="assign-user-name">${name}</span>
                            ${user.email ? `<span class="assign-user-email">${user.email}</span>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            listContainer.querySelectorAll('.assign-user-option').forEach(option => {
                option.addEventListener('click', async () => {
                    const userId = option.dataset.userId;
                    const userName = option.dataset.userName;
                    const userPhoto = option.dataset.userPhoto;
                    closeModal();
                    await this.assignUserToDevice(deviceId, userId, userName, userPhoto);
                });
            });
        };

        searchInput.addEventListener('input', (e) => renderUsers(e.target.value));
        renderUsers();
        searchInput.focus();
    },

    /**
     * Назначить пользователя на устройство
     */
    async assignUserToDevice(deviceId, userId, userName, userPhoto) {
        if (!Auth.isAdmin) {
            Toast.show('Недостаточно прав', 'error');
            return;
        }

        try {
            const deviceUpdateData = {
                currentUserId: userId,
                currentUserName: userName,
            };
            if (userPhoto) {
                deviceUpdateData.currentUserPhoto = userPhoto;
            }

            await db.collection(COLLECTIONS.DEVICES).doc(deviceId).update(deviceUpdateData);
            this.applyLocalDevicePatch(deviceId, deviceUpdateData);

            Toast.show(`Пользователь ${userName} назначен`, 'success');
        } catch (error) {
            console.error('Error assigning user to device:', error);
            Toast.show('Ошибка назначения: ' + error.message, 'error');
        }
    },

    /**
     * Добавить обработчики событий к карточкам устройств
     * @param {HTMLElement} container - контейнер с карточками
     */
    attachCardEventHandlers(container) {
        if (!container) return;
        if (container.dataset.cardHandlersBound !== 'true') {
            container.dataset.cardHandlersBound = 'true';

            container.addEventListener('click', async (e) => {
                const card = e.target.closest('.device-card');
                if (!card || !container.contains(card)) return;

                const deviceId = card.dataset.deviceId;
                if (!deviceId) return;

                const actionButton = e.target.closest('button');
                if (actionButton && card.contains(actionButton)) {
                    e.stopPropagation();
                    if (await this.handleCardAction(actionButton, deviceId)) {
                        return;
                    }
                }

                const device = this.getDeviceById(deviceId);
                if (device) {
                    this.openDeviceDetails(device);
                }
            });
        }

        container.querySelectorAll('button').forEach((button) => {
            if (button.dataset.cardActionBound === 'true') {
                return;
            }

            button.dataset.cardActionBound = 'true';
            button.addEventListener('click', async (e) => {
                e.stopPropagation();

                const card = button.closest('.device-card');
                const deviceId = button.dataset.deviceId || card?.dataset.deviceId;
                if (!deviceId) {
                    return;
                }

                await this.handleCardAction(button, deviceId);
            });
        });
    },

    /**
     * Отрисовать чекбоксы колонок
     */
    renderColumnsCheckboxes() {
        const container = document.getElementById('columns-checkboxes');
        if (!container) return;

        // Показываем колонки только для текущей ОС
        const currentOsColumns = this.tableColumns[this.currentOsTab] || this.tableColumns.android;
        const visibleCols = this.visibleColumns[this.currentOsTab] || [];

        container.innerHTML = '<div class="filters-options">' + currentOsColumns.map(col => `
            <label class="filter-option">
                <input type="checkbox" data-column="${col.id}" ${visibleCols.includes(col.id) ? 'checked' : ''}>
                <span>${col.label}</span>
            </label>
        `).join('') + '</div>';

        // Добавляем обработчики
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const colId = e.target.dataset.column;
                const isChecked = e.target.checked;
                const currentOsCols = this.visibleColumns[this.currentOsTab] || [];

                if (isChecked) {
                    if (!currentOsCols.includes(colId)) {
                        this.visibleColumns[this.currentOsTab].push(colId);
                    }
                } else {
                    this.visibleColumns[this.currentOsTab] = this.visibleColumns[this.currentOsTab].filter(id => id !== colId);
                }

                this.saveColumnSettings();
                this.renderAdminDevices();
            });
        });
    },

    /**
     * Извлечь производителя из названия устройства
     */
    extractManufacturer(name, os) {
        if (os === 'ios') return 'Apple';
        
        const manufacturers = [
            'Samsung', 'Xiaomi', 'Huawei', 'Honor', 'OPPO', 'Vivo', 'Realme', 
            'OnePlus', 'Google', 'Motorola', 'Nokia', 'Sony', 'LG', 'HTC', 
            'Asus', 'Meizu', 'TECNO', 'Infinix', 'Nothing', 'POCO', 'Acer', 'UMIDIGI'
        ];
        
        for (const m of manufacturers) {
            if (name.toLowerCase().includes(m.toLowerCase())) {
                return m;
            }
        }
        
        // Первое слово как производитель
        return name.split(' ')[0];
    },

    /**
     * Разбить screen на ширину и высоту
     */
    parseScreen(screen) {
        if (!screen) return { width: '', height: '' };
        
        // Поддержка разных разделителей: x, ×, X, пробел
        const match = screen.match(/(\d+)\s*[xX×]\s*(\d+)/);
        if (match) {
            return { width: match[1], height: match[2] };
        }
        return { width: '', height: '' };
    },

    /**
     * Нормализовать размеры экрана устройства
     * @param {Object} device
     * @returns {{width: number, height: number}|null}
     */
    parseDeviceScreenDimensions(device) {
        const parsed = this.parseScreen(device?.screen);
        const parsedWidth = Number(parsed.width);
        const parsedHeight = Number(parsed.height);
        const screenWidth = Number(device?.screenWidth);
        const screenHeight = Number(device?.screenHeight);
        const width = Number.isFinite(screenWidth) && screenWidth > 0
            ? screenWidth
            : (Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : 0);
        const height = Number.isFinite(screenHeight) && screenHeight > 0
            ? screenHeight
            : (Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : 0);
        if (!width || !height) return null;
        return {
            width: Math.min(width, height),
            height: Math.max(width, height)
        };
    },

    /**
     * НОД для сокращения соотношения сторон
     * @param {number} a
     * @param {number} b
     * @returns {number}
     */
    gcd(a, b) {
        let x = Math.abs(Math.round(a || 0));
        let y = Math.abs(Math.round(b || 0));
        while (y) {
            [x, y] = [y, x % y];
        }
        return x || 1;
    },

    /**
     * Построить метрики экрана устройства
     * @param {Object} device
     * @returns {{resolution: string, aspectRatio: string, ppi: string}}
     */
    getDeviceScreenCharacteristics(device) {
        const dims = this.parseDeviceScreenDimensions(device);
        const resolution = device?.screen || (dims ? `${dims.width}x${dims.height}` : '');

        if (!dims) {
            return {
                resolution,
                aspectRatio: '',
                ppi: ''
            };
        }

        const divisor = this.gcd(dims.height, dims.width);
        const aspectRatio = `${dims.height / divisor}:${dims.width / divisor}`;

        const diagonalRaw = Number.parseFloat(String(device?.diagonal || '').replace(',', '.'));
        let ppi = '';
        if (Number.isFinite(diagonalRaw) && diagonalRaw > 0) {
            const diagonalPixels = Math.sqrt((dims.width ** 2) + (dims.height ** 2));
            ppi = `${Math.round(diagonalPixels / diagonalRaw)} ppi`;
        }

        return {
            resolution,
            aspectRatio,
            ppi
        };
    },

    /**
     * Определить наличие Google Services
     */
    hasGoogleServices(device) {
        if (device.os !== 'android') return null;
        
        const noGmsIndicators = ['без google', 'no google', 'huawei nova', 'huawei y8p', 'huawei p40'];
        const searchStr = ((device.osVersion || '') + ' ' + (device.name || '')).toLowerCase();
        
        for (const indicator of noGmsIndicators) {
            if (searchStr.includes(indicator)) {
                return false;
            }
        }
        return true;
    },

    /**
     * Извлечь особенности устройства
     */
    extractFeatures(device) {
        // Сначала проверяем поле features из БД
        if (device.features) {
            return device.features;
        }
        
        // Fallback: извлекаем из shell/osVersion
        const features = [];
        
        if (device.shell) {
            if (device.shell.toLowerCase().includes('jailbreak')) {
                features.push('Jailbreak');
            }
        }
        
        if (device.osVersion) {
            if (device.osVersion.toLowerCase().includes('root')) {
                features.push('Root');
            }
        }
        
        return features.join(', ');
    },

    /**
     * Получить значение ячейки таблицы
     */
    getTableCellValue(device, columnId) {
        switch (columnId) {
            case 'manufacturer':
                return this.extractManufacturer(device.name, device.os);
            case 'name':
                return device.name || '';
            case 'osVersion':
                return device.osVersion || '';
            case 'deviceId':
                return device.deviceId || '';
            case 'serial':
                return device.serial || '';
            case 'udid':
                return device.udid || '';
            case 'screenWidth':
                return device.screenWidth || '';
            case 'screenHeight':
                return device.screenHeight || '';
            case 'diagonal':
                return device.diagonal ? device.diagonal + '"' : '';
            case 'gms':
                // Используем hasGoogleServices напрямую из БД
                if (device.hasGoogleServices === null || device.hasGoogleServices === undefined) {
                    return '';
                }
                return device.hasGoogleServices 
                    ? '<span class="status-badge has-gms">Да</span>' 
                    : '<span class="status-badge no-gms">Нет</span>';
            case 'shell':
                return device.shell || '';
            case 'features':
                return this.extractFeatures(device);
            case 'mac':
                return device.mac || '';
            case 'status':
                return device.isWorking !== false 
                    ? '<span class="status-badge working">Рабочее</span>'
                    : '<span class="status-badge broken">Не работает</span>';
            case 'actions':
                const canDelete = device.status !== DEVICE_STATUS.BOOKED && device.status !== DEVICE_STATUS.EXTERNAL;
                return `
                    <div class="actions-cell">
                        <button class="icon-btn btn-edit" title="Редактировать">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        ${canDelete ? `
                            <button class="icon-btn danger btn-delete" title="Удалить">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                `;
            default:
                return '';
        }
    },

    /**
     * Отображение устройств в админ-панели (таблица)
     */
    renderAdminDevices() {
        if (!Auth?.isAdmin) return;
        if (!this.isAdminDevicesTabActive()) {
            this.adminDevicesRenderPending = true;
            return;
        }

        const thead = document.getElementById('admin-devices-thead');
        const tbody = document.getElementById('admin-devices-tbody');
        
        if (!thead || !tbody) return;

        // Загружаем настройки колонок если ещё не загружены
        if (!this.visibleColumns) {
            this.loadColumnSettings();
        }

        // Фильтруем устройства по выбранному табу
        let filteredDevices = this.devices.filter(d => d.os === this.currentOsTab);

        // Применяем поисковый фильтр
        if (this.adminDevicesSearchQuery) {
            const query = this.adminDevicesSearchQuery;
            filteredDevices = filteredDevices.filter(device => {
                const searchFields = [
                    device.name,
                    device.manufacturer,
                    device.model,
                    device.osVersion,
                    device.serial,
                    device.udid,
                    device.shell,
                    device.screenResolution,
                    device.location
                ].map(f => (f || '').toLowerCase());
                
                return searchFields.some(f => f.includes(query));
            });
        }

        // Применяем сортировку если выбрана
        if (this.sortColumn) {
            filteredDevices = this.sortDevices(filteredDevices, this.sortColumn, this.sortDirection);
        }

        // Получаем видимые колонки для текущей ОС
        const currentOsColumns = this.tableColumns[this.currentOsTab] || this.tableColumns.android;
        const allVisibleCols = currentOsColumns.filter(c => {
            const visibleCols = this.visibleColumns[this.currentOsTab] || [];
            return visibleCols.includes(c.id);
        });

        // Сортируем по порядку из tableColumns (если нет сохранённого порядка)
        // Порядок колонок определяется порядком в tableColumns для текущей ОС
        const defaultOrder = currentOsColumns.map(c => c.id);
        allVisibleCols.sort((a, b) => {
            const orderA = defaultOrder.indexOf(a.id);
            const orderB = defaultOrder.indexOf(b.id);
            return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
        });

        // Рендерим заголовок с поддержкой сортировки и drag & drop
        thead.innerHTML = `
            <tr>
                ${allVisibleCols.map(col => {
                    const isSorted = this.sortColumn === col.id;
                    const sortIcon = col.id === 'actions' ? '' : `
                        <span class="sort-icon ${isSorted ? 'active' : ''}">
                            ${isSorted && this.sortDirection === 'desc' ? '▼' : '▲'}
                        </span>
                    `;
                    const draggable = col.id !== 'actions' ? 'draggable="true"' : '';
                    return `<th data-column="${col.id}" ${draggable} class="${isSorted ? 'sorted' : ''}">${col.label}${sortIcon}</th>`;
                }).join('')}
            </tr>
        `;

        // Добавляем обработчики для заголовков
        thead.querySelectorAll('th[data-column]').forEach(th => {
            const columnId = th.dataset.column;
            
            // Сортировка по клику
            if (columnId !== 'actions') {
                th.addEventListener('click', () => this.handleSortClick(columnId));
            }
            
            // Drag & Drop
            if (th.draggable) {
                th.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', columnId);
                    th.classList.add('dragging');
                });
                
                th.addEventListener('dragend', () => {
                    th.classList.remove('dragging');
                });
                
                th.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    th.classList.add('drag-over');
                });
                
                th.addEventListener('dragleave', () => {
                    th.classList.remove('drag-over');
                });
                
                th.addEventListener('drop', (e) => {
                    e.preventDefault();
                    th.classList.remove('drag-over');
                    const draggedId = e.dataTransfer.getData('text/plain');
                    const targetId = columnId;
                    
                    if (draggedId !== targetId) {
                        // Перемещаем колонку в порядке текущей ОС
                        const currentOsColumns = this.tableColumns[this.currentOsTab] || this.tableColumns.android;
                        
                        // Находим индексы в текущем порядке
                        const draggedIdx = currentOsColumns.findIndex(c => c.id === draggedId);
                        const targetIdx = currentOsColumns.findIndex(c => c.id === targetId);
                        
                        if (draggedIdx !== -1 && targetIdx !== -1) {
                            // Перемещаем в массиве колонок текущей ОС
                            const [removed] = currentOsColumns.splice(draggedIdx, 1);
                            currentOsColumns.splice(targetIdx, 0, removed);
                            
                            // Обновляем порядок видимых колонок
                            const visibleCols = this.visibleColumns[this.currentOsTab] || [];
                            const newVisibleOrder = currentOsColumns
                                .filter(c => visibleCols.includes(c.id))
                                .map(c => c.id);
                            this.visibleColumns[this.currentOsTab] = newVisibleOrder;
                            
                            this.saveColumnSettings();
                            this.renderAdminDevices();
                        }
                    }
                });
            }
        });

        // Рендерим строки
        let rowsHtml = '';

        if (filteredDevices.length > 0) {
            filteredDevices.forEach(device => {
                rowsHtml += `
                    <tr data-device-id="${device.id}">
                        ${allVisibleCols.map(col => {
                            // Для колонок, не применимых к текущей ОС, показываем "—"
                            if (this.currentOsTab === 'android' && col.id === 'features') {
                                return '<td>—</td>';
                            }
                            if (this.currentOsTab === 'ios' && (col.id === 'gms' || col.id === 'shell')) {
                                return '<td>—</td>';
                            }
                            // Для UDID на Android показываем "—" если пусто
                            if (this.currentOsTab === 'android' && col.id === 'udid' && !device.udid) {
                                return '<td>—</td>';
                            }
                            // Для serial на iOS показываем "—" если пусто
                            if (this.currentOsTab === 'ios' && col.id === 'serial' && !device.serial) {
                                return '<td>—</td>';
                            }
                            return `<td>${this.getTableCellValue(device, col.id)}</td>`;
                        }).join('')}
                    </tr>
                `;
            });
        }

        if (filteredDevices.length === 0) {
            const emptyMessage = this.adminDevicesSearchQuery 
                ? 'Устройства не найдены' 
                : 'Нет устройств';
            rowsHtml = `<tr><td colspan="${allVisibleCols.length}" style="text-align: center; padding: 40px;">${emptyMessage}</td></tr>`;
        }

        tbody.innerHTML = rowsHtml;

        // Добавляем обработчики
        const devicesById = new Map(this.devices.map(device => [device.id, device]));
        tbody.querySelectorAll('tr[data-device-id]').forEach(row => {
            const deviceId = row.dataset.deviceId;
            const device = devicesById.get(deviceId);

            row.querySelector('.btn-edit')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openDeviceModal(device);
            });

            row.querySelector('.btn-delete')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteDevice(deviceId);
            });
        });
    },

    /**
     * Отрисовать карточку одного устройства (для режима автоопределения)
     * @param {Object} device - устройство для отображения
     */
    renderSingleDevice(device) {
        const container = document.getElementById('detected-device-card');
        if (!container || !device) return;

        const user = Auth.getUser();
        const isMyDevice = this.isDeviceOwnedByUser(device, user);
        const isExternal = device.status === DEVICE_STATUS.EXTERNAL;
        const isAvailable = device.status === DEVICE_STATUS.AVAILABLE;
        
        // Иконка ОС
        const osIcon = this.getOsIcon(device.os);
        
        // Статус устройства
        let statusHtml = '';
        if (isAvailable) {
            statusHtml = `
                <div class="status-banner available">
                    <div class="status-dot available"></div>
                    <div class="status-text">
                        <div class="status-title">Устройство свободно</div>
                        <div class="status-subtitle">Можно взять в использование</div>
                    </div>
                </div>
            `;
        } else if (isExternal) {
            const externalDepartment = device.externalDepartment?.trim() || 'Не указано';
            const externalComment = device.externalComment?.trim();
            statusHtml = `
                <div class="status-banner external">
                    <div class="status-dot external"></div>
                    <div class="status-text">
                        <div class="status-title">Устройство вне отдела</div>
                        <div class="status-subtitle">Подразделение: ${externalDepartment}</div>
                        ${externalComment ? `<div class="status-subtitle">${externalComment}</div>` : ''}
                    </div>
                </div>
            `;
        } else {
            const userName = device.currentUserName || 'Пользователь';
            const userPhoto = device.currentUserPhoto || '';
            const bookingType = this.getBookingType(device);
            const isHome = bookingType === BOOKING_TYPES.HOME;
            const location = isHome 
                ? (device.currentUserHomeAddress || 'Дома')
                : (device.currentUserOffice || 'В офисе');
            const actionText = isHome ? 'Забрал домой' : 'Использует';
            
            statusHtml = `
                <div class="status-banner booked">
                    <div class="status-dot booked"></div>
                    <div class="status-text">
                        <div class="status-title">${isMyDevice ? 'У вас' : actionText}</div>
                        <div class="status-subtitle">${location}</div>
                        ${!isMyDevice ? `
                            <div class="booking-user-info">
                                ${userPhoto ? `<img src="${userPhoto}" alt="">` : ''}
                                <span class="user-name">${userName}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        // Детали устройства
        const details = [];
        const screenCharacteristics = this.getDeviceScreenCharacteristics(device);
        if (device.osVersion) details.push({ label: 'Версия ОС', value: device.osVersion });
        if (screenCharacteristics.resolution) details.push({ label: 'Разрешение', value: screenCharacteristics.resolution });
        if (screenCharacteristics.aspectRatio) details.push({ label: 'Соотношение', value: screenCharacteristics.aspectRatio });
        if (screenCharacteristics.ppi) details.push({ label: 'PPI', value: screenCharacteristics.ppi });
        if (device.shell) details.push({ label: 'Оболочка', value: device.shell });
        if (device.serial) details.push({ label: 'Серийный номер', value: device.serial });
        
        const detailsHtml = details.length > 0 ? `
            <div class="device-details-section">
                <div class="details-grid">
                    ${details.map(d => `
                        <div class="detail-item">
                            <span class="detail-label">${d.label}</span>
                            <span class="detail-value">${d.value}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';
        
        // Кнопки действий
        let actionsHtml = '';
        if (isAvailable) {
            actionsHtml = `
                <button class="action-btn primary btn-take" data-device-id="${device.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14"/>
                        <path d="M12 5l7 7-7 7"/>
                    </svg>
                    <span class="btn-text">Использую</span>
                </button>
                <button class="action-btn secondary btn-book" data-device-id="${device.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span class="btn-text">Забрать домой</span>
                </button>
            `;
        } else if (isExternal && Auth.isAdmin) {
            actionsHtml = `
                <button class="action-btn secondary btn-return-from-external" data-device-id="${device.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 10 4 15 9 20"/>
                        <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
                    </svg>
                    <span class="btn-text">Вернуть в отдел</span>
                </button>
            `;
        } else if (isMyDevice) {
            const bookingType = this.getBookingType(device);
            const isHome = bookingType === BOOKING_TYPES.HOME;
            
            // Кнопка смены типа
            const changeTypeBtn = isHome 
                ? `<button class="action-btn secondary btn-return-to-office" data-device-id="${device.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span class="btn-text">Вернуть в офис</span>
                </button>`
                : `<button class="action-btn secondary btn-take-home" data-device-id="${device.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span class="btn-text">Забрать домой</span>
                </button>`;
            
            actionsHtml = `
                ${changeTypeBtn}
                <button class="action-btn secondary btn-edit-date" data-device-id="${device.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span class="btn-text">Изменить дату</span>
                </button>
                <button class="action-btn danger btn-return" data-device-id="${device.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 10 4 15 9 20"/>
                        <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
                    </svg>
                    <span class="btn-text">Вернуть</span>
                </button>
            `;
        }
        
        container.innerHTML = `
            <div class="device-hero">
                <div class="device-icon-large">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        ${device.type === 'tablet' 
                            ? '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>'
                            : '<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/>'
                        }
                    </svg>
                </div>
                <div class="device-name-large">${device.name || 'Устройство'}</div>
                <div class="device-os-large">
                    ${osIcon}
                    <span>${OS_TYPES[device.os]?.label || device.os} ${device.osVersion || ''}</span>
                </div>
            </div>
            <div class="device-status-section">
                ${statusHtml}
            </div>
            ${detailsHtml}
            <div class="device-actions-section">
                ${actionsHtml}
            </div>
        `;
        
        // Добавляем обработчики
        container.querySelector('.btn-take')?.addEventListener('click', () => {
            this.quickTake(device.id);
        });
        
        container.querySelector('.btn-book')?.addEventListener('click', () => {
            this.openBookingModal(device.id);
        });
        
        container.querySelector('.btn-return')?.addEventListener('click', () => {
            this.returnDevice(device.id);
        });

        container.querySelector('.btn-return-from-external')?.addEventListener('click', () => {
            this.returnFromExternal(device.id);
        });
        
        container.querySelector('.btn-edit-date')?.addEventListener('click', () => {
            this.openEditDateModal(device.id);
        });

        // Кнопки смены типа бронирования
        container.querySelector('.btn-take-home')?.addEventListener('click', () => {
            this.takeHomeFromOffice(device.id);
        });

        container.querySelector('.btn-return-to-office')?.addEventListener('click', () => {
            this.returnToOffice(device.id);
        });

        container.querySelector('.btn-confirm-receipt')?.addEventListener('click', () => {
            this.confirmReceipt(device.id);
        });
    },

    /**
     * Отрисовать список подходящих устройств для выбора
     * @param {Array} matchedDevices - массив похожих устройств (с высоким score)
     * @param {Array} otherDevices - массив остальных устройств той же ОС
     */
    renderDeviceSelection(matchedDevices, otherDevices = []) {
        const grid = document.getElementById('device-selection-grid');
        const hint = document.getElementById('device-selection-hint');
        
        if (!grid) return;
        
        const totalCount = matchedDevices.length + otherDevices.length;
        
        if (hint) {
            if (matchedDevices.length > 0) {
                hint.textContent = `Найдено ${matchedDevices.length} похожих устройств`;
            } else {
                hint.textContent = `Найдено ${totalCount} устройств`;
            }
        }
        
        // Создаём карточки: сначала похожие с бейджем, потом остальные
        const matchedCards = matchedDevices.map(device => 
            this.createDeviceCard(device, { showMatchBadge: true })
        ).join('');
        
        const otherCards = otherDevices.map(device => 
            this.createDeviceCard(device, { showMatchBadge: false })
        ).join('');
        
        grid.innerHTML = matchedCards + otherCards;
        
        // Объединяем все устройства для поиска
        const allDevices = [...matchedDevices, ...otherDevices];
        const allDevicesById = new Map(allDevices.map(device => [device.id, device]));
        
        // Добавляем обработчики событий
        grid.querySelectorAll('.device-card').forEach(card => {
            const deviceId = card.dataset.deviceId;
            const device = allDevicesById.get(deviceId);
            
            // Клик по карточке - показать карточку одного устройства
            card.addEventListener('click', () => {
                if (device) {
                    App.showDetectedDevice(device);
                }
            });
            
            card.querySelector('.btn-take')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.quickTake(deviceId);
            });

            card.querySelector('.btn-return')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.returnDevice(deviceId);
            });

            card.querySelector('.btn-edit-date')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openEditDateModal(deviceId);
            });

            card.querySelector('.btn-book')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.openBookingModal(deviceId);
            });

            // Кнопки смены типа бронирования
            card.querySelector('.btn-take-home')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.takeHomeFromOffice(deviceId);
            });

            card.querySelector('.btn-return-to-office')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.returnToOffice(deviceId);
            });

            card.querySelector('.btn-confirm-receipt')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.confirmReceipt(deviceId);
            });

            card.querySelector('.history-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openDeviceHistory(deviceId);
            });

            // Кнопка календаря
            card.querySelector('.calendar-btn')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.openDeviceCalendar(deviceId);
            });
        });
    },

    /**
     * Получить иконку ОС
     */
    getOsIcon(os) {
        if (os === 'ios' || os === 'ipados') {
            return `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>`;
        } else {
            return `<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M17.523 15.341c-.5 0-.919.177-1.265.532-.347.354-.52.791-.52 1.31 0 .52.173.956.52 1.31.346.355.766.532 1.265.532.499 0 .918-.177 1.264-.532.347-.354.52-.79.52-1.31 0-.519-.173-.956-.52-1.31-.346-.355-.765-.532-1.264-.532zM6.477 15.341c-.499 0-.918.177-1.264.532-.347.354-.52.791-.52 1.31 0 .52.173.956.52 1.31.346.355.765.532 1.264.532s.919-.177 1.265-.532c.347-.354.52-.79.52-1.31 0-.519-.173-.956-.52-1.31-.346-.355-.766-.532-1.265-.532zM21.708 10.636l-1.549-2.727c-.165-.293-.385-.533-.66-.72-.276-.187-.576-.28-.9-.28h-1.29l.884-3.54c.055-.22.027-.43-.083-.63-.11-.2-.27-.34-.48-.42-.21-.08-.42-.05-.63.09-.21.14-.35.33-.42.57l-.96 3.93H8.38l-.96-3.93c-.07-.24-.21-.43-.42-.57-.21-.14-.42-.17-.63-.09-.21.08-.37.22-.48.42-.11.2-.138.41-.083.63l.884 3.54h-1.29c-.324 0-.624.093-.9.28-.275.187-.495.427-.66.72L3.292 10.636c-.165.294-.22.611-.165.952.055.34.22.622.495.846l2.878 2.341v5.198c0 .354.124.654.371.9.248.247.547.37.9.37h8.457c.354 0 .653-.123.9-.37.247-.246.37-.546.37-.9v-5.198l2.879-2.341c.275-.224.44-.506.495-.846.055-.341 0-.658-.164-.952z"/>
            </svg>`;
        }
    }
});
