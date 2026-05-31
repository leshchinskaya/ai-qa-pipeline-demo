/**
 * Analytics — тонкая обёртка над Firebase Analytics / gtag.
 * BR.05.10 / BR.05.31 — события qr_scan и др.
 *
 * При отсутствии провайдера работает как no-op, чтобы не падать в браузере
 * без аналитики и не блокировать тесты.
 */
const Analytics = {
    log(event, payload) {
        try {
            if (typeof firebase !== 'undefined' && firebase.analytics) {
                firebase.analytics().logEvent(event, payload || {});
                return;
            }
        } catch (e) {
            // ignore — fallback ниже
        }
        try {
            if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
                window.gtag('event', event, payload || {});
            }
        } catch (e) {
            // ignore
        }
    }
};

if (typeof window !== 'undefined') {
    window.Analytics = Analytics;
}
