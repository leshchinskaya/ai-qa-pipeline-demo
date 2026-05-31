/**
 * DEMO MOCK FIREBASE SDK
 * ----------------------
 * Полностью заменяет firebase-app/auth/firestore compat-SDK для демо-стенда.
 * Никакого реального Firebase, никакой авторизации — авто-вход фейкового
 * пользователя @test.dev и реактивная in-memory база (onSnapshot обновляется
 * при записи, поэтому каталог перерисовывается после QR-бронирования).
 *
 * Подключается ДО js/core/firebase-config.js (тот вызывает firebase.initializeApp,
 * firebase.auth(), firebase.firestore() и т.д.).
 */
(function () {
  'use strict';

  // ── Timestamp ───────────────────────────────────────────────────────────
  function Ts(date) { this._date = date instanceof Date ? date : new Date(date); }
  Ts.prototype.toDate = function () { return new Date(this._date.getTime()); };
  Ts.prototype.toMillis = function () { return this._date.getTime(); };
  Ts.prototype.getTime = function () { return this._date.getTime(); };
  Object.defineProperty(Ts.prototype, 'seconds', { get() { return Math.floor(this._date.getTime() / 1000); } });
  Object.defineProperty(Ts.prototype, 'nanoseconds', { get() { return 0; } });

  const SERVER_TS = { __serverTimestamp: true };
  function resolveValues(obj) {
    const out = {};
    for (const k in obj) {
      const v = obj[k];
      out[k] = (v === SERVER_TS) ? new Ts(new Date()) : v;
    }
    return out;
  }

  // ── In-memory store ──────────────────────────────────────────────────────
  // collection name -> Map<docId, dataObject>
  const store = {};
  // collection name -> Set<listener>  (listener = {resolve, onNext})
  const collListeners = {};
  // "collection/docId" -> Set<listener>
  const docListeners = {};

  function coll(name) { return (store[name] = store[name] || new Map()); }
  let autoId = 1000;
  const genId = () => 'auto-' + (++autoId);
  // shallow clone preserving Ts instances
  function dataClone(o) {
    if (!o) return o;
    const c = {};
    for (const k in o) c[k] = o[k];
    return c;
  }

  // ── Snapshots ──────────────────────────────────────────────────────────
  function docSnap(name, id) {
    const data = coll(name).get(id);
    return {
      id,
      exists: data !== undefined,
      data: () => (data === undefined ? undefined : dataClone(data)),
      get: (f) => (data ? data[f] : undefined),
    };
  }
  function querySnap(docs) {
    return {
      docs,
      size: docs.length,
      empty: docs.length === 0,
      forEach: (cb) => docs.forEach(cb),
      docChanges: () => docs.map((d) => ({ type: 'added', doc: d })),
    };
  }

  // ── Query resolution ─────────────────────────────────────────────────────
  function applyQuery(name, spec) {
    let rows = Array.from(coll(name).entries()).map(([id, data]) => ({ id, data }));
    for (const w of spec.wheres) {
      rows = rows.filter((r) => matchWhere(r.data[w.field], w.op, w.val));
    }
    if (spec.orderField) {
      const dir = spec.orderDir === 'desc' ? -1 : 1;
      rows.sort((a, b) => {
        const av = a.data[spec.orderField], bv = b.data[spec.orderField];
        if (av == null && bv == null) return 0;
        if (av == null) return -1 * dir;
        if (bv == null) return 1 * dir;
        if (typeof av === 'string' || typeof bv === 'string') {
          return String(av).localeCompare(String(bv), 'ru') * dir;
        }
        const an = (av instanceof Ts) ? av.getTime() : av;
        const bn = (bv instanceof Ts) ? bv.getTime() : bv;
        return (an < bn ? -1 : an > bn ? 1 : 0) * dir;
      });
    }
    if (spec.lim != null) rows = rows.slice(0, spec.lim);
    return rows.map((r) => ({
      id: r.id,
      exists: true,
      data: () => dataClone(r.data),
      get: (f) => r.data[f],
    }));
  }
  function matchWhere(fieldVal, op, val) {
    switch (op) {
      case '==': return fieldVal === val;
      case '!=': return fieldVal !== val;
      case '>': return fieldVal > val;
      case '>=': return fieldVal >= val;
      case '<': return fieldVal < val;
      case '<=': return fieldVal <= val;
      case 'in': return Array.isArray(val) && val.includes(fieldVal);
      case 'array-contains': return Array.isArray(fieldVal) && fieldVal.includes(val);
      case 'array-contains-any': return Array.isArray(fieldVal) && Array.isArray(val) && val.some((v) => fieldVal.includes(v));
      default: return false;
    }
  }

  // ── Notifications (reactive onSnapshot) ───────────────────────────────────
  function notifyColl(name) {
    const set = collListeners[name];
    if (set) set.forEach((l) => queueMicrotask(() => { try { l(); } catch (e) { console.error(e); } }));
    const prefix = name + '/';
    for (const key in docListeners) {
      if (key.indexOf(prefix) === 0) {
        docListeners[key].forEach((l) => queueMicrotask(() => { try { l(); } catch (e) { console.error(e); } }));
      }
    }
  }

  // ── Query object ───────────────────────────────────────────────────────
  function makeQuery(name, spec) {
    const q = {
      where(field, op, val) { return makeQuery(name, { ...spec, wheres: [...spec.wheres, { field, op, val }] }); },
      orderBy(field, dir) { return makeQuery(name, { ...spec, orderField: field, orderDir: dir || 'asc' }); },
      limit(n) { return makeQuery(name, { ...spec, lim: n }); },
      get() { return Promise.resolve(querySnap(applyQuery(name, spec))); },
      onSnapshot(onNext, onErr) {
        const fn = () => { try { onNext(querySnap(applyQuery(name, spec))); } catch (e) { if (onErr) onErr(e); else console.error(e); } };
        (collListeners[name] = collListeners[name] || new Set()).add(fn);
        queueMicrotask(fn);
        return () => collListeners[name].delete(fn);
      },
    };
    return q;
  }

  // ── DocumentReference ─────────────────────────────────────────────────────
  function makeDoc(name, id) {
    return {
      id,
      __coll: name,
      get parent() { return makeCollection(name); },
      collection(sub) { return makeCollection(name + '/' + id + '/' + sub); },
      get() { return Promise.resolve(docSnap(name, id)); },
      set(data, opts) {
        const c = coll(name);
        const resolved = resolveValues(data);
        if (opts && opts.merge && c.has(id)) c.set(id, Object.assign({}, c.get(id), resolved));
        else c.set(id, resolved);
        notifyColl(name);
        return Promise.resolve();
      },
      update(data) {
        const c = coll(name);
        if (!c.has(id)) {
          const err = new Error('No document to update: ' + name + '/' + id);
          err.code = 'not-found';
          return Promise.reject(err);
        }
        c.set(id, Object.assign({}, c.get(id), resolveValues(data)));
        notifyColl(name);
        return Promise.resolve();
      },
      delete() { coll(name).delete(id); notifyColl(name); return Promise.resolve(); },
      onSnapshot(onNext, onErr) {
        const fn = () => { try { onNext(docSnap(name, id)); } catch (e) { if (onErr) onErr(e); else console.error(e); } };
        const key = name + '/' + id;
        (docListeners[key] = docListeners[key] || new Set()).add(fn);
        queueMicrotask(fn);
        return () => docListeners[key].delete(fn);
      },
    };
  }

  // ── CollectionReference ───────────────────────────────────────────────────
  function makeCollection(name) {
    const base = makeQuery(name, { wheres: [], lim: null });
    return Object.assign(base, {
      doc(id) { return makeDoc(name, id || genId()); },
      add(data) {
        const id = genId();
        coll(name).set(id, resolveValues(data));
        notifyColl(name);
        return Promise.resolve(makeDoc(name, id));
      },
    });
  }

  // ── Transactions & batch ──────────────────────────────────────────────────
  function runTransaction(updateFn) {
    const ops = [];
    const tx = {
      get(ref) { return Promise.resolve(docSnap(refName(ref), ref.id)); },
      set(ref, data, opts) { ops.push(() => ref.set(data, opts)); return tx; },
      update(ref, data) { ops.push(() => ref.update(data)); return tx; },
      delete(ref) { ops.push(() => ref.delete()); return tx; },
    };
    return Promise.resolve()
      .then(() => updateFn(tx))
      .then((res) => { ops.forEach((op) => op()); return res; });
  }
  function refName(ref) { return ref.__coll; }

  function batch() {
    const ops = [];
    return {
      set(ref, data, opts) { ops.push(() => ref.set(data, opts)); return this; },
      update(ref, data) { ops.push(() => ref.update(data)); return this; },
      delete(ref) { ops.push(() => ref.delete()); return this; },
      commit() { return Promise.all(ops.map((op) => op())); },
    };
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const DEMO_USER = {
    uid: 'demo-user',
    email: 'demo@test.dev',
    displayName: 'Демо QA',
    photoURL: '',
    emailVerified: true,
  };
  let currentUser = DEMO_USER;       // авто-вход
  const authListeners = new Set();
  function fireAuth() { authListeners.forEach((cb) => queueMicrotask(() => cb(currentUser))); }

  const authInstance = {
    get currentUser() { return currentUser; },
    setPersistence() { return Promise.resolve(); },
    onAuthStateChanged(cb) { authListeners.add(cb); queueMicrotask(() => cb(currentUser)); return () => authListeners.delete(cb); },
    signInWithPopup() { currentUser = DEMO_USER; fireAuth(); return Promise.resolve({ user: DEMO_USER }); },
    signInWithRedirect() { currentUser = DEMO_USER; fireAuth(); return Promise.resolve(); },
    getRedirectResult() { return Promise.resolve({ user: null }); },
    signOut() { currentUser = null; fireAuth(); return Promise.resolve(); },
  };

  function GoogleAuthProvider() {}
  GoogleAuthProvider.prototype.setCustomParameters = function () {};
  GoogleAuthProvider.prototype.addScope = function () {};

  // ── firebase global ─────────────────────────────────────────────────────
  const dbInstance = {
    collection: (name) => makeCollection(name),
    doc: (path) => { const i = path.lastIndexOf('/'); return makeDoc(path.slice(0, i), path.slice(i + 1)); },
    runTransaction,
    batch,
  };

  const firestoreFn = function () { return dbInstance; };
  firestoreFn.FieldValue = {
    serverTimestamp: () => SERVER_TS,
    delete: () => undefined,
    arrayUnion: (...v) => ({ __arrayUnion: v }),
    arrayRemove: (...v) => ({ __arrayRemove: v }),
    increment: (n) => ({ __increment: n }),
  };
  firestoreFn.Timestamp = {
    fromDate: (d) => new Ts(d),
    fromMillis: (ms) => new Ts(new Date(ms)),
    now: () => new Ts(new Date()),
  };

  const authFn = function () { return authInstance; };
  authFn.GoogleAuthProvider = GoogleAuthProvider;
  authFn.Auth = { Persistence: { LOCAL: 'local', SESSION: 'session', NONE: 'none' } };

  window.firebase = {
    initializeApp() { return {}; },
    app() { return {}; },
    auth: authFn,
    firestore: firestoreFn,
  };

  // ── SEED DATA ──────────────────────────────────────────────────────────
  const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(18, 0, 0, 0); return new Ts(d); };

  // users
  coll('users').set('demo-user', {
    uid: 'demo-user', email: 'demo@test.dev', displayName: 'Демо QA',
    photoURL: '', isAdmin: false, isSharedAccount: false, office: 'СПб', accentScheme: 'blue', theme: 'light',
    createdAt: new Ts(new Date()), lastLogin: new Ts(new Date()),
  });
  coll('users').set('u-anna', {
    uid: 'u-anna', email: 'anna.petrova@test.dev', displayName: 'Анна Петрова',
    photoURL: '', isAdmin: false, isSharedAccount: false, office: 'Москва',
  });
  coll('users').set('u-ivan', {
    uid: 'u-ivan', email: 'ivan.sidorov@test.dev', displayName: 'Иван Сидоров',
    photoURL: '', isAdmin: false, isSharedAccount: false, office: 'СПб',
  });
  coll('users').set('u-olga', {
    uid: 'u-olga', email: 'olga.kuznetsova@test.dev', displayName: 'Ольга Кузнецова',
    photoURL: '', isAdmin: false, isSharedAccount: false, office: 'Москва',
  });

  // devices (5)
  coll('devices').set('DEV-001', {
    name: 'iPhone 13', model: 'iPhone 13', deviceId: 'DEV-001', type: 'phone', os: 'ios', osVersion: '17.4',
    status: 'available', isWorking: true, description: 'Apple A15, 128GB', screen: '6.1″ OLED', serial: 'F2LDV1QXXXX',
  });
  coll('devices').set('DEV-002', {
    name: 'Samsung Galaxy S21 FE', model: 'SM-G990B', deviceId: 'DEV-002', type: 'phone', os: 'android', osVersion: '14',
    status: 'available', isWorking: true, description: 'Exynos 2100, 128GB', screen: '6.4″ AMOLED', serial: 'R58T30XXXXX',
  });
  coll('devices').set('DEV-003', {
    name: 'Google Pixel 6a', model: 'GX7AS', deviceId: 'DEV-003', type: 'phone', os: 'android', osVersion: '16',
    status: 'booked', isWorking: true, description: 'Tensor, 128GB', screen: '6.1″ OLED',
    currentUserId: 'u-anna', currentUserName: 'Анна Петрова', currentUserPhoto: '',
    bookingType: 'home', bookedAt: new Ts(new Date()), bookedUntil: daysFromNow(16),
  });
  coll('devices').set('DEV-004', {
    name: 'Xiaomi Redmi Note 10 Pro', model: 'M2101K6G', deviceId: 'DEV-004', type: 'phone', os: 'android', osVersion: '12',
    status: 'booked', isWorking: true, description: 'Snapdragon 732G, 128GB', screen: '6.67″ AMOLED',
    currentUserId: 'demo-user', currentUserName: 'Демо QA', currentUserPhoto: '',
    bookingType: 'home', bookedAt: new Ts(new Date()), bookedUntil: daysFromNow(6),
  });
  coll('devices').set('DEV-005', {
    name: 'Samsung Galaxy A50', model: 'SM-A505FN', deviceId: 'DEV-005', type: 'phone', os: 'android', osVersion: '11',
    status: 'available', isWorking: false, description: 'Не включается — в ремонте', screen: '6.4″ Super AMOLED',
  });

  // projects
  const NOW = new Ts(new Date());
  coll('projects').set('proj-alfa', {
    name: 'Альфа Банк', code: 'ALFA', description: 'Мобильный банк, iOS + Android',
    isActive: true, minOsVersions: { android: '10', ios: '15', ipados: '' },
    createdAt: NOW, updatedAt: NOW, updatedBy: 'demo@test.dev',
  });
  coll('projects').set('proj-beta', {
    name: 'Бета Маркет', code: 'BETA', description: 'E-commerce приложение',
    isActive: true, minOsVersions: { android: '11', ios: '16', ipados: '16' },
    createdAt: NOW, updatedAt: NOW, updatedBy: 'demo@test.dev',
  });
  coll('projects').set('proj-gamma', {
    name: 'Гамма Доставка', code: 'GAMMA', description: 'Логистика и доставка',
    isActive: true, minOsVersions: { android: '12', ios: '16', ipados: '' },
    createdAt: NOW, updatedAt: NOW, updatedBy: 'demo@test.dev',
  });

  // project assignments (кто на каких проектах)
  const assign = (id, userId, userEmail, userName, projectId, projectName) =>
    coll('projectAssignments').set(id, {
      userId, userEmail, userName, projectId, projectName,
      isActive: true, createdAt: NOW, updatedAt: NOW, updatedBy: 'demo@test.dev',
    });
  // Авторизованный пользователь (Демо QA) — на двух проектах, чтобы можно было выбирать.
  assign('asg-demo-alfa', 'demo-user', 'demo@test.dev', 'Демо QA', 'proj-alfa', 'Альфа Банк');
  assign('asg-demo-beta', 'demo-user', 'demo@test.dev', 'Демо QA', 'proj-beta', 'Бета Маркет');
  // Остальные сотрудники — для бронирования на других людей.
  assign('asg-anna-gamma', 'u-anna', 'anna.petrova@test.dev', 'Анна Петрова', 'proj-gamma', 'Гамма Доставка');
  assign('asg-ivan-alfa', 'u-ivan', 'ivan.sidorov@test.dev', 'Иван Сидоров', 'proj-alfa', 'Альфа Банк');
  assign('asg-olga-beta', 'u-olga', 'olga.kuznetsova@test.dev', 'Ольга Кузнецова', 'proj-beta', 'Бета Маркет');

  // config
  coll('config').set('app', { forceUpdate: false, minVersion: '0.0.0', updateMessage: '' });
  coll('config').set('features', {});
  coll('config').set('featureFlags', {});

  console.log('[DEMO] Mock Firebase ready — auto-login as', DEMO_USER.email,
    '| devices:', coll('devices').size, '| users:', coll('users').size, '| projects:', coll('projects').size);
})();
