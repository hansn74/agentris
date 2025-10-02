import { test, expect } from '@playwright/test';
import { setupAuth } from './helpers/auth';
import { createMockApproval, createMockDeployment } from './helpers/mocks';

test.describe('Deployment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup authentication
    await setupAuth(page);
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should deploy approved changes', async ({ page }) => {
    // Create a mock approval with approved items
    const approval = await createMockApproval({
      status: 'APPROVED',
      itemCount: 3,
    });

    // Navigate to approvals page
    await page.goto('/dashboard/approvals');
    
    // Click on the approval
    await page.click(`[data-testid="approval-${approval.id}"]`);
    
    // Verify approved items are shown
    await expect(page.locator('[data-testid="approved-tab"]')).toBeVisible();
    await page.click('[data-testid="approved-tab"]');
    await expect(page.locator('[data-testid="approved-item"]')).toHaveCount(3);
    
    // Click deploy button
    await page.click('[data-testid="deploy-button"]');
    await expect(page.locator('[data-testid="deployment-panel"]')).toBeVisible();
    
    // Select target organization
    await page.click('[data-testid="org-select"]');
    await page.click('[data-testid="org-option-sandbox"]');
    
    // Configure deployment options
    await page.check('[data-testid="rollback-on-error"]');
    
    // Start deployment
    await page.click('[data-testid="deploy-submit"]');
    
    // Should redirect to deployment status page
    await page.waitForURL(/\/dashboard\/deployments\/.+/);
    
    // Verify deployment status is shown
    await expect(page.locator('[data-testid="deployment-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('IN_PROGRESS');
  });

  test('should show real-time deployment progress', async ({ page }) => {
    const deployment = await createMockDeployment({
      status: 'IN_PROGRESS',
    });

    // Navigate to deployment detail page
    await page.goto(`/dashboard/deployments/${deployment.deploymentId}`);
    
    // Verify initial status
    await expect(page.locator('[data-testid="deployment-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('IN_PROGRESS');
    
    // Wait for progress update
    await page.waitForSelector('[data-testid="progress-bar"]');
    const progressBar = page.locator('[data-testid="progress-bar"]');
    
    // Verify progress updates
    await expect(progressBar).toHaveAttribute('aria-valuenow', '25');
    await page.waitForTimeout(2000);
    await expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    await page.waitForTimeout(2000);
    await expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    
    // Verify final status
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('SUCCEEDED');
  });

  test('should display deployment logs', async ({ page }) => {
    const deployment = await createMockDeployment({
      status: 'IN_PROGRESS',
      withLogs: true,
    });

    // Navigate to deployment detail page
    await page.goto(`/dashboard/deployments/${deployment.deploymentId}`);
    
    // Click on logs tab
    await page.click('[data-testid="logs-tab"]');
    await expect(page.locator('[data-testid="deployment-logs"]')).toBeVisible();
    
    // Verify logs are displayed
    await expect(page.locator('[data-testid="log-entry"]')).toHaveCount(5);
    
    // Filter logs by level
    await page.selectOption('[data-testid="log-level-filter"]', 'ERROR');
    await expect(page.locator('[data-testid="log-entry"]')).toHaveCount(1);
    
    // Search logs
    await page.fill('[data-testid="log-search"]', 'Component deployed');
    await expect(page.locator('[data-testid="log-entry"]')).toHaveCount(2);
    
    // Export logs
    await page.click('[data-testid="export-logs"]');
    // Verify download started (implementation depends on how downloads are handled)
  });

  test('should handle deployment failure and allow rollback', async ({ page }) => {
    const deployment = await createMockDeployment({
      status: 'FAILED',
      error: 'Connection timeout',
    });

    // Navigate to deployment detail page
    await page.goto(`/dashboard/deployments/${deployment.deploymentId}`);
    
    // Verify failed status
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('FAILED');
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Connection timeout');
    
    // Click rollback button
    await page.click('[data-testid="rollback-button"]');
    await expect(page.locator('[data-testid="rollback-dialog"]')).toBeVisible();
    
    // Fill rollback reason
    await page.fill('[data-testid="rollback-reason"]', 'Deployment failed due to connection issues');
    
    // Confirm rollback
    await page.click('[data-testid="confirm-rollback"]');
    
    // Verify rollback initiated
    await expect(page.locator('[data-testid="rollback-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="rollback-status"]')).toContainText('IN_PROGRESS');
  });

  test('should show deployment history', async ({ page }) => {
    // Create multiple mock deployments
    await createMockDeployment({ status: 'SUCCEEDED' });
    await createMockDeployment({ status: 'FAILED' });
    await createMockDeployment({ status: 'IN_PROGRESS' });

    // Navigate to deployments page
    await page.goto('/dashboard/deployments');
    
    // Verify active deployments section
    await expect(page.locator('[data-testid="active-deployments"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-deployment-card"]')).toHaveCount(1);
    
    // Verify deployment history
    await expect(page.locator('[data-testid="deployment-history"]')).toBeVisible();
    await expect(page.locator('[data-testid="deployment-item"]')).toHaveCount(3);
    
    // Filter by status
    await page.click('[data-testid="filter-succeeded"]');
    await expect(page.locator('[data-testid="deployment-item"]')).toHaveCount(1);
    
    await page.click('[data-testid="filter-failed"]');
    await expect(page.locator('[data-testid="deployment-item"]')).toHaveCount(1);
    
    // Search deployments
    await page.fill('[data-testid="search-deployments"]', 'deploy_');
    await expect(page.locator('[data-testid="deployment-item"]')).toHaveCount(3);
  });

  test('should validate deployment options', async ({ page }) => {
    const approval = await createMockApproval({
      status: 'APPROVED',
      itemCount: 2,
    });

    // Navigate to approval and open deployment panel
    await page.goto(`/dashboard/approvals/${approval.id}`);
    await page.click('[data-testid="deploy-button"]');
    
    // Try to deploy without selecting org
    await page.click('[data-testid="deploy-submit"]');
    await expect(page.locator('[data-testid="error-toast"]')).toContainText('Please select a target organization');
    
    // Select production org
    await page.click('[data-testid="org-select"]');
    await page.click('[data-testid="org-option-production"]');
    
    // Verify production warning
    await expect(page.locator('[data-testid="production-warning"]')).toBeVisible();
    
    // Enable check-only mode
    await page.check('[data-testid="check-only"]');
    await expect(page.locator('[data-testid="validation-info"]')).toBeVisible();
    
    // Verify button text changes
    await expect(page.locator('[data-testid="deploy-submit"]')).toContainText('Validate Changes');
  });

  test('should handle rollback history', async ({ page }) => {
    const deployment = await createMockDeployment({
      status: 'SUCCEEDED',
      withRollbacks: true,
    });

    // Navigate to deployment detail page
    await page.goto(`/dashboard/deployments/${deployment.deploymentId}`);
    
    // Click on rollback history tab
    await page.click('[data-testid="rollbacks-tab"]');
    await expect(page.locator('[data-testid="rollback-history"]')).toBeVisible();
    
    // Verify rollback entries
    await expect(page.locator('[data-testid="rollback-entry"]')).toHaveCount(2);
    
    // Verify rollback details
    const firstRollback = page.locator('[data-testid="rollback-entry"]').first();
    await expect(firstRollback).toContainText('COMPLETED');
    await expect(firstRollback).toContainText('Manual rollback requested');
  });

  test('should receive deployment notifications', async ({ page }) => {
    const deployment = await createMockDeployment({
      status: 'IN_PROGRESS',
    });

    // Navigate to deployment page
    await page.goto(`/dashboard/deployments/${deployment.deploymentId}`);
    
    // Wait for deployment to complete
    await page.waitForTimeout(5000);
    
    // Verify success notification
    await expect(page.locator('[data-testid="notification-toast"]')).toBeVisible();
    await expect(page.locator('[data-testid="notification-toast"]')).toContainText('Deployment Successful');
    
    // Click notification action
    await page.click('[data-testid="notification-action"]');
    await expect(page).toHaveURL(`/dashboard/deployments/${deployment.deploymentId}`);
  });
});

test.describe('Deployment Permissions', () => {
  test('should restrict deployment to org owner', async ({ page }) => {
    // Login as different user
    await setupAuth(page, { userId: 'other-user' });
    
    const approval = await createMockApproval({
      status: 'APPROVED',
      userId: 'original-user',
    });

    // Try to access deployment
    await page.goto(`/dashboard/approvals/${approval.id}`);
    
    // Deploy button should not be visible
    await expect(page.locator('[data-testid="deploy-button"]')).not.toBeVisible();
  });

  test('should validate production deployment permissions', async ({ page }) => {
    await setupAuth(page, { role: 'CONSULTANT' });
    
    const approval = await createMockApproval({
      status: 'APPROVED',
    });

    // Navigate to approval
    await page.goto(`/dashboard/approvals/${approval.id}`);
    await page.click('[data-testid="deploy-button"]');
    
    // Select production org
    await page.click('[data-testid="org-select"]');
    
    // Production option should be disabled for consultants
    await expect(page.locator('[data-testid="org-option-production"]')).toBeDisabled();
  });
});