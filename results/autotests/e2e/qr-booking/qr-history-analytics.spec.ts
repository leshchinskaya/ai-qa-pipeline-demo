/**
 * QR-бронирование. История QR-операций, аналитика, карточка устройства, уведомления.
 * TC-QR-035..TC-QR-038
 *
 * Соответствие RULES.md: см. qr-scanner.spec.ts.
 */
import { test, expect } from '../../fixtures/test';
import { OpenApp } from '../../screenplay/tasks/OpenApp';
import { SignIn } from '../../screenplay/tasks/SignIn';
import { NavigateToTab } from '../../screenplay/tasks/NavigateToTab';
import { AppPage } from '../../pages/AppPage';
import { QrScannerPage } from '../../pages/QrScannerPage';
import { QrBookingSheetPage } from '../../pages/QrBookingSheetPage';
import { HistoryPage } from '../../pages/HistoryPage';
import { DevicesPage } from '../../pages/DevicesPage';
import { DeviceDetailsModal } from '../../pages/DeviceDetailsModal';
import { configWithMutations } from '../../helpers/config';
import { getCollection } from '../../helpers/store';
import { QrTestData, trace } from './helpers';

// ── TC-QR-035: История — QR-операции ─────────────────────────────────────────

test('[P1][TC-QR-035.1] История — после QR-бронирования появляется запись action=take @regression', async ({ actor, page }) => {
  trace('TC-QR-035.1');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);
  const app = new AppPage(page);

  await test.step('Авторизоваться, открыть сканер и эмулировать скан доступного устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan(QrTestData.deviceAvailable);
    await sheet.expectVisible();
  });

  await test.step('Подтвердить бронирование', async () => {
    await sheet.confirm();
    await expect(app.toastByText('забронировано')).toBeVisible();
  });

  await test.step('Проверить, что запись action=take содержит source=qr и bookingType=office', async () => {
    // BR.05.10 — запись содержит source='qr' и bookingType (devices-qr.js:862-867).
    const bookings = await getCollection<{
      deviceId: string;
      action: string;
      deviceName?: string;
      userId?: string;
      source?: string;
      bookingType?: string;
    }>(page, 'bookings');
    const record = bookings.find(
      (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take' && b.source === 'qr'
    );
    expect(record).toBeDefined();
    expect(record?.deviceName).toBeTruthy();
    expect(record?.userId).toBeTruthy();
    expect(record?.source).toBe('qr');
    expect(record?.bookingType).toBe('office');
  });
});

test('[P1][TC-QR-035.2] История — после QR-возврата появляется запись action=return с source=qr @regression', async ({ actor, page }) => {
  trace('TC-QR-035.2');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);
  const app = new AppPage(page);

  await test.step('Авторизоваться, открыть сканер и эмулировать скан своего home-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan(QrTestData.deviceOwnHome);
    await sheet.expectVisible();
  });

  await test.step('Запустить возврат устройства через QR', async () => {
    await sheet.returnDevice();
    await expect(app.toastByText('возвращено')).toBeVisible();
  });

  await test.step('Проверить, что в bookings есть ровно одна запись action=return, source=qr', async () => {
    const bookings = await getCollection<{ deviceId: string; action: string; source?: string }>(
      page,
      'bookings'
    );
    const records = bookings.filter(
      (b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'return' && b.source === 'qr'
    );
    // Manual TC: возврат через QR помечается source='qr' и создаёт ровно одну запись.
    expect(records).toHaveLength(1);
  });
});

test('[P1][TC-QR-035.3] История — QR-операции отображаются в общей ленте истории @regression', async ({ actor, page }) => {
  trace('TC-QR-035.3');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);
  const app = new AppPage(page);
  const history = new HistoryPage(page);

  await test.step('Авторизоваться, открыть сканер и подтвердить бронь по QR', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan(QrTestData.deviceAvailable);
    await sheet.expectVisible();
    await sheet.confirm();
    await expect(app.toastByText('забронировано')).toBeVisible();
  });

  await test.step('Перейти на вкладку "История" и проверить наличие записи в таблице', async () => {
    await actor.attemptsTo(NavigateToTab('history'));
    await history.expectAnyRowVisible();
  });
});

test('[P1][TC-QR-035.4] История — source=qr отображается в записях брони @regression', async ({ actor, page }) => {
  trace('TC-QR-035.4');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);
  const app = new AppPage(page);

  await test.step('Авторизоваться и отсканировать QR доступного устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan(QrTestData.deviceAvailable);
    await sheet.expectVisible();
  });

  await test.step('Подтвердить office-бронь', async () => {
    await sheet.confirm();
    await expect(app.toastByText('забронировано')).toBeVisible();
  });

  await test.step('Проверить, что запись take содержит source="qr"', async () => {
    const bookings = await getCollection<{ deviceId: string; action: string; source?: string }>(
      page,
      'bookings'
    );
    const record = bookings.find(
      (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take' && b.source === 'qr'
    );
    expect(record).toBeDefined();
    expect(record?.source).toBe('qr');
  });
});

// ── TC-QR-036: Аналитика — событие qr_scan ───────────────────────────────────

test('[P1][TC-QR-036] Аналитика — событие qr_scan отправляется при сканировании @regression', async ({ actor, page }) => {
  trace('TC-QR-036');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Эмулировать успешный скан доступного устройства', async () => {
    await scanner.simulateScan(QrTestData.deviceAvailable);
    await sheet.expectVisible();
  });

  await test.step('Проверить, что событие qr_scan с result=device_found и source=camera отправлено', async () => {
    // BR.05.28 — payload содержит source (для simulateScan через onScanSuccess дефолт 'camera').
    const events = await page.evaluate(() => (window as any).__analyticsEvents || []);
    const found = (events as Array<{ event: string; payload: { deviceId?: string; result?: string; source?: string } }>)
      .filter(
        (e) =>
          e.event === 'qr_scan' &&
          e.payload?.deviceId === QrTestData.deviceAvailable &&
          e.payload?.result === 'device_found' &&
          e.payload?.source === 'camera'
      );
    expect(found.length).toBeGreaterThanOrEqual(1);
  });
});

test('[P1][TC-QR-036.2] Аналитика — событие qr_scan с result=device_not_found @regression', async ({ actor, page }) => {
  trace('TC-QR-036.2');
  const scanner = new QrScannerPage(page);
  const app = new AppPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Эмулировать скан несуществующего deviceId', async () => {
    await scanner.simulateScan(QrTestData.unknownDeviceId);
    await expect(app.toastByText('не найдено')).toBeVisible();
  });

  await test.step('Проверить событие qr_scan с result=device_not_found и source=camera', async () => {
    // BR.05.28 — payload.source='camera' для simulateScan (onScanSuccess).
    const events = await page.evaluate(() => (window as any).__analyticsEvents || []);
    const found = (events as Array<{ event: string; payload: { deviceId?: string; result?: string; source?: string } }>)
      .filter(
        (e) =>
          e.event === 'qr_scan' &&
          e.payload?.deviceId === QrTestData.unknownDeviceId &&
          e.payload?.result === 'device_not_found' &&
          e.payload?.source === 'camera'
      );
    expect(found.length).toBeGreaterThanOrEqual(1);
  });
});

test('[P1][TC-QR-036.3] Аналитика — событие qr_scan с result=invalid_payload @regression', async ({ actor, page }) => {
  trace('TC-QR-036.3');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Эмулировать скан невалидного payload', async () => {
    await scanner.simulateScan('!!!invalid payload!!!');
  });

  await test.step('Проверить событие qr_scan с result=invalid_payload и source=camera', async () => {
    // BR.05.28 — payload.source='camera' для simulateScan.
    const events = await page.evaluate(() => (window as any).__analyticsEvents || []);
    const found = (events as Array<{ event: string; payload: { deviceId?: string | null; result?: string; source?: string } }>)
      .filter(
        (e) => e.event === 'qr_scan' && e.payload?.result === 'invalid_payload' && e.payload?.source === 'camera'
      );
    expect(found.length).toBeGreaterThanOrEqual(1);
  });
});

// ── TC-QR-036.4: Аналитика — qr_scan для invalid_payload содержит source ────

test('[P1][TC-QR-036.4] Аналитика — событие qr_scan с result=invalid_payload и source=manual @regression', async ({ actor, page }) => {
  // BR.05.28 — для ручного ввода код шлёт source='manual' (devices-qr.js:263, 311).
  trace('TC-QR-036.4');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Через ручной ввод отправить невалидный payload', async () => {
    await scanner.typeManualId('!!!invalid!!!');
    await scanner.submitManualId();
  });

  await test.step('Проверить событие qr_scan с result=invalid_payload и source=manual', async () => {
    const events = await page.evaluate(() => (window as any).__analyticsEvents || []);
    const found = (events as Array<{ event: string; payload: { result?: string; source?: string } }>)
      .filter(
        (e) => e.event === 'qr_scan' && e.payload?.result === 'invalid_payload' && e.payload?.source === 'manual'
      );
    expect(found.length).toBeGreaterThanOrEqual(1);
  });
});

// ── TC-QR-036.5: Аналитика — скан занятого чужим: device_found, source=camera ─

test('[P1][TC-QR-036.5] Аналитика — qr_scan для занятого чужим устройством: result=device_found, source=camera @regression', async ({ actor, page }) => {
  // BR.05.28 (частично) — закрепляем текущее поведение кода: код шлёт device_found для
  // любого найденного устройства, независимо от занятости. Когда требование будет
  // переработано (already_booked_other) — этот тест нужно обновить.
  trace('TC-QR-036.5');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Эмулировать скан занятого чужим устройства', async () => {
    await scanner.simulateScan(QrTestData.deviceBookedByOther);
    await sheet.expectVisible();
  });

  await test.step('Проверить событие qr_scan с result=device_found, source=camera', async () => {
    const events = await page.evaluate(() => (window as any).__analyticsEvents || []);
    const found = (events as Array<{ event: string; payload: { deviceId?: string; result?: string; source?: string } }>)
      .filter(
        (e) =>
          e.event === 'qr_scan' &&
          e.payload?.deviceId === QrTestData.deviceBookedByOther &&
          e.payload?.result === 'device_found' &&
          e.payload?.source === 'camera'
      );
    expect(found.length).toBeGreaterThanOrEqual(1);
  });
});

// ── TC-QR-027.4: Параметризованный — bookingType в bookings соответствует устройству ─

for (const { mode, expectedBookingType } of [
  { mode: 'office' as const, expectedBookingType: 'office' as const },
  { mode: 'home' as const, expectedBookingType: 'home' as const },
]) {
  test(`[P1][TC-QR-027.4] Аналитика — bookings.bookingType = ${expectedBookingType} соответствует Firestore-полю устройства @regression`, async ({
    actor,
    page,
  }) => {
    // BR.05.10 — запись bookings.bookingType должна совпадать с deviceUpdate.bookingType.
    trace(`TC-QR-027.4-${mode}`);
    const scanner = new QrScannerPage(page);
    const sheet = new QrBookingSheetPage(page);
    const app = new AppPage(page);

    await test.step('Авторизоваться, отсканировать доступное устройство, открыть шторку', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await scanner.open();
      await scanner.simulateScan(QrTestData.deviceAvailable);
      await sheet.expectVisible();
    });

    await test.step(`Подтвердить бронь типа ${mode}` , async () => {
      if (mode === 'home') {
        await sheet.selectHomeType();
        // Импорт addDays/formatDate — через helpers/date (используется в других тестах).
        const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        await sheet.fillReturnDate(futureDate);
      }
      await sheet.confirm();
      await expect(app.toastByText('забронировано')).toBeVisible();
    });

    await test.step(`Проверить, что bookings.bookingType=${expectedBookingType} и endDate соответствует режиму`, async () => {
      const bookings = await getCollection<{
        deviceId: string;
        action: string;
        bookingType?: string;
        endDate?: unknown;
        source?: string;
      }>(page, 'bookings');
      const record = bookings.find(
        (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take' && b.source === 'qr'
      );
      expect(record).toBeDefined();
      expect(record?.bookingType).toBe(expectedBookingType);
      if (mode === 'home') {
        expect(record?.endDate).toBeTruthy();
      } else {
        expect(record?.endDate ?? null).toBeNull();
      }
    });
  });
}

// ── TC-QR-035.6: История — строка для date_change (BR.05.13 + 05.19) ──────────

test('[P1][TC-QR-035.6] История — после QR date_change в таблице видна строка с deviceName и action «Изменил дату» @regression', async ({ actor, page }) => {
  // BR.05.13 — QR-операции попадают в общую ленту; date_change рендерится как «Изменил дату»
  // (app.js:1691 getActionBadge → DATE_CHANGE: 'Изменил дату').
  trace('TC-QR-035.6');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);
  const app = new AppPage(page);
  const history = new HistoryPage(page);

  await test.step('Авторизоваться и отсканировать QR своего home-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan(QrTestData.deviceOwnHome);
    await sheet.expectVisible();
  });

  await test.step('Открыть форму изменения даты, заполнить и сохранить', async () => {
    await sheet.openChangeDateForm();
    await sheet.expectChangeDateFormVisible();
    const newDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await sheet.fillChangeDate(newDate);
    await sheet.saveChangeDate();
    await expect(app.toastByText('Дата возврата обновлена')).toBeVisible();
  });

  await test.step('Перейти на вкладку «История» и найти строку с action «Изменил дату»', async () => {
    await actor.attemptsTo(NavigateToTab('history'));
    // deviceName для deviceOwnHome — «Booked iPhone» из defaultMockConfig.
    await history.expectRowForDeviceAction('Booked iPhone', 'Изменил дату');
  });
});

// ── TC-QR-035.5: История — строка в UI ленты с deviceName + action ────────────

test('[P1][TC-QR-035.5] История — после QR-возврата в таблице видна строка с deviceName и action @regression', async ({ actor, page }) => {
  // BR.05.13 — QR-операции отображаются на вкладке «История». Маркер source='qr' в UI
  // не реализован (см. coverage-plan §Notes), поэтому проверяем по deviceName + action-тексту.
  trace('TC-QR-035.5');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);
  const app = new AppPage(page);
  const history = new HistoryPage(page);

  await test.step('Авторизоваться, отсканировать своё home-устройство и вернуть его', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan(QrTestData.deviceOwnHome);
    await sheet.expectVisible();
    await sheet.returnDevice();
    await expect(app.toastByText('возвращено')).toBeVisible();
  });

  await test.step('Перейти на вкладку "История" и найти строку для устройства', async () => {
    await actor.attemptsTo(NavigateToTab('history'));
    // deviceName для deviceOwnHome — "Booked iPhone"; action='return' рендерится как «Вернул»
    // (см. app.js:1689 getActionBadge).
    await history.expectRowForDeviceAction('Booked iPhone', 'Вернул');
  });
});

// ── TC-QR-037: Карточка устройства — QR-код ──────────────────────────────────

test('[P1][TC-QR-037] Карточка устройства. QR-код — отображается в карточке @regression', async ({ actor, page }) => {
  trace('TC-QR-037');
  const devices = new DevicesPage(page);
  const details = new DeviceDetailsModal(page);

  await test.step('Авторизоваться и открыть карточку устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await devices.openDeviceCardById(QrTestData.deviceAvailable);
    await details.expectVisible();
  });

  await test.step('Проверить отображение QR и отсутствие чувствительных данных', async () => {
    await details.expectQrBlockVisible();
    await details.expectQrImageVisible();
    await details.expectQrImageEncodesOnly(QrTestData.deviceAvailable);
    await details.expectQrImageHasNoSensitiveData();
  });
});

// ── TC-QR-024.3: История — строка для receipt_confirmed (BR.05.13 + 05.16) ───

const pendingReceiptHistoryConfig = configWithMutations((config) => {
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

test.describe('[TC-QR-024.3] История — receipt_confirmed', () => {
  test.use({ mockConfig: pendingReceiptHistoryConfig });

  test('[P1][TC-QR-024.3] История — после receipt_confirmed в таблице видна строка с action «Подтверждено получение» @regression', async ({ actor, page }) => {
    // BR.05.13 + BR.05.16 — receipt_confirmed попадает в общую ленту истории;
    // app.js:1693 getActionBadge → 'Подтверждено получение'.
    trace('TC-QR-024.3');
    const scanner = new QrScannerPage(page);
    const sheet = new QrBookingSheetPage(page);
    const app = new AppPage(page);
    const history = new HistoryPage(page);

    await test.step('Авторизоваться и отсканировать QR устройства с pendingReceipt', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await scanner.open();
      await scanner.simulateScan('dev-samsung-s24');
      await sheet.expectVisible();
    });

    await test.step('Подтвердить получение', async () => {
      await sheet.expectPendingReceiptStateVisible();
      await sheet.confirmReceipt();
      await expect(app.toastByText('Получение подтверждено')).toBeVisible();
    });

    await test.step('Перейти на вкладку «История» и найти строку для устройства', async () => {
      await actor.attemptsTo(NavigateToTab('history'));
      // deviceName для dev-samsung-s24 из defaultMockConfig — «Samsung Galaxy S24».
      await history.expectRowForDeviceAction('Samsung Galaxy S24', 'Подтверждено получение');
    });
  });
});

// ── TC-QR-038: Уведомления — смена владельца ─────────────────────────────────

const ownerTransferConfig = configWithMutations((config) => {
  const device = config.data.devices.find((d) => d.id === 'dev-iphone-13');
  if (device) {
    device.status = 'available';
    device.currentUserId = 'user-2';
    device.currentUserName = 'Ольга Второй';
  }
});

test.describe('[TC-QR-038] Уведомления — смена владельца через QR', () => {
  test.use({ mockConfig: ownerTransferConfig });

  test('[P1][TC-QR-038] Уведомления — in-app уведомление при смене владельца через QR @regression', async ({ actor, page }) => {
    trace('TC-QR-038');
    const scanner = new QrScannerPage(page);
    const sheet = new QrBookingSheetPage(page);
    const app = new AppPage(page);

    await test.step('Авторизоваться и отсканировать QR устройства предыдущего владельца', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await scanner.open();
      await scanner.simulateScan('dev-iphone-13');
      await sheet.expectVisible();
    });

    await test.step('Подтвердить бронь', async () => {
      await sheet.confirm();
      await expect(app.toastByText('забронировано')).toBeVisible();
    });

    await test.step('Проверить, что предыдущему владельцу создано уведомление device_taken', async () => {
      const notifications = await getCollection<{
        userId: string;
        type: string;
        deviceId: string;
        deviceName?: string;
        by?: string;
        byName?: string;
      }>(page, 'notifications');
      const record = notifications.find(
        (n) => n.userId === 'user-2' && n.type === 'device_taken' && n.deviceId === 'dev-iphone-13'
      );
      expect(record).toBeDefined();
      // BR.05.25 — payload в дополнение к smoke-полям содержит deviceName, чтобы
      // получатель видел, какое устройство забрали (devices-qr.js:941-950).
      expect(record?.deviceName).toBeTruthy();
    });
  });

  test('[P1][TC-QR-038.2] Уведомления — payload device_taken содержит deviceName, by и byName @regression', async ({ actor, page }) => {
    // BR.05.25 — Notifications.notify({type:'device_taken'}) пишет deviceName,
    // by (uid нового владельца) и byName (имя). Текущий TC-QR-038 покрывал только
    // userId/type/deviceId; здесь — полный набор payload-полей.
    trace('TC-QR-038.2');
    const scanner = new QrScannerPage(page);
    const sheet = new QrBookingSheetPage(page);
    const app = new AppPage(page);

    await test.step('Авторизоваться и отсканировать QR устройства предыдущего владельца', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await scanner.open();
      await scanner.simulateScan('dev-iphone-13');
      await sheet.expectVisible();
    });

    await test.step('Подтвердить бронь', async () => {
      await sheet.confirm();
      await expect(app.toastByText('забронировано')).toBeVisible();
    });

    await test.step('Проверить полный payload device_taken: deviceName/by/byName', async () => {
      const notifications = await getCollection<{
        userId: string;
        type: string;
        deviceId: string;
        deviceName?: string;
        by?: string;
        byName?: string;
      }>(page, 'notifications');
      const record = notifications.find(
        (n) => n.userId === 'user-2' && n.type === 'device_taken' && n.deviceId === 'dev-iphone-13'
      );
      expect(record).toBeDefined();
      // deviceName — каноничное имя устройства (iPhone 13 из defaultMockConfig).
      expect(record?.deviceName).toBeTruthy();
      expect(record?.deviceName).toMatch(/iPhone/i);
      // by — uid нового владельца (текущий пользователь, который сделал take).
      expect(record?.by).toBe(QrTestData.currentUserId);
      // byName — имя нового владельца (displayName || email).
      expect(record?.byName).toBeTruthy();
    });
  });
});
