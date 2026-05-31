/**
 * Subscription Manager
 * Централизованное управление Firestore onSnapshot listeners.
 *
 * Использование:
 *   SubscriptionManager.register('chat.messages', unsubFn);
 *   SubscriptionManager.unsubscribeAll(); // при logout
 *   SubscriptionManager.unsubscribe('chat.messages'); // точечная отписка
 */

const SubscriptionManager = {
    _subs: new Map(),

    /**
     * Зарегистрировать listener.
     * Если под тем же именем уже есть активная подписка — она будет отменена.
     * @param {string} name - уникальное имя подписки (рекомендуется формат 'module.listener')
     * @param {function} unsubFn - функция отписки, возвращаемая onSnapshot()
     */
    register(name, unsubFn) {
        if (typeof unsubFn !== 'function') return;
        if (this._subs.has(name)) {
            try { this._subs.get(name)(); } catch (e) { /* ignore */ }
        }
        this._subs.set(name, unsubFn);
    },

    /**
     * Отписаться от конкретного listener по имени.
     * @param {string} name
     */
    unsubscribe(name) {
        const unsub = this._subs.get(name);
        if (unsub) {
            try { unsub(); } catch (e) { /* ignore */ }
            this._subs.delete(name);
        }
    },

    /**
     * Отписаться от всех активных listeners.
     * Вызывать при logout пользователя.
     */
    unsubscribeAll() {
        this._subs.forEach((unsub) => {
            try { unsub(); } catch (e) { /* ignore */ }
        });
        this._subs.clear();
    },

    /**
     * Количество активных подписок.
     * @returns {number}
     */
    size() {
        return this._subs.size;
    }
};
