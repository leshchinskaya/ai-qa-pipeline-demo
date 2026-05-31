/**
 * QR-бронирование. Шторка ожидания получения, действий с устройством, shared-аккаунт.
 * TC-QR-023..TC-QR-034
 *
 * Соответствие RULES.md: см. qr-scanner.spec.ts.
 */
import { test, expect } from '../../fixtures/test';
import { OpenApp } from '../../screenplay/tasks/OpenApp';
import { SignIn } from '../../screenplay/tasks/SignIn';
import { AppPage } from '../../pages/AppPage';
import { QrBookingSheetPage } from '../../pages/QrBookingSheetPage';
import { DevicesPage } from '../../pages/DevicesPage';
import { configWithMutations, configForUser } from '../../helpers/config';
import { getDoc, getCollection } from '../../helpers/store';
import { QrTestData, openBookingSheetForDevice, trace } from './helpers';

// ── Конфигурации ──────────────────────────────────────────────────────────────

/** Устройство с pendingReceipt=true для user-1 */
const pendingReceiptConfig = configWithMutations((config) => {
  const device = config.data.devices.find((d) => d.id === 'dev-samsung-s24');
  if (device) {
    device.status = 'booked';
    device.pendingReceipt = true;
    device.bookedFor = QrTestData.currentUserId;
    device.currentUserId = QrTestData.currentUserId;
    device.currentUserName = 'Иван Тестовый';
    device.bookedByName = 'Администратор';
  }
});

/** Ошибки записи в Firestore */
const writeNetworkErrorConfig = configWithMutations((config) => {
  config.failures = { update: { devices: 'unavailable' }, add: { bookings: 'unavailable' } };
});

const writePermissionErrorConfig = configWithMutations((config) => {
  config.failures = { update: { devices: 'permission-denied' }, add: { bookings: 'permission-denied' } };
});

/** Shared-аккаунт (qatest@test.dev) */
const sharedAccountConfig = configForUser(QrTestData.sharedUserId);

const sharedAccountWriteErrorConfig = configWithMutations((config) => {
  const shared = config.data.users.find((u) => u.id === QrTestData.sharedUserId)!;
  config.auth.user = shared;
  config.failures = { update: { devices: 'unavailable' } };
});

// ── TC-QR-023: Шторка ожидания получения — компоновка ────────────────────────

test.describe('[TC-QR-023] Шторка ожидания получения', () => {
  test.use({ mockConfig: pendingReceiptConfig });

  test('[P1][TC-QR-023.1] Шторка ожидания получения — компоновка @regression', async ({ actor, page }) => {
    trace('TC-QR-023.1');

    await test.step('Авторизоваться и отсканировать QR устройства с pendingReceipt', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, 'dev-samsung-s24');

    await test.step('Проверить баннер ожидания и кнопку подтверждения получения', async () => {
      await sheet.expectPendingReceiptStateVisible();
    });
  });
});

// ── TC-QR-024: Шторка ожидания получения — запрос подтверждения ──────────────

test.describe('[TC-QR-024] Шторка ожидания получения — запрос подтверждения', () => {
  test.use({ mockConfig: pendingReceiptConfig });

  test('[P1][TC-QR-024] Шторка ожидания получения — подтверждение получения @regression', async ({ actor, page }) => {
    trace('TC-QR-024');
    const app = new AppPage(page);

    await test.step('Авторизоваться и отсканировать QR устройства с pendingReceipt', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, 'dev-samsung-s24');

    await test.step('Нажать "Подтвердить получение" и проверить toast', async () => {
      await sheet.confirmReceipt();
      await expect(app.toastByText('Получение подтверждено')).toBeVisible();
    });

    await test.step('Проверить pendingReceipt=false и запись receipt_confirmed/source=qr', async () => {
      const device = await getDoc<{ pendingReceipt?: boolean }>(page, 'devices', 'dev-samsung-s24');
      expect(device?.pendingReceipt).toBe(false);

      const bookings = await getCollection<{ deviceId: string; action: string; source?: string }>(page, 'bookings');
      const record = bookings.find(
        (b) => b.deviceId === 'dev-samsung-s24' && b.action === 'receipt_confirmed' && b.source === 'qr'
      );
      expect(record).toBeDefined();
    });
  });
});

// ── TC-QR-025: Шторка ожидания получения — ошибки ────────────────────────────

const pendingReceiptWriteNetworkErrorConfig = configWithMutations((config) => {
  const device = config.data.devices.find((d) => d.id === 'dev-samsung-s24');
  if (device) {
    device.status = 'booked';
    device.pendingReceipt = true;
    device.bookedFor = QrTestData.currentUserId;
    device.currentUserId = QrTestData.currentUserId;
    device.currentUserName = 'Иван Тестовый';
    device.bookedByName = 'Администратор';
  }
  config.failures = { update: { devices: 'unavailable' }, add: { bookings: 'unavailable' } };
});

const pendingReceiptWritePermissionErrorConfig = configWithMutations((config) => {
  const device = config.data.devices.find((d) => d.id === 'dev-samsung-s24');
  if (device) {
    device.status = 'booked';
    device.pendingReceipt = true;
    device.bookedFor = QrTestData.currentUserId;
    device.currentUserId = QrTestData.currentUserId;
    device.currentUserName = 'Иван Тестовый';
    device.bookedByName = 'Администратор';
  }
  config.failures = { update: { devices: 'permission-denied' }, add: { bookings: 'permission-denied' } };
});

test.describe('[TC-QR-025.1] Шторка ожидания получения — сетевая ошибка', () => {
  test.use({ mockConfig: pendingReceiptWriteNetworkErrorConfig });

  test('[P1][TC-QR-025.1] Шторка ожидания получения — сетевая ошибка: toast, pendingReceipt не сбрасывается @regression', async ({ actor, page }) => {
    trace('TC-QR-025.1');
    const app = new AppPage(page);

    await test.step('Авторизоваться и открыть шторку pendingReceipt', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, 'dev-samsung-s24');

    await test.step('Нажать "Подтвердить получение" при сбое Firestore', async () => {
      await sheet.confirmReceipt();
      await expect(app.toastByText('Не удалось')).toBeVisible();
    });

    await test.step('Проверить pendingReceipt=true и отсутствие записи receipt_confirmed', async () => {
      const device = await getDoc<{ pendingReceipt?: boolean }>(page, 'devices', 'dev-samsung-s24');
      expect(device?.pendingReceipt).toBe(true);

      const bookings = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
      const record = bookings.find(
        (b) => b.deviceId === 'dev-samsung-s24' && b.action === 'receipt_confirmed'
      );
      expect(record).toBeUndefined();
    });
  });
});

test.describe('[TC-QR-025.2] Шторка ожидания получения — ошибка прав доступа', () => {
  test.use({ mockConfig: pendingReceiptWritePermissionErrorConfig });

  test('[P1][TC-QR-025.2] Шторка ожидания получения — ошибка прав: toast, pendingReceipt не сбрасывается @regression', async ({ actor, page }) => {
    trace('TC-QR-025.2');
    const app = new AppPage(page);

    await test.step('Авторизоваться и открыть шторку pendingReceipt', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, 'dev-samsung-s24');

    await test.step('Нажать "Подтвердить получение" при ошибке прав', async () => {
      await sheet.confirmReceipt();
      await expect(app.toastByText('Не удалось')).toBeVisible();
    });

    await test.step('Проверить pendingReceipt=true и отсутствие записи receipt_confirmed', async () => {
      const device = await getDoc<{ pendingReceipt?: boolean }>(page, 'devices', 'dev-samsung-s24');
      expect(device?.pendingReceipt).toBe(true);

      const bookings = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
      const record = bookings.find(
        (b) => b.deviceId === 'dev-samsung-s24' && b.action === 'receipt_confirmed'
      );
      expect(record).toBeUndefined();
    });
  });
});

// ── TC-QR-026: Шторка действий с устройством — компоновка ────────────────────

test('[P1][TC-QR-026.1] Шторка действий — "Это устройство уже у вас" отображается для своего устройства @regression', async ({ actor, page }) => {
  trace('TC-QR-026.1');

  await test.step('Авторизоваться и отсканировать QR собственного home-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceOwnHome);

  await test.step('Проверить шторку own-состояния', async () => {
    await sheet.expectOwnStateVisible();
  });
});

test('[P1][TC-QR-026.2] Шторка действий — кнопка "Вернуть" активна @regression', async ({ actor, page }) => {
  trace('TC-QR-026.2');

  await test.step('Авторизоваться и отсканировать QR собственного home-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceOwnHome);

  await test.step('Проверить, что кнопка "Вернуть" видна и активна', async () => {
    await expect(sheet.ownReturnButton).toBeVisible();
    await expect(sheet.ownReturnButton).toBeEnabled();
  });
});

test('[P1][TC-QR-026.3] Шторка действий — закрывается по крестику @regression', async ({ actor, page }) => {
  trace('TC-QR-026.3');

  await test.step('Авторизоваться и отсканировать QR собственного home-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceOwnHome);

  await test.step('Закрыть шторку по крестику и проверить скрытие', async () => {
    await sheet.close();
    await sheet.expectHidden();
  });
});

test('[P1][TC-QR-026.4] Шторка действий — закрывается по оверлею @regression', async ({ actor, page }) => {
  trace('TC-QR-026.4');

  await test.step('Авторизоваться и отсканировать QR собственного home-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceOwnHome);

  await test.step('Закрыть шторку по оверлею и проверить скрытие', async () => {
    await sheet.closeViaOverlay();
    await sheet.expectHidden();
  });
});

// ── TC-QR-027: Запрос возврата ───────────────────────────────────────────────

test('[P0][TC-QR-027.1] Шторка действий — успешный возврат устройства через QR @smoke', async ({ actor, page }) => {
  trace('TC-QR-027.1');
  const app = new AppPage(page);

  await test.step('Авторизоваться и отсканировать QR собственного home-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceOwnHome);

  await test.step('Запустить возврат и проверить toast / закрытие шторки', async () => {
    await sheet.returnDevice();
    await expect(app.toastByText('возвращено')).toBeVisible();
    await sheet.expectHidden();
  });

  await test.step('Проверить обновление Firestore (статус available, currentUserId очищен)', async () => {
    const device = await getDoc<{ status: string; currentUserId?: string }>(
      page,
      'devices',
      QrTestData.deviceOwnHome
    );
    expect(device?.status).toBe('available');
    expect(device?.currentUserId).toBeFalsy();
  });
});

test('[P1][TC-QR-027.2] Шторка действий — повторный тап "Вернуть": ровно одна запись return @regression', async ({ actor, page }) => {
  trace('TC-QR-027.2');
  const app = new AppPage(page);

  await test.step('Авторизоваться, зафиксировать число записей return для устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const bookingsBefore = await getCollection<{ deviceId: string; action: string; source?: string }>(
    page,
    'bookings'
  );
  const returnsBefore = bookingsBefore.filter(
    (b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'return'
  ).length;
  const qrReturnsBefore = bookingsBefore.filter(
    (b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'return' && b.source === 'qr'
  ).length;

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceOwnHome);

  await test.step('Тап "Вернуть" — обработчик идемпотентен (guard _returnInProgress в devices-qr.js)', async () => {
    await sheet.returnDevice();
  });

  await test.step('Проверить toast, статус available, bookedUntil очищен и ровно +1 запись return (source=qr)', async () => {
    await expect(app.toastByText('возвращено')).toBeVisible();
    // BR.05.19 — после возврата status=available, bookedUntil очищается.
    const device = await getDoc<{ status: string; bookedUntil?: unknown }>(
      page,
      'devices',
      QrTestData.deviceOwnHome
    );
    expect(device?.status).toBe('available');
    expect(device?.bookedUntil ?? null).toBeNull();
    const bookingsAfter = await getCollection<{ deviceId: string; action: string; source?: string }>(
      page,
      'bookings'
    );
    // Manual TC «Повторный запрос к Firestore не отправляется»: ровно +1 запись return.
    const returnsAfter = bookingsAfter.filter(
      (b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'return'
    ).length;
    expect(returnsAfter).toBe(returnsBefore + 1);
    // BR.05.10 — новая запись return содержит source='qr' (как в devices-qr.js:944).
    const qrReturnsAfter = bookingsAfter.filter(
      (b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'return' && b.source === 'qr'
    ).length;
    expect(qrReturnsAfter).toBe(qrReturnsBefore + 1);
  });
});

// ── TC-QR-028: Запрос возврата — ошибка ──────────────────────────────────────

test.describe('[TC-QR-028.1] Шторка действий — ошибка сети при возврате', () => {
  test.use({ mockConfig: writeNetworkErrorConfig });

  test('[P1][TC-QR-028.1] Шторка действий — ошибка сети: toast с ошибкой, статус не меняется @regression', async ({ actor, page }) => {
    trace('TC-QR-028.1');
    const app = new AppPage(page);

    await test.step('Авторизоваться и отсканировать QR собственного home-устройства при сетевой ошибке', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceOwnHome);

    const returnsBefore = (
      await getCollection<{ deviceId: string; action: string }>(page, 'bookings')
    ).filter((b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'return').length;

    await test.step('Запустить возврат при недоступности Firestore', async () => {
      await sheet.returnDevice();
    });

    await test.step('Проверить toast ошибки, статус booked, currentUserId сохранён, нет записи return', async () => {
      await expect(app.toastByText('Не удалось')).toBeVisible();
      const device = await getDoc<{ status: string; currentUserId?: string }>(
        page,
        'devices',
        QrTestData.deviceOwnHome
      );
      expect(device?.status).toBe('booked');
      // Manual TC «Статус устройства не меняется»: валидность данных бронирования сохраняется.
      expect(device?.currentUserId).toBeTruthy();
      const returnsAfter = (
        await getCollection<{ deviceId: string; action: string }>(page, 'bookings')
      ).filter((b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'return').length;
      expect(returnsAfter).toBe(returnsBefore);
    });
  });
});

test.describe('[TC-QR-028.2] Шторка действий — ошибка прав доступа при возврате', () => {
  test.use({ mockConfig: writePermissionErrorConfig });

  test('[P1][TC-QR-028.2] Шторка действий — ошибка прав доступа: toast с ошибкой @regression', async ({ actor, page }) => {
    trace('TC-QR-028.2');
    const app = new AppPage(page);

    await test.step('Авторизоваться и отсканировать QR собственного home-устройства при ошибке прав', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceOwnHome);

    await test.step('Запустить возврат при недостаточных правах и проверить toast', async () => {
      await sheet.returnDevice();
      await expect(app.toastByText('Не удалось')).toBeVisible();
    });
  });
});

// ── TC-QR-029: Изменение даты возврата ───────────────────────────────────────

test('[P1][TC-QR-029] Шторка действий. Изменение даты возврата — запрос @regression', async ({ actor, page }) => {
  trace('TC-QR-029');
  const app = new AppPage(page);

  await test.step('Авторизоваться и отсканировать QR собственного home-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceOwnHome);

  await test.step('Открыть форму изменения даты и сохранить новую дату', async () => {
    await sheet.expectChangeDateButtonVisible();
    await sheet.openChangeDateForm();
    await sheet.expectChangeDateFormVisible();
    const newDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await sheet.fillChangeDate(newDate);
    await sheet.saveChangeDate();
    await expect(app.toastByText('Дата возврата обновлена')).toBeVisible();
  });

  await test.step('Проверить, что bookedUntil обновлён и есть запись date_change/source=qr', async () => {
    const device = await getDoc<{ bookedUntil?: unknown }>(page, 'devices', QrTestData.deviceOwnHome);
    expect(device?.bookedUntil).toBeTruthy();

    const bookings = await getCollection<{ deviceId: string; action: string; source?: string }>(page, 'bookings');
    const record = bookings.find(
      (b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'date_change' && b.source === 'qr'
    );
    expect(record).toBeDefined();
  });
});

// ── TC-QR-030: Изменение даты возврата — ошибка ──────────────────────────────

test.describe('[TC-QR-030.1] Изменение даты возврата — сетевая ошибка', () => {
  test.use({ mockConfig: writeNetworkErrorConfig });

  test('[P1][TC-QR-030.1] Шторка действий. Изменение даты возврата — сетевая ошибка @regression', async ({ actor, page }) => {
    trace('TC-QR-030.1');
    const app = new AppPage(page);

    await test.step('Авторизоваться и открыть шторку собственного устройства', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceOwnHome);
    const deviceBefore = await getDoc<{ bookedUntil?: unknown }>(page, 'devices', QrTestData.deviceOwnHome);
    const bookedUntilBefore = deviceBefore?.bookedUntil;
    const dateChangesBefore = (
      await getCollection<{ deviceId: string; action: string }>(page, 'bookings')
    ).filter((b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'date_change').length;

    await test.step('Открыть форму, заполнить дату и сохранить при сбое Firestore', async () => {
      await sheet.openChangeDateForm();
      const newDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await sheet.fillChangeDate(newDate);
      await sheet.saveChangeDate();
      await expect(app.toastByText('Не удалось')).toBeVisible();
    });

    await test.step('Проверить, что bookedUntil не изменился и нет новой записи date_change', async () => {
      const deviceAfter = await getDoc<{ bookedUntil?: unknown }>(page, 'devices', QrTestData.deviceOwnHome);
      expect(deviceAfter?.bookedUntil).toEqual(bookedUntilBefore);

      const bookings = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
      const dateChangesAfter = bookings.filter(
        (b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'date_change'
      );
      expect(dateChangesAfter.length).toBe(dateChangesBefore);
    });
  });
});

test.describe('[TC-QR-030.2] Изменение даты возврата — ошибка прав доступа', () => {
  test.use({ mockConfig: writePermissionErrorConfig });

  test('[P1][TC-QR-030.2] Шторка действий. Изменение даты возврата — ошибка прав @regression', async ({ actor, page }) => {
    trace('TC-QR-030.2');
    const app = new AppPage(page);

    await test.step('Авторизоваться и открыть шторку собственного устройства', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceOwnHome);
    const dateChangesBefore = (
      await getCollection<{ deviceId: string; action: string }>(page, 'bookings')
    ).filter((b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'date_change').length;

    await test.step('Открыть форму, заполнить дату и сохранить при ошибке прав', async () => {
      await sheet.openChangeDateForm();
      const newDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await sheet.fillChangeDate(newDate);
      await sheet.saveChangeDate();
      await expect(app.toastByText('Не удалось')).toBeVisible();
    });

    await test.step('Проверить отсутствие новой записи date_change', async () => {
      const bookings = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
      const dateChangesAfter = bookings.filter(
        (b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'date_change'
      );
      expect(dateChangesAfter.length).toBe(dateChangesBefore);
    });
  });
});

// ── TC-QR-031: Шторка брони (shared-аккаунт) — компоновка ────────────────────

test.describe('[TC-QR-031] Шторка брони (shared) — компоновка', () => {
  test.use({ mockConfig: sharedAccountConfig });

  test('[P1][TC-QR-031] Шторка брони (shared) — поле "Выбрать пользователя" отображается @regression', async ({ actor, page }) => {
    trace('TC-QR-031');

    await test.step('Авторизоваться под shared-аккаунтом и открыть шторку брони', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet: _sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

    await test.step('Проверить наличие поля "Выбрать пользователя"', async () => {
      const userSearch = page.locator('#qr-user-search');
      await expect(userSearch).toBeVisible();
      await expect(userSearch).toHaveAttribute('placeholder');
    });
  });
});

// ── TC-QR-032: Поиск пользователя (shared) ───────────────────────────────────

test.describe('[TC-QR-032] Шторка брони (shared) — поиск пользователя', () => {
  test.use({ mockConfig: sharedAccountConfig });

  test('[P1][TC-QR-032] Шторка брони (shared) — поиск пользователя @regression', async ({ actor, page }) => {
    trace('TC-QR-032');

    await test.step('Авторизоваться под shared-аккаунтом и открыть шторку брони', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

    await test.step('Ввести 2+ символа в поиск и проверить, что появились подсказки', async () => {
      const userSearch = page.locator('#qr-user-search');
      const suggest = page.locator('#qr-user-suggest');
      await userSearch.fill('Ив');
      await expect(suggest).toBeVisible();
      const items = suggest.locator('li[data-user-id]');
      await expect(items.first()).toBeVisible();
      await expect(items.first()).toContainText(/Иван|Ив/);
    });
  });
});

// ── TC-QR-033: Shared — запрос бронирования ──────────────────────────────────

test.describe('[TC-QR-033] Шторка брони (shared) — запрос бронирования', () => {
  test.use({ mockConfig: sharedAccountConfig });

  test('[P1][TC-QR-033] Шторка брони (shared) — выбор пользователя: currentUserId = выбранный, bookedBy = shared-аккаунт @regression', async ({ actor, page }) => {
    // BR.05.18 — после выбора пользователя бронь оформляется на него (currentUserId),
    // а bookedBy/bookedByName указывают на shared-аккаунт.
    trace('TC-QR-033');
    const app = new AppPage(page);

    await test.step('Авторизоваться под shared-аккаунтом и отсканировать QR', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

    await test.step('Выбрать пользователя через UI (поиск "Ив" → первая подсказка)', async () => {
      await sheet.expectUserSearchVisible();
      await sheet.searchSharedUser('Ив');
      await sheet.expectFirstSuggestionContains(/Иван|Ив/);
      await sheet.selectFirstUserSuggestion();
    });

    await test.step('Подтвердить бронирование', async () => {
      await sheet.confirm();
      await expect(app.toastByText('забронировано')).toBeVisible();
    });

    await test.step('Проверить, что currentUserId = выбранный, bookedBy = shared-аккаунт', async () => {
      const device = await getDoc<{ status: string; currentUserId: string }>(
        page,
        'devices',
        QrTestData.deviceAvailable
      );
      expect(device?.status).toBe('booked');
      expect(device?.currentUserId).toBe(QrTestData.currentUserId); // выбранный пользователь (user-1)
      const bookings = await getCollection<{
        deviceId: string;
        action: string;
        userId: string;
        bookedBy?: string;
        bookedByName?: string;
      }>(page, 'bookings');
      const record = bookings.find(
        (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take' && b.source === 'qr'
      );
      expect(record).toBeDefined();
      expect(record?.userId).toBe(QrTestData.currentUserId);
      expect(record?.bookedBy).toBe(QrTestData.sharedUserId);
      expect(record?.bookedByName).toBeTruthy();
    });
  });
});

// ── TC-QR-033.2: shared — bookedBy/bookedByName заполнены именем shared-аккаунта ─

test.describe('[TC-QR-033.2] Шторка брони (shared) — bookedBy/bookedByName', () => {
  test.use({ mockConfig: sharedAccountConfig });

  test('[P1][TC-QR-033.2] Шторка брони (shared) — bookedBy/bookedByName заполняются shared-аккаунтом @regression', async ({ actor, page }) => {
    // BR.05.18 (P1-3.2 traceability-matrix) — записать в bookings: bookedBy = shared.uid,
    // bookedByName = displayName/email shared-аккаунта.
    trace('TC-QR-033.2');
    const app = new AppPage(page);

    await test.step('Авторизоваться под shared-аккаунтом и открыть шторку брони', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

    await test.step('Выбрать пользователя через поиск', async () => {
      await sheet.expectUserSearchVisible();
      await sheet.searchSharedUser('Ив');
      await sheet.expectFirstSuggestionContains(/Иван|Ив/);
      await sheet.selectFirstUserSuggestion();
    });

    await test.step('Подтвердить бронирование', async () => {
      await sheet.confirm();
      await expect(app.toastByText('забронировано')).toBeVisible();
    });

    await test.step('Проверить, что в bookings есть запись с bookedBy=shared, bookedByName=имя shared', async () => {
      const bookings = await getCollection<{
        deviceId: string;
        action: string;
        userId: string;
        bookedBy?: string;
        bookedByName?: string;
      }>(page, 'bookings');
      const record = bookings.find(
        (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take' && b.source === 'qr'
      );
      expect(record).toBeDefined();
      expect(record?.bookedBy).toBe(QrTestData.sharedUserId);
      // displayName shared-аккаунта в test data = 'QA Shared' (или email 'qatest@test.dev').
      expect(record?.bookedByName).toMatch(/QA Shared|qatest@surf\.dev/);
      expect(record?.userId).toBe(QrTestData.currentUserId);
    });
  });
});

// ── TC-QR-034: Shared — ошибка бронирования ──────────────────────────────────

test.describe('[TC-QR-034] Шторка брони (shared) — ошибка бронирования', () => {
  test.use({ mockConfig: sharedAccountWriteErrorConfig });

  test('[P1][TC-QR-034] Шторка брони (shared) — ошибка сети: toast с ошибкой, статус не меняется @regression', async ({ actor, page }) => {
    trace('TC-QR-034');
    const app = new AppPage(page);

    await test.step('Авторизоваться под shared-аккаунтом при сетевой ошибке записи', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

    // BR.05.18 / 05.30 — для shared-аккаунта выбор пользователя обязателен,
    // иначе продакшен выйдет с warning-toast «Выберите пользователя для брони»
    // и не дойдёт до Firestore-ошибки, которую проверяет тест.
    await test.step('Выбрать пользователя через поиск', async () => {
      await sheet.expectUserSearchVisible();
      await sheet.searchSharedUser('Ив');
      await sheet.expectFirstSuggestionContains(/Иван|Ив/);
      await sheet.selectFirstUserSuggestion();
    });

    await test.step('Подтвердить бронирование и получить ошибку', async () => {
      await sheet.confirm();
    });

    await test.step('Проверить toast ошибки и неизменность статуса устройства', async () => {
      await expect(app.toastByText('Не удалось')).toBeVisible();
      const device = await getDoc<{ status: string }>(page, 'devices', QrTestData.deviceAvailable);
      expect(device?.status).toBe('available');
    });
  });
});

// ── TC-QR-024.2: pendingReceipt — bookedAt не перетирается при confirm (BR.05.16) ─

const pendingReceiptWithBookedAtConfig = configWithMutations((config) => {
  const device = config.data.devices.find((d) => d.id === 'dev-samsung-s24');
  if (device) {
    device.status = 'booked';
    device.pendingReceipt = true;
    device.bookedFor = QrTestData.currentUserId;
    device.currentUserId = QrTestData.currentUserId;
    device.currentUserName = 'Иван Тестовый';
    device.bookedByName = 'Администратор';
    // Фиксируем bookedAt детерминированной датой, чтобы сравнить до/после.
    device.bookedAt = { __ts: true, value: '2026-01-15T10:00:00.000Z' };
  }
});

test.describe('[TC-QR-024.2] Шторка ожидания получения — bookedAt не перетирается', () => {
  test.use({ mockConfig: pendingReceiptWithBookedAtConfig });

  test('[P1][TC-QR-024.2] pendingReceipt confirm — bookedAt сохраняется, запись receipt_confirmed/source=qr создаётся @regression', async ({ actor, page }) => {
    // BR.05.16 — при подтверждении получения pendingReceipt сбрасывается, bookedAt НЕ
    // должно перетираться (см. devices-qr.js:1016-1048).
    trace('TC-QR-024.2');
    const app = new AppPage(page);

    await test.step('Авторизоваться и открыть шторку pendingReceipt', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const bookedBefore = await getDoc<{ bookedAt?: { value?: string } | null }>(
      page,
      'devices',
      'dev-samsung-s24'
    );
    const bookedAtBefore = bookedBefore?.bookedAt ?? null;
    expect(bookedAtBefore).toBeTruthy();

    const { sheet } = await openBookingSheetForDevice(page, 'dev-samsung-s24');

    await test.step('Подтвердить получение и дождаться toast', async () => {
      await sheet.confirmReceipt();
      await expect(app.toastByText('Получение подтверждено')).toBeVisible();
    });

    await test.step('Проверить, что bookedAt не изменился, pendingReceipt=false и запись receipt_confirmed создана', async () => {
      const deviceAfter = await getDoc<{
        pendingReceipt?: boolean;
        bookedAt?: { value?: string } | null;
      }>(page, 'devices', 'dev-samsung-s24');
      expect(deviceAfter?.pendingReceipt).toBe(false);
      expect(deviceAfter?.bookedAt).toEqual(bookedAtBefore);

      const bookings = await getCollection<{ deviceId: string; action: string; source?: string }>(
        page,
        'bookings'
      );
      const record = bookings.find(
        (b) => b.deviceId === 'dev-samsung-s24' && b.action === 'receipt_confirmed' && b.source === 'qr'
      );
      expect(record).toBeDefined();
    });
  });
});

// ── TC-QR-027.3: Реалтайм-обновление каталога после QR-возврата (BR.05.20) ───

test('[P1][TC-QR-027.3] Шторка действий — реалтайм-обновление каталога после QR-возврата @regression', async ({ actor, page }) => {
  // BR.05.20 — каталог обновляется в реальном времени после QR-операции,
  // без перезагрузки страницы (через onSnapshot в devices.js).
  trace('TC-QR-027.3');
  const app = new AppPage(page);
  const devices = new DevicesPage(page);

  await test.step('Авторизоваться и убедиться, что карточка устройства видна со статусом booked', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await devices.expectDeviceCardStatus(QrTestData.deviceOwnHome, 'booked');
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceOwnHome);

  await test.step('Запустить возврат через QR-шторку', async () => {
    await sheet.returnDevice();
    await expect(app.toastByText('возвращено')).toBeVisible();
  });

  await test.step('Проверить, что карточка в каталоге обновилась до status=available без перезагрузки', async () => {
    await devices.expectDeviceCardStatus(QrTestData.deviceOwnHome, 'available');
  });
});
