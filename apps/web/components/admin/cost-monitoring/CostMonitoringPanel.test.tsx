import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CostMonitoringPanel from './CostMonitoringPanel';

// Mock the tRPC hooks
vi.mock('@/trpc/client', () => ({
  trpc: {
    llm: {
      getUsageStats: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock date-fns to ensure consistent test results
vi.mock('date-fns', () => ({
  format: vi.fn((date, format) => '2024-01-01'),
  subDays: vi.fn((date, days) => new Date('2024-01-01')),
  subWeeks: vi.fn((date, weeks) => new Date('2024-01-01')),
  subMonths: vi.fn((date, months) => new Date('2024-01-01')),
}));

// Mock recharts components
vi.mock('recharts', () => ({
  LineChart: vi.fn(() => null),
  Line: vi.fn(() => null),
  BarChart: vi.fn(() => null),
  Bar: vi.fn(() => null),
  AreaChart: vi.fn(() => null),
  Area: vi.fn(() => null),
  XAxis: vi.fn(() => null),
  YAxis: vi.fn(() => null),
  CartesianGrid: vi.fn(() => null),
  Tooltip: vi.fn(() => null),
  Legend: vi.fn(() => null),
  ResponsiveContainer: vi.fn(({ children }: any) => <div>{children}</div>),
}));

const mockUsageData = {
  aggregated: {
    totalTokens: 1500000,
    totalCost: 45.75,
    totalRequests: 150,
    totalCacheHits: 45,
  },
  userUsage: [
    {
      date: '2024-01-01',
      tokens: 500000,
      cost: 15.25,
      requests: 50,
      cacheHits: 15,
      provider: 'ANTHROPIC',
    },
    {
      date: '2024-01-02',
      tokens: 600000,
      cost: 18.50,
      requests: 60,
      cacheHits: 20,
      provider: 'ANTHROPIC',
    },
    {
      date: '2024-01-03',
      tokens: 400000,
      cost: 12.00,
      requests: 40,
      cacheHits: 10,
      provider: 'ANTHROPIC',
    },
  ],
  cacheStats: {
    totalEntries: 100,
    totalHits: 45,
    avgHitRate: 0.45,
  },
  period: {
    start: '2024-01-01T00:00:00.000Z',
    end: '2024-01-03T23:59:59.999Z',
  },
};

describe('CostMonitoringPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state correctly', () => {
    const { trpc } = require('@/trpc/client');
    trpc.llm.getUsageStats.useQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    render(<CostMonitoringPanel />);
    
    // Should show skeleton loaders
    const skeletons = document.querySelectorAll('[class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders error state correctly', () => {
    const { trpc } = require('@/trpc/client');
    trpc.llm.getUsageStats.useQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Failed to fetch usage data' },
    });

    render(<CostMonitoringPanel />);
    
    expect(screen.getByText('Error loading usage data')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch usage data')).toBeInTheDocument();
  });

  it('renders usage statistics correctly', () => {
    const { trpc } = require('@/trpc/client');
    trpc.llm.getUsageStats.useQuery.mockReturnValue({
      data: mockUsageData,
      isLoading: false,
      error: null,
    });

    render(<CostMonitoringPanel />);
    
    // Check header
    expect(screen.getByText('LLM Cost Monitoring')).toBeInTheDocument();
    
    // Check key metrics
    expect(screen.getByText('$45.75')).toBeInTheDocument(); // Total cost
    expect(screen.getByText('1,500,000')).toBeInTheDocument(); // Total tokens
    expect(screen.getByText('30.0%')).toBeInTheDocument(); // Cache hit rate
    expect(screen.getByText('$0.3050')).toBeInTheDocument(); // Avg cost per request
  });

  it('changes time range when selector is used', async () => {
    const { trpc } = require('@/trpc/client');
    const mockUseQuery = vi.fn().mockReturnValue({
      data: mockUsageData,
      isLoading: false,
      error: null,
    });
    trpc.llm.getUsageStats.useQuery = mockUseQuery;

    render(<CostMonitoringPanel />);
    
    // Find and click the time range selector
    const selector = screen.getByRole('combobox');
    fireEvent.click(selector);
    
    // Select "Last Month"
    const monthOption = await screen.findByText('Last Month');
    fireEvent.click(monthOption);
    
    // Verify the query was called with updated date range
    await waitFor(() => {
      expect(mockUseQuery).toHaveBeenCalled();
      const lastCall = mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1][0];
      expect(lastCall).toHaveProperty('startDate');
      expect(lastCall).toHaveProperty('endDate');
    });
  });

  it('displays provider breakdown correctly', () => {
    const { trpc } = require('@/trpc/client');
    trpc.llm.getUsageStats.useQuery.mockReturnValue({
      data: mockUsageData,
      isLoading: false,
      error: null,
    });

    render(<CostMonitoringPanel />);
    
    // Click on Provider Breakdown tab
    const providerTab = screen.getByText('Provider Breakdown');
    fireEvent.click(providerTab);
    
    // Check provider information is displayed
    expect(screen.getByText('ANTHROPIC')).toBeInTheDocument();
    expect(screen.getByText(/150 requests/)).toBeInTheDocument();
  });

  it('displays cache statistics correctly', () => {
    const { trpc } = require('@/trpc/client');
    trpc.llm.getUsageStats.useQuery.mockReturnValue({
      data: mockUsageData,
      isLoading: false,
      error: null,
    });

    render(<CostMonitoringPanel />);
    
    // Check cache performance section
    expect(screen.getByText('Cache Performance')).toBeInTheDocument();
    expect(screen.getByText('Total Entries')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument(); // Total entries
    expect(screen.getByText('45')).toBeInTheDocument(); // Total hits
    expect(screen.getByText('0.5')).toBeInTheDocument(); // Avg hit rate
  });

  it('switches between tabs correctly', async () => {
    const { trpc } = require('@/trpc/client');
    trpc.llm.getUsageStats.useQuery.mockReturnValue({
      data: mockUsageData,
      isLoading: false,
      error: null,
    });

    render(<CostMonitoringPanel />);
    
    // Switch to Cost Alerts tab
    const alertsTab = screen.getByText('Cost Alerts');
    fireEvent.click(alertsTab);
    
    // Verify alerts content is shown
    await waitFor(() => {
      expect(screen.getByText(/Budget Status/)).toBeInTheDocument();
    });
  });
});