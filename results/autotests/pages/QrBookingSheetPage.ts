import { type Page, type Locator, expect } from 'playwright/test';

/**
 * Page Object для всех состояний шторки QR-бронирования (#qr-booking-sheet).
 * Состояния: available, booked-by-other, own-device, external.
 */
export class QrBookingSheetPage {
  readonly page: Page;

  /* ---- Locators ---- */

  readonly sheet: Locator;
  readonly sheetOverlay: Locator;
  readonly closeButton: Locator;
  readonly body: Locator;

  // Доступное устройство (.qr-state-available)
  readonly typeButtonOffice: Locator;
  readonly typeButtonHome: Locator;
  readonly homeFields: Locator;
  readonly returnDateInput: Locator;
  readonly cancelButton: Locator;
  readonly confirmButton: Locator;

  // Занятое другим (.qr-state-blocked)
  readonly blockedBanner: Locator;
  readonly blockedInfo: Locator;
  readonly blockedCloseButton: Locator;

  // External (.qr-state-external)
  readonly externalBanner: Locator;
  readonly externalInfo: Locator;
  readonly externalCloseButton: Locator;

  // Своё устройство (.qr-state-own)
  readonly ownBanner: Locator;
  readonly ownReturnButton: Locator;
  readonly ownCancelButton: Locator;

  // Заголовок карточки устройства
  readonly deviceCardName: Locator;
  readonly modalContent: Locator;

  // Неисправное устройство (.qr-state-broken)
  readonly brokenBanner: Locator;
  readonly brokenCloseButton: Locator;
  readonly openAdminButton: Locator;

  // Ожидание получения (.qr-state-pending-receipt)
  readonly pendingReceiptBanner: Locator;
  readonly confirmReceiptButton: Locator;

  // Изменение даты возврата (own-state)
  readonly changeDateButton: Locator;
  readonly changeUntilInput: Locator;
  readonly changeDateSaveButton: Locator;
  readonly changeDateCancelButton: Locator;

  // Shared-аккаунт: поиск пользователя
  readonly userSearchInput: Locator;
  readonly userSuggestList: Locator;
  readonly userSuggestItems: Locator;

  // BR.05.21 — inline-баннер ошибки бронирования с кнопкой «Повторить»
  readonly errorBanner: Locator;
  readonly retryButton: Locator;

  // BR.05.15 — выбор проектов (чекбоксы)
  readonly projectSelectGroup: Locator;
  readonly projectCheckboxes: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sheet = page.locator('#qr-booking-sheet');
    this.sheetOverlay = this.sheet.locator('.modal-overlay');
    this.closeButton = this.sheet.locator('.modal-close');
    this.body = page.locator('#qr-booking-body');

    this.typeButtonOffice = page.locator('.qr-type-btn[data-type="office"]');
    this.typeButtonHome = page.locator('.qr-type-btn[data-type="home"]');
    this.homeFields = page.locator('.qr-home-fields');
    this.returnDateInput = page.locator('#qr-booking-until');
    this.cancelButton = page.locator('[data-qr-action="cancel"]');
    this.confirmButton = page.locator('[data-qr-action="confirm"]');

    this.blockedBanner = page.locator('.qr-state-blocked .qr-blocked-banner');
    this.blockedInfo = page.locator('.qr-state-blocked .qr-blocked-info');
    this.blockedCloseButton = page.locator('.qr-state-blocked [data-qr-action="close"]');

    this.externalBanner = page.locator('.qr-state-external .qr-blocked-banner');
    this.externalInfo = page.locator('.qr-state-external .qr-blocked-info');
    this.externalCloseButton = page.locator('.qr-state-external [data-qr-action="close"]');

    this.ownBanner = page.locator('.qr-state-own .qr-info-banner');
    this.ownReturnButton = page.locator('[data-qr-action="return"]');
    this.ownCancelButton = page.locator('.qr-state-own [data-qr-action="cancel"]');

    this.deviceCardName = page.locator('.qr-device-card-name');
    this.modalContent = this.sheet.locator('.modal-content');

    this.brokenBanner = page.locator('.qr-state-broken .qr-broken-banner');
    this.brokenCloseButton = page.locator('.qr-state-broken [data-qr-action="close"]');
    this.openAdminButton = page.locator('[data-qr-action="open-admin"]');

    this.pendingReceiptBanner = page.locator('.qr-state-pending-receipt .qr-info-banner');
    this.confirmReceiptButton = page.locator('[data-qr-action="confirm-receipt"]');

    this.changeDateButton = page.locator('[data-qr-action="change-date"]');
    this.changeUntilInput = page.locator('#qr-change-until');
    this.changeDateSaveButton = page.locator('[data-qr-action="change-date-save"]');
    this.changeDateCancelButton = page.locator('[data-qr-action="change-date-cancel"]');

    this.userSearchInput = page.locator('#qr-user-search');
    this.userSuggestList = page.locator('#qr-user-suggest');
    this.userSuggestItems = this.userSuggestList.locator('li[data-user-id]');

    this.errorBanner = page.locator('#qr-booking-body .qr-booking-error');
    this.retryButton = this.errorBanner.locator('[data-qr-action="retry"]');

    this.projectSelectGroup = page.locator('#qr-booking-project-select');
    this.projectCheckboxes = this.projectSelectGroup.locator('input[type="checkbox"]');
  }

  /* ---- Shared user search actions ---- */

  async searchSharedUser(query: string): Promise<void> {
    await this.userSearchInput.fill(query);
  }

  async selectFirstUserSuggestion(): Promise<void> {
    await this.userSuggestItems.first().click();
  }

  async expectUserSearchVisible(): Promise<void> {
    await expect(this.userSearchInput).toBeVisible();
  }

  async expectFirstSuggestionContains(text: string | RegExp): Promise<void> {
    await expect(this.userSuggestItems.first()).toContainText(text);
  }

  /* ---- Broken / Pending receipt actions ---- */

  async confirmReceipt(): Promise<void> {
    await this.confirmReceiptButton.click();
  }

  async openAdmin(): Promise<void> {
    await this.openAdminButton.click();
  }

  /* ---- Change-date actions ---- */

  async openChangeDateForm(): Promise<void> {
    await this.changeDateButton.click();
  }

  async fillChangeDate(dateValue: string): Promise<void> {
    await this.changeUntilInput.fill(dateValue);
  }

  async saveChangeDate(): Promise<void> {
    await this.changeDateSaveButton.click();
  }

  async cancelChangeDate(): Promise<void> {
    await this.changeDateCancelButton.click();
  }

  /* ---- Broken / Pending receipt assertions ---- */

  async expectBrokenStateVisible(): Promise<void> {
    await expect(this.brokenBanner).toBeVisible();
  }

  async expectPendingReceiptStateVisible(): Promise<void> {
    await expect(this.pendingReceiptBanner).toBeVisible();
    await expect(this.confirmReceiptButton).toBeVisible();
  }

  async expectOpenAdminButtonVisible(): Promise<void> {
    await expect(this.openAdminButton).toBeVisible();
  }

  /* ---- Change-date assertions ---- */

  async expectChangeDateButtonVisible(): Promise<void> {
    await expect(this.changeDateButton).toBeVisible();
  }

  async expectChangeDateFormVisible(): Promise<void> {
    await expect(this.changeUntilInput).toBeVisible();
    await expect(this.changeDateSaveButton).toBeVisible();
  }

  /* ---- Actions ---- */

  async close(): Promise<void> {
    await this.closeButton.click();
  }

  async closeViaOverlay(): Promise<void> {
    // .modal-content центрируется поверх .modal-overlay; клик в центр перехватывается
    // контентом. Кликаем в угол, чтобы попасть в фон оверлея.
    await this.sheetOverlay.click({ position: { x: 1, y: 1 } });
  }

  async selectOfficeType(): Promise<void> {
    await this.typeButtonOffice.click();
  }

  async selectHomeType(): Promise<void> {
    await this.typeButtonHome.click();
  }

  async fillReturnDate(dateValue: string): Promise<void> {
    await this.returnDateInput.fill(dateValue);
  }

  async confirm(): Promise<void> {
    await this.confirmButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  async returnDevice(): Promise<void> {
    await this.ownReturnButton.click();
  }

  async returnDeviceForce(): Promise<void> {
    await this.ownReturnButton.click({ force: true });
  }

  async closeBlockedSheet(): Promise<void> {
    await this.blockedCloseButton.click();
  }

  async closeExternalSheet(): Promise<void> {
    await this.externalCloseButton.click();
  }

  /* ---- Assertions ---- */

  async expectVisible(): Promise<void> {
    await expect(this.sheet).toBeVisible();
  }

  async expectHidden(): Promise<void> {
    await expect(this.sheet).toBeHidden();
  }

  async expectDeviceName(name: string): Promise<void> {
    await expect(this.deviceCardName).toContainText(name);
  }

  async expectAvailableStateVisible(): Promise<void> {
    await expect(this.page.locator('.qr-state-available')).toBeVisible();
  }

  async expectOfficeModeSelected(): Promise<void> {
    await expect(this.typeButtonOffice).toHaveClass(/active/);
  }

  async expectHomeModeSelected(): Promise<void> {
    await expect(this.typeButtonHome).toHaveClass(/active/);
  }

  async expectHomeFieldsVisible(): Promise<void> {
    await expect(this.homeFields).not.toHaveClass(/hidden/);
    await expect(this.returnDateInput).toBeVisible();
  }

  async expectHomeFieldsHidden(): Promise<void> {
    await expect(this.homeFields).toHaveClass(/hidden/);
  }

  async expectConfirmEnabled(): Promise<void> {
    await expect(this.confirmButton).toBeEnabled();
  }

  async expectBlockedStateVisible(): Promise<void> {
    await expect(this.blockedBanner).toBeVisible();
  }

  async expectBlockedOwnerName(name: string): Promise<void> {
    await expect(this.blockedInfo).toContainText(name);
  }

  async expectExternalStateVisible(): Promise<void> {
    await expect(this.externalBanner).toBeVisible();
  }

  async expectExternalDepartment(dept: string): Promise<void> {
    await expect(this.externalInfo).toContainText(dept);
  }

  async expectExternalComment(comment: string): Promise<void> {
    await expect(this.externalInfo).toContainText(comment);
  }

  async expectOwnStateVisible(): Promise<void> {
    await expect(this.ownBanner).toBeVisible();
  }

  async expectConfirmButtonAbsent(): Promise<void> {
    await expect(this.confirmButton).toHaveCount(0);
  }

  async expectReturnDateMinIs(date: string): Promise<void> {
    await expect(this.returnDateInput).toHaveAttribute('min', date);
  }

  /** Очищает значение поля даты возврата (для проверки сценария сброса). */
  async clearReturnDate(): Promise<void> {
    await this.returnDateInput.fill('');
  }

  async expectReturnDateEmpty(): Promise<void> {
    await expect(this.returnDateInput).toHaveValue('');
  }

  async expectConfirmDisabled(): Promise<void> {
    await expect(this.confirmButton).toBeDisabled();
  }

  /* ---- BR.05.21 — inline-баннер ошибки + кнопка «Повторить» ---- */

  async expectErrorBannerVisible(): Promise<void> {
    await expect(this.errorBanner).toBeVisible();
    await expect(this.errorBanner).toHaveAttribute('role', 'alert');
  }

  async expectErrorBannerHidden(): Promise<void> {
    await expect(this.errorBanner).toBeHidden();
  }

  async expectRetryButtonVisible(): Promise<void> {
    await expect(this.retryButton).toBeVisible();
    await expect(this.retryButton).toContainText('Повторить');
    await expect(this.retryButton).toBeEnabled();
  }

  async clickRetry(): Promise<void> {
    await this.retryButton.click();
  }

  /* ---- BR.05.15 — выбор нескольких проектов ---- */

  /**
   * Отмечает чекбоксы проектов в шторке брони.
   * Если codes пустой — отмечает все доступные.
   */
  async selectAllAvailableProjects(): Promise<void> {
    await expect(this.projectSelectGroup).toBeVisible();
    const count = await this.projectCheckboxes.count();
    for (let i = 0; i < count; i++) {
      const cb = this.projectCheckboxes.nth(i);
      if (await cb.isDisabled()) continue;
      if (!(await cb.isChecked())) await cb.check();
    }
  }

  async getCheckedProjectIds(): Promise<string[]> {
    return this.projectSelectGroup
      .locator('input[type="checkbox"]:checked')
      .evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value));
  }
}
