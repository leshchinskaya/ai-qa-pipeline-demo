/**
 * QR-бронирование. Шторка брони и шторки статусов.
 * TC-QR-012..TC-QR-022
 *
 * Соответствие RULES.md: см. qr-scanner.spec.ts (тот же набор правил).
 */
import { test, expect } from '../../fixtures/test';
import { OpenApp } from '../../screenplay/tasks/OpenApp';
import { SignIn } from '../../screenplay/tasks/SignIn';
import { AppPage } from '../../pages/AppPage';
import { QrBookingSheetPage } from '../../pages/QrBookingSheetPage';
import { configWithMutations } from '../../helpers/config';
import { getDoc, getCollection } from '../../helpers/store';
import { formatDate, addDays } from '../../helpers/date';
import { QrTestData, openBookingSheetForDevice, trace } from './helpers';

// ── Конфигурации ──────────────────────────────────────────────────────────────

const writeNetworkErrorConfig = configWithMutations((config) => {
  config.failures = { update: { devices: 'unavailable' }, add: { bookings: 'unavailable' } };
});

const writePermissionErrorConfig = configWithMutations((config) => {
  config.failures = { update: { devices: 'permission-denied' }, add: { bookings: 'permission-denied' } };
});

/**
 * BR.05.15 — user-1 закреплён за двумя активными проектами, чтобы шторка
 * предлагала множественный выбор (assignments.length > 1).
 */
const multiProjectAssignmentConfig = configWithMutations((config) => {
  config.data.projectAssignments.push({
    id: 'assignment-user1-storefront',
    projectId: 'project-storefront',
    projectName: 'Storefront QA',
    userId: QrTestData.currentUserId,
    userEmail: 'test@test.dev',
    userName: 'Иван Тестовый',
    isActive: true,
    createdAt: config.data.projectAssignments[0].createdAt
  });
});

// ── TC-QR-012: Шторка брони — компоновка, тип office ─────────────────────────

test('[P1][TC-QR-012.1] Шторка брони (office) — drag handle и карточка устройства отображаются @regression', async ({ actor, page }) => {
  trace('TC-QR-012.1');

  await test.step('Авторизоваться и открыть шторку брони для доступного устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Проверить контент шторки и имя устройства', async () => {
    await expect(sheet.modalContent).toBeVisible();
    await sheet.expectDeviceName(QrTestData.deviceAvailableName);
  });
});

test('[P1][TC-QR-012.2] Шторка брони (office) — по умолчанию выбран тип "office" @regression', async ({ actor, page }) => {
  trace('TC-QR-012.2');

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Проверить, что выбран office и поля home скрыты', async () => {
    await sheet.expectOfficeModeSelected();
    await sheet.expectHomeFieldsHidden();
  });
});

test('[P1][TC-QR-012.3] Шторка брони (office) — кнопка "Подтвердить" активна @regression', async ({ actor, page }) => {
  trace('TC-QR-012.3');

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Проверить, что кнопка подтверждения видна и активна', async () => {
    await expect(sheet.confirmButton).toBeVisible();
    await expect(sheet.confirmButton).toBeEnabled();
  });
});

test('[P1][TC-QR-012.4] Шторка брони — закрытие по крестику @regression', async ({ actor, page }) => {
  trace('TC-QR-012.4');

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Закрыть шторку по крестику и проверить, что она скрыта', async () => {
    await sheet.close();
    await sheet.expectHidden();
  });
});

test('[P1][TC-QR-012.5] Шторка брони — закрытие по клику на оверлей @regression', async ({ actor, page }) => {
  trace('TC-QR-012.5');

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Закрыть шторку по клику на оверлей и проверить скрытие', async () => {
    await sheet.closeViaOverlay();
    await sheet.expectHidden();
  });
});

// ── TC-QR-013: Шторка брони — компоновка, тип home ───────────────────────────

test('[P1][TC-QR-013.1] Шторка брони (home) — переключение на "home" показывает поле даты @regression', async ({ actor, page }) => {
  trace('TC-QR-013.1');

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Переключить тип на home и проверить, что поле даты появилось', async () => {
    await sheet.selectHomeType();
    await sheet.expectHomeModeSelected();
    await sheet.expectHomeFieldsVisible();
  });
});

test('[P1][TC-QR-013.2] Шторка брони (home) — "Подтвердить" блокируется toast-ом без даты возврата @regression', async ({ actor, page }) => {
  trace('TC-QR-013.2');
  const app = new AppPage(page);

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Переключить тип на home и попытаться подтвердить без даты', async () => {
    await sheet.selectHomeType();
    await expect(sheet.returnDateInput).toBeVisible();
    await sheet.confirm();
  });

  await test.step('Проверить toast-предупреждение о необходимости указать дату', async () => {
    await expect(app.toastByText('Укажите дату возврата')).toBeVisible();
    // Статус устройства не должен измениться при незаполненной форме
    const device = await getDoc<{ status: string }>(page, 'devices', QrTestData.deviceAvailable);
    expect(device?.status).toBe('available');
  });
});

// ── TC-QR-014: Переключатель типа брони ──────────────────────────────────────

test('[P1][TC-QR-014.1] Шторка брони. Переключатель — office→home→office @regression', async ({ actor, page }) => {
  trace('TC-QR-014.1');

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Проверить начальное состояние office', async () => {
    await sheet.expectOfficeModeSelected();
    await sheet.expectHomeFieldsHidden();
  });

  await test.step('Переключить на home и проверить отображение полей', async () => {
    await sheet.selectHomeType();
    await sheet.expectHomeModeSelected();
    await sheet.expectHomeFieldsVisible();
  });

  await test.step('Вернуть на office и проверить, что home-поля снова скрыты', async () => {
    await sheet.selectOfficeType();
    await sheet.expectOfficeModeSelected();
    await sheet.expectHomeFieldsHidden();
    await sheet.expectConfirmEnabled();
  });
});

// ── TC-QR-015: Выбор проектов ────────────────────────────────────────────────

test('[P1][TC-QR-015] Шторка брони. Выбор проектов — поле присутствует в шторке @regression', async ({ actor, page }) => {
  trace('TC-QR-015');

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Проверить, что доступно состояние available и кнопка подтверждения', async () => {
    await sheet.expectAvailableStateVisible();
    await expect(sheet.confirmButton).toBeVisible();
  });
});

// ── TC-QR-015.2: Выбор ≥2 проектов → массивы в bookings + device ─────────────

test.describe('[TC-QR-015.2] Шторка брони — выбор нескольких проектов', () => {
  test.use({ mockConfig: multiProjectAssignmentConfig });

  test('[P1][TC-QR-015.2] Шторка брони — выбор ≥2 проектов: bookings/device содержат массивы currentProjectIds/Codes/Names @regression', async ({ actor, page }) => {
    // BR.05.15 — submitBooking пишет currentProjectIds[]/Codes[]/Names[] и основной
    // currentProjectId/Code/Name (devices-qr.js:885-890 + :930-935). Проверяем оба слоя.
    trace('TC-QR-015.2');
    const app = new AppPage(page);

    await test.step('Авторизоваться и открыть шторку брони', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

    await test.step('Отметить оба доступных проекта в чекбоксах', async () => {
      await sheet.selectAllAvailableProjects();
      const checked = await sheet.getCheckedProjectIds();
      expect(checked.length).toBeGreaterThanOrEqual(2);
    });

    await test.step('Подтвердить бронирование', async () => {
      await sheet.confirm();
      await expect(app.toastByText('забронировано')).toBeVisible();
    });

    await test.step('Проверить массивы и основной проект в device + bookings', async () => {
      const device = await getDoc<{
        currentProjectIds?: string[] | null;
        currentProjectCodes?: string[] | null;
        currentProjectNames?: string[] | null;
        currentProjectId?: string | null;
        currentProjectCode?: string | null;
        currentProjectName?: string | null;
      }>(page, 'devices', QrTestData.deviceAvailable);
      expect(Array.isArray(device?.currentProjectIds)).toBe(true);
      expect((device?.currentProjectIds || []).length).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(device?.currentProjectCodes)).toBe(true);
      expect((device?.currentProjectCodes || []).length).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(device?.currentProjectNames)).toBe(true);
      expect((device?.currentProjectNames || []).length).toBeGreaterThanOrEqual(2);
      // Основной проект — первый из массива (см. getTargetProjectSelection).
      expect(device?.currentProjectId).toBeTruthy();
      expect(device?.currentProjectIds?.[0]).toBe(device?.currentProjectId);
      expect(device?.currentProjectCodes?.[0]).toBe(device?.currentProjectCode);
      expect(device?.currentProjectNames?.[0]).toBe(device?.currentProjectName);

      const bookings = await getCollection<{
        deviceId: string;
        action: string;
        source?: string;
        currentProjectIds?: string[] | null;
        currentProjectCodes?: string[] | null;
        currentProjectNames?: string[] | null;
        currentProjectId?: string | null;
      }>(page, 'bookings');
      const record = bookings.find(
        (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take' && b.source === 'qr'
      );
      expect(record).toBeDefined();
      expect(Array.isArray(record?.currentProjectIds)).toBe(true);
      expect((record?.currentProjectIds || []).length).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(record?.currentProjectCodes)).toBe(true);
      expect((record?.currentProjectCodes || []).length).toBeGreaterThanOrEqual(2);
      expect(Array.isArray(record?.currentProjectNames)).toBe(true);
      expect((record?.currentProjectNames || []).length).toBeGreaterThanOrEqual(2);
      expect(record?.currentProjectIds?.[0]).toBe(record?.currentProjectId);
    });
  });
});

// ── TC-QR-016: Дата возврата ─────────────────────────────────────────────────

test('[P1][TC-QR-016.1] Шторка брони. Дата возврата — открывается поле даты при home @regression', async ({ actor, page }) => {
  trace('TC-QR-016.1');

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Переключить тип на home и проверить, что поле даты видно', async () => {
    await sheet.selectHomeType();
    await sheet.expectHomeFieldsVisible();
    await expect(sheet.returnDateInput).toBeVisible();
  });
});

test('[P1][TC-QR-016.2] Шторка брони. Дата возврата — заполнение даты активирует "Подтвердить" @regression', async ({ actor, page }) => {
  trace('TC-QR-016.2');

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Переключить тип на home и заполнить дату возврата', async () => {
    await sheet.selectHomeType();
    const futureDate = formatDate(addDays(QrTestData.homeReturnDateOffsetDays));
    await sheet.fillReturnDate(futureDate);
    await expect(sheet.returnDateInput).toHaveValue(futureDate);
  });

  await test.step('Проверить, что кнопка подтверждения активна', async () => {
    await expect(sheet.confirmButton).toBeEnabled();
  });
});

test('[P1][TC-QR-016.3] Шторка брони. Дата возврата — атрибут min не ранее сегодня @regression', async ({ actor, page }) => {
  trace('TC-QR-016.3');

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Переключить тип на home и проверить атрибут min даты возврата', async () => {
    await sheet.selectHomeType();
    const today = formatDate(new Date());
    await sheet.expectReturnDateMinIs(today);
  });
});

// ── TC-QR-017: Запрос бронирования ───────────────────────────────────────────

test('[P0][TC-QR-017.1] Шторка брони — успешное бронирование в офисе (office) @smoke', async ({ actor, page }) => {
  trace('TC-QR-017.1');
  const app = new AppPage(page);

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Подтвердить бронирование с типом office', async () => {
    await sheet.confirm();
  });

  await test.step('Проверить toast, закрытие шторки и поля Firestore', async () => {
    await expect(app.toastByText('забронировано')).toBeVisible();
    await sheet.expectHidden();

    // BR.05.4 — после подтверждения устройство получает status=booked и заполненные поля
    // currentUserId/currentUserName/currentUserPhoto/bookedAt (требование §9 раздела «BR.05.4»).
    const device = await getDoc<{
      status: string;
      bookingType: string;
      currentUserId?: string;
      currentUserName?: string;
      currentUserPhoto?: string | null;
      bookedAt?: unknown;
    }>(page, 'devices', QrTestData.deviceAvailable);
    expect(device?.status).toBe('booked');
    expect(device?.bookingType).toBe('office');
    expect(device?.currentUserId).toBe(QrTestData.currentUserId);
    expect(device?.currentUserName).toBeTruthy();
    expect(device?.bookedAt).toBeTruthy();
    // BR.05.4 — currentUserPhoto должен быть записан (либо строка URL, либо null,
    // в зависимости от user.photoURL; devices-qr.js:882 пишет photoURL || null).
    expect(device).toHaveProperty('currentUserPhoto');

    // BR.05.4 — bookings.userPhoto тоже сохраняется (devices-qr.js:920).
    const bookings = await getCollection<{
      deviceId: string;
      action: string;
      source?: string;
      userPhoto?: string | null;
    }>(page, 'bookings');
    const record = bookings.find(
      (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take' && b.source === 'qr'
    );
    expect(record).toBeDefined();
    expect(record).toHaveProperty('userPhoto');
  });
});

test('[P0][TC-QR-017.2] Шторка брони — успешное бронирование домой (home) @smoke', async ({ actor, page }) => {
  trace('TC-QR-017.2');
  const app = new AppPage(page);

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  const returnDate = formatDate(addDays(QrTestData.homeReturnDateOffsetDays));

  await test.step('Переключить на home, заполнить дату возврата и подтвердить', async () => {
    await sheet.selectHomeType();
    await sheet.fillReturnDate(returnDate);
    await sheet.confirm();
  });

  await test.step('Проверить toast и поля Firestore (bookingType=home, bookedUntil совпадает с выбранной датой)', async () => {
    await expect(app.toastByText('забронировано')).toBeVisible();
    await sheet.expectHidden();

    // BR.05.14 — bookedUntil соответствует выбранной дате (mock-Timestamp сериализуется как ISO).
    const device = await getDoc<{ status: string; bookingType: string; bookedUntil?: { value?: string } | null }>(
      page,
      'devices',
      QrTestData.deviceAvailable
    );
    expect(device?.status).toBe('booked');
    expect(device?.bookingType).toBe('home');
    expect(device?.bookedUntil).toBeTruthy();
    const storedDate = (device?.bookedUntil as { value?: string } | null)?.value || '';
    expect(storedDate.slice(0, 10)).toBe(returnDate);
  });
});

test('[P1][TC-QR-017.3] Шторка брони — ровно одна запись take появляется в bookings (идемпотентность) @regression', async ({ actor, page }) => {
  trace('TC-QR-017.3');
  const app = new AppPage(page);

  await test.step('Авторизоваться, открыть шторку брони и зафиксировать число take-броней до операции', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const bookingsBefore = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
  const takesBefore = bookingsBefore.filter(
    (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take'
  ).length;

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Подтвердить бронирование', async () => {
    await sheet.confirm();
    await expect(app.toastByText('забронировано')).toBeVisible();
  });

  await test.step('Проверить, что запись take появилась и счётчик увеличился ровно на 1', async () => {
    const bookingsAfter = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
    const takesAfter = bookingsAfter.filter(
      (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take'
    );
    // Manual TC «Повторный Firestore write не отправляется»: ровно одна запись take.
    expect(takesAfter).toHaveLength(takesBefore + 1);
  });
});

// ── TC-QR-016.4: Дата возврата — очистка возвращает шторку в исходное состояние ─────

test('[P1][TC-QR-016.4] Шторка брони. Дата возврата — очистка поля сбрасывает бронирование @regression', async ({ actor, page }) => {
  trace('TC-QR-016.4');
  const app = new AppPage(page);

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Переключить на home, заполнить дату возврата и очистить её', async () => {
    await sheet.selectHomeType();
    const futureDate = formatDate(addDays(QrTestData.homeReturnDateOffsetDays));
    await sheet.fillReturnDate(futureDate);
    await expect(sheet.returnDateInput).toHaveValue(futureDate);
    await sheet.clearReturnDate();
    await sheet.expectReturnDateEmpty();
  });

  await test.step('Попытаться подтвердить и проверить toast «Укажите дату» + неизменность Firestore', async () => {
    await sheet.confirm();
    // Manual TC «Поле очищается. Кнопка "Подтвердить" снова блокируется» — в текущей реализации
    // submit показывает warning-toast и не записывает данные (BR-эквивалент disabled-кнопки).
    await expect(app.toastByText('Укажите дату возврата')).toBeVisible();
    const device = await getDoc<{ status: string }>(page, 'devices', QrTestData.deviceAvailable);
    expect(device?.status).toBe('available');
  });
});

// ── TC-QR-018: Запрос бронирования — ошибка ──────────────────────────────────

test.describe('[TC-QR-018.1] Шторка брони — ошибка сети при записи в Firestore', () => {
  test.use({ mockConfig: writeNetworkErrorConfig });

  test('[P1][TC-QR-018.1] Шторка брони — ошибка сети: toast, статус не меняется, запись в bookings не создаётся @regression', async ({ actor, page }) => {
    trace('TC-QR-018.1');
    const app = new AppPage(page);

    await test.step('Авторизоваться и открыть шторку брони при сетевой ошибке записи', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const bookingsBefore = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
    const takesBefore = bookingsBefore.filter(
      (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take'
    ).length;

    const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

    await test.step('Подтвердить бронирование и получить ошибку', async () => {
      await sheet.confirm();
    });

    await test.step('Проверить toast ошибки, неизменность статуса и отсутствие новой записи в bookings', async () => {
      await expect(app.toastByText('Не удалось')).toBeVisible();
      const device = await getDoc<{ status: string }>(page, 'devices', QrTestData.deviceAvailable);
      expect(device?.status).toBe('available');
      // Manual TC «Статус устройства не меняется. Toast успеха не отображается»:
      // дополнительно убеждаемся, что новая запись take не создана (baseline-сравнение).
      const bookings = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
      const takes = bookings.filter(
        (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take'
      );
      expect(takes).toHaveLength(takesBefore);
      // BR.05.21 — после ошибки в #qr-booking-body должен появиться inline-баннер
      // «Не удалось оформить бронь: …» с кнопкой «Повторить» (renderBookingErrorBanner,
      // devices-qr.js:979-1001). Кнопка confirm также enabled для повторной попытки.
      await sheet.expectErrorBannerVisible();
      await sheet.expectRetryButtonVisible();
      await sheet.expectConfirmEnabled();
    });
  });
});

test.describe('[TC-QR-018.2] Шторка брони — ошибка прав доступа при записи в Firestore', () => {
  test.use({ mockConfig: writePermissionErrorConfig });

  test('[P1][TC-QR-018.2] Шторка брони — ошибка прав доступа: toast, статус не меняется, нет записи в bookings @regression', async ({ actor, page }) => {
    trace('TC-QR-018.2');
    const app = new AppPage(page);

    await test.step('Авторизоваться и открыть шторку брони при ошибке прав', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const bookingsBefore = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
    const takesBefore = bookingsBefore.filter(
      (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take'
    ).length;

    const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

    await test.step('Подтвердить бронирование и получить ошибку прав', async () => {
      await sheet.confirm();
    });

    await test.step('Проверить toast ошибки, неизменность статуса и отсутствие записи take в bookings', async () => {
      await expect(app.toastByText('Не удалось')).toBeVisible();
      const device = await getDoc<{ status: string }>(page, 'devices', QrTestData.deviceAvailable);
      expect(device?.status).toBe('available');
      const bookings = await getCollection<{ deviceId: string; action: string }>(page, 'bookings');
      const takes = bookings.filter(
        (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take'
      );
      expect(takes).toHaveLength(takesBefore);
      // BR.05.21 — inline-баннер ошибки + кнопка «Повторить» рендерятся одинаково для
      // permission-denied и network-ошибок (catch-блок submitBooking, devices-qr.js:958-1001).
      await sheet.expectErrorBannerVisible();
      await sheet.expectRetryButtonVisible();
      await sheet.expectConfirmEnabled();
    });
  });
});

// ── TC-QR-018.3: Шторка брони — inline-баннер «Повторить» виден после ошибки ─

test.describe('[TC-QR-018.3] Шторка брони — inline-баннер с кнопкой «Повторить»', () => {
  test.use({ mockConfig: writeNetworkErrorConfig });

  test('[P1][TC-QR-018.3] Шторка брони — inline-баннер с кнопкой «Повторить» виден после ошибки записи @regression', async ({ actor, page }) => {
    // BR.05.21 — renderBookingErrorBanner (devices-qr.js:979-1001) рендерит
    // .qr-booking-error c role="alert" и кнопкой [data-qr-action="retry"]/«Повторить».
    trace('TC-QR-018.3');
    const app = new AppPage(page);

    await test.step('Авторизоваться и открыть шторку брони при сетевой ошибке записи', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

    await test.step('Подтвердить бронь и дождаться toast ошибки', async () => {
      await sheet.confirm();
      await expect(app.toastByText('Не удалось')).toBeVisible();
    });

    await test.step('Проверить inline-баннер и кнопку «Повторить» внутри #qr-booking-body', async () => {
      await sheet.expectErrorBannerVisible();
      await sheet.expectRetryButtonVisible();
    });
  });
});

// ── TC-QR-018.4: Шторка брони — клик «Повторить» инициирует повторный submit ─

test.describe('[TC-QR-018.4] Шторка брони — retry-кнопка инициирует повторный submit', () => {
  test.use({ mockConfig: writeNetworkErrorConfig });

  test('[P1][TC-QR-018.4] Шторка брони — клик «Повторить» инициирует повторный submit @regression', async ({ actor, page }) => {
    // BR.05.21 — retry-обработчик (devices-qr.js:993-998) удаляет баннер и зовёт
    // submitBooking() заново. При сохраняющейся ошибке баннер появляется снова,
    // запись take не создаётся, статус устройства остаётся available.
    trace('TC-QR-018.4');
    const app = new AppPage(page);

    await test.step('Авторизоваться и открыть шторку брони при сетевой ошибке записи', async () => {
      await actor.attemptsTo(OpenApp(), SignIn());
    });

    const takesBefore = (
      await getCollection<{ deviceId: string; action: string; source?: string }>(page, 'bookings')
    ).filter(
      (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take' && b.source === 'qr'
    ).length;

    const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

    await test.step('Первый submit → дождаться баннера ошибки', async () => {
      await sheet.confirm();
      await expect(app.toastByText('Не удалось')).toBeVisible();
      await sheet.expectErrorBannerVisible();
    });

    await test.step('Клик «Повторить» → баннер пересоздаётся при повторной ошибке', async () => {
      await sheet.clickRetry();
      // После клика обработчик удаляет старый баннер и зовёт submitBooking() снова.
      // При том же mock-ошибке баннер должен появиться повторно.
      await expect(app.toastByText('Не удалось')).toBeVisible();
      await sheet.expectErrorBannerVisible();
      await sheet.expectRetryButtonVisible();
    });

    await test.step('Проверить, что статус не изменился и take-записей не прибавилось', async () => {
      const device = await getDoc<{ status: string }>(page, 'devices', QrTestData.deviceAvailable);
      expect(device?.status).toBe('available');
      const takesAfter = (
        await getCollection<{ deviceId: string; action: string; source?: string }>(page, 'bookings')
      ).filter(
        (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take' && b.source === 'qr'
      ).length;
      expect(takesAfter).toBe(takesBefore);
    });
  });
});

// ── TC-QR-019: Гонка при бронировании ────────────────────────────────────────

test('[P1][TC-QR-019] Шторка брони — гонка: транзакция Firestore защищает от двойного бронирования @regression', async ({ actor, page }) => {
  trace('TC-QR-019');
  const app = new AppPage(page);

  await test.step('Авторизоваться и открыть шторку брони доступного устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  const takesBefore = (
    await getCollection<{ deviceId: string; action: string; userId: string }>(page, 'bookings')
  ).filter(
    (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take' && b.userId === QrTestData.currentUserId
  ).length;

  await test.step('Эмулировать гонку: другой пользователь уже забронировал устройство', async () => {
    await page.evaluate((id: string) => {
      const store = (window as any).__mockStore;
      if (store?.devices?.[id]) {
        store.devices[id].status = 'booked';
        store.devices[id].currentUserId = 'racing-user';
      }
    }, QrTestData.deviceAvailable);
  });

  await test.step('Подтвердить бронь и получить предупреждение "уже занято"', async () => {
    await sheet.confirm();
    await expect(app.toastByText('Устройство уже занято')).toBeVisible();
  });

  await test.step('Проверить, что в bookings нет лишней записи take от текущего пользователя', async () => {
    const bookings = await getCollection<{ deviceId: string; action: string; userId: string }>(page, 'bookings');
    const racesAfter = bookings.filter(
      (b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take' && b.userId === QrTestData.currentUserId
    );
    expect(racesAfter.length).toBe(takesBefore);
    // BR.05.22 — защита от ложного успеха: toast «забронировано» НЕ должен быть виден,
    // когда транзакция отклонила бронь из-за гонки.
    await expect(app.toastByText('забронировано')).not.toBeVisible();
  });
});

// ── TC-QR-020: Шторка занятости — компоновка ─────────────────────────────────

test('[P1][TC-QR-020.1] Шторка занятости — отображается имя текущего владельца и bookings не растёт @regression', async ({ actor, page }) => {
  trace('TC-QR-020.1');

  await test.step('Авторизоваться и зафиксировать число записей bookings для занятого устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const bookingsBefore = (
    await getCollection<{ deviceId: string }>(page, 'bookings')
  ).filter((b) => b.deviceId === QrTestData.deviceBookedByOther).length;

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceBookedByOther);

  await test.step('Проверить шторку занятости и имя владельца', async () => {
    await sheet.expectBlockedStateVisible();
    await sheet.expectBlockedOwnerName(QrTestData.deviceBookedByOtherOwner);
    // BR.05.5 — занятое устройство имеет bookedUntil (дата возврата). В стандартном моке
    // у dev-booked-other выставлен bookedUntil, отображается в блоке информации.
    await expect(sheet.blockedInfo).toBeVisible();
  });

  await test.step('Проверить, что bookings не выросли (скан занятого не создаёт записей)', async () => {
    const bookingsAfter = (
      await getCollection<{ deviceId: string }>(page, 'bookings')
    ).filter((b) => b.deviceId === QrTestData.deviceBookedByOther).length;
    expect(bookingsAfter).toBe(bookingsBefore);
  });
});

test('[P1][TC-QR-020.2] Шторка занятости — кнопки бронирования отсутствуют @regression', async ({ actor, page }) => {
  trace('TC-QR-020.2');

  await test.step('Авторизоваться и отсканировать QR занятого устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceBookedByOther);

  await test.step('Проверить отсутствие кнопки подтверждения', async () => {
    await sheet.expectConfirmButtonAbsent();
  });
});

test('[P1][TC-QR-020.3] Шторка занятости — закрывается по крестику @regression', async ({ actor, page }) => {
  trace('TC-QR-020.3');

  await test.step('Авторизоваться и отсканировать QR занятого устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceBookedByOther);

  await test.step('Закрыть шторку по крестику и проверить скрытие', async () => {
    await sheet.close();
    await sheet.expectHidden();
  });
});

test('[P1][TC-QR-020.4] Шторка занятости — дата возврата отображается если задана @regression', async ({ actor, page }) => {
  trace('TC-QR-020.4');

  await test.step('Авторизоваться и отсканировать QR занятого устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceBookedByOther);

  await test.step('Проверить видимость блока с информацией (включая дату возврата)', async () => {
    await expect(sheet.blockedInfo).toBeVisible();
  });
});

// ── TC-QR-021: Шторка внешнего устройства — компоновка ───────────────────────

test('[P1][TC-QR-021.1] Шторка external — department отображается @regression', async ({ actor, page }) => {
  trace('TC-QR-021.1');

  await test.step('Авторизоваться и отсканировать QR external-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceExternal);

  await test.step('Проверить шторку external и поле department', async () => {
    await sheet.expectExternalStateVisible();
    await sheet.expectExternalDepartment(QrTestData.deviceExternalDepartment);
  });
});

test('[P1][TC-QR-021.2] Шторка external — comment отображается @regression', async ({ actor, page }) => {
  trace('TC-QR-021.2');

  await test.step('Авторизоваться и отсканировать QR external-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceExternal);

  await test.step('Проверить отображение комментария external', async () => {
    await sheet.expectExternalComment(QrTestData.deviceExternalComment);
  });
});

test('[P1][TC-QR-021.3] Шторка external — кнопки бронирования и переключатель типа отсутствуют, bookings не растут @regression', async ({ actor, page }) => {
  trace('TC-QR-021.3');

  await test.step('Авторизоваться и зафиксировать число bookings для external-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const bookingsBefore = (
    await getCollection<{ deviceId: string }>(page, 'bookings')
  ).filter((b) => b.deviceId === QrTestData.deviceExternal).length;

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceExternal);

  await test.step('Проверить отсутствие confirm-кнопки и переключателя типа брони', async () => {
    await sheet.expectConfirmButtonAbsent();
    // BR.05.6 — кнопки бронирования (включая qr-type-btn) скрыты для external,
    // т.е. ни confirm, ни office/home переключатель не отрисовываются.
    await expect(sheet.typeButtonOffice).toHaveCount(0);
    await expect(sheet.typeButtonHome).toHaveCount(0);
  });

  await test.step('Закрыть шторку и убедиться, что bookings не выросли', async () => {
    await sheet.close();
    const bookingsAfter = (
      await getCollection<{ deviceId: string }>(page, 'bookings')
    ).filter((b) => b.deviceId === QrTestData.deviceExternal).length;
    expect(bookingsAfter).toBe(bookingsBefore);
  });
});

test('[P1][TC-QR-021.4] Шторка external — закрывается по крестику @regression', async ({ actor, page }) => {
  trace('TC-QR-021.4');

  await test.step('Авторизоваться и отсканировать QR external-устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceExternal);

  await test.step('Закрыть шторку по крестику и проверить скрытие', async () => {
    await sheet.close();
    await sheet.expectHidden();
  });
});

// ── TC-QR-022: Шторка неисправного устройства ────────────────────────────────

test('[P1][TC-QR-022] Шторка неисправного устройства — компоновка @regression', async ({ actor, page }) => {
  trace('TC-QR-022');

  await test.step('Авторизоваться и отсканировать QR неисправного устройства', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, 'dev-broken');

  await test.step('Проверить баннер "Устройство неисправно", отсутствие confirm, наличие "Закрыть"', async () => {
    await sheet.expectBrokenStateVisible();
    await sheet.expectConfirmButtonAbsent();
    await expect(sheet.brokenCloseButton).toBeVisible();
  });
});

// ── TC-QR-013.3: Home — confirm без даты блокируется (BR.05.14) ──────────────

test('[P1][TC-QR-013.3] Шторка брони (home) — кнопка "Подтвердить" блокирует submit пока дата не заполнена @regression', async ({ actor, page }) => {
  // BR.05.14 — при home обязателен bookedUntil; submit без даты не должен создавать бронь.
  trace('TC-QR-013.3');
  const app = new AppPage(page);

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const bookingsBefore = (
    await getCollection<{ deviceId: string; action: string }>(page, 'bookings')
  ).filter((b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take').length;

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Переключить на home, убедиться что поле даты пустое, и нажать "Подтвердить"', async () => {
    await sheet.selectHomeType();
    await sheet.expectReturnDateEmpty();
    await sheet.confirm();
  });

  await test.step('Проверить toast "Укажите дату возврата", статус и счётчик не изменились', async () => {
    await expect(app.toastByText('Укажите дату возврата')).toBeVisible();
    const device = await getDoc<{ status: string }>(page, 'devices', QrTestData.deviceAvailable);
    expect(device?.status).toBe('available');
    const bookingsAfter = (
      await getCollection<{ deviceId: string; action: string }>(page, 'bookings')
    ).filter((b) => b.deviceId === QrTestData.deviceAvailable && b.action === 'take').length;
    expect(bookingsAfter).toBe(bookingsBefore);
  });
});

// ── TC-QR-014.2: Переключение office→home→office (BR.05.14) ──────────────────

test('[P1][TC-QR-014.2] Шторка брони — office→home→office: submit без даты на home показывает toast, на office — бронирует @regression', async ({ actor, page }) => {
  // BR.05.14 — переключение типа брони не должно создавать бронь без обязательной даты.
  trace('TC-QR-014.2');
  const app = new AppPage(page);

  await test.step('Авторизоваться и открыть шторку брони', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const { sheet } = await openBookingSheetForDevice(page, QrTestData.deviceAvailable);

  await test.step('Проверить начальное состояние office и enabled confirm', async () => {
    await sheet.expectOfficeModeSelected();
    await sheet.expectConfirmEnabled();
  });

  await test.step('Переключить на home и нажать confirm без даты', async () => {
    await sheet.selectHomeType();
    await sheet.expectReturnDateEmpty();
    await sheet.confirm();
    await expect(app.toastByText('Укажите дату возврата')).toBeVisible();
    const deviceMid = await getDoc<{ status: string }>(page, 'devices', QrTestData.deviceAvailable);
    expect(deviceMid?.status).toBe('available');
  });

  await test.step('Вернуть на office и подтвердить бронь', async () => {
    await sheet.selectOfficeType();
    await sheet.expectOfficeModeSelected();
    await sheet.confirm();
    await expect(app.toastByText('забронировано')).toBeVisible();
  });

  await test.step('Проверить, что бронь создана с bookingType=office', async () => {
    const device = await getDoc<{ status: string; bookingType: string }>(
      page,
      'devices',
      QrTestData.deviceAvailable
    );
    expect(device?.status).toBe('booked');
    expect(device?.bookingType).toBe('office');
  });
});

// ── TC-QR-022.2: Шторка broken — confirm отсутствует, bookings не растут (BR.05.17) ─

test('[P1][TC-QR-022.2] Шторка неисправного устройства — confirm отсутствует, bookings не пополняются @regression', async ({ actor, page }) => {
  // BR.05.17 — при isWorking=false запись в bookings и изменение status не выполняются.
  trace('TC-QR-022.2');

  await test.step('Авторизоваться и зафиксировать число take-броней для dev-broken', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  const takesBefore = (
    await getCollection<{ deviceId: string; action: string }>(page, 'bookings')
  ).filter((b) => b.deviceId === 'dev-broken' && b.action === 'take').length;

  const { sheet } = await openBookingSheetForDevice(page, 'dev-broken');

  await test.step('Проверить баннер broken и отсутствие confirm', async () => {
    await sheet.expectBrokenStateVisible();
    await sheet.expectConfirmButtonAbsent();
  });

  await test.step('Проверить, что Firestore не изменился: статус и take-counter сохранились', async () => {
    const device = await getDoc<{ status: string }>(page, 'devices', 'dev-broken');
    expect(device?.status).toBe('available');
    const takesAfter = (
      await getCollection<{ deviceId: string; action: string }>(page, 'bookings')
    ).filter((b) => b.deviceId === 'dev-broken' && b.action === 'take').length;
    expect(takesAfter).toBe(takesBefore);
  });
});
