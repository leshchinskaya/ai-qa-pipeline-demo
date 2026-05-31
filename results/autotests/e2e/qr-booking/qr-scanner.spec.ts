/**
 * QR-бронирование. Сканер QR — компоновка, камера, ввод, ошибки.
 * TC-QR-001..TC-QR-011
 *
 * Соответствие RULES.md:
 *   #1   Каждый тест заканчивается assertion.
 *   #1.3 Тестовые данные в TestData (helpers.ts).
 *   #2   Логические блоки оборачиваются в `test.step()` с описанием на русском.
 *   #2.1 Локаторы только в Page Objects.
 *   #3   Имена тестов: [Priority][TC-ID] Описание @tag.
 *   #5   Smart waits через PO/expect, без `waitForTimeout`.
 *   #6   Изоляция тестов: ошибки Firestore — через `test.use({ mockConfig })`.
 *   #10  DRY: общие хелперы в helpers.ts.
 */
import { test, expect } from '../../fixtures/test';
import { OpenApp } from '../../screenplay/tasks/OpenApp';
import { SignIn } from '../../screenplay/tasks/SignIn';
import { AppPage } from '../../pages/AppPage';
import { QrScannerPage } from '../../pages/QrScannerPage';
import { QrBookingSheetPage } from '../../pages/QrBookingSheetPage';
import { configWithMutations } from '../../helpers/config';
import { getCollection, getDoc } from '../../helpers/store';
import { QrTestData, trace } from './helpers';

// ── Конфигурации для ошибок Firestore ────────────────────────────────────────

const firestoreReadNetworkErrorConfig = configWithMutations((config) => {
  config.failures = { get: { devices: 'unavailable' } };
});

const firestoreReadPermissionErrorConfig = configWithMutations((config) => {
  config.failures = { get: { devices: 'permission-denied' } };
});

/** Устройство с pendingReceipt=true для user-1 (BR.05.28). */
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

// ── TC-QR-001: Сканер QR — компоновка ────────────────────────────────────────

test('[P1][TC-QR-001] Сканер QR — компоновка: все элементы отображаются после открытия @regression', async ({ actor, page }) => {
  trace('TC-QR-001');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Проверить заголовок и контролы сканера', async () => {
    await expect(scanner.modalTitle).toContainText('Сканировать QR');
    await expect(scanner.closeButton).toBeVisible();
    await expect(scanner.scannerArea).toBeVisible();
    await expect(scanner.statusText).toBeVisible();
    await scanner.expectAllControlsVisible();
  });
});

test('[P1][TC-QR-001.2] Сканер QR — закрытие по крестику @regression', async ({ actor, page }) => {
  trace('TC-QR-001.2');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Закрыть сканер по крестику и проверить, что модал скрыт', async () => {
    await scanner.close();
    await scanner.expectHidden();
  });
});

test('[P1][TC-QR-001.3] Сканер QR — закрытие по клику на оверлей @regression', async ({ actor, page }) => {
  trace('TC-QR-001.3');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Закрыть сканер по клику вне модала и проверить скрытие', async () => {
    await scanner.closeViaOverlay();
    await scanner.expectHidden();
  });
});

test('[P1][TC-QR-001.4] Сканер QR — закрытие по клавише Escape @regression', async ({ actor, page }) => {
  trace('TC-QR-001.4');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Закрыть сканер по Escape и проверить, что модал скрыт', async () => {
    await scanner.closeViaEsc();
    await scanner.expectHidden();
  });
});

// ── TC-QR-002: Камера — логика работы ────────────────────────────────────────

test('[P1][TC-QR-002] Сканер QR. Камера — статус отображается после открытия сканера @regression', async ({ actor, page }) => {
  trace('TC-QR-002');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Проверить, что статус сканера виден и непустой', async () => {
    // Статус может быть "Наведите камеру" либо "Камера недоступна" — оба валидны
    await expect(scanner.statusText).toBeVisible();
    await expect(scanner.statusText).not.toBeEmpty();
  });
});

test('[P1][TC-QR-002.2] Сканер QR. Камера — переключение камеры не приводит к краш-ошибке @regression', async ({ actor, page }) => {
  trace('TC-QR-002.2');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться, открыть сканер и переключить камеру', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.flipCamera();
  });

  await test.step('Проверить, что модал остался открытым и статус виден', async () => {
    await scanner.expectVisible();
    await expect(scanner.statusText).toBeVisible();
  });
});

// ── TC-QR-003: Таймаут распознавания ─────────────────────────────────────────

test('[P1][TC-QR-003] Сканер QR. Таймаут распознавания — подсказка через 10 секунд @regression', async ({ actor, page }) => {
  trace('TC-QR-003');
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

// ── TC-QR-004: No Connection State ───────────────────────────────────────────

test.describe('[TC-QR-004] Сканер QR — No Connection State', () => {
  test.use({ mockConfig: firestoreReadNetworkErrorConfig });

  test('[P1][TC-QR-004] Сканер QR — при офлайн ошибка Firestore при чтении @regression', async ({ actor, page }) => {
    trace('TC-QR-004');
    const scanner = new QrScannerPage(page);
    const sheet = new QrBookingSheetPage(page);
    const app = new AppPage(page);

    await test.step('Авторизоваться и открыть сканер', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await scanner.open();
    });

    await test.step('Эмулировать сканирование при недоступности Firestore', async () => {
      await scanner.simulateScan(QrTestData.deviceAvailable);
    });

    await test.step('Проверить, что шторка не открыта и виден toast ошибки', async () => {
      await expect(sheet.sheet).toBeHidden();
      await expect(app.toastByText('Не удалось')).toBeVisible();
    });
  });
});

// ── TC-QR-005: Запрос устройства по QR ───────────────────────────────────────

test('[P0][TC-QR-005.1] Сканер QR — доступное устройство: открывается шторка брони @smoke', async ({ actor, page }) => {
  trace('TC-QR-005.1');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться, открыть сканер и эмулировать скан доступного устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan(QrTestData.deviceAvailable);
  });

  await test.step('Проверить шторку available-состояния и имя устройства', async () => {
    await sheet.expectVisible();
    await sheet.expectAvailableStateVisible();
    await sheet.expectDeviceName(QrTestData.deviceAvailableName);
  });
});

test('[P1][TC-QR-005.2] Сканер QR — занятое чужое устройство: открывается шторка занятости @regression', async ({ actor, page }) => {
  trace('TC-QR-005.2');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и отсканировать QR занятого устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan(QrTestData.deviceBookedByOther);
  });

  await test.step('Проверить шторку blocked-состояния и имя владельца', async () => {
    await sheet.expectVisible();
    await sheet.expectBlockedStateVisible();
    await sheet.expectBlockedOwnerName(QrTestData.deviceBookedByOtherOwner);
  });
});

test('[P1][TC-QR-005.3] Сканер QR — своё устройство: открывается шторка действий @regression', async ({ actor, page }) => {
  trace('TC-QR-005.3');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и отсканировать QR собственного устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan(QrTestData.deviceOwnHome);
  });

  await test.step('Проверить шторку own-состояния', async () => {
    await sheet.expectVisible();
    await sheet.expectOwnStateVisible();
  });
});

test('[P1][TC-QR-005.4] Сканер QR — внешнее устройство: открывается шторка external @regression', async ({ actor, page }) => {
  trace('TC-QR-005.4');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и отсканировать QR external-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan(QrTestData.deviceExternal);
  });

  await test.step('Проверить шторку external-состояния и department', async () => {
    await sheet.expectVisible();
    await sheet.expectExternalStateVisible();
    await sheet.expectExternalDepartment(QrTestData.deviceExternalDepartment);
  });
});

test.describe('[TC-QR-005.5] Сканер QR — pendingReceipt: шторка ожидания получения', () => {
  test.use({ mockConfig: pendingReceiptConfig });

  test('[P1][TC-QR-005.5] Сканер QR — pendingReceipt: шторка ожидания получения @regression', async ({ actor, page }) => {
    trace('TC-QR-005.5');
    const scanner = new QrScannerPage(page);
    const sheet = new QrBookingSheetPage(page);

    await test.step('Авторизоваться и отсканировать QR устройства с pendingReceipt', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await scanner.open();
      await scanner.simulateScan('dev-samsung-s24');
    });

    await test.step('Проверить шторку ожидания получения', async () => {
      await sheet.expectVisible();
      await sheet.expectPendingReceiptStateVisible();
    });
  });
});

test('[P1][TC-QR-005.7] Сканер QR — повторное сканирование своего устройства не создаёт дубликат take @regression', async ({ actor, page }) => {
  // BR.05.9 — повторный скан собственного устройства не пишет новую запись take.
  trace('TC-QR-005.7');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и зафиксировать число take-броней для своего home-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const takesBefore = (
    await getCollection<{ deviceId: string; action: string }>(page, 'bookings')
  ).filter((b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'take').length;

  await test.step('Первый скан собственного устройства: открыть own-state и закрыть по cancel', async () => {
    await scanner.open();
    await scanner.simulateScan(QrTestData.deviceOwnHome);
    await sheet.expectVisible();
    await sheet.expectOwnStateVisible();
    await sheet.cancel();
    await sheet.expectHidden();
  });

  await test.step('Повторный скан того же устройства: снова own-state', async () => {
    await scanner.open();
    await scanner.simulateScan(QrTestData.deviceOwnHome);
    await sheet.expectVisible();
    await sheet.expectOwnStateVisible();
  });

  await test.step('Проверить, что счётчик take не изменился и устройство всё ещё забронировано пользователем', async () => {
    const takesAfter = (
      await getCollection<{ deviceId: string; action: string }>(page, 'bookings')
    ).filter((b) => b.deviceId === QrTestData.deviceOwnHome && b.action === 'take').length;
    expect(takesAfter).toBe(takesBefore);
    const device = await getDoc<{ status: string; currentUserId?: string }>(
      page,
      'devices',
      QrTestData.deviceOwnHome
    );
    expect(device?.status).toBe('booked');
    expect(device?.currentUserId).toBe(QrTestData.currentUserId);
  });
});

test('[P1][TC-QR-005.6] Сканер QR — неисправное устройство: шторка неисправного @regression', async ({ actor, page }) => {
  trace('TC-QR-005.6');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и отсканировать QR неисправного устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan('dev-broken');
  });

  await test.step('Проверить шторку неисправного устройства', async () => {
    await sheet.expectVisible();
    await sheet.expectBrokenStateVisible();
  });
});

// ── TC-QR-006: Запрос устройства по QR — ошибка ──────────────────────────────

test('[P1][TC-QR-006.1] Сканер QR — устройство не найдено: Error State @regression', async ({ actor, page }) => {
  trace('TC-QR-006.1');
  const scanner = new QrScannerPage(page);
  const app = new AppPage(page);

  await test.step('Авторизоваться и отсканировать QR с неизвестным deviceId', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.simulateScan(QrTestData.unknownDeviceId);
  });

  await test.step('Проверить toast «не найдено», что сканер остаётся открытым, и что запись в bookings не создана', async () => {
    await expect(app.toastByText('не найдено')).toBeVisible();
    await expect(scanner.modal).not.toBeHidden();
    // BR.05.10 + manual TC step «Запись в bookings не создаётся»: убеждаемся, что неудачный
    // скан не пишет ничего в коллекцию броней.
    const bookings = await getCollection<{ deviceId: string }>(page, 'bookings');
    const stray = bookings.filter((b) => b.deviceId === QrTestData.unknownDeviceId);
    expect(stray).toHaveLength(0);
  });
});

test.describe('[TC-QR-006.2] Сканер QR — ошибка сети при чтении Firestore', () => {
  test.use({ mockConfig: firestoreReadNetworkErrorConfig });

  test('[P1][TC-QR-006.2] Сканер QR — ошибка сети при чтении: toast с кнопкой Повторить @regression', async ({ actor, page }) => {
    trace('TC-QR-006.2');
    const scanner = new QrScannerPage(page);
    const app = new AppPage(page);
    const sheet = new QrBookingSheetPage(page);

    await test.step('Авторизоваться и эмулировать скан при сетевой ошибке', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await scanner.open();
      await scanner.simulateScan(QrTestData.deviceAvailable);
    });

    await test.step('Проверить toast ошибки и что шторка не открыта', async () => {
      await expect(app.toastByText('Не удалось')).toBeVisible();
      await expect(sheet.sheet).toBeHidden();
    });
  });
});

test.describe('[TC-QR-006.3] Сканер QR — ошибка прав доступа при чтении Firestore', () => {
  test.use({ mockConfig: firestoreReadPermissionErrorConfig });

  test('[P1][TC-QR-006.3] Сканер QR — ошибка прав доступа: toast с ошибкой @regression', async ({ actor, page }) => {
    trace('TC-QR-006.3');
    const scanner = new QrScannerPage(page);
    const app = new AppPage(page);
    const sheet = new QrBookingSheetPage(page);

    await test.step('Авторизоваться и эмулировать скан при ошибке прав доступа', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await scanner.open();
      await scanner.simulateScan(QrTestData.deviceAvailable);
    });

    await test.step('Проверить toast ошибки и что шторка не открыта', async () => {
      await expect(app.toastByText('Не удалось')).toBeVisible();
      await expect(sheet.sheet).toBeHidden();
    });
  });
});

// ── TC-QR-007: Неавторизованный пользователь ─────────────────────────────────

const unauthConfig = configWithMutations((config) => {
  config.auth.user = null;
  config.auth.autoSignIn = false;
});

test.describe('[TC-QR-007] Сканер QR — неавторизованный', () => {
  test.use({ mockConfig: unauthConfig });

  test('[P0][TC-QR-007.1] Сканер QR (неавторизованный) — кнопка "Сканировать QR" скрыта @smoke', async ({ actor, page }) => {
    trace('TC-QR-007.1');
    const scanner = new QrScannerPage(page);

    await test.step('Открыть приложение без авторизации', async () => {
      await actor.attemptsTo(OpenApp());
    });

    await test.step('Проверить, что кнопка сканера скрыта неавторизованному пользователю', async () => {
      await scanner.expectScannerButtonHidden();
    });
  });
});

// ── TC-QR-008: Загрузка изображения QR ───────────────────────────────────────

test('[P1][TC-QR-008.1] Сканер QR. Загрузка изображения — файловый пикер доступен @regression', async ({ actor, page }) => {
  trace('TC-QR-008.1');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Проверить наличие input[type=file] и accept=image/*', async () => {
    await expect(scanner.uploadLabel).toBeVisible();
    await scanner.expectUploadInputCount(1);
    await scanner.expectUploadInputAcceptsImages();
  });
});

// ── TC-QR-009: Ручной ввод ID устройства ─────────────────────────────────────

test('[P1][TC-QR-009.1] Сканер QR. Ручной ввод — поле ввода отображается @regression', async ({ actor, page }) => {
  trace('TC-QR-009.1');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Проверить видимость поля ручного ввода и наличие placeholder', async () => {
    await expect(scanner.manualInput).toBeVisible();
    await expect(scanner.manualInput).toHaveAttribute('placeholder');
  });
});

test('[P1][TC-QR-009.2] Сканер QR. Ручной ввод — текст вводится и стирается корректно @regression', async ({ actor, page }) => {
  trace('TC-QR-009.2');
  const scanner = new QrScannerPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Ввести deviceId и проверить значение поля', async () => {
    await scanner.typeManualId('test-device-123');
    await expect(scanner.manualInput).toHaveValue('test-device-123');
  });

  await test.step('Очистить поле и проверить, что значение пустое', async () => {
    await scanner.clearManualId();
    await expect(scanner.manualInput).toHaveValue('');
  });
});

test('[P1][TC-QR-009.3] Сканер QR. Ручной ввод — отправка по Enter работает @regression', async ({ actor, page }) => {
  trace('TC-QR-009.3');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться и открыть сканер', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  await test.step('Ввести deviceId и отправить по клавише Enter', async () => {
    await scanner.typeManualId(QrTestData.deviceAvailable);
    await scanner.submitManualIdViaEnter();
  });

  await test.step('Проверить, что шторка брони открылась', async () => {
    await sheet.expectVisible();
  });
});

test('[P1][TC-QR-009.4] Сканер QR. Ручной ввод — пустое поле: шторка не открывается @regression', async ({ actor, page }) => {
  trace('TC-QR-009.4');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться, открыть сканер и зафиксировать число броней', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
  });

  const bookingsBefore = (await getCollection<{ deviceId: string }>(page, 'bookings')).length;

  await test.step('Отправить пустое поле ручного ввода', async () => {
    await scanner.submitManualId();
  });

  await test.step('Проверить, что шторка не открыта, сканер виден и Firestore не изменён', async () => {
    await expect(sheet.sheet).toBeHidden();
    await scanner.expectVisible();
    // Manual TC «Кнопка отправки заблокирована (disabled)»: даже если submit прошёл, запись
    // в bookings не создаётся.
    const bookingsAfter = (await getCollection<{ deviceId: string }>(page, 'bookings')).length;
    expect(bookingsAfter).toBe(bookingsBefore);
  });
});

// ── TC-QR-010: Ручной ввод ID — запрос устройства ───────────────────────────

test('[P0][TC-QR-010] Сканер QR. Ручной ввод — валидный deviceId: открывается шторка @smoke', async ({ actor, page }) => {
  trace('TC-QR-010');
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться, открыть сканер и ввести валидный deviceId', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.typeManualId(QrTestData.deviceAvailable);
    await scanner.submitManualId();
  });

  await test.step('Проверить шторку брони с корректным именем устройства', async () => {
    await sheet.expectVisible();
    await sheet.expectDeviceName(QrTestData.deviceAvailableName);
  });
});

// ── TC-QR-011: Ручной ввод ID — ошибки ──────────────────────────────────────

test('[P1][TC-QR-011.1] Сканер QR. Ручной ввод — несуществующий deviceId: Error State @regression', async ({ actor, page }) => {
  trace('TC-QR-011.1');
  const scanner = new QrScannerPage(page);
  const app = new AppPage(page);
  const sheet = new QrBookingSheetPage(page);

  await test.step('Авторизоваться, открыть сканер и ввести несуществующий deviceId', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
    await scanner.open();
    await scanner.typeManualId(QrTestData.unknownDeviceId);
    await scanner.submitManualId();
  });

  await test.step('Проверить toast «не найдено» и что шторка не открылась', async () => {
    await expect(app.toastByText('не найдено')).toBeVisible();
    await expect(sheet.sheet).toBeHidden();
  });
});

test.describe('[TC-QR-011.2] Ручной ввод — ошибка сети при чтении Firestore', () => {
  test.use({ mockConfig: firestoreReadNetworkErrorConfig });

  test('[P1][TC-QR-011.2] Сканер QR. Ручной ввод — ошибка сети: toast с ошибкой @regression', async ({ actor, page }) => {
    trace('TC-QR-011.2');
    const scanner = new QrScannerPage(page);
    const app = new AppPage(page);
    const sheet = new QrBookingSheetPage(page);

    await test.step('Авторизоваться, открыть сканер и отправить ручной ввод при сетевой ошибке', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await scanner.open();
      await scanner.typeManualId(QrTestData.deviceAvailable);
      await scanner.submitManualId();
    });

    await test.step('Проверить toast ошибки и что шторка не открыта', async () => {
      await expect(app.toastByText('Не удалось')).toBeVisible();
      await expect(sheet.sheet).toBeHidden();
    });
  });
});

test.describe('[TC-QR-011.3] Ручной ввод — ошибка прав доступа Firestore', () => {
  test.use({ mockConfig: firestoreReadPermissionErrorConfig });

  test('[P1][TC-QR-011.3] Сканер QR. Ручной ввод — ошибка прав доступа: toast с ошибкой @regression', async ({ actor, page }) => {
    trace('TC-QR-011.3');
    const scanner = new QrScannerPage(page);
    const app = new AppPage(page);
    const sheet = new QrBookingSheetPage(page);

    await test.step('Авторизоваться, открыть сканер и отправить ручной ввод при ошибке прав', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
      await scanner.open();
      await scanner.typeManualId(QrTestData.deviceAvailable);
      await scanner.submitManualId();
    });

    await test.step('Проверить toast ошибки и что шторка не открыта', async () => {
      await expect(app.toastByText('Не удалось')).toBeVisible();
      await expect(sheet.sheet).toBeHidden();
    });
  });
});
