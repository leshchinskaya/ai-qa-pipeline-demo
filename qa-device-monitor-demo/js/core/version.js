/**
 * Версия приложения
 * Обновите значение здесь — оно автоматически подтянется во все места
 * 
 * После изменения версии выполните: node scripts/update-version.js
 * Скрипт автоматически обновит ?v= параметры в index.html
 */
const APP_VERSION = '1.34.2';
const BUILD_TIMESTAMP = Date.now();

// История изменений удалена из демо-версии
const VERSION_HISTORY = [];

/**
 * Модуль управления версиями и Force Update
 */
const VersionManager = {
    // Отписка от real-time слушателя
    configUnsubscribe: null,
    // Флаг, чтобы не показывать модалку повторно
    forceUpdateShown: false,
    // Флаг для отслеживания добавления обработчика Escape
    escapeHandlerAdded: false,

    /**
     * Сравнение semver версий
     * @param {string} current - текущая версия (например, "1.14.2")
     * @param {string} required - минимальная требуемая версия (например, "1.15.0")
     * @returns {boolean} true если current < required (нужно обновление)
     */
    compareVersions(current, required) {
        if (!current || !required) return false;
        
        const currentParts = current.split('.').map(Number);
        const requiredParts = required.split('.').map(Number);
        
        // Дополняем массивы нулями до одинаковой длины
        const maxLength = Math.max(currentParts.length, requiredParts.length);
        while (currentParts.length < maxLength) currentParts.push(0);
        while (requiredParts.length < maxLength) requiredParts.push(0);
        
        for (let i = 0; i < maxLength; i++) {
            if (currentParts[i] < requiredParts[i]) return true;  // Нужно обновление
            if (currentParts[i] > requiredParts[i]) return false; // Версия новее
        }
        return false; // Версии равны
    },

    /**
     * Проверка Force Update из Firestore
     * Вызывается после инициализации Firebase
     */
    async checkForceUpdate() {
        try {
            // Проверяем, что db доступен
            if (typeof db === 'undefined') {
                console.warn('Firestore не инициализирован, пропускаем проверку версии');
                return;
            }

            const configDoc = await db.collection('config').doc('app').get();
            
            if (!configDoc.exists) {
                console.log('Документ config/app не найден, пропускаем проверку Force Update');
                return;
            }

            const config = configDoc.data();
            
            // Проверяем, включен ли Force Update
            if (!config.forceUpdate) {
                console.log('Force Update отключен в конфигурации');
                return;
            }

            const minVersion = config.minVersion;
            const updateMessage = config.updateMessage || 'Доступна новая версия приложения с важными обновлениями.';

            console.log(`Проверка версии: текущая ${APP_VERSION}, минимальная ${minVersion}`);

            if (this.compareVersions(APP_VERSION, minVersion)) {
                console.log('Обнаружена устаревшая версия, показываем Force Update');
                this.showForceUpdateModal(minVersion, updateMessage);
            } else {
                console.log('Версия актуальна');
            }
        } catch (error) {
            console.error('Ошибка проверки Force Update:', error);
            // При ошибке не блокируем работу приложения
        }
    },

    /**
     * Запустить real-time слушатель изменений конфигурации
     * Пользователь получит уведомление сразу после включения Force Update админом
     */
    startConfigListener() {
        if (typeof db === 'undefined') {
            console.warn('Firestore не инициализирован, real-time слушатель не запущен');
            return;
        }

        // Отписываемся от предыдущего слушателя
        if (this.configUnsubscribe) {
            this.configUnsubscribe();
        }

        console.log('Запуск real-time слушателя Force Update...');

        this.configUnsubscribe = db.collection('config').doc('app')
            .onSnapshot((doc) => {
                if (!doc.exists) return;

                const config = doc.data();
                
                // Проверяем, нужно ли показать Force Update
                if (config.forceUpdate && config.minVersion) {
                    if (this.compareVersions(APP_VERSION, config.minVersion) && !this.forceUpdateShown) {
                        const message = config.updateMessage || 'Доступна новая версия приложения с важными обновлениями.';
                        console.log('Real-time: обнаружено требование обновления');
                        this.showForceUpdateModal(config.minVersion, message);
                    }
                }
            }, (error) => {
                console.error('Ошибка real-time слушателя Force Update:', error);
            });
    },

    /**
     * Остановить real-time слушатель
     */
    stopConfigListener() {
        if (this.configUnsubscribe) {
            this.configUnsubscribe();
            this.configUnsubscribe = null;
            console.log('Real-time слушатель Force Update остановлен');
        }
    },

    /**
     * Настроить проверку при возврате на вкладку
     */
    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.forceUpdateShown) {
                console.log('Вкладка стала активной, проверяем Force Update...');
                this.checkForceUpdate();
            }
        });
    },

    /**
     * Показать модальное окно Force Update
     * @param {string} newVersion - новая версия
     * @param {string} message - сообщение для пользователя
     */
    showForceUpdateModal(newVersion, message) {
        // Не показываем повторно
        if (this.forceUpdateShown) return;

        const modal = document.getElementById('force-update-modal');
        const messageEl = document.getElementById('force-update-message');
        const versionEl = document.getElementById('force-update-version');
        const currentVersionEl = document.getElementById('force-update-current-version');

        if (!modal) {
            console.error('Модальное окно Force Update не найдено');
            return;
        }

        // Помечаем, что модалка показана
        this.forceUpdateShown = true;

        // Заполняем данные
        if (messageEl) messageEl.textContent = message;
        if (versionEl) versionEl.textContent = newVersion;
        if (currentVersionEl) currentVersionEl.textContent = APP_VERSION;

        // Показываем модальное окно
        modal.classList.remove('hidden');

        // Блокируем прокрутку страницы
        document.body.style.overflow = 'hidden';
    },

    /**
     * Выполнить обновление приложения
     */
    performUpdate() {
        console.log('Выполняем обновление приложения...');
        
        // Очищаем кэш Service Worker и Cache API
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }

        // Очищаем localStorage версии
        localStorage.removeItem('app_version');

        // Принудительная перезагрузка страницы (обходя кэш)
        window.location.reload(true);
    },

    /**
     * Инициализация обработчиков
     */
    init() {
        // Обработчик кнопки обновления
        document.addEventListener('DOMContentLoaded', () => {
            const updateBtn = document.getElementById('force-update-btn');
            if (updateBtn) {
                updateBtn.addEventListener('click', () => this.performUpdate());
            }
            
            // Инициализация админ-панели Force Update
            this.initAdminPanel();
            
            // Проверка при возврате на вкладку
            this.setupVisibilityListener();
            
            // Инициализация диалога истории версий
            this.initVersionHistoryDialog();
        });
    },

    // =====================================================
    // ADMIN PANEL: Управление Force Update
    // =====================================================

    /**
     * Инициализация админ-панели Force Update
     */
    initAdminPanel() {
        const form = document.getElementById('force-update-form');
        const resetBtn = document.getElementById('force-update-reset-btn');
        
        if (!form) return; // Форма не найдена (возможно, не админ)
        
        // Обработчик сохранения
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveForceUpdateSettings();
        });
        
        // Обработчик сброса
        resetBtn?.addEventListener('click', () => {
            this.loadForceUpdateSettings();
        });
        
        // Отображаем текущую версию приложения
        const currentVersionEl = document.getElementById('admin-current-version');
        if (currentVersionEl) {
            currentVersionEl.textContent = APP_VERSION;
        }
    },

    /**
     * Загрузить настройки Force Update для админ-панели
     * Вызывается при открытии вкладки "Обновления"
     */
    async loadForceUpdateSettings() {
        try {
            if (typeof db === 'undefined') {
                console.warn('Firestore не инициализирован');
                return;
            }

            // Показываем статус загрузки
            this.updateAdminStatusUI('loading');

            const configDoc = await db.collection('config').doc('app').get();
            
            let config = {
                forceUpdate: false,
                minVersion: '',
                updateMessage: 'Доступна новая версия приложения с важными обновлениями.'
            };

            if (configDoc.exists) {
                config = { ...config, ...configDoc.data() };
            }

            // Заполняем форму
            const enabledCheckbox = document.getElementById('admin-force-update-enabled');
            const minVersionInput = document.getElementById('admin-min-version-input');
            const messageTextarea = document.getElementById('admin-update-message');
            const adminMinVersion = document.getElementById('admin-min-version');

            if (enabledCheckbox) enabledCheckbox.checked = config.forceUpdate === true;
            if (minVersionInput) minVersionInput.value = config.minVersion || '';
            if (messageTextarea) messageTextarea.value = config.updateMessage || '';
            if (adminMinVersion) adminMinVersion.textContent = config.minVersion || 'Не задана';

            // Обновляем статус
            this.updateAdminStatusUI(config.forceUpdate ? 'enabled' : 'disabled', config.minVersion);

            console.log('Настройки Force Update загружены:', config);

        } catch (error) {
            console.error('Ошибка загрузки настроек Force Update:', error);
            this.updateAdminStatusUI('error');
            if (typeof Toast !== 'undefined') {
                Toast.show('Ошибка загрузки настроек: ' + error.message, 'error');
            }
        }
    },

    /**
     * Сохранить настройки Force Update
     */
    async saveForceUpdateSettings() {
        try {
            if (typeof db === 'undefined') {
                throw new Error('Firestore не инициализирован');
            }

            const enabledCheckbox = document.getElementById('admin-force-update-enabled');
            const minVersionInput = document.getElementById('admin-min-version-input');
            const messageTextarea = document.getElementById('admin-update-message');

            const forceUpdate = enabledCheckbox?.checked || false;
            const minVersion = minVersionInput?.value.trim() || '';
            const updateMessage = messageTextarea?.value.trim() || 'Доступна новая версия приложения с важными обновлениями.';

            // Валидация версии
            if (forceUpdate && !minVersion) {
                if (typeof Toast !== 'undefined') {
                    Toast.show('Укажите минимальную версию', 'warning');
                }
                minVersionInput?.focus();
                return;
            }

            if (minVersion && !/^\d+\.\d+\.\d+$/.test(minVersion)) {
                if (typeof Toast !== 'undefined') {
                    Toast.show('Неверный формат версии. Используйте X.Y.Z', 'warning');
                }
                minVersionInput?.focus();
                return;
            }

            // Сохраняем в Firestore
            await db.collection('config').doc('app').set({
                forceUpdate: forceUpdate,
                minVersion: minVersion,
                updateMessage: updateMessage,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: typeof Auth !== 'undefined' && Auth.currentUser ? Auth.currentUser.email : 'unknown'
            }, { merge: true });

            // Обновляем UI
            const adminMinVersion = document.getElementById('admin-min-version');
            if (adminMinVersion) adminMinVersion.textContent = minVersion || 'Не задана';
            
            this.updateAdminStatusUI(forceUpdate ? 'enabled' : 'disabled', minVersion);

            if (typeof Toast !== 'undefined') {
                Toast.show('Настройки Force Update сохранены', 'success');
            }

            console.log('Настройки Force Update сохранены:', { forceUpdate, minVersion, updateMessage });

        } catch (error) {
            console.error('Ошибка сохранения настроек Force Update:', error);
            if (typeof Toast !== 'undefined') {
                Toast.show('Ошибка сохранения: ' + error.message, 'error');
            }
        }
    },

    /**
     * Обновить UI статуса в админ-панели
     * @param {'loading'|'enabled'|'disabled'|'error'} status
     * @param {string} minVersion
     */
    updateAdminStatusUI(status, minVersion = '') {
        const statusIcon = document.getElementById('force-update-status-icon');
        const statusText = document.getElementById('force-update-status-text');
        const statusBadge = document.getElementById('force-update-status-badge');

        if (!statusBadge) return;

        const dotEl = statusBadge.querySelector('.status-dot');
        const labelEl = statusBadge.querySelector('.status-label');

        // Сбрасываем классы
        statusBadge.className = 'status-card-badge';
        if (statusIcon) statusIcon.className = 'status-card-icon';

        switch (status) {
            case 'loading':
                statusBadge.classList.add('loading');
                if (dotEl) dotEl.style.background = 'var(--text-muted)';
                if (labelEl) labelEl.textContent = 'Загрузка...';
                if (statusText) statusText.textContent = 'Загрузка настроек...';
                break;

            case 'enabled':
                statusBadge.classList.add('enabled');
                if (statusIcon) statusIcon.classList.add('enabled');
                if (dotEl) dotEl.style.background = 'var(--status-available)';
                if (labelEl) labelEl.textContent = 'Включен';
                if (statusText) {
                    const needsUpdate = this.compareVersions(APP_VERSION, minVersion);
                    if (needsUpdate) {
                        statusText.textContent = `Активен! Текущая версия (${APP_VERSION}) требует обновления до ${minVersion}`;
                    } else {
                        statusText.textContent = `Включен, но текущая версия (${APP_VERSION}) актуальна`;
                    }
                }
                break;

            case 'disabled':
                statusBadge.classList.add('disabled');
                if (dotEl) dotEl.style.background = 'var(--text-muted)';
                if (labelEl) labelEl.textContent = 'Выключен';
                if (statusText) statusText.textContent = 'Force Update отключен. Пользователи не будут принуждены к обновлению.';
                break;

            case 'error':
                statusBadge.classList.add('error');
                if (dotEl) dotEl.style.background = 'var(--accent-danger)';
                if (labelEl) labelEl.textContent = 'Ошибка';
                if (statusText) statusText.textContent = 'Не удалось загрузить настройки';
                break;
        }
    },

    // =====================================================
    // VERSION HISTORY: Диалог истории изменений
    // =====================================================

    /**
     * Инициализация диалога истории версий
     */
    initVersionHistoryDialog() {
        // Обработчик клика на элементы с классом .version
        // Используем делегирование событий для элементов, которые могут быть добавлены динамически
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('version') || e.target.closest('.version')) {
                const versionEl = e.target.classList.contains('version') ? e.target : e.target.closest('.version');
                if (versionEl) {
                    versionEl.style.cursor = 'pointer';
                    this.showVersionHistory();
                }
            }
        });

        // Устанавливаем курсор для существующих элементов
        document.querySelectorAll('.version').forEach(el => {
            el.style.cursor = 'pointer';
        });

        // Обработчик закрытия модального окна
        const closeBtn = document.getElementById('version-history-close');
        const modal = document.getElementById('version-history-modal');
        const overlay = modal?.querySelector('.modal-overlay');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideVersionHistory());
        }

        if (overlay) {
            overlay.addEventListener('click', () => this.hideVersionHistory());
        }

        // Закрытие по Escape (добавляем один раз)
        if (!this.escapeHandlerAdded) {
            document.addEventListener('keydown', (e) => {
                const modal = document.getElementById('version-history-modal');
                if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
                    this.hideVersionHistory();
                }
            });
            this.escapeHandlerAdded = true;
        }
    },

    /**
     * Показать диалог истории версий
     */
    showVersionHistory() {
        const modal = document.getElementById('version-history-modal');
        if (!modal) {
            console.error('Модальное окно истории версий не найдено');
            return;
        }

        // Рендерим список версий
        this.renderVersionHistory();

        // Показываем модальное окно
        modal.classList.remove('hidden');

        // Блокируем прокрутку страницы
        document.body.style.overflow = 'hidden';
    },

    /**
     * Скрыть диалог истории версий
     */
    hideVersionHistory() {
        const modal = document.getElementById('version-history-modal');
        if (!modal) return;

        // Скрываем модальное окно
        modal.classList.add('hidden');

        // Разблокируем прокрутку страницы
        document.body.style.overflow = '';
    },

    /**
     * Рендерить список версий в диалоге
     */
    renderVersionHistory() {
        const listContainer = document.getElementById('version-history-list');
        if (!listContainer) {
            console.error('Контейнер списка версий не найден');
            return;
        }

        // Очищаем контейнер
        listContainer.innerHTML = '';

        // Рендерим каждую версию
        VERSION_HISTORY.forEach(versionData => {
            const versionCard = this.createVersionCard(versionData);
            listContainer.appendChild(versionCard);
        });
    },

    /**
     * Создать карточку версии
     * @param {Object} versionData - данные о версии
     * @returns {HTMLElement} элемент карточки
     */
    createVersionCard(versionData) {
        const card = document.createElement('div');
        card.className = 'version-item-card';

        // Заголовок версии
        const header = document.createElement('div');
        header.className = 'version-header';

        const versionNumber = document.createElement('div');
        versionNumber.className = 'version-number';
        versionNumber.textContent = `v${versionData.version}`;

        const versionDate = document.createElement('div');
        versionDate.className = 'version-date';
        versionDate.textContent = this.formatDate(versionData.date);

        header.appendChild(versionNumber);
        header.appendChild(versionDate);

        // Список изменений
        const changesList = document.createElement('ul');
        changesList.className = 'version-changes';

        versionData.changes.forEach(change => {
            const changeItem = document.createElement('li');
            changeItem.className = 'version-change-item';
            changeItem.textContent = change;
            changesList.appendChild(changeItem);
        });

        card.appendChild(header);
        card.appendChild(changesList);

        return card;
    },

    /**
     * Форматировать дату для отображения
     * @param {string} dateString - дата в формате YYYY-MM-DD
     * @returns {string} отформатированная дата
     */
    formatDate(dateString) {
        const date = new Date(dateString + 'T00:00:00');
        const months = [
            'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }
};

// Инициализация VersionManager
VersionManager.init();

// Проверяем, изменилась ли версия - если да, принудительно обновляем страницу
(function checkVersionAndRefresh() {
    const storedVersion = localStorage.getItem('app_version');
    if (storedVersion && storedVersion !== APP_VERSION) {
        // Версия изменилась - очищаем кэш и перезагружаем
        console.log(`Обнаружена новая версия: ${storedVersion} → ${APP_VERSION}. Обновление...`);
        localStorage.setItem('app_version', APP_VERSION);
        // Принудительная перезагрузка с очисткой кэша
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }
        window.location.reload(true);
        return;
    }
    localStorage.setItem('app_version', APP_VERSION);
})();

// Подставляем версию во все элементы с классом .version
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.version').forEach(el => {
        el.textContent = `v${APP_VERSION}`;
        el.style.cursor = 'pointer';
    });
});
