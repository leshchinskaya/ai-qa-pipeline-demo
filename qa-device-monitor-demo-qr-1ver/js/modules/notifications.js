/**
 * Notifications Module — BR.05.* in-app уведомления о событиях устройств.
 *
 * Минимальный набор:
 *   - Notifications.notify({ userId, type, deviceId, deviceName, by }) — пишет
 *     документ в коллекцию `notifications`.
 *   - Notifications.subscribe(userId) — слушает свои непрочитанные уведомления
 *     и рисует badge в navbar.
 *   - Notifications.markRead(id) — помечает уведомление прочитанным.
 *
 * Зависит от: firebase, COLLECTIONS, Auth.
 */
const Notifications = {
    _unsubscribe: null,
    _count: 0,

    init() {
        if (typeof firebase === 'undefined' || !firebase.auth) return;
        firebase.auth().onAuthStateChanged((user) => {
            if (this._unsubscribe) {
                try { this._unsubscribe(); } catch (e) { /* ignore */ }
                this._unsubscribe = null;
            }
            if (user && user.uid) {
                this.subscribe(user.uid);
            } else {
                this._updateBadge(0);
            }
        });
    },

    subscribe(userId) {
        if (typeof db === 'undefined') return;
        try {
            this._unsubscribe = db.collection('notifications')
                .where('userId', '==', userId)
                .onSnapshot((snapshot) => {
                    const unread = (snapshot.docs || []).filter((d) => {
                        const data = d.data ? d.data() : d;
                        return !data.readAt;
                    });
                    this._updateBadge(unread.length);
                }, () => { /* ignore listen errors */ });
        } catch (e) {
            // ignore
        }
    },

    async notify(payload) {
        if (!payload || !payload.userId || typeof db === 'undefined') return null;
        try {
            const doc = {
                userId: payload.userId,
                type: payload.type || 'generic',
                deviceId: payload.deviceId || null,
                deviceName: payload.deviceName || null,
                by: payload.by || null,
                byName: payload.byName || null,
                readAt: null,
                createdAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue && firebase.firestore.FieldValue.serverTimestamp)
                    ? firebase.firestore.FieldValue.serverTimestamp()
                    : new Date().toISOString()
            };
            const ref = await db.collection('notifications').add(doc);
            return ref && ref.id ? ref.id : null;
        } catch (e) {
            console.warn('Notifications.notify failed', e);
            return null;
        }
    },

    async markRead(id) {
        if (!id || typeof db === 'undefined') return;
        try {
            await db.collection('notifications').doc(id).update({
                readAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue && firebase.firestore.FieldValue.serverTimestamp)
                    ? firebase.firestore.FieldValue.serverTimestamp()
                    : new Date().toISOString()
            });
        } catch (e) {
            // ignore
        }
    },

    _updateBadge(count) {
        this._count = count;
        const badge = document.getElementById('notification-badge');
        if (!badge) return;
        if (count > 0) {
            badge.textContent = String(count);
            badge.classList.remove('hidden');
        } else {
            badge.textContent = '0';
            badge.classList.add('hidden');
        }
    }
};

if (typeof window !== 'undefined') {
    window.Notifications = Notifications;
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Notifications.init());
    } else {
        Notifications.init();
    }
}
