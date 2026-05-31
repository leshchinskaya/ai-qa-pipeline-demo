import { type Page, type Locator, expect } from 'playwright/test';

export class QrScannerPage {
  readonly page: Page;

  /* ---- Locators ---- */

  readonly modal: Locator;
  readonly modalOverlay: Locator;
  readonly closeButton: Locator;
  readonly scannerArea: Locator;
  readonly statusText: Locator;
  readonly flipCameraButton: Locator;
  readonly uploadInput: Locator;
  readonly uploadLabel: Locator;
  readonly manualInput: Locator;
  readonly manualSubmitButton: Locator;
  readonly openScannerButton: Locator;
  readonly modalTitle: Locator;
  readonly timeoutHint: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modal = page.locator('#qr-scanner-modal');
    this.modalOverlay = this.modal.locator('.modal-overlay');
    this.closeButton = this.modal.locator('.modal-close');
    this.scannerArea = page.locator('#qr-scanner-area');
    this.statusText = page.locator('#qr-scanner-status');
    this.flipCameraButton = page.locator('#qr-flip-camera');
    this.uploadInput = page.locator('#qr-upload-input');
    this.uploadLabel = page.locator('label.qr-upload-btn');
    this.manualInput = page.locator('#qr-manual-input');
    this.manualSubmitButton = page.locator('#qr-manual-submit');
    this.openScannerButton = page.locator('#qr-scan-btn');
    this.modalTitle = this.modal.locator('.modal-header h3');
    this.timeoutHint = page.locator('#qr-scanner-timeout-hint');
  }

  /** Форсирует показ подсказки о таймауте без ожидания 10 секунд. */
  async forceTimeoutHint(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).DevicesQR.showTimeoutHint();
    });
  }

  async expectTimeoutHintVisible(): Promise<void> {
    await expect(this.timeoutHint).not.toHaveClass(/hidden/);
    await expect(this.timeoutHint).toBeVisible();
  }

  /* ---- Actions ---- */

  async open(): Promise<void> {
    await this.openScannerButton.click();
    await this.modal.waitFor({ state: 'visible' });
  }

  async close(): Promise<void> {
    await this.closeButton.click();
  }

  async closeViaOverlay(): Promise<void> {
    // .modal-content центрируется поверх .modal-overlay, поэтому клик в центр
    // оверлея перехватывается контентом (actionability fail). Кликаем в угол,
    // где .modal-overlay реально доступен.
    await this.modalOverlay.click({ position: { x: 1, y: 1 } });
  }

  async closeViaEsc(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  async flipCamera(): Promise<void> {
    await this.flipCameraButton.click();
  }

  async typeManualId(deviceId: string): Promise<void> {
    await this.manualInput.fill(deviceId);
  }

  async submitManualId(): Promise<void> {
    await this.manualSubmitButton.click();
  }

  async submitManualIdViaEnter(): Promise<void> {
    await this.manualInput.press('Enter');
  }

  async clearManualId(): Promise<void> {
    await this.manualInput.clear();
  }

  /** Симулирует успешное распознавание QR-кода через JS. */
  async simulateScan(deviceId: string): Promise<void> {
    await this.page.evaluate((id: string) => {
      (window as any).DevicesQR.onScanSuccess(id);
    }, deviceId);
  }

  /* ---- Assertions ---- */

  async expectVisible(): Promise<void> {
    await expect(this.modal).toBeVisible();
  }

  async expectHidden(): Promise<void> {
    await expect(this.modal).toBeHidden();
  }

  async expectScannerButtonHidden(): Promise<void> {
    await expect(this.openScannerButton).toBeHidden();
  }

  async expectScannerButtonVisible(): Promise<void> {
    await expect(this.openScannerButton).toBeVisible();
  }

  async expectStatus(text: string): Promise<void> {
    await expect(this.statusText).toHaveText(text);
  }

  async expectStatusContains(text: string): Promise<void> {
    await expect(this.statusText).toContainText(text);
  }

  async expectManualInputEmpty(): Promise<void> {
    await expect(this.manualInput).toHaveValue('');
  }

  async expectManualSubmitVisible(): Promise<void> {
    await expect(this.manualSubmitButton).toBeVisible();
  }

  async expectUploadInputCount(count: number): Promise<void> {
    await expect(this.uploadInput).toHaveCount(count);
  }

  async expectUploadInputAcceptsImages(): Promise<void> {
    await expect(this.uploadInput).toHaveAttribute('accept', 'image/*');
  }

  async expectAllControlsVisible(): Promise<void> {
    await expect(this.flipCameraButton).toBeVisible();
    await expect(this.uploadLabel).toBeVisible();
    await expect(this.manualInput).toBeVisible();
    await expect(this.manualSubmitButton).toBeVisible();
  }
}
