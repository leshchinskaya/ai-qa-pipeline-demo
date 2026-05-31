/**
 * Общие хелперы и тестовые данные для QR-бронирования.
 * См. RULES.md #1.3 (TestData), #10 (DRY).
 */
import { test } from '../../fixtures/test';
import type { Page } from 'playwright/test';
import { QrScannerPage } from '../../pages/QrScannerPage';
import { QrBookingSheetPage } from '../../pages/QrBookingSheetPage';

/* ---- Тестовые данные (RULES.md #1.3) ---- */

export const QrTestData = {
  deviceAvailable: 'dev-iphone-13',
  deviceAvailableName: 'iPhone 13',
  deviceBookedByOther: 'dev-booked-other',
  deviceBookedByOtherOwner: 'Ольга Второй',
  deviceOwnOffice: 'dev-booked-office',
  deviceOwnHome: 'dev-booked-home',
  deviceExternal: 'dev-external-a3',
  deviceExternalDepartment: 'SA',
  deviceExternalComment: 'Передан в отдел SA',
  unknownDeviceId: 'non-existent-device-xyz',
  currentUserId: 'user-1',
  sharedUserId: 'shared-1',
  homeReturnDateOffsetDays: 7,
} as const;

/* ---- Трассировка (allure-playwright не подключён в package.json) ---- */

/**
 * Записывает TC-идентификатор в аннотации Playwright.
 * Если `allure-playwright` будет добавлен в зависимости проекта,
 * этот хелпер можно заменить на `allure.story(tcId)` без правки тестов.
 */
export function trace(tcId: string): void {
  test.info().annotations.push({ type: 'TC', description: tcId });
}

/* ---- Открытие шторки брони после симуляции скана ---- */

export async function openBookingSheetForDevice(
  page: Page,
  deviceId: string
): Promise<{ scanner: QrScannerPage; sheet: QrBookingSheetPage }> {
  const scanner = new QrScannerPage(page);
  const sheet = new QrBookingSheetPage(page);
  await scanner.open();
  await scanner.simulateScan(deviceId);
  await sheet.expectVisible();
  return { scanner, sheet };
}
