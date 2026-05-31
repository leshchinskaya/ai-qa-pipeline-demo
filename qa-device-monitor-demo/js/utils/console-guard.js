/**
 * Console guard:
 * - Hides noisy logs in production
 * - Redacts sensitive data from console output
 */
(function initConsoleGuard() {
    if (typeof window === 'undefined' || !window.console) {
        return;
    }

    const originalConsole = {
        log: window.console.log ? window.console.log.bind(window.console) : function noop() {},
        info: window.console.info ? window.console.info.bind(window.console) : function noop() {},
        debug: window.console.debug ? window.console.debug.bind(window.console) : function noop() {},
        trace: window.console.trace ? window.console.trace.bind(window.console) : function noop() {},
        warn: window.console.warn ? window.console.warn.bind(window.console) : function noop() {},
        error: window.console.error ? window.console.error.bind(window.console) : function noop() {}
    };

    function getDebugLogsEnabled() {
        const query = new URLSearchParams(window.location.search);
        if (query.get('debugLogs') === '0' || query.get('debug') === '0') {
            return false;
        }

        if (query.get('debugLogs') === '1' || query.get('debug') === '1') {
            return true;
        }

        try {
            const stored = window.localStorage.getItem('qa_device_monitor_debug_logs');
            if (stored === '1' || stored === 'true') {
                return true;
            }
        } catch (error) {
            // localStorage access may fail in privacy mode
        }

        return false;
    }

    const debugLogsEnabled = getDebugLogsEnabled();
    const SENSITIVE_KEY_RE = /(pass(word)?|secret|token|auth|authorization|cookie|session|credential|api[-_]?key|email|phone|address|uid|photo(url)?|bearer)/i;
    const EMAIL_RE = /([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi;
    const BEARER_RE = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
    const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
    const SECRET_ASSIGN_RE = /\b(password|passwd|token|secret|api[_-]?key|authorization|cookie)\s*[:=]\s*([^\s,;]+)/gi;
    const messageSeenAt = new Map();

    function redactString(value) {
        return String(value)
            .replace(EMAIL_RE, '[redacted-email]')
            .replace(BEARER_RE, 'Bearer [redacted-token]')
            .replace(JWT_RE, '[redacted-jwt]')
            .replace(SECRET_ASSIGN_RE, '$1=[redacted]');
    }

    function sanitizeValue(value, depth = 0) {
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof value === 'string') {
            return redactString(value);
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'bigint') {
            return value.toString();
        }

        if (value instanceof Error) {
            const code = value.code !== undefined ? ` [${value.code}]` : '';
            return `${value.name || 'Error'}${code}: ${redactString(value.message || 'Unknown error')}`;
        }

        if (typeof value === 'object') {
            if (depth >= 1 && !debugLogsEnabled) {
                return '[redacted-object]';
            }

            if (Array.isArray(value)) {
                if (!debugLogsEnabled) {
                    return `[array length=${value.length}]`;
                }
                const preview = value.slice(0, 5).map((item) => sanitizeValue(item, depth + 1));
                if (value.length > 5) {
                    preview.push(`[+${value.length - 5} more]`);
                }
                return preview;
            }

            const output = {};
            const entries = Object.entries(value);
            const limit = debugLogsEnabled ? 12 : 4;

            for (let i = 0; i < entries.length && i < limit; i += 1) {
                const [key, raw] = entries[i];
                output[key] = SENSITIVE_KEY_RE.test(key)
                    ? '[redacted]'
                    : sanitizeValue(raw, depth + 1);
            }

            if (entries.length > limit) {
                output.__truncated__ = `+${entries.length - limit} keys`;
            }

            return output;
        }

        return String(value);
    }

    function summarizePrimaryArg(args) {
        if (!args.length) {
            return '';
        }

        const first = args[0];
        if (typeof first === 'string' && first.trim()) {
            return redactString(first);
        }

        const sanitized = sanitizeValue(first);
        if (typeof sanitized === 'string') {
            return sanitized;
        }
        return '[message]';
    }

    function shouldEmit(level, message) {
        if (debugLogsEnabled) {
            return true;
        }

        const key = `${level}:${message}`;
        const now = Date.now();
        const prev = messageSeenAt.get(key) || 0;
        messageSeenAt.set(key, now);

        if (messageSeenAt.size > 100) {
            for (const [seenKey, seenTs] of messageSeenAt.entries()) {
                if (now - seenTs > 60_000) {
                    messageSeenAt.delete(seenKey);
                }
            }
        }

        return now - prev > 3000;
    }

    function buildArgs(level, args) {
        const message = summarizePrimaryArg(args);
        const output = [message];

        if (level === 'warn' || level === 'error') {
            if (debugLogsEnabled) {
                for (let i = 1; i < args.length; i += 1) {
                    output.push(sanitizeValue(args[i]));
                }
            } else {
                for (let i = 1; i < args.length; i += 1) {
                    const value = sanitizeValue(args[i]);
                    if (typeof value === 'string' && value.trim()) {
                        output.push(value);
                        break;
                    }
                }
            }
        } else if (debugLogsEnabled) {
            for (let i = 1; i < args.length; i += 1) {
                output.push(sanitizeValue(args[i]));
            }
        }

        return output;
    }

    function setConsoleMethod(name, fn) {
        try {
            window.console[name] = fn;
        } catch (error) {
            // Some environments lock console methods
        }
    }

    function emit(level, args) {
        const payload = buildArgs(level, args);
        const message = String(payload[0] || '');
        if (!shouldEmit(level, message)) {
            return;
        }
        originalConsole[level].apply(window.console, payload);
    }

    if (debugLogsEnabled) {
        setConsoleMethod('log', function guardedLog(...args) {
            emit('log', args);
        });
        setConsoleMethod('info', function guardedInfo(...args) {
            emit('info', args);
        });
        setConsoleMethod('debug', function guardedDebug(...args) {
            emit('debug', args);
        });
        setConsoleMethod('trace', function guardedTrace(...args) {
            emit('trace', args);
        });
    } else {
        setConsoleMethod('log', function silentLog() {});
        setConsoleMethod('info', function silentInfo() {});
        setConsoleMethod('debug', function silentDebug() {});
        setConsoleMethod('trace', function silentTrace() {});
    }

    setConsoleMethod('warn', function guardedWarn(...args) {
        emit('warn', args);
    });
    setConsoleMethod('error', function guardedError(...args) {
        emit('error', args);
    });

    window.ConsoleGuard = {
        debugLogsEnabled,
        enableDebugLogs() {
            try {
                window.localStorage.setItem('qa_device_monitor_debug_logs', '1');
            } catch (error) {
                // ignored
            }
        },
        disableDebugLogs() {
            try {
                window.localStorage.removeItem('qa_device_monitor_debug_logs');
            } catch (error) {
                // ignored
            }
        }
    };
}());
