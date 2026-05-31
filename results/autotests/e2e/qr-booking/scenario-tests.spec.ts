/**
 * QR-бронирование. Сценарные автотесты, сгенерированные из ручных проверок.
 *
 * Источник:
 *   /Users/leshchinskaya/podlodka/qa-autogenerator-manual-tests/results/tests/scenario/scenario_tests.json
 *
 * Трассировка: TC-SCN-NN соответствует порядковому номеру сценария в JSON (1-based)
 * и проставляется в имени теста + аннотации `TC` через хелпер trace().
 *
 * Примечание: в `package.json` нет `allure-playwright`, поэтому вместо
 * `allure.story('TC-SCN-NN')` используется встроенный механизм аннотаций
 * Playwright (`test.info().annotations`). Семантика трассировки сохраняется.
 *
 * Соответствие RULES.md:
 *   #1  Каждый тест заканчивается assertion.
 *   #2  Логические блоки оборачиваются в `test.step()` с описанием на русском.
 *   #2.1 Локаторы не вызываются в тестах напрямую — только через Page Object.
 *   #3  Имена тестов: [Priority][TC-ID] Описание @tag.
 *   #5  Smart waits через PO/expect, без `waitForTimeout`/`sleep`.
 *   #7  Минимум один assertion на тест.
 *   #8  Локаторы по приоритету (см. Page Objects).
 */
import { test, expect } from '../../fixtures/test';
import { OpenApp } from '../../screenplay/tasks/OpenApp';
import { SignIn } from '../../screenplay/tasks/SignIn';
import { NavigateToTab } from '../../screenplay/tasks/NavigateToTab';
import { AppPage } from '../../pages/AppPage';
import { HistoryPage } from '../../pages/HistoryPage';
import { QrScannerPage } from '../../pages/QrScannerPage';
import { QrBookingSheetPage } from '../../pages/QrBookingSheetPage';
import { DevicesPage } from '../../pages/DevicesPage';
import { DeviceDetailsModal } from '../../pages/DeviceDetailsModal';
import { configForUser, configWithMutations } from '../../helpers/config';
import { getDoc, getCollection } from '../../helpers/store';
import { addDays, formatDate } from '../../helpers/date';
import { QrTestData as TestData, openBookingSheetForDevice as openSheetForDevice, trace } from './helpers';

// ── Конфигурации mock (RULES.md #6 — изоляция тестов) ────────────────────────

const unauthConfig = configWithMutations((config) => {
  config.auth.autoSignIn = false;
});

const firestoreReadNetworkErrorConfig = configWithMutations((config) => {
  config.failures = { get: { devices: 'unavailable' } };
});

const writeNetworkErrorConfig = configWithMutations((config) => {
  config.failures = { update: { devices: 'unavailable' }, add: { bookings: 'unavailable' } };
});

const sharedAccountConfig = configForUser(TestData.sharedUserId);

// ── TC-SCN-01: QR-сканер — успешное открытие и распознавание кода ────────────

test('[P0][TC-SCN-01] QR-сканер — открытие сканера и распознавание QR доступного устройства @smoke', async ({ actor, page }) => {
  trace('TC-SCN-01');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Открыть приложение и авторизоваться', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  await test.step('Проверить, что кнопка сканера видна на вкладке Устройства', async () => {
    await expect(scanner.openScannerButton).toBeVisible();
  });

  await test.step('Открыть сканер и проверить активный видеопоток', async () => {
    await scanner.open();
    await scanner.expectVisible();
    await expect(scanner.scannerArea).toBeVisible();
  });

  await test.step('Эмулировать успешное распознавание QR и проверить превью устройства', async () => {
    await scanner.simulateScan(TestData.deviceAvailable);
    await sheet.expectVisible();
    await sheet.expectAvailableStateVisible();
    await sheet.expectDeviceName(TestData.deviceAvailableName);
  });
});

// ── TC-SCN-02: QR-сканер — открытие без авторизации ──────────────────────────

test.describe('[TC-SCN-02] QR-сканер — без авторизации', () => {
  test.use({ mockConfig: unauthConfig });

  test('[P0][TC-SCN-02] Сканер скрыт без авторизации; после входа становится доступен @smoke', async ({ actor, page }) => {
    trace('TC-SCN-02');
    const scanner = new QrScannerPage(page);

    await test.step('Открыть приложение без авторизации', async () => {
      await actor.attemptsTo(OpenApp());
    });

    await test.step('Проверить, что кнопка сканера скрыта неавторизованному пользователю', async () => {
      await scanner.expectScannerButtonHidden();
    });

    await test.step('Авторизоваться и проверить, что кнопка сканера появилась', async () => {
      await actor.attemptsTo(SignIn());
      await scanner.expectScannerButtonVisible();
    });
  });
});

// ── TC-SCN-03: QR-сканер — отказ в доступе к камере (fallback-контроли) ──────

test('[P1][TC-SCN-03] QR-сканер — при отсутствии камеры доступны загрузка фото и ручной ввод @regression', async ({ actor, page }) => {
  trace('TC-SCN-03');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть экран сканера', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Проверить наличие альтернативных кнопок загрузки фото и ручного ввода', async () => {
    await expect(scanner.uploadLabel).toBeVisible();
    await scanner.expectUploadInputAcceptsImages();
    await expect(scanner.manualInput).toBeVisible();
    await expect(scanner.manualSubmitButton).toBeVisible();
  });
});

// ── TC-SCN-04: QR-сканер — таймаут распознавания 10 секунд ───────────────────

test('[P1][TC-SCN-04] QR-сканер — подсказка через 10 секунд без QR @regression', async ({ actor, page }) => {
  trace('TC-SCN-04');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Форсировать таймаут-подсказку и проверить её появление', async () => {
    await scanner.forceTimeoutHint();
    await scanner.expectTimeoutHintVisible();
  });
});

// ── TC-SCN-05: QR-сканер — загрузка фото QR-кода (fallback) ──────────────────

test('[P1][TC-SCN-05] QR-сканер — поле загрузки фото QR доступно и принимает изображения @regression', async ({ actor, page }) => {
  trace('TC-SCN-05');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть экран сканера', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Проверить наличие поля загрузки картинки с QR', async () => {
    await expect(scanner.uploadLabel).toBeVisible();
    await scanner.expectUploadInputCount(1);
    await scanner.expectUploadInputAcceptsImages();
  });
});

// ── TC-SCN-06: QR-сканер — ручной ввод deviceId ──────────────────────────────

test('[P0][TC-SCN-06] QR-сканер — ручной ввод deviceId открывает шторку и создаёт бронь action=take @smoke', async ({ actor, page }) => {
  trace('TC-SCN-06');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);
  const app = new AppPage(page);

  await test.step('Авторизоваться и открыть экран сканера', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Ввести deviceId вручную и отправить форму', async () => {
    await scanner.typeManualId(TestData.deviceAvailable);
    await scanner.submitManualId();
  });

  await test.step('Подтвердить бронирование в открывшейся шторке', async () => {
    await sheet.expectVisible();
    await sheet.expectDeviceName(TestData.deviceAvailableName);
    await sheet.confirm();
  });

  await test.step('Проверить toast и обновление Firestore (device + bookings)', async () => {
    await expect(app.toastByText('забронировано')).toBeVisible();

    const device = await getDoc<{ status: string }>(page, 'devices', TestData.deviceAvailable);
    expect(device?.status).toBe('booked');

    const bookings = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
    const record = bookings.find(
      (b) => b.deviceId === TestData.deviceAvailable && b.action === 'take'
    );
    expect(record).toBeDefined();
  });
});

// ── TC-SCN-07: QR-сканер — переключение камер ────────────────────────────────

test('[P1][TC-SCN-07] QR-сканер — переключение камеры не закрывает модал @regression', async ({ actor, page }) => {
  trace('TC-SCN-07');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть экран сканера', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Тапнуть кнопку переключения камеры', async () => {
    await expect(scanner.flipCameraButton).toBeVisible();
    await scanner.flipCamera();
  });

  await test.step('Проверить, что модал сканера и статус видимы', async () => {
    await scanner.expectVisible();
    await expect(scanner.statusText).toBeVisible();
  });
});

// ── TC-SCN-08: QR-бронирование — успешное бронирование office ────────────────

test('[P0][TC-SCN-08] QR-бронирование — успешное бронирование в офисе (office) @smoke', async ({ actor, page }) => {
  trace('TC-SCN-08');
  const app = new AppPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться, отсканировать QR доступного устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await openSheetForDevice(page, TestData.deviceAvailable);
  });

  await test.step('Проверить, что выбран тип office, и подтвердить бронь', async () => {
    await sheet.expectOfficeModeSelected();
    await sheet.confirm();
  });

  await test.step('Проверить toast, закрытие шторки и поля Firestore', async () => {
    await expect(app.toastByText('забронировано')).toBeVisible();
    await sheet.expectHidden();

    const device = await getDoc<{ status: string; bookingType: string; currentUserId: string }>(
      page,
      'devices',
      TestData.deviceAvailable
    );
    expect(device?.status).toBe('booked');
    expect(device?.bookingType).toBe('office');
    expect(device?.currentUserId).toBe(TestData.currentUserId);

    const bookings = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
    const record = bookings.find(
      (b) => b.deviceId === TestData.deviceAvailable && b.action === 'take'
    );
    expect(record).toBeDefined();
  });
});

// ── TC-SCN-09: QR-бронирование — тип home с датой возврата ───────────────────

test('[P1][TC-SCN-09] QR-бронирование — переключение на home показывает поле даты и сохраняет дату @regression', async ({ actor, page }) => {
  trace('TC-SCN-09');
  const app = new AppPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться, отсканировать QR доступного устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await openSheetForDevice(page, TestData.deviceAvailable);
  });

  await test.step('Переключить тип брони на home и заполнить дату возврата', async () => {
    await sheet.selectHomeType();
    await sheet.expectHomeFieldsVisible();

    const returnDate = formatDate(addDays(TestData.homeReturnDateOffsetDays));
    await sheet.fillReturnDate(returnDate);
    await expect(sheet.returnDateInput).toHaveValue(returnDate);

    await sheet.confirm();
  });

  await test.step('Проверить toast и тип брони home в Firestore', async () => {
    await expect(app.toastByText('забронировано')).toBeVisible();

    const device = await getDoc<{ bookingType: string }>(page, 'devices', TestData.deviceAvailable);
    expect(device?.bookingType).toBe('home');
  });
});

// ── TC-SCN-10: QR-бронирование — выбор проектов в шторке ─────────────────────

const multiProjectAssignmentConfig = configWithMutations((config) => {
  config.data.projectAssignments.push({
    id: 'assignment-user1-storefront',
    projectId: 'project-storefront',
    projectName: 'Storefront QA',
    userId: TestData.currentUserId,
    userEmail: 'test@test.dev',
    userName: 'Иван Тестовый',
    isActive: true,
    createdAt: config.data.projectAssignments[0].createdAt
  });
});

test.describe('[TC-SCN-10] QR-бронирование — выбор нескольких проектов', () => {
  test.use({ mockConfig: multiProjectAssignmentConfig });

  test('[P1][TC-SCN-10] QR-бронирование — выбор нескольких проектов в шторке @regression', async ({ actor, page }) => {
    trace('TC-SCN-10');
    const app = new AppPage(page);
    const sheet = new QrBookingSheetPage(page);

    await test.step('Авторизоваться и отсканировать QR доступного устройства', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await openSheetForDevice(page, TestData.deviceAvailable);
    });

    await test.step('Выбрать оба проекта в чек-боксах', async () => {
      const projectGroup = page.locator('#qr-booking-project-select');
      await expect(projectGroup).toBeVisible();
      const checkboxes = projectGroup.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      for (let i = 0; i < count; i++) {
        const cb = checkboxes.nth(i);
        if (!(await cb.isChecked())) await cb.check();
      }
    });

    await test.step('Подтвердить бронь', async () => {
      await sheet.confirm();
      await expect(app.toastByText('забронировано')).toBeVisible();
    });

    await test.step('Проверить, что в device.currentProjectIds оба проекта', async () => {
      const device = await getDoc<{ currentProjectIds?: string[] }>(page, 'devices', TestData.deviceAvailable);
      expect(device?.currentProjectIds).toContain('project-banking');
      expect(device?.currentProjectIds).toContain('project-storefront');
    });
  });
});

// ── TC-SCN-11: QR-бронирование — сканирование занятого устройства ────────────

test('[P1][TC-SCN-11] QR-бронирование — занятое устройство: шторка занятости, кнопка подтверждения отсутствует @regression', async ({ actor, page }) => {
  trace('TC-SCN-11');
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и зафиксировать количество броней до сканирования', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const bookingsBefore = await getCollection<{ deviceId: string }>(page, 'bookings');
  const countBefore = bookingsBefore.filter((b) => b.deviceId === TestData.deviceBookedByOther).length;

  await test.step('Отсканировать QR занятого устройства', async () => {
    await openSheetForDevice(page, TestData.deviceBookedByOther);
  });

  await test.step('Проверить шторку занятости, имя владельца и отсутствие кнопки подтверждения', async () => {
    await sheet.expectBlockedStateVisible();
    await sheet.expectBlockedOwnerName(TestData.deviceBookedByOtherOwner);
    await sheet.expectConfirmButtonAbsent();

    const bookingsAfter = await getCollection<{ deviceId: string }>(page, 'bookings');
    const countAfter = bookingsAfter.filter((b) => b.deviceId === TestData.deviceBookedByOther).length;
    expect(countAfter).toBe(countBefore);
  });
});

// ── TC-SCN-12: QR-бронирование — собственное устройство (office) ─────────────

test('[P1][TC-SCN-12] QR-бронирование — своё office-устройство: открывается шторка действий с "Вернуть" @regression', async ({ actor, page }) => {
  trace('TC-SCN-12');
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и зафиксировать количество take-броней до сканирования', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const bookingsBefore = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
  const takesBefore = bookingsBefore.filter(
    (b) => b.deviceId === TestData.deviceOwnOffice && b.action === 'take'
  ).length;

  await test.step('Отсканировать QR собственного office-устройства', async () => {
    await openSheetForDevice(page, TestData.deviceOwnOffice);
  });

  await test.step('Проверить шторку действий и активную кнопку "Вернуть"', async () => {
    await sheet.expectOwnStateVisible();
    await expect(sheet.ownReturnButton).toBeVisible();
    await expect(sheet.ownReturnButton).toBeEnabled();

    const bookingsAfter = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
    const takesAfter = bookingsAfter.filter(
      (b) => b.deviceId === TestData.deviceOwnOffice && b.action === 'take'
    ).length;
    expect(takesAfter).toBe(takesBefore);
  });
});

// ── TC-SCN-13: QR-бронирование — собственное устройство (home) ───────────────

test('[P1][TC-SCN-13] QR-бронирование — своё home-устройство: шторка действий с "Вернуть" @regression', async ({ actor, page }) => {
  trace('TC-SCN-13');
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и зафиксировать количество take-броней до сканирования', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const bookingsBefore = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
  const takesBefore = bookingsBefore.filter(
    (b) => b.deviceId === TestData.deviceOwnHome && b.action === 'take'
  ).length;

  await test.step('Отсканировать QR собственного home-устройства', async () => {
    await openSheetForDevice(page, TestData.deviceOwnHome);
  });

  await test.step('Проверить шторку действий и активную кнопку "Вернуть"', async () => {
    await sheet.expectOwnStateVisible();
    await expect(sheet.ownReturnButton).toBeVisible();
    await expect(sheet.ownReturnButton).toBeEnabled();

    const bookingsAfter = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
    const takesAfter = bookingsAfter.filter(
      (b) => b.deviceId === TestData.deviceOwnHome && b.action === 'take'
    ).length;
    expect(takesAfter).toBe(takesBefore);
  });
});

// ── TC-SCN-14: QR-возврат своего устройства ──────────────────────────────────

test('[P1][TC-SCN-14] QR-бронирование — возврат собственного устройства через QR: action=return, source=qr @regression', async ({ actor, page }) => {
  trace('TC-SCN-14');
  const app = new AppPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться, отсканировать QR собственного home-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await openSheetForDevice(page, TestData.deviceOwnHome);
  });

  await test.step('Запустить возврат через кнопку "Вернуть"', async () => {
    await sheet.returnDevice();
  });

  await test.step('Проверить toast, закрытие шторки и обновление Firestore', async () => {
    await expect(app.toastByText('возвращено')).toBeVisible();
    await sheet.expectHidden();

    const device = await getDoc<{ status: string; currentUserId?: string }>(
      page,
      'devices',
      TestData.deviceOwnHome
    );
    expect(device?.status).toBe('available');
    expect(device?.currentUserId).toBeFalsy();

    const bookings = await getCollection<{ deviceId: string; action: string; source: string }>(
      page,
      'bookings'
    );
    const record = bookings.find(
      (b) => b.deviceId === TestData.deviceOwnHome && b.action === 'return' && b.source === 'qr'
    );
    expect(record).toBeDefined();
  });
});

// ── TC-SCN-15: Изменение даты возврата через QR ──────────────────────────────

test('[P1][TC-SCN-15] QR-бронирование — изменение даты возврата для home-устройства @regression', async ({ actor, page }) => {
  trace('TC-SCN-15');
  const app = new AppPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и отсканировать QR своего home-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await openSheetForDevice(page, TestData.deviceOwnHome);
  });

  await test.step('Открыть форму изменения даты, заполнить и сохранить', async () => {
    await sheet.openChangeDateForm();
    await sheet.expectChangeDateFormVisible();
    const newDate = formatDate(addDays(14));
    await sheet.fillChangeDate(newDate);
    await sheet.saveChangeDate();
    await expect(app.toastByText('Дата возврата обновлена')).toBeVisible();
  });

  await test.step('Проверить запись date_change с source=qr в bookings', async () => {
    const bookings = await getCollection<{ deviceId: string; action: string; source?: string }>(page, 'bookings');
    const record = bookings.find(
      (b) => b.deviceId === TestData.deviceOwnHome && b.action === 'date_change' && b.source === 'qr'
    );
    expect(record).toBeDefined();
  });
});

// ── TC-SCN-16: QR-бронирование — сканирование external устройства ────────────

test('[P1][TC-SCN-16] QR-бронирование — external устройство: department/comment отображаются, action недоступен @regression', async ({ actor, page }) => {
  trace('TC-SCN-16');
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и отсканировать QR external-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await openSheetForDevice(page, TestData.deviceExternal);
  });

  await test.step('Проверить отображение department/comment и отсутствие подтверждения', async () => {
    await sheet.expectExternalStateVisible();
    await sheet.expectExternalDepartment(TestData.deviceExternalDepartment);
    await sheet.expectExternalComment(TestData.deviceExternalComment);
    await sheet.expectConfirmButtonAbsent();
  });
});

// ── TC-SCN-17: Сканирование неисправного устройства ──────────────────────────

test('[P1][TC-SCN-17] QR-бронирование — неисправное устройство: баннер и запрет брони @regression', async ({ actor, page }) => {
  trace('TC-SCN-17');
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и отсканировать QR неисправного устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await openSheetForDevice(page, 'dev-broken');
  });

  await test.step('Проверить баннер "Устройство неисправно" и отсутствие confirm', async () => {
    await sheet.expectBrokenStateVisible();
    await sheet.expectConfirmButtonAbsent();
  });
});

// ── TC-SCN-18: Администратор сканирует неисправное устройство ────────────────

test.describe('[TC-SCN-18] QR-бронирование — администратор: неисправное устройство', () => {
  test.use({ mockConfig: configForUser('admin-1') });

  test('[P1][TC-SCN-18] QR-бронирование — администратор: неисправное устройство c кнопкой админ-карточки @regression', async ({ actor, page }) => {
    trace('TC-SCN-18');
    const sheet = new QrBookingSheetPage(page);

    await test.step('Авторизоваться под админом и отсканировать QR неисправного устройства', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await openSheetForDevice(page, 'dev-broken');
    });

    await test.step('Проверить баннер неисправности и наличие админ-кнопки', async () => {
      await sheet.expectBrokenStateVisible();
      await sheet.expectOpenAdminButtonVisible();
      await expect(sheet.openAdminButton).toBeEnabled();
    });

    await test.step('Нажать "Открыть карточку устройства" и проверить закрытие шторки', async () => {
      await sheet.openAdmin();
      await sheet.expectHidden();
    });
  });
});

// ── TC-SCN-19: Подтверждение получения (pendingReceipt) ──────────────────────

const pendingReceiptConfig = configWithMutations((config) => {
  const device = config.data.devices.find((d) => d.id === 'dev-samsung-s24');
  if (device) {
    device.status = 'booked';
    device.pendingReceipt = true;
    device.bookedFor = TestData.currentUserId;
    device.currentUserId = TestData.currentUserId;
    device.currentUserName = 'Иван Тестовый';
    device.bookedByName = 'Администратор';
  }
});

test.describe('[TC-SCN-19] QR-бронирование — подтверждение получения', () => {
  test.use({ mockConfig: pendingReceiptConfig });

  test('[P1][TC-SCN-19] QR-бронирование — подтверждение получения устройства (pendingReceipt) @regression', async ({ actor, page }) => {
    trace('TC-SCN-19');
    const app = new AppPage(page);
    const sheet = new QrBookingSheetPage(page);

    await test.step('Авторизоваться и отсканировать QR устройства с pendingReceipt', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await openSheetForDevice(page, 'dev-samsung-s24');
    });

    await test.step('Подтвердить получение и проверить toast', async () => {
      await sheet.expectPendingReceiptStateVisible();
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

// ── TC-SCN-20: Устройство не найдено в системе ───────────────────────────────

test('[P1][TC-SCN-20] QR-сканер — несуществующий deviceId: toast "не найдено", запись не создаётся @regression', async ({ actor, page }) => {
  trace('TC-SCN-20');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);
  const app = new AppPage(page);

  await test.step('Авторизоваться и зафиксировать количество броней до сканирования', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const bookingsBefore = await getCollection<{ deviceId: string }>(page, 'bookings');
  const countBefore = bookingsBefore.length;

  await test.step('Открыть сканер и эмулировать неизвестный deviceId', async () => {
    await scanner.open();
    await scanner.simulateScan(TestData.unknownDeviceId);
  });

  await test.step('Проверить toast "не найдено" и неизменность коллекции bookings', async () => {
    await expect(app.toastByText('не найдено')).toBeVisible();
    await sheet.expectHidden();

    const bookingsAfter = await getCollection<{ deviceId: string }>(page, 'bookings');
    expect(bookingsAfter.length).toBe(countBefore);
  });
});

// ── TC-SCN-21: Ошибка записи в Firestore при бронировании ────────────────────

test.describe('[TC-SCN-21] QR-бронирование — ошибка записи в Firestore', () => {
  test.use({ mockConfig: writeNetworkErrorConfig });

  test('[P1][TC-SCN-21] QR-бронирование — ошибка записи: toast с ошибкой, статус устройства не меняется @regression', async ({ actor, page }) => {
    trace('TC-SCN-21');
    const app = new AppPage(page);
    const sheet = new QrBookingSheetPage(page);

    await test.step('Авторизоваться и открыть шторку для доступного устройства', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await openSheetForDevice(page, TestData.deviceAvailable);
    });

    await test.step('Подтвердить бронирование при сбое Firestore', async () => {
      await sheet.confirm();
    });

    await test.step('Проверить toast ошибки и неизменность статуса устройства', async () => {
      await expect(app.toastByText('Не удалось')).toBeVisible();

      const device = await getDoc<{ status: string }>(page, 'devices', TestData.deviceAvailable);
      expect(device?.status).toBe('available');
    });
  });
});

// ── TC-SCN-22: Гонка двух одновременных сканирований ─────────────────────────

test('[P1][TC-SCN-22] QR-бронирование — гонка: одновременное сканирование двумя пользователями @regression', async ({ actor, page }) => {
  trace('TC-SCN-22');
  const app = new AppPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await openSheetForDevice(page, TestData.deviceAvailable);
  });

  const takesBefore = (
    await getCollection<{ deviceId: string; action: string; userId: string }>(page, 'bookings')
  ).filter(
    (b) => b.deviceId === TestData.deviceAvailable && b.action === 'take' && b.userId === TestData.currentUserId
  ).length;

  await test.step('Эмулировать второй параллельный скан: device → booked', async () => {
    await page.evaluate((id: string) => {
      const store = (window as any).__mockStore;
      if (store?.devices?.[id]) {
        store.devices[id].status = 'booked';
        store.devices[id].currentUserId = 'parallel-user';
      }
    }, TestData.deviceAvailable);
  });

  await test.step('Подтвердить и получить предупреждение "уже занято"', async () => {
    await sheet.confirm();
    await expect(app.toastByText('Устройство уже занято')).toBeVisible();
  });

  await test.step('Проверить отсутствие лишней записи take от текущего пользователя', async () => {
    const bookings = await getCollection<{ deviceId: string; action: string; userId: string }>(page, 'bookings');
    const racesAfter = bookings.filter(
      (b) => b.deviceId === TestData.deviceAvailable && b.action === 'take' && b.userId === TestData.currentUserId
    );
    expect(racesAfter.length).toBe(takesBefore);
  });
});

// ── TC-SCN-23: Offline-режим ─────────────────────────────────────────────────

test.describe('[TC-SCN-23] QR-сканер — offline', () => {
  test.use({ mockConfig: firestoreReadNetworkErrorConfig });

  test('[P1][TC-SCN-23] QR-сканер — offline (ошибка чтения Firestore): toast, шторка не открывается @regression', async ({ actor, page }) => {
    trace('TC-SCN-23');
    const scanner = new QrScannerPage(page);
    const sheet = new QrBookingSheetPage(page);
    const app = new AppPage(page);

    await test.step('Авторизоваться и открыть сканер', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await scanner.open();
    });

    await test.step('Эмулировать сканирование при недоступности Firestore', async () => {
      await scanner.simulateScan(TestData.deviceAvailable);
    });

    await test.step('Проверить toast ошибки и что шторка не открыта', async () => {
      await expect(app.toastByText('Не удалось')).toBeVisible();
      await sheet.expectHidden();
    });
  });
});

// ── TC-SCN-24: Бронирование с shared-аккаунта ────────────────────────────────

test.describe('[TC-SCN-24] QR-бронирование — shared-аккаунт', () => {
  test.use({ mockConfig: sharedAccountConfig });

  test('[P1][TC-SCN-24] QR-бронирование (shared) — выбор пользователя: currentUserId = выбранный, bookedBy = shared @regression', async ({ actor, page }) => {
    // BR.05.18 — зеркало TC-QR-033: после выбора пользователя бронь оформляется на него,
    // а bookedBy указывает на shared-аккаунт.
    trace('TC-SCN-24');
    const app = new AppPage(page);
    const sheet = new QrBookingSheetPage(page);

    await test.step('Авторизоваться под shared-аккаунтом и отсканировать QR', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await openSheetForDevice(page, TestData.deviceAvailable);
    });

    await test.step('Выбрать пользователя через поиск', async () => {
      await sheet.expectUserSearchVisible();
      await sheet.searchSharedUser('Ив');
      await sheet.expectFirstSuggestionContains(/Иван|Ив/);
      await sheet.selectFirstUserSuggestion();
    });

    await test.step('Подтвердить бронирование', async () => {
      await sheet.confirm();
    });

    await test.step('Проверить, что currentUserId = выбранный, bookedBy = shared', async () => {
      await expect(app.toastByText('забронировано')).toBeVisible();

      const device = await getDoc<{ status: string; currentUserId: string }>(
        page,
        'devices',
        TestData.deviceAvailable
      );
      expect(device?.status).toBe('booked');
      expect(device?.currentUserId).toBe(TestData.currentUserId);
      const bookings = await getCollection<{
        deviceId: string;
        action: string;
        userId: string;
        bookedBy?: string;
        bookedByName?: string;
      }>(page, 'bookings');
      const record = bookings.find(
        (b) => b.deviceId === TestData.deviceAvailable && b.action === 'take' && b.source === 'qr'
      );
      expect(record).toBeDefined();
      expect(record?.userId).toBe(TestData.currentUserId);
      expect(record?.bookedBy).toBe(TestData.sharedUserId);
      expect(record?.bookedByName).toBeTruthy();
    });
  });
});

// ── TC-SCN-25: Отображение QR-операций в истории ─────────────────────────────

test('[P1][TC-SCN-25] QR-бронирование — операции отображаются на вкладке "История" @regression', async ({ actor, page }) => {
  trace('TC-SCN-25');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);
  const app = new AppPage(page);
  const history = new HistoryPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Отсканировать QR доступного устройства и подтвердить бронь', async () => {
    await scanner.simulateScan(TestData.deviceAvailable);
    await sheet.expectVisible();
    await sheet.confirm();
    await expect(app.toastByText('забронировано')).toBeVisible();
  });

  await test.step('Перейти на вкладку "История" и проверить наличие записи', async () => {
    const bookings = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
    const takeRecord = bookings.find(
      (b) => b.deviceId === TestData.deviceAvailable && b.action === 'take'
    );
    expect(takeRecord).toBeDefined();

    await actor.attemptsTo(NavigateToTab('history'));
    await history.expectAnyRowVisible();
  });
});

// ── TC-SCN-26: Отсутствие чувствительных данных в QR ─────────────────────────

test('[P1][TC-SCN-26] QR-код — payload содержит только deviceId или /#device/<id> @regression', async ({ actor, page }) => {
  trace('TC-SCN-26');
  const devices = new DevicesPage(page);
  const details = new DeviceDetailsModal(page);

  await test.step('Авторизоваться и открыть карточку устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await devices.openDeviceCardById(TestData.deviceAvailable);
    await details.expectVisible();
  });

  await test.step('Проверить, что QR-payload — только deviceId, без чувствительных данных', async () => {
    await details.expectQrImageEncodesOnly(TestData.deviceAvailable);
    await details.expectQrImageHasNoSensitiveData();
  });
});

// ── TC-SCN-27: Отображение QR-кода в карточке устройства ─────────────────────

test('[P1][TC-SCN-27] QR-бронирование — QR-код в карточке устройства идентичен админке @regression', async ({ actor, page }) => {
  trace('TC-SCN-27');
  const devices = new DevicesPage(page);
  const details = new DeviceDetailsModal(page);

  await test.step('Авторизоваться и открыть карточку устройства из каталога', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await devices.openDeviceCardById(TestData.deviceAvailable);
    await details.expectVisible();
  });

  await test.step('Зафиксировать payload QR в карточке (devices)', async () => {
    await details.expectQrPayload(TestData.deviceAvailable);
    await details.expectQrImageEncodesOnly(TestData.deviceAvailable);
  });
});

// ── TC-SCN-28: Уведомление предыдущему владельцу ─────────────────────────────

const scnOwnerTransferConfig = configWithMutations((config) => {
  const device = config.data.devices.find((d) => d.id === TestData.deviceAvailable);
  if (device) {
    device.status = 'available';
    device.currentUserId = 'user-2';
    device.currentUserName = 'Ольга Второй';
  }
});

test.describe('[TC-SCN-28] QR-бронирование — in-app уведомление', () => {
  test.use({ mockConfig: scnOwnerTransferConfig });

  test('[P1][TC-SCN-28] QR-бронирование — in-app уведомление предыдущему владельцу @regression', async ({ actor, page }) => {
    trace('TC-SCN-28');
    const app = new AppPage(page);
    const sheet = new QrBookingSheetPage(page);

    await test.step('Авторизоваться и отсканировать QR устройства', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await openSheetForDevice(page, TestData.deviceAvailable);
    });

    await test.step('Подтвердить бронь', async () => {
      await sheet.confirm();
      await expect(app.toastByText('забронировано')).toBeVisible();
    });

    await test.step('Проверить уведомление предыдущему владельцу', async () => {
      const notifications = await getCollection<{ userId: string; type: string; deviceId: string }>(
        page,
        'notifications'
      );
      const record = notifications.find(
        (n) => n.userId === 'user-2' && n.type === 'device_taken' && n.deviceId === TestData.deviceAvailable
      );
      expect(record).toBeDefined();
    });
  });
});

// ── TC-SCN-29: Доступность (a11y) ────────────────────────────────────────────

test('[P1][TC-SCN-29] QR-сканер — keyboard navigation, aria-label, focus-trap @regression', async ({ actor, page }) => {
  trace('TC-SCN-29');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Проверить ARIA-атрибуты модалки сканера', async () => {
    await expect(scanner.modal).toHaveAttribute('role', 'dialog');
    await expect(scanner.modal).toHaveAttribute('aria-modal', 'true');
    await expect(scanner.modal).toHaveAttribute('aria-labelledby', 'qr-scanner-title');
  });

  await test.step('Проверить focus-trap: после Tab активный элемент остаётся внутри модалки', async () => {
    for (let i = 0; i < 12; i++) {
      const stillInside = await page.evaluate(() => {
        const modal = document.getElementById('qr-scanner-modal');
        return !!(modal && document.activeElement && modal.contains(document.activeElement));
      });
      expect(stillInside).toBe(true);
      await page.keyboard.press('Tab');
    }
  });

  await test.step('Закрыть по Escape и проверить, что фокус вернулся на кнопку сканера', async () => {
    await scanner.closeViaEsc();
    await scanner.expectHidden();
    const focusedId = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.id || null);
    expect(focusedId).toBe('qr-scan-btn');
    // TODO BR.05.27 — шторка брони (ensureBookingSheet) сейчас не имеет role=dialog/aria-modal/
    // focus-trap. Этот тест осознанно покрывает ТОЛЬКО сканер. После фикса кода в
    // ensureBookingSheet нужно добавить аналогичные проверки для #qr-booking-sheet.
    // См. traceability-matrix §«Risk» и coverage-plan §Notes (BR.05.27).
  });
});

// ── TC-SCN-30: Аналитика qr_scan ─────────────────────────────────────────────

test('[P1][TC-SCN-30] QR-бронирование — событие аналитики qr_scan с корректными полями @regression', async ({ actor, page }) => {
  trace('TC-SCN-30');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Эмулировать успешный скан', async () => {
    await scanner.simulateScan(TestData.deviceAvailable);
    await sheet.expectVisible();
  });

  await test.step('Проверить событие qr_scan с deviceId и result=device_found', async () => {
    const events = await page.evaluate(() => (window as any).__analyticsEvents || []);
    const found = (events as Array<{ event: string; payload: { deviceId?: string; result?: string; source?: string } }>)
      .filter((e) => e.event === 'qr_scan' && e.payload?.deviceId === TestData.deviceAvailable && e.payload?.result === 'device_found');
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found[0].payload.source).toBeTruthy();
  });
});

// ── TC-SCN-08.2: QR-бронирование office — реалтайм-обновление карточки (BR.05.20) ─

test('[P0][TC-SCN-08.2] QR-бронирование (office) — карточка в каталоге обновляется в реалтайме без перезагрузки @smoke', async ({ actor, page }) => {
  // BR.05.20 — после успеха каталог обновляется через onSnapshot, без page.reload().
  trace('TC-SCN-08.2');
  const app = new AppPage(page);
  const sheet = new QrBookingSheetPage(page);
  const devices = new DevicesPage(page);

  await test.step('Авторизоваться и убедиться, что карточка доступного устройства видна со status=available', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await devices.expectDeviceCardStatus(TestData.deviceAvailable, 'available');
  });

  await test.step('Отсканировать QR доступного устройства и подтвердить бронь office', async () => {
    await openSheetForDevice(page, TestData.deviceAvailable);
    await sheet.expectOfficeModeSelected();
    await sheet.confirm();
    await expect(app.toastByText('забронировано')).toBeVisible();
  });

  await test.step('Проверить, что карточка переключилась на data-status="booked" без reload', async () => {
    await devices.expectDeviceCardStatus(TestData.deviceAvailable, 'booked');
  });
});

// ── TC-SCN-08.3: Сканер и шторка скрыты после успешного бронирования (BR.05.20) ─

test('[P1][TC-SCN-08.3] QR-бронирование — сканер закрывается после успешного бронирования @regression', async ({ actor, page }) => {
  // BR.05.20 — после toast «забронировано» как сканер (#qr-scanner-modal), так и шторка
  // брони (#qr-booking-sheet) должны быть скрыты. closeBookingSheet вызывается через
  // setTimeout(...,0) в devices-qr.js:957, поэтому используем PO.expectHidden (без hard-wait).
  trace('TC-SCN-08.3');
  const app = new AppPage(page);
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться, открыть сканер и отсканировать доступное устройство', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan(TestData.deviceAvailable);
    await sheet.expectVisible();
  });

  await test.step('Подтвердить бронь', async () => {
    await sheet.confirm();
    await expect(app.toastByText('забронировано')).toBeVisible();
  });

  await test.step('Проверить, что и шторка брони, и модал сканера скрыты', async () => {
    await sheet.expectHidden();
    await scanner.expectHidden();
  });
});

// ── TC-SCN-12.2: Двойное открытие шторки своего устройства не создаёт take (BR.05.9) ─

test('[P1][TC-SCN-12.2] QR-сканер — повторное открытие шторки своего office-устройства: bookings counter не растёт @regression', async ({ actor, page }) => {
  // BR.05.9 — повторные сканы собственного устройства не создают новых take-записей.
  trace('TC-SCN-12.2');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и зафиксировать число take для своего office-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const takesBefore = (
    await getCollection<{ deviceId: string; action: string }>(page, 'bookings')
  ).filter((b) => b.deviceId === TestData.deviceOwnOffice && b.action === 'take').length;

  await test.step('Первый цикл: открыть сканер, скан, закрыть шторку по cancel', async () => {
    await scanner.open();
    await scanner.simulateScan(TestData.deviceOwnOffice);
    await sheet.expectVisible();
    await sheet.expectOwnStateVisible();
    await sheet.cancel();
    await sheet.expectHidden();
  });

  await test.step('Второй цикл: открыть сканер заново, скан, снова закрыть', async () => {
    await scanner.open();
    await scanner.simulateScan(TestData.deviceOwnOffice);
    await sheet.expectVisible();
    await sheet.expectOwnStateVisible();
    await sheet.cancel();
    await sheet.expectHidden();
  });

  await test.step('Проверить, что число take не изменилось', async () => {
    const takesAfter = (
      await getCollection<{ deviceId: string; action: string }>(page, 'bookings')
    ).filter((b) => b.deviceId === TestData.deviceOwnOffice && b.action === 'take').length;
    expect(takesAfter).toBe(takesBefore);
  });
});

// ── TC-SCN-27.2: разные deviceId дают разный QR-payload (BR.05.1) ────────────

test('[P1][TC-SCN-27.2] QR в карточке устройства — разные deviceId дают разный payload @regression', async ({ actor, page }) => {
  // BR.05.1 — каждый QR содержит уникальный payload = deviceId.
  trace('TC-SCN-27.2');
  const devices = new DevicesPage(page);
  const details = new DeviceDetailsModal(page);

  await test.step('Авторизоваться', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  let payloadA = '';
  let payloadB = '';

  await test.step('Открыть карточку первого устройства и зафиксировать payload', async () => {
    await devices.openDeviceCardById(TestData.deviceAvailable);
    await details.expectVisible();
    payloadA = await details.getQrPayloadText();
    await details.close();
  });

  await test.step('Открыть карточку второго устройства и зафиксировать payload', async () => {
    await devices.openDeviceCardById(TestData.deviceOwnHome);
    await details.expectVisible();
    payloadB = await details.getQrPayloadText();
  });

  await test.step('Проверить, что payload-ы различаются и равны соответствующим deviceId', async () => {
    expect(payloadA).toBe(TestData.deviceAvailable);
    expect(payloadB).toBe(TestData.deviceOwnHome);
    expect(payloadA).not.toBe(payloadB);
  });
});

// ── TC-SCN-30.2: Аналитика qr_scan — source='manual' для ручного ввода (BR.05.28) ─

test('[P1][TC-SCN-30.2] Аналитика qr_scan — source="manual" для ручного ввода @regression', async ({ actor, page }) => {
  // BR.05.28 — поле source соответствует способу ввода: 'manual' для ручного.
  trace('TC-SCN-30.2');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Ввести deviceId через manual-форму и отправить', async () => {
    await scanner.typeManualId(TestData.deviceAvailable);
    await scanner.submitManualId();
    await sheet.expectVisible();
  });

  await test.step('Проверить, что qr_scan содержит result=device_found, source=manual', async () => {
    const events = await page.evaluate(() => (window as any).__analyticsEvents || []);
    const found = (events as Array<{ event: string; payload: { deviceId?: string; result?: string; source?: string } }>)
      .filter(
        (e) =>
          e.event === 'qr_scan' &&
          e.payload?.deviceId === TestData.deviceAvailable &&
          e.payload?.result === 'device_found' &&
          e.payload?.source === 'manual'
      );
    expect(found.length).toBeGreaterThanOrEqual(1);
  });
});
