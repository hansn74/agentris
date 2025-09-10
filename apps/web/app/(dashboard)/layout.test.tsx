import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardLayout from './layout';

// Mock useAuth hook
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { name: 'Test User', email: 'test@example.com' },
    signOut: vi.fn(),
  }),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

describe('DashboardLayout', () => {
  it('renders navigation links', () => {
    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Tickets')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders user menu', () => {
    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>
    );

    // Check if user info is displayed
    const userButtons = screen.getAllByRole('button');
    const userButton = userButtons.find(
      (btn) =>
        btn.textContent?.includes('Test User') || btn.textContent?.includes('test@example.com')
    );
    expect(userButton).toBeDefined();
  });

  it('toggles mobile sidebar', async () => {
    render(
      <DashboardLayout>
        <div>Test Content</div>
      </DashboardLayout>
    );

    const user = userEvent.setup();

    // Find menu button (only visible on mobile)
    const menuButtons = screen.getAllByRole('button');
    const menuButton = menuButtons[0]; // First button should be menu toggle

    await user.click(menuButton);

    // Sidebar should now be visible
    expect(screen.getByText('Agentris')).toBeInTheDocument();
  });
});
