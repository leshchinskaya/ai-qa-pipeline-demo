/**
 * Search Utils
 * Общая утилита для поискового поля с debounce и кнопкой очистки.
 *
 * Использование:
 *   SearchUtils.setup({
 *       inputId:    'devices-search',
 *       wrapperId:  'devices-search-wrapper',
 *       clearBtnId: 'devices-search-clear',
 *       debounceMs: 100,
 *       onSearch:   (query) => { Devices.searchQuery = query; Devices.requestSortedMainDevicesRender(); },
 *       onClear:    () => { Devices.requestSortedMainDevicesRender(); }
 *   });
 *
 *   SearchUtils.clear('devices-search', 'devices-search-wrapper');
 */

const SearchUtils = {
    /**
     * Привязать поведение поиска к DOM-элементам.
     *
     * @param {object} options
     * @param {string}   options.inputId       — id поля ввода
     * @param {string}   [options.wrapperId]   — id обёртки (CSS-класс has-value)
     * @param {string}   [options.clearBtnId]  — id кнопки очистки
     * @param {number}   [options.debounceMs=150] — задержка debounce в мс
     * @param {function} options.onSearch      — callback(query: string) при вводе
     * @param {function} [options.onClear]     — callback() при очистке
     * @returns {object|null} ссылки на DOM-элементы или null если input не найден
     */
    setup({ inputId, wrapperId, clearBtnId, debounceMs = 150, onSearch, onClear }) {
        const input = document.getElementById(inputId);
        if (!input) return null;

        if (input.dataset.searchUtilsInit === 'true') return null;
        input.dataset.searchUtilsInit = 'true';

        const wrapper  = wrapperId  ? document.getElementById(wrapperId)  : null;
        const clearBtn = clearBtnId ? document.getElementById(clearBtnId) : null;

        const updateClearButton = () => {
            wrapper?.classList.toggle('has-value', input.value.length > 0);
        };

        let timer;
        input.addEventListener('input', (e) => {
            updateClearButton();
            clearTimeout(timer);
            timer = setTimeout(() => {
                onSearch(e.target.value.toLowerCase().trim());
            }, debounceMs);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clear(inputId, wrapperId);
                onClear?.();
            }
        });

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clear(inputId, wrapperId);
                onClear?.();
                input.focus();
            });
        }

        return { input, wrapper, clearBtn };
    },

    /**
     * Программно очистить поле поиска.
     * @param {string} inputId
     * @param {string} [wrapperId]
     */
    clear(inputId, wrapperId) {
        const input   = document.getElementById(inputId);
        const wrapper = wrapperId ? document.getElementById(wrapperId) : null;
        if (input)   input.value = '';
        wrapper?.classList.remove('has-value');
    }
};
