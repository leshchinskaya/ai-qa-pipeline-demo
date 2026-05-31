/**
 * Devices Booking Module
 * Логика бронирования: взять в офисе, взять домой, вернуть, изменить дату
 *
 * Этот файл расширяет объект Devices методами для бронирования.
 * Должен загружаться ПОСЛЕ devices.js.
 */
Object.assign(Devices, {
    /**
     * Настройка модального окна "Использую" для общего аккаунта
     */
    setupTakeModal() {
        const modal = document.getElementById('take-user-modal');
        const form = document.getElementById('take-form');
        const closeModal = () => {
            this.takeModalTargetUserId = '';
            this.takeModalTargetUserName = '';
            modal.classList.add('hidden');
        };

        if (!modal || !form) return;

        // Обработка отправки формы
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleTakeWithUser();
        });

        // Закрытие модального окна
        modal.querySelector('.modal-close')?.addEventListener('click', closeModal);
        modal.querySelector('.modal-cancel')?.addEventListener('click', closeModal);
        modal.querySelector('.modal-overlay')?.addEventListener('click', closeModal);
    },

    /**
     * Обработка "Использую" с выбором пользователя (для общего аккаунта)
     */
    async handleTakeWithUser() {
        const currentUser = Auth.getUser();
        if (!currentUser || !this.selectedDevice) return;
        const deviceId = this.selectedDevice.id;

        const selectedUserId = document.getElementById('take-user')?.value;
        const targetUserId = Auth.isSharedAccount() ? selectedUserId : (this.takeModalTargetUserId || currentUser.uid);

        if (!targetUserId) {
            Toast.show('Выберите пользователя', 'warning');
            return;
        }

        const selectedUser = targetUserId === currentUser.uid && !Auth.isSharedAccount()
            ? {
                id: currentUser.uid,
                displayName: currentUser.displayName || currentUser.email,
                email: currentUser.email,
                photoURL: currentUser.photoURL,
                office: Auth.userProfile?.office || ''
            }
            : (() => {
                if (typeof Users === 'undefined') return null;
                return Users.getUserById(targetUserId);
            })();

        if (!selectedUser) {
            Toast.show('Пользователь не найден', 'error');
            return;
        }

        const targetUser = {
            uid: selectedUser.id,
            displayName: selectedUser.displayName || selectedUser.email,
            photoURL: selectedUser.photoURL
        };

        const selectedProjectIds = this.getSelectedProjectIds('take-project-select');
        const projectSelection = this.getTargetProjectSelection(targetUser.uid, selectedProjectIds);
        if (projectSelection.required && !projectSelection.context) {
            Toast.show('Выберите хотя бы один проект', 'warning');
            return;
        }
        const projectContext = projectSelection.context;

        if (!this.beginDeviceAction(deviceId)) {
            return;
        }

        let previousDevice = null;

        try {
            // Получаем данные профиля пользователя
            let userOffice = selectedUser.office || '';
            previousDevice = { ...this.selectedDevice };
            this.preserveCurrentMainListOrder();
            this.applyLocalDevicePatch(deviceId, {
                status: DEVICE_STATUS.BOOKED,
                bookingType: BOOKING_TYPES.OFFICE,
                currentUserId: targetUser.uid,
                currentUserName: targetUser.displayName,
                currentUserPhoto: targetUser.photoURL,
                currentUserOffice: userOffice,
                currentUserHomeAddress: '',
                bookedAt: new Date(),
                bookedUntil: null,
                currentProjectIds: projectContext?.projectIds || null,
                currentProjectCodes: projectContext?.projectCodes || null,
                currentProjectNames: projectContext?.projectNames || null,
                currentProjectId: projectContext?.projectId || null,
                currentProjectCode: projectContext?.projectCode || null,
                currentProjectName: projectContext?.projectName || null,
                pendingReceipt: null,
                bookedBy: null,
                bookedByName: null,
                bookedFor: null
            });
            
            // Обновляем устройство
            await db.collection(COLLECTIONS.DEVICES).doc(deviceId).update({
                status: DEVICE_STATUS.BOOKED,
                bookingType: BOOKING_TYPES.OFFICE,  // Использую в офисе
                currentUserId: targetUser.uid,
                currentUserName: targetUser.displayName,
                currentUserPhoto: targetUser.photoURL,
                currentUserOffice: userOffice,
                currentUserHomeAddress: '',
                bookedAt: firebase.firestore.FieldValue.serverTimestamp(),
                bookedUntil: null,
                currentProjectIds: projectContext?.projectIds || null,
                currentProjectCodes: projectContext?.projectCodes || null,
                currentProjectNames: projectContext?.projectNames || null,
                currentProjectId: projectContext?.projectId || null,
                currentProjectCode: projectContext?.projectCode || null,
                currentProjectName: projectContext?.projectName || null
            });

            // Записываем в историю
            await this.addBookingRecord(
                deviceId, 
                this.selectedDevice.name, 
                BOOKING_ACTIONS.TAKE,
                null,
                null,
                targetUser,
                userOffice,
                null,
                null,
                projectContext
            );

            Toast.show(`Устройство "${this.selectedDevice.name}" взято для ${targetUser.displayName}`, 'success');
            this.takeModalTargetUserId = '';
            this.takeModalTargetUserName = '';
            document.getElementById('take-user-modal').classList.add('hidden');
        } catch (error) {
            if (previousDevice) {
                this.setLocalDevice(previousDevice);
            }
            console.error('Error taking device:', error);
            Toast.show('Ошибка: ' + error.message, 'error');
        } finally {
            this.endDeviceAction(deviceId);
        }
    },

    /**
     * Возврат устройства
     */
    async returnDevice(deviceId, options = {}) {
        const { silent = false } = options;
        const user = Auth.getUser();
        if (!user) return false;

        if (!this.beginDeviceAction(deviceId)) {
            return false;
        }

        let previousDevice = null;

        try {
            const device = this.getDeviceById(deviceId);
            // Админ может вернуть любое устройство, обычный пользователь - только своё
            if (!device || (!this.isDeviceOwnedByUser(device, user) && !Auth.isAdmin)) {
                if (!silent) {
                    Toast.show('Вы не можете вернуть это устройство', 'error');
                }
                return false;
            }

            if (device.status !== DEVICE_STATUS.BOOKED) {
                if (!silent) {
                    Toast.show('Возврат доступен только для занятых устройств', 'warning');
                }
                return false;
            }

            previousDevice = { ...device };
            const projectContext = this.getDeviceProjectContext(device);
            this.preserveCurrentMainListOrder();
            this.applyLocalDevicePatch(deviceId, {
                status: DEVICE_STATUS.AVAILABLE,
                bookingType: null,
                currentUserId: null,
                currentUserName: null,
                currentUserPhoto: null,
                currentUserOffice: null,
                currentUserHomeAddress: null,
                bookedAt: null,
                bookedUntil: null,
                currentProjectIds: null,
                currentProjectCodes: null,
                currentProjectNames: null,
                currentProjectId: null,
                currentProjectCode: null,
                currentProjectName: null,
                pendingReceipt: null,
                bookedBy: null,
                bookedByName: null,
                bookedFor: null
            });

            // Обновляем устройство
            await db.collection(COLLECTIONS.DEVICES).doc(deviceId).update({
                status: DEVICE_STATUS.AVAILABLE,
                bookingType: null,  // Сбрасываем тип бронирования
                currentUserId: null,
                currentUserName: null,
                currentUserPhoto: null,
                currentUserOffice: null,
                currentUserHomeAddress: null,
                bookedAt: null,
                bookedUntil: null,
                currentProjectIds: null,
                currentProjectCodes: null,
                currentProjectNames: null,
                currentProjectId: null,
                currentProjectCode: null,
                currentProjectName: null
            });

            // Записываем в историю
            await this.addBookingRecord(deviceId, device.name, BOOKING_ACTIONS.RETURN, null, null, null, null, null, null, projectContext);

            if (!silent) {
                Toast.show(`Устройство "${device.name}" возвращено`, 'success');
            }
            return true;
        } catch (error) {
            if (previousDevice) {
                this.setLocalDevice(previousDevice);
            }
            console.error('Error returning device:', error);
            if (!silent) {
                Toast.show('Ошибка: ' + error.message, 'error');
            }
            return false;
        } finally {
            this.endDeviceAction(deviceId);
        }
    },

    /**
     * Вернуть устройство из статуса "Вне отдела" обратно в отдел
     */
    async returnFromExternal(deviceId) {
        if (!Auth.isAdmin) {
            Toast.show('Только администратор может вернуть устройство в отдел', 'error');
            return;
        }

        const device = this.devices.find(d => d.id === deviceId);
        if (!device || device.status !== DEVICE_STATUS.EXTERNAL) {
            Toast.show('Устройство не находится в статусе "Вне отдела"', 'warning');
            return;
        }

        const confirmed = confirm(`Вернуть устройство "${device.name}" в отдел?`);
        if (!confirmed) {
            return;
        }

        let previousDevice = null;

        try {
            previousDevice = { ...device };
            this.preserveCurrentMainListOrder();
            this.applyLocalDevicePatch(deviceId, {
                status: DEVICE_STATUS.AVAILABLE,
                externalDepartment: null,
                externalComment: null,
                externalUpdatedAt: new Date(),
                externalUpdatedBy: null,
                externalUpdatedByName: null,
                bookingType: null,
                currentUserId: null,
                currentUserName: null,
                currentUserPhoto: null,
                currentUserOffice: null,
                currentUserHomeAddress: null,
                currentProjectIds: null,
                currentProjectCodes: null,
                currentProjectNames: null,
                currentProjectId: null,
                currentProjectCode: null,
                currentProjectName: null,
                bookedAt: null,
                bookedUntil: null,
                pendingReceipt: null,
                bookedBy: null,
                bookedByName: null,
                bookedFor: null,
                updatedAt: new Date()
            });
            await db.collection(COLLECTIONS.DEVICES).doc(deviceId).update({
                status: DEVICE_STATUS.AVAILABLE,
                externalDepartment: null,
                externalComment: null,
                externalUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                externalUpdatedBy: null,
                externalUpdatedByName: null,
                bookingType: null,
                currentUserId: null,
                currentUserName: null,
                currentUserPhoto: null,
                currentUserOffice: null,
                currentUserHomeAddress: null,
                currentProjectIds: null,
                currentProjectCodes: null,
                currentProjectNames: null,
                currentProjectId: null,
                currentProjectCode: null,
                currentProjectName: null,
                bookedAt: null,
                bookedUntil: null,
                pendingReceipt: null,
                bookedBy: null,
                bookedByName: null,
                bookedFor: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            Toast.show(`Устройство "${device.name}" возвращено в отдел`, 'success');
        } catch (error) {
            if (previousDevice) {
                this.setLocalDevice(previousDevice);
            }
            console.error('Error returning external device:', error);
            Toast.show('Ошибка: ' + error.message, 'error');
        }
    },

    /**
     * Массовый возврат всех устройств текущего пользователя
     */
    async returnAllMyDevices() {
        const user = Auth.getUser();
        if (!user) return;

        const myDevices = this.getMyBookedDevices(user);
        if (myDevices.length === 0) {
            Toast.show('У вас нет устройств для возврата', 'warning');
            this.updateReturnAllBtn();
            return;
        }

        const confirmed = confirm(`Вернуть все устройства (${myDevices.length})?`);
        if (!confirmed) {
            return;
        }

        this.isBulkReturnInProgress = true;
        this.updateReturnAllBtn();

        let successCount = 0;

        try {
            for (const device of myDevices) {
                const returned = await this.returnDevice(device.id, { silent: true });
                if (returned) {
                    successCount += 1;
                }
            }
        } finally {
            this.isBulkReturnInProgress = false;
            this.updateReturnAllBtn();
        }

        const failedCount = myDevices.length - successCount;
        if (successCount > 0 && failedCount === 0) {
            Toast.show(`Возвращено устройств: ${successCount}`, 'success');
        } else if (successCount > 0) {
            Toast.show(`Возвращено устройств: ${successCount}. Ошибок: ${failedCount}`, 'warning');
        } else {
            Toast.show('Не удалось вернуть устройства', 'error');
        }
    },

    /**
     * Открыть модальное окно бронирования
     */
    async openBookingModal(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        this.selectedDevice = device;
        this.bookingProjectContextLocked = null;

        const modal = document.getElementById('booking-modal');
        const deviceInfo = document.getElementById('booking-device-info');
        const userSelectGroup = document.getElementById('booking-user-select');
        const userSelect = document.getElementById('booking-user');
        const projectSelectGroup = document.getElementById('booking-project-select-group');
        
        deviceInfo.innerHTML = `
            <div class="booking-device-icon">
                ${this.getDeviceIcon(device.type)}
            </div>
            <div class="booking-device-details">
                <h4>${device.name}</h4>
                <p>${DEVICE_TYPES[device.type]?.label || device.type}${device.os ? ' • ' + (OS_TYPES[device.os]?.label || device.os) : ''}</p>
            </div>
        `;

        // Показываем выбор пользователя для админов или общего аккаунта (qatest@test.dev)
        // Но только если фича-флаг включен
        const isBookForOthersEnabled = typeof FeatureFlags !== 'undefined' && FeatureFlags.isEnabled('bookForOthers');
        const showUserSelect = (Auth.isAdmin || Auth.isSharedAccount()) && isBookForOthersEnabled;
        const isShared = Auth.isSharedAccount();
        
        if (showUserSelect && userSelectGroup) {
            const usersModuleReady = await this.ensureUsersModuleLoaded();
            if (!usersModuleReady || typeof Users === 'undefined') {
                Toast.show('Модуль пользователей не загружен', 'error');
                return;
            }

            userSelectGroup.classList.remove('hidden');
            // Загружаем пользователей если ещё не загружены
            if (Users.users.length === 0) {
                Users.loadUsers().catch(() => {
                    Toast.show('Не удалось загрузить список пользователей', 'error');
                });
            } else {
                Users.updateBookingUserSelect();
            }
        } else if (userSelectGroup) {
            userSelectGroup.classList.add('hidden');
        }
        
        // Показываем/скрываем подсказку и маркер обязательности для общего аккаунта
        const userHint = document.getElementById('booking-user-hint');
        const userRequired = document.getElementById('booking-user-required');
        if (userHint) {
            userHint.classList.toggle('hidden', !isShared);
        }
        if (userRequired) {
            userRequired.classList.toggle('hidden', !isShared);
        }
        
        // Сбрасываем выбор пользователя
        if (userSelect) {
            userSelect.value = '';
        }
        const userLabel = document.getElementById('booking-user-label');
        if (userLabel) {
            // Для общего аккаунта нельзя бронировать на себя
            userLabel.textContent = isShared ? 'Выберите пользователя' : 'Для себя';
        }
        const userSearch = document.getElementById('booking-user-search');
        if (userSearch) {
            userSearch.value = '';
        }

        if (!this.isProjectContextEnabled()) {
            projectSelectGroup?.classList.add('hidden');
        } else if (Auth.isSharedAccount()) {
            projectSelectGroup?.classList.add('hidden');
        } else {
            await this.handleBookingTargetUserChange('booking', Auth.getUser()?.uid || '');
        }

        // Устанавливаем даты
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Дата окончания = сегодня + 1 день
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 1);
        const endDateStr = endDate.toISOString().split('T')[0];
        
        document.getElementById('end-date').min = todayStr;
        document.getElementById('end-date').value = endDateStr;

        modal.classList.remove('hidden');
    },

    /**
     * Настройка модального окна бронирования
     */
    setupBookingModal() {
        const modal = document.getElementById('booking-modal');
        const form = document.getElementById('booking-form');
        const closeModal = () => {
            this.bookingProjectContextLocked = null;
            modal.classList.add('hidden');
        };

        // Обработка отправки формы
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleBooking();
        });

        // Закрытие модального окна
        modal.querySelector('.modal-close').addEventListener('click', closeModal);
        modal.querySelector('.modal-cancel').addEventListener('click', closeModal);
        modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
    },

    /**
     * Обработка бронирования (Забрать домой)
     */
    async handleBooking() {
        const currentUser = Auth.getUser();
        if (!currentUser || !this.selectedDevice) return;
        const deviceId = this.selectedDevice.id;

        // Проверяем, это смена типа (office → home) или новое бронирование
        const isChangingType = this._isChangingToHome === true;
        this._isChangingToHome = false;  // Сбрасываем флаг

        const selectedUserId = document.getElementById('booking-user')?.value;
        const canBookForOthers = (Auth.isAdmin || Auth.isSharedAccount()) && !!selectedUserId;
        let usersCache = [];
        
        // Для общего аккаунта обязательно выбрать пользователя (если не смена типа)
        if (!isChangingType && Auth.isSharedAccount() && !selectedUserId) {
            Toast.show('Выберите пользователя для бронирования', 'warning');
            return;
        }

        if (canBookForOthers) {
            const usersModuleReady = await this.ensureUsersModuleLoaded();
            if (!usersModuleReady || typeof Users === 'undefined') {
                Toast.show('Модуль пользователей не загружен', 'error');
                return;
            }
            usersCache = Users.users;
        } else if (typeof Users !== 'undefined') {
            usersCache = Users.users;
        }
        
        // Определяем, для кого бронируем
        let targetUser;
        let isBookingForOther = false;
        
        if (isChangingType) {
            // При смене типа сохраняем текущего пользователя устройства
            targetUser = {
                uid: this.selectedDevice.currentUserId,
                displayName: this.selectedDevice.currentUserName,
                photoURL: this.selectedDevice.currentUserPhoto
            };
        } else {
            targetUser = {
                uid: currentUser.uid,
                displayName: this.resolveDisplayName(currentUser),
                photoURL: currentUser.photoURL
            };

            // Если админ или общий аккаунт выбрал другого пользователя
            if (canBookForOthers) {
                // Проверяем фича-флаг
                if (typeof FeatureFlags !== 'undefined' && !FeatureFlags.isEnabled('bookForOthers')) {
                    Toast.show('Бронирование на других пользователей отключено', 'error');
                    return;
                }
                
                const selectedUser = typeof Users !== 'undefined' ? Users.getUserById(selectedUserId) : null;
                if (selectedUser) {
                    // Проверяем, что это действительно другой пользователь
                    if (selectedUser.id !== currentUser.uid) {
                        isBookingForOther = true;
                        targetUser = {
                            uid: selectedUser.id,
                            displayName: selectedUser.displayName || selectedUser.email,
                            photoURL: selectedUser.photoURL
                        };
                    }
                }
            }
        }

        const selectedProjectIds = this.getSelectedProjectIds('booking-project-select');
        const projectSelection = this.bookingProjectContextLocked
            ? { context: this.bookingProjectContextLocked, required: false }
            : this.getTargetProjectSelection(targetUser.uid, selectedProjectIds);

        if (projectSelection.required && !projectSelection.context) {
            Toast.show('Выберите хотя бы один проект', 'warning');
            return;
        }

        const projectContext = projectSelection.context;

        if (!this.beginDeviceAction(deviceId)) {
            return;
        }

        let previousDevice = null;

        try {
            const endDateStr = document.getElementById('end-date').value;

            if (!endDateStr) {
                Toast.show('Укажите дату возврата', 'warning');
                return;
            }

            // Дата начала всегда сегодня
            const startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(endDateStr);

            if (endDate < startDate) {
                Toast.show('Дата возврата должна быть после даты начала', 'warning');
                return;
            }

            // Получаем данные профиля пользователя
            let userOffice = '';
            let userHomeAddress = '';
            
            if (targetUser.uid === Auth.getUser()?.uid) {
                // Для себя - берём из Auth
                userOffice = Auth.userProfile?.office || '';
                userHomeAddress = Auth.userProfile?.homeAddress || '';
            } else {
                // Для другого пользователя - получаем из Firestore
                // Сначала пытаемся получить из загруженных пользователей
                const userData = usersCache.find(u => u.id === targetUser.uid);
                if (userData) {
                    userOffice = userData.office || '';
                    userHomeAddress = userData.homeAddress || '';
                } else {
                    // Если пользователь не найден в списке, загружаем напрямую из Firestore
                    try {
                        const userDoc = await db.collection(COLLECTIONS.USERS).doc(targetUser.uid).get();
                        if (userDoc.exists) {
                            const userDocData = userDoc.data();
                            userOffice = userDocData.office || '';
                            userHomeAddress = userDocData.homeAddress || '';
                        }
                    } catch (error) {
                        console.warn('Не удалось загрузить данные профиля пользователя:', error);
                    }
                }
            }

            previousDevice = { ...this.selectedDevice };
            this.preserveCurrentMainListOrder();
            this.applyLocalDevicePatch(deviceId, {
                status: DEVICE_STATUS.BOOKED,
                bookingType: BOOKING_TYPES.HOME,
                currentUserId: targetUser.uid,
                currentUserName: targetUser.displayName,
                currentUserPhoto: targetUser.photoURL,
                currentUserOffice: userOffice,
                currentUserHomeAddress: userHomeAddress,
                bookedAt: new Date(),
                bookedUntil: endDate,
                currentProjectIds: projectContext?.projectIds || null,
                currentProjectCodes: projectContext?.projectCodes || null,
                currentProjectNames: projectContext?.projectNames || null,
                currentProjectId: projectContext?.projectId || null,
                currentProjectCode: projectContext?.projectCode || null,
                currentProjectName: projectContext?.projectName || null,
                pendingReceipt: isBookingForOther,
                bookedBy: isBookingForOther ? currentUser.uid : null,
                bookedByName: isBookingForOther ? this.resolveDisplayName(currentUser) : null,
                bookedFor: isBookingForOther ? targetUser.uid : null
            });

            const updateData = {
                status: DEVICE_STATUS.BOOKED,
                bookingType: BOOKING_TYPES.HOME,  // Взято домой
                currentUserId: targetUser.uid,
                currentUserName: targetUser.displayName,
                currentUserPhoto: targetUser.photoURL,
                currentUserOffice: userOffice,
                currentUserHomeAddress: userHomeAddress,
                bookedAt: firebase.firestore.FieldValue.serverTimestamp(),
                bookedUntil: firebase.firestore.Timestamp.fromDate(endDate),
                currentProjectIds: projectContext?.projectIds || null,
                currentProjectCodes: projectContext?.projectCodes || null,
                currentProjectNames: projectContext?.projectNames || null,
                currentProjectId: projectContext?.projectId || null,
                currentProjectCode: projectContext?.projectCode || null,
                currentProjectName: projectContext?.projectName || null
            };

            // Если бронируем на другого пользователя, устанавливаем флаг ожидания подтверждения
            if (isBookingForOther) {
                updateData.pendingReceipt = true;
                updateData.bookedBy = currentUser.uid;
                updateData.bookedByName = this.resolveDisplayName(currentUser);
                updateData.bookedFor = targetUser.uid;
            }

            // Обновляем устройство
            await db.collection(COLLECTIONS.DEVICES).doc(deviceId).update(updateData);

            this.bookingProjectContextLocked = null;
            document.getElementById('booking-modal').classList.add('hidden');
            Toast.show(`Устройство "${this.selectedDevice.name}" забрано домой`, 'success');

            // Записываем в историю
            if (isBookingForOther) {
                // Если бронируем на другого пользователя - записываем действие TRANSFERRED с информацией о передавшем
                const currentUser = Auth.getUser();
                await db.collection(COLLECTIONS.BOOKINGS).add({
                    deviceId: deviceId,
                    deviceName: this.selectedDevice.name,
                    deviceOsVersion: this.selectedDevice.osVersion || null,
                    userId: targetUser.uid,
                    userName: targetUser.displayName,
                    userPhoto: targetUser.photoURL,
                    action: BOOKING_ACTIONS.TRANSFERRED,
                    startDate: firebase.firestore.Timestamp.fromDate(startDate),
                    endDate: firebase.firestore.Timestamp.fromDate(endDate),
                    office: userOffice || null,
                    homeAddress: userHomeAddress || null,
                    bookingType: BOOKING_TYPES.HOME,
                    transferredBy: currentUser.uid,
                    transferredByName: this.resolveDisplayName(currentUser),
                    transferredByPhoto: currentUser.photoURL,
                    projectIds: projectContext?.projectIds || null,
                    projectCodes: projectContext?.projectCodes || null,
                    projectNames: projectContext?.projectNames || null,
                    projectId: projectContext?.projectId || null,
                    projectCode: projectContext?.projectCode || null,
                    projectName: projectContext?.projectName || null,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                await this.addBookingRecord(
                    this.selectedDevice.id, 
                    this.selectedDevice.name, 
                    BOOKING_ACTIONS.BOOK,
                    startDate,
                    endDate,
                    targetUser,
                    userOffice,
                    userHomeAddress,
                    null,
                    projectContext
                );
            }
        } catch (error) {
            if (previousDevice) {
                this.setLocalDevice(previousDevice);
            }
            console.error('Error booking device:', error);
            Toast.show('Ошибка: ' + error.message, 'error');
        } finally {
            this.endDeviceAction(deviceId);
        }
    },

    /**
     * Забрать домой устройство, которое уже используется в офисе
     * Открывает модальное окно для указания даты возврата
     */
    takeHomeFromOffice(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        // Используем существующее модальное окно бронирования
        this.selectedDevice = device;

        const modal = document.getElementById('booking-modal');
        const deviceInfo = document.getElementById('booking-device-info');
        const bookingUserSelect = document.getElementById('booking-user-select');
        const projectSelectGroup = document.getElementById('booking-project-select-group');

        deviceInfo.innerHTML = `
            <div class="booking-device-icon">
                ${this.getDeviceIcon(device.type)}
            </div>
            <div class="booking-device-details">
                <h4>${device.name}</h4>
                <p>Сменить статус: "Использую" → "Взято домой"</p>
            </div>
        `;

        // Скрываем выбор пользователя (устройство уже за текущим пользователем)
        if (bookingUserSelect) {
            bookingUserSelect.classList.add('hidden');
        }
        if (projectSelectGroup) {
            projectSelectGroup.classList.add('hidden');
        }
        this.bookingProjectContextLocked = this.getDeviceProjectContext(device);

        // Устанавливаем минимальную дату - сегодня
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        document.getElementById('end-date').min = todayStr;
        
        // Устанавливаем дату по умолчанию: завтра
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 1);
        document.getElementById('end-date').value = endDate.toISOString().split('T')[0];

        // Меняем заголовок модального окна
        const modalHeader = modal.querySelector('.modal-header h3');
        if (modalHeader) {
            modalHeader.textContent = 'Забрать домой';
        }

        // Помечаем что это смена типа, а не новое бронирование
        this._isChangingToHome = true;

        modal.classList.remove('hidden');
    },

    /**
     * Вернуть устройство в офис (сменить статус home → office)
     */
    async returnToOffice(deviceId) {
        const user = Auth.getUser();
        if (!user) return;

        const device = this.devices.find(d => d.id === deviceId);
        if (!device) {
            Toast.show('Устройство не найдено', 'error');
            return;
        }

        // Проверяем, что устройство принадлежит текущему пользователю
        if (!this.isDeviceOwnedByUser(device, user) && !Auth.isAdmin) {
            Toast.show('Это не ваше устройство', 'error');
            return;
        }

        let previousDevice = null;

        try {
            previousDevice = { ...device };
            this.preserveCurrentMainListOrder();
            const projectContext = this.getDeviceProjectContext(device);
            this.applyLocalDevicePatch(deviceId, {
                bookingType: BOOKING_TYPES.OFFICE,
                bookedUntil: null,
                currentUserOffice: Auth.userProfile?.office || device.currentUserOffice || '',
                updatedAt: new Date()
            });
            // Обновляем устройство: меняем тип на офис, сбрасываем дату
            await db.collection(COLLECTIONS.DEVICES).doc(deviceId).update({
                bookingType: BOOKING_TYPES.OFFICE,
                bookedUntil: null,  // Сбрасываем дату возврата
                currentUserOffice: Auth.userProfile?.office || device.currentUserOffice || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Записываем в историю как "Использую" (тот же статус что и при взятии в офисе)
            await this.addBookingRecord(
                deviceId, 
                device.name, 
                BOOKING_ACTIONS.TAKE,
                null,
                null,
                null,
                Auth.userProfile?.office || '',
                null,
                null,
                projectContext
            );

            Toast.show(`Устройство "${device.name}" возвращено в офис`, 'success');
        } catch (error) {
            if (previousDevice) {
                this.setLocalDevice(previousDevice);
            }
            console.error('Error returning to office:', error);
            Toast.show('Ошибка: ' + error.message, 'error');
        }
    },

    /**
     * Подтвердить получение устройства
     * Вызывается когда пользователь, на которого забронировано устройство, подтверждает получение
     */
    async confirmReceipt(deviceId) {
        const user = Auth.getUser();
        if (!user) return;

        let previousDevice = null;

        try {
            const device = this.devices.find(d => d.id === deviceId);
            if (!device) {
                Toast.show('Устройство не найдено', 'error');
                return;
            }

            // Проверяем, что устройство ожидает подтверждения и текущий пользователь - тот, на кого забронировано
            if (!device.pendingReceipt || device.bookedFor !== user.uid) {
                Toast.show('Вы не можете подтвердить получение этого устройства', 'error');
                return;
            }

            // Получаем данные профиля пользователя
            let userOffice = '';
            let userHomeAddress = '';
            
            // Для текущего пользователя - берём из Auth
            userOffice = Auth.userProfile?.office || '';
            userHomeAddress = Auth.userProfile?.homeAddress || '';

            // Получаем даты из устройства
            const bookedAt = device.bookedAt?.toDate ? device.bookedAt.toDate() : (device.bookedAt ? new Date(device.bookedAt) : new Date());
            const bookedUntil = device.bookedUntil?.toDate ? device.bookedUntil.toDate() : (device.bookedUntil ? new Date(device.bookedUntil) : null);
            
            // Устанавливаем время начала на начало дня
            const startDate = new Date(bookedAt);
            startDate.setHours(0, 0, 0, 0);

            previousDevice = { ...device };
            const projectContext = this.getDeviceProjectContext(device);
            this.preserveCurrentMainListOrder();
            this.applyLocalDevicePatch(deviceId, {
                pendingReceipt: false,
                currentUserOffice: userOffice,
                currentUserHomeAddress: userHomeAddress,
                bookedBy: null,
                bookedByName: null,
                bookedFor: null
            });
            
            // Обновляем устройство: снимаем флаг ожидания подтверждения
            await db.collection(COLLECTIONS.DEVICES).doc(deviceId).update({
                pendingReceipt: false,
                currentUserOffice: userOffice,
                currentUserHomeAddress: userHomeAddress,
                // Очищаем поля bookedBy, bookedByName, bookedFor так как они больше не нужны
                bookedBy: null,
                bookedByName: null,
                bookedFor: null
            });

            // Записываем в историю подтверждение получения с датами и адресом
            await db.collection(COLLECTIONS.BOOKINGS).add({
                deviceId: deviceId,
                deviceName: device.name,
                deviceOsVersion: device.osVersion || null,
                userId: user.uid,
                userName: this.resolveDisplayName(user),
                userPhoto: user.photoURL,
                action: BOOKING_ACTIONS.RECEIPT_CONFIRMED,
                startDate: firebase.firestore.Timestamp.fromDate(startDate),
                endDate: bookedUntil ? firebase.firestore.Timestamp.fromDate(bookedUntil) : null,
                office: null,
                homeAddress: userHomeAddress || 'Дома',
                bookingType: BOOKING_TYPES.HOME,
                projectIds: projectContext?.projectIds || null,
                projectCodes: projectContext?.projectCodes || null,
                projectNames: projectContext?.projectNames || null,
                projectId: projectContext?.projectId || null,
                projectCode: projectContext?.projectCode || null,
                projectName: projectContext?.projectName || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            Toast.show(`Получение устройства "${device.name}" подтверждено`, 'success');
        } catch (error) {
            if (previousDevice) {
                this.setLocalDevice(previousDevice);
            }
            console.error('Error confirming receipt:', error);
            Toast.show('Ошибка: ' + error.message, 'error');
        }
    },

    /**
     * Настройка модального окна редактирования даты
     */
    setupEditDateModal() {
        const modal = document.getElementById('edit-date-modal');
        const form = document.getElementById('edit-date-form');

        if (!modal || !form) return;

        // Обработка отправки формы
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleEditDate();
        });

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
     * Открыть модальное окно редактирования даты
     */
    openEditDateModal(deviceId) {
        const device = this.devices.find(d => d.id === deviceId);
        if (!device) return;

        this.selectedDevice = device;

        const modal = document.getElementById('edit-date-modal');
        const deviceInfo = document.getElementById('edit-date-device-info');
        const dateInput = document.getElementById('new-end-date');

        const currentBookedUntil = this.getDeviceDateValue(device.bookedUntil);

        deviceInfo.innerHTML = `
            <div class="booking-device-icon">
                ${this.getDeviceIcon(device.type)}
            </div>
            <div class="booking-device-details">
                <h4>${device.name}</h4>
                <p>${currentBookedUntil ? 'Текущая дата возврата: ' + this.formatDate(currentBookedUntil) : 'Дата возврата не установлена'}</p>
            </div>
        `;

        // Устанавливаем минимальную дату - сегодня
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        dateInput.min = todayStr;

        // Если есть текущая дата, устанавливаем её, иначе +2 дня
        if (currentBookedUntil) {
            const currentDate = currentBookedUntil;
            dateInput.value = currentDate.toISOString().split('T')[0];
        } else {
            const defaultDate = new Date(today);
            defaultDate.setDate(defaultDate.getDate() + 2);
            dateInput.value = defaultDate.toISOString().split('T')[0];
        }

        modal.classList.remove('hidden');
    },

    /**
     * Обработка изменения даты
     * Важно: НЕ меняет bookingType, только дату возврата
     */
    async handleEditDate() {
        const currentUser = Auth.getUser();
        if (!currentUser || !this.selectedDevice) return;

        const newEndDateStr = document.getElementById('new-end-date').value;
        // Получаем актуальные данные устройства из списка (selectedDevice может быть устаревшим)
        const device = this.devices.find(d => d.id === this.selectedDevice.id) || this.selectedDevice;

        // Дата опциональна - если пустая, сбрасываем дату
        let newEndDate = null;
        if (newEndDateStr) {
            newEndDate = new Date(newEndDateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (newEndDate < today) {
                Toast.show('Дата возврата не может быть в прошлом', 'warning');
                return;
            }
        }
        
        // Получаем данные профиля пользователя для обновления
        let userOffice = device.currentUserOffice || '';
        let userHomeAddress = device.currentUserHomeAddress || '';
        
        // Если пользователь - текущий пользователь, обновляем из Auth
        if (device.currentUserId === currentUser.uid) {
            userOffice = Auth.userProfile?.office || userOffice;
            userHomeAddress = Auth.userProfile?.homeAddress || userHomeAddress;
        } else {
            // Для другого пользователя - получаем из Firestore или Users
            const usersCache = typeof Users !== 'undefined' ? Users.users : [];
            const userData = usersCache.find(u => u.id === device.currentUserId);
            if (userData) {
                userOffice = userData.office || userOffice;
                userHomeAddress = userData.homeAddress || userHomeAddress;
            } else {
                // Загружаем напрямую из Firestore
                try {
                    const userDoc = await db.collection(COLLECTIONS.USERS).doc(device.currentUserId).get();
                    if (userDoc.exists) {
                        const userDocData = userDoc.data();
                        userOffice = userDocData.office || userOffice;
                        userHomeAddress = userDocData.homeAddress || userHomeAddress;
                    }
                } catch (error) {
                    console.warn('Не удалось загрузить данные профиля:', error);
                }
            }
        }

        try {
            // НЕ меняем bookingType - только дату и метаданные
            const updateData = {
                bookedUntil: newEndDate ? firebase.firestore.Timestamp.fromDate(newEndDate) : null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                currentUserOffice: userOffice,
                currentUserHomeAddress: userHomeAddress
            };
            
            await db.collection(COLLECTIONS.DEVICES).doc(device.id).update(updateData);

            // Записываем изменение даты в историю
            const deviceBookingType = this.getBookingType(device);
            await this.addBookingRecord(
                device.id,
                device.name,
                BOOKING_ACTIONS.DATE_CHANGE,
                null,
                newEndDate,  // Новая дата возврата
                {
                    uid: device.currentUserId,
                    displayName: device.currentUserName,
                    photoURL: device.currentUserPhoto
                },
                userOffice,
                userHomeAddress,
                deviceBookingType,
                this.getDeviceProjectContext(device)
            );

            const message = newEndDate 
                ? 'Дата возврата обновлена' 
                : 'Дата возврата сброшена';
            Toast.show(message, 'success');
            document.getElementById('edit-date-modal').classList.add('hidden');
        } catch (error) {
            console.error('Error updating date:', error);
            Toast.show('Ошибка: ' + error.message, 'error');
        }
    },

    /**
     * Добавить запись в историю бронирований
     */
    async addBookingRecord(deviceId, deviceName, action, startDate = null, endDate = null, targetUser = null, office = null, homeAddress = null, bookingType = null, projectContext = null) {
        const currentUser = Auth.getUser();
        if (!currentUser) return;

        // Используем targetUser если указан, иначе текущего пользователя
        const user = targetUser || {
            uid: currentUser.uid,
            displayName: this.resolveDisplayName(currentUser),
            photoURL: currentUser.photoURL
        };

        // Если office и homeAddress не переданы, пытаемся получить из устройства
        if (office === null || homeAddress === null) {
            const device = this.devices.find(d => d.id === deviceId);
            if (device) {
                office = device.currentUserOffice || office;
                homeAddress = device.currentUserHomeAddress || homeAddress;
                if (!projectContext) {
                    projectContext = this.getDeviceProjectContext(device);
                }
            }
        }

        try {
            await db.collection(COLLECTIONS.BOOKINGS).add({
                deviceId: deviceId,
                deviceName: deviceName,
                deviceOsVersion: this.getDeviceById(deviceId)?.osVersion || null,
                userId: user.uid,
                userName: user.displayName,
                userPhoto: user.photoURL,
                action: action,
                startDate: startDate ? firebase.firestore.Timestamp.fromDate(startDate) : null,
                endDate: endDate ? firebase.firestore.Timestamp.fromDate(endDate) : null,
                office: office || null,
                homeAddress: homeAddress || null,
                bookingType: bookingType || null,
                projectIds: projectContext?.projectIds || null,
                projectCodes: projectContext?.projectCodes || null,
                projectNames: projectContext?.projectNames || null,
                projectId: projectContext?.projectId || null,
                projectCode: projectContext?.projectCode || null,
                projectName: projectContext?.projectName || null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error adding booking record:', error);
        }
    },

    /**
     * Получить тип бронирования устройства (с миграцией для старых данных)
     * @param {Object} device - данные устройства
     * @returns {string} - 'office' или 'home'
     */
    getBookingType(device) {
        // Если поле bookingType уже есть - используем его
        if (device.bookingType) {
            return device.bookingType;
        }
        // Миграция: если bookingType не установлен, определяем по bookedUntil
        // Старая логика: есть дата = домой, нет даты = офис
        return device.bookedUntil ? BOOKING_TYPES.HOME : BOOKING_TYPES.OFFICE;
    },

    /**
     * Форматирование даты
     */
    formatDate(date) {
        if (!date) return '';
        return new Intl.DateTimeFormat('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(date);
    }
});
