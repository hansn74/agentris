import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntegrationsPage from './page';

// Mock tRPC
vi.mock('@/lib/trpc', () => ({
  trpc: {
    jira: {
      connect: {
        useMutation: () => ({
          mutate: vi.fn(),
          isLoading: false,
        }),
      },
      disconnect: {
        useMutation: () => ({
          mutate: vi.fn(),
          isLoading: false,
        }),
      },
    },
  },
}));

describe('IntegrationsPage', () => {
  it('renders Jira integration section', () => {
    render(<IntegrationsPage />);

    expect(screen.getByText('Jira Integration')).toBeInTheDocument();
    expect(screen.getByText(/Connect your Jira account/)).toBeInTheDocument();
  });

  it('shows connection form when not connected', () => {
    render(<IntegrationsPage />);

    expect(screen.getByLabelText('Jira Instance URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect Jira/i })).toBeInTheDocument();
  });

  it('validates URL input', async () => {
    render(<IntegrationsPage />);
    const user = userEvent.setup();

    const urlInput = screen.getByLabelText('Jira Instance URL');
    const connectButton = screen.getByRole('button', { name: /Connect Jira/i });

    // Try with invalid URL
    await user.type(urlInput, 'not-a-url');
    await user.click(connectButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid URL')).toBeInTheDocument();
    });
  });

  it('shows connected state after successful connection', async () => {
    render(<IntegrationsPage />);
    const user = userEvent.setup();

    const urlInput = screen.getByLabelText('Jira Instance URL');
    const connectButton = screen.getByRole('button', { name: /Connect Jira/i });

    await user.type(urlInput, 'https://test.atlassian.net');
    await user.click(connectButton);

    // Wait for mock connection
    await waitFor(
      () => {
        expect(screen.getByText('Connected')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText('Connected Instance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument();
  });

  it('shows other integrations as coming soon', () => {
    render(<IntegrationsPage />);

    expect(screen.getByText('GitHub Integration')).toBeInTheDocument();
    expect(screen.getByText('Slack Integration')).toBeInTheDocument();

    const comingSoonButtons = screen.getAllByRole('button', { name: /Coming Soon/i });
    expect(comingSoonButtons).toHaveLength(2);
    comingSoonButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });
});
