/**
 * QR-бронирование. Карточка устройства. QR-код — компоновка.
 * Покрывает TC-37 из JSON ручных проверок (component_tests.json).
 *
 * Соответствие RULES.md:
 *   #1   Каждый тест заканчивается assertion.
 *   #1.3 Тестовые данные в TestData (helpers.ts).
 *   #2   Логические блоки оборачиваются в `test.step()` с описанием на русском.
 *   #2.1 Локаторы только в Page Objects (DeviceDetailsModal, DevicesPage).
 *   #3   Имена тестов: [Priority][TC-ID] Описание @tag.
 *   #5   Smart waits через PO/expect, без `waitForTimeout`.
 *   #6   Изоляция тестов: каждый тест использует свежий mockConfig (fixture).
 *
 * Трассировка: TC-37 (JSON) → TC-QR-037.x.
 * BR.05.* — payload содержит только deviceId, без чувствительных данных.
 */
import { test } from '../../fixtures/test';
import { OpenApp } from '../../screenplay/tasks/OpenApp';
import { SignIn } from '../../screenplay/tasks/SignIn';
import { DevicesPage } from '../../pages/DevicesPage';
import { DeviceDetailsModal } from '../../pages/DeviceDetailsModal';
import { QrTestData, trace } from './helpers';

// ── TC-37: Карточка устройства. QR-код — компоновка ──────────────────────────

test('[P1][TC-QR-037.1] Карточка устройства — QR-код отображается @regression', async ({ actor, page }) => {
  trace('TC-QR-037.1');
  const devices = new DevicesPage(page);
  const details = new DeviceDetailsModal(page);

  await test.step('Авторизоваться и открыть приложение', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  await test.step('Открыть карточку устройства из каталога', async () => {
    await devices.openDeviceCardById(QrTestData.deviceAvailable);
    await details.expectVisible();
  });

  await test.step('Проверить, что QR-блок и изображение QR отображаются', async () => {
    await details.expectQrBlockVisible();
    await details.expectQrImageVisible();
  });
});

test('[P1][TC-QR-037.2] Карточка устройства — QR payload содержит только deviceId @regression', async ({ actor, page }) => {
  trace('TC-QR-037.2');
  const devices = new DevicesPage(page);
  const details = new DeviceDetailsModal(page);

  await test.step('Авторизоваться и открыть приложение', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  await test.step('Открыть карточку устройства', async () => {
    await devices.openDeviceCardById(QrTestData.deviceAvailable);
    await details.expectVisible();
  });

  await test.step('Проверить отображаемый payload рядом с QR-кодом', async () => {
    await details.expectQrPayload(QrTestData.deviceAvailable);
  });
});

test('[P1][TC-QR-037.3] Карточка устройства — QR-изображение кодирует только deviceId, без чувствительных данных @regression', async ({ actor, page }) => {
  trace('TC-QR-037.3');
  const devices = new DevicesPage(page);
  const details = new DeviceDetailsModal(page);

  await test.step('Авторизоваться и открыть приложение', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  await test.step('Открыть карточку устройства', async () => {
    await devices.openDeviceCardById(QrTestData.deviceAvailable);
    await details.expectVisible();
  });

  await test.step('Проверить, что в data-параметре QR закодирован только deviceId', async () => {
    await details.expectQrImageEncodesOnly(QrTestData.deviceAvailable);
    await details.expectQrImageHasNoSensitiveData();
  });
});

test('[P1][TC-QR-037.4] Карточка устройства — подсказка о QR-коде отображается @regression', async ({ actor, page }) => {
  trace('TC-QR-037.4');
  const devices = new DevicesPage(page);
  const details = new DeviceDetailsModal(page);

  await test.step('Авторизоваться и открыть приложение', async () => {
    await actor.attemptsTo(OpenApp(), SignIn());
  });

  await test.step('Открыть карточку устройства', async () => {
    await devices.openDeviceCardById(QrTestData.deviceAvailable);
    await details.expectVisible();
  });

  await test.step('Проверить наличие подсказки рядом с QR', async () => {
    await details.expectHintVisible();
  });
});
