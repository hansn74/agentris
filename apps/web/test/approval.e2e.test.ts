import { test, expect, Page } from '@playwright/test';

// Helper to login
async function loginAsConsultant(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'consultant@test.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

// Helper to create mock preview data
async function createMockPreview(page: Page) {
  // This would typically be done via API or database seeding
  // For now, we'll navigate to a page that creates test data
  await page.goto('/test/create-preview');
  await page.waitForSelector('[data-testid="preview-created"]');
}

test.describe('Approval Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsConsultant(page);
  });

  test('should display approval queue with pending items', async ({ page }) => {
    await createMockPreview(page);
    await page.goto('/approvals');
    
    // Check page title and structure
    await expect(page.locator('h1')).toContainText('Approvals');
    await expect(page.locator('[data-testid="approval-queue"]')).toBeVisible();
    
    // Check pending items badge
    const pendingBadge = page.locator('text=/\\d+ Pending/');
    await expect(pendingBadge).toBeVisible();
  });

  test('should allow selecting items for approval', async ({ page }) => {
    await createMockPreview(page);
    await page.goto('/approvals');
    
    // Select first item
    const firstCheckbox = page.locator('[data-testid^="approval-item-"] input[type="checkbox"]').first();
    await firstCheckbox.click();
    
    // Check selection counter updates
    await expect(page.locator('text=/1 selected/')).toBeVisible();
    
    // Select all items
    await page.click('button:has-text("Select All")');
    const selectedCount = await page.locator('text=/\\d+ selected/').textContent();
    expect(parseInt(selectedCount?.match(/\\d+/)?.[0] || '0')).toBeGreaterThan(1);
  });

  test('should approve selected items with comments', async ({ page }) => {
    await createMockPreview(page);
    await page.goto('/approvals');
    
    // Select items
    await page.locator('[data-testid^="approval-item-"] input[type="checkbox"]').first().click();
    
    // Click approve button
    await page.click('button:has-text("Approve")');
    
    // Add comment in dialog
    await page.fill('textarea[placeholder*="approval comments"]', 'Looks good to me');
    await page.click('button:has-text("Submit")');
    
    // Check success notification
    await expect(page.locator('text=/Successfully approved/')).toBeVisible();
    
    // Check item is removed from pending
    const pendingCount = await page.locator('text=/\\d+ pending/').textContent();
    expect(parseInt(pendingCount?.match(/\\d+/)?.[0] || '0')).toBe(0);
  });

  test('should reject items with required reason', async ({ page }) => {
    await createMockPreview(page);
    await page.goto('/approvals');
    
    // Select item
    await page.locator('[data-testid^="approval-item-"] input[type="checkbox"]').first().click();
    
    // Click reject button
    await page.click('button:has-text("Reject")');
    
    // Try to submit without reason - should fail
    await page.click('button:has-text("Submit")');
    await expect(page.locator('text=/This field is required/')).toBeVisible();
    
    // Add reason and submit
    await page.fill('textarea[placeholder*="rejection"]', 'Does not meet requirements');
    await page.click('button:has-text("Submit")');
    
    // Check success notification
    await expect(page.locator('text=/Successfully rejected/')).toBeVisible();
  });

  test('should modify item before approval', async ({ page }) => {
    await createMockPreview(page);
    await page.goto('/approvals');
    
    // Expand first item
    const firstItem = page.locator('[data-testid^="approval-item-"]').first();
    await firstItem.locator('button[aria-label*="expand"]').click();
    
    // Click edit button
    await firstItem.locator('button[aria-label*="edit"]').click();
    
    // Modify in editor
    await page.waitForSelector('[data-testid="change-editor"]');
    await page.fill('input[id="fieldName"]', 'UpdatedFieldName');
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Check success notification
    await expect(page.locator('text=/Successfully modified/')).toBeVisible();
  });

  test('should bulk approve by pattern', async ({ page }) => {
    await createMockPreview(page);
    await page.goto('/approvals');
    
    // Open bulk actions dropdown
    await page.click('button:has-text("Bulk Actions")');
    
    // Select bulk approve by type
    await page.click('text=/Approve all FIELD/');
    
    // Add comment in dialog
    await page.fill('textarea', 'Bulk approving all fields');
    await page.click('button:has-text("Submit")');
    
    // Check success notification
    await expect(page.locator('text=/Bulk approved/')).toBeVisible();
  });

  test('should show approval history', async ({ page }) => {
    await createMockPreview(page);
    await page.goto('/approvals');
    
    // Approve some items first
    await page.locator('[data-testid^="approval-item-"] input[type="checkbox"]').first().click();
    await page.click('button:has-text("Approve")');
    await page.click('button:has-text("Submit")');
    
    // Switch to history tab
    await page.click('button:has-text("Approval History")');
    
    // Check history is displayed
    await expect(page.locator('[data-testid="approval-history"]')).toBeVisible();
    await expect(page.locator('text=/Approved/')).toBeVisible();
  });

  test('should use keyboard shortcuts', async ({ page }) => {
    await createMockPreview(page);
    await page.goto('/approvals');
    
    // Select an item
    await page.locator('[data-testid^="approval-item-"] input[type="checkbox"]').first().click();
    
    // Press 'a' to approve
    await page.keyboard.press('a');
    await expect(page.locator('text=/Approve Changes/')).toBeVisible();
    await page.keyboard.press('Escape'); // Close dialog
    
    // Press 'r' to reject
    await page.keyboard.press('r');
    await expect(page.locator('text=/Reject Changes/')).toBeVisible();
    await page.keyboard.press('Escape'); // Close dialog
    
    // Press 'Escape' to clear selection
    await page.keyboard.press('Escape');
    await expect(page.locator('text=/0 selected/')).toBeVisible();
  });

  test('should filter items by impact', async ({ page }) => {
    await createMockPreview(page);
    await page.goto('/approvals');
    
    // Open impact filter
    await page.click('[data-testid="filter-impact"]');
    await page.click('text=/High/');
    
    // Check only high impact items are shown
    const items = page.locator('[data-testid^="approval-item-"]');
    const count = await items.count();
    
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i).locator('text=/HIGH/')).toBeVisible();
    }
  });

  test('should search for items', async ({ page }) => {
    await createMockPreview(page);
    await page.goto('/approvals');
    
    // Search for specific item
    await page.fill('input[placeholder*="Search"]', 'Test Field');
    
    // Check filtered results
    const items = page.locator('[data-testid^="approval-item-"]');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText('Test Field');
  });

  test('should handle real-time updates', async ({ page, context }) => {
    await createMockPreview(page);
    await page.goto('/approvals');
    
    // Open second browser tab as different user
    const page2 = await context.newPage();
    await loginAsConsultant(page2);
    await page2.goto('/approvals');
    
    // Approve item in second tab
    await page2.locator('[data-testid^="approval-item-"] input[type="checkbox"]').first().click();
    await page2.click('button:has-text("Approve")');
    await page2.click('button:has-text("Submit")');
    
    // Check first tab receives update
    await expect(page.locator('text=/item\\(s\\) approved/')).toBeVisible();
    
    // Check pending count updated
    const pendingCount = await page.locator('text=/\\d+ pending/').textContent();
    expect(parseInt(pendingCount?.match(/\\d+/)?.[0] || '0')).toBe(0);
  });

  test('should integrate with preview system', async ({ page }) => {
    await createMockPreview(page);
    await page.goto('/preview/test-preview-id');
    
    // Check preview with approval section exists
    await expect(page.locator('text=/Preview & Approval/')).toBeVisible();
    
    // Check approval progress bar
    await expect(page.locator('[data-testid="approval-progress"]')).toBeVisible();
    
    // Switch to approval tab
    await page.click('button:has-text("Approval Workflow")');
    
    // Check approval panel is displayed
    await expect(page.locator('[data-testid="approval-panel"]')).toBeVisible();
    
    // Navigate to full approval view
    await page.click('button:has-text("Full Approval View")');
    await page.waitForURL('/approvals');
  });

  test('should handle errors gracefully', async ({ page }) => {
    await page.goto('/approvals');
    
    // Simulate network error
    await page.route('**/api/trpc/approval.approveItems', route => {
      route.abort('failed');
    });
    
    // Try to approve
    await page.locator('[data-testid^="approval-item-"] input[type="checkbox"]').first().click();
    await page.click('button:has-text("Approve")');
    await page.click('button:has-text("Submit")');
    
    // Check error notification
    await expect(page.locator('text=/Failed to approve/')).toBeVisible();
    
    // Check optimistic update was reverted
    await expect(page.locator('text=/1 selected/')).toBeVisible();
  });

  test('should validate JSON in change editor', async ({ page }) => {
    await createMockPreview(page);
    await page.goto('/approvals');
    
    // Open editor
    const firstItem = page.locator('[data-testid^="approval-item-"]').first();
    await firstItem.locator('button[aria-label*="edit"]').click();
    
    // Switch to JSON editor
    await page.click('button:has-text("JSON Editor")');
    
    // Enter invalid JSON
    await page.fill('textarea[placeholder*="JSON"]', '{ invalid json }');
    
    // Check validation error
    await expect(page.locator('text=/Invalid JSON/')).toBeVisible();
    
    // Check save button is disabled
    await expect(page.locator('button:has-text("Save Changes")')).toBeDisabled();
  });

  test('should handle large approval queues with pagination', async ({ page }) => {
    // Create many preview items
    await page.goto('/test/create-bulk-previews?count=50');
    await page.goto('/approvals');
    
    // Check pagination controls exist
    await expect(page.locator('[data-testid="pagination"]')).toBeVisible();
    
    // Navigate to next page
    await page.click('button[aria-label="Next page"]');
    
    // Check URL updated
    await expect(page).toHaveURL(/page=2/);
    
    // Check different items are shown
    const firstItemText = await page.locator('[data-testid^="approval-item-"]').first().textContent();
    
    // Go back to first page
    await page.click('button[aria-label="Previous page"]');
    const newFirstItemText = await page.locator('[data-testid^="approval-item-"]').first().textContent();
    
    expect(firstItemText).not.toBe(newFirstItemText);
  });
});