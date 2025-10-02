import { describe, it, expect, vi, beforeEach } from 'vitest';
import { automationRouter } from './automation';
import { createInnerTRPCContext } from '../trpc';
import type { Session } from 'next-auth';

// Mock dependencies
vi.mock('@agentris/services', () => ({
  AutomationOrchestrator: vi.fn().mockImplementation(() => ({
    orchestrateFieldCreation: vi.fn(),
    getAutomationStatus: vi.fn(),
  })),
}));

describe('automationRouter', () => {
  let ctx: any;
  let mockSession: Session;

  beforeEach(() => {
    mockSession = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      },
      expires: new Date(Date.now() + 3600000).toISOString(),
    };

    ctx = {
      session: mockSession,
      prisma: {
        ticket: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        organization: {
          findFirst: vi.fn(),
        },
        automationRun: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
        },
        automationStep: {
          findFirst: vi.fn(),
          create: vi.fn(),
        },
      },
      salesforceMetadataService: {},
      salesforceDeploymentTracker: {},
    };
  });

  describe('parseTicketRequirements', () => {
    it('should parse ticket requirements successfully', async () => {
      const mockTicket = {
        id: 'ticket-123',
        description: 'Create a status field',
        acceptanceCriteria: 'Field should be required',
        ambiguityScore: 0,
      };

      ctx.prisma.ticket.findUnique.mockResolvedValue(mockTicket);
      ctx.prisma.ticket.update.mockResolvedValue({
        ...mockTicket,
        ambiguityScore: 20,
      });

      const caller = automationRouter.createCaller(ctx);

      // Mock the parser response
      const mockParsedRequirements = {
        fields: [{
          fieldName: 'Status',
          fieldLabel: 'Status',
          fieldType: 'Picklist',
          description: 'Status field',
          required: true,
          picklistValues: ['New', 'In Progress', 'Done'],
        }],
        validationRules: [],
        summary: 'Create status field',
        ambiguities: ['Default value not specified'],
      };

      // We need to mock the orchestrator's parser
      const AutomationOrchestrator = (await import('@agentris/services')).AutomationOrchestrator;
      (AutomationOrchestrator as any).mockImplementation(() => ({
        requirementsParser: {
          parseTicketDescription: vi.fn().mockResolvedValue(mockParsedRequirements),
          parseAcceptanceCriteria: vi.fn().mockResolvedValue({}),
        },
      }));

      const result = await caller.parseTicketRequirements({
        ticketId: 'ticket-123',
        includeContext: true,
      });

      expect(result).toMatchObject(mockParsedRequirements);
      expect(ctx.prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: { ambiguityScore: 20 },
      });
    });

    it('should throw error when ticket not found', async () => {
      ctx.prisma.ticket.findUnique.mockResolvedValue(null);

      const caller = automationRouter.createCaller(ctx);

      await expect(
        caller.parseTicketRequirements({
          ticketId: 'nonexistent',
        })
      ).rejects.toThrow('Ticket nonexistent not found');
    });
  });

  describe('deployAutomation', () => {
    it('should deploy automation successfully', async () => {
      const mockOrg = {
        id: 'org-123',
        userId: 'user-123',
        orgType: 'SANDBOX',
      };

      ctx.prisma.organization.findFirst.mockResolvedValue(mockOrg);
      ctx.prisma.ticket.update.mockResolvedValue({
        id: 'ticket-123',
        status: 'AUTOMATED',
      });

      const mockResult = {
        runId: 'run-123',
        status: 'SUCCESS',
        metadata: { fields: [], validationRules: [] },
        deploymentId: 'deploy-123',
        errors: [],
        warnings: [],
      };

      const AutomationOrchestrator = (await import('@agentris/services')).AutomationOrchestrator;
      (AutomationOrchestrator as any).mockImplementation(() => ({
        orchestrateFieldCreation: vi.fn().mockResolvedValue(mockResult),
      }));

      const caller = automationRouter.createCaller(ctx);

      const result = await caller.deployAutomation({
        ticketId: 'ticket-123',
        targetOrgId: 'org-123',
        deployToProduction: false,
        dryRun: false,
      });

      expect(result).toMatchObject(mockResult);
      expect(ctx.prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: {
          status: 'AUTOMATED',
          automationSuccess: true,
        },
      });
    });

    it('should throw error when org not found', async () => {
      ctx.prisma.organization.findFirst.mockResolvedValue(null);

      const caller = automationRouter.createCaller(ctx);

      await expect(
        caller.deployAutomation({
          ticketId: 'ticket-123',
          targetOrgId: 'org-123',
        })
      ).rejects.toThrow('Organization not found or access denied');
    });

    it('should update ticket status on failure', async () => {
      const mockOrg = {
        id: 'org-123',
        userId: 'user-123',
        orgType: 'SANDBOX',
      };

      ctx.prisma.organization.findFirst.mockResolvedValue(mockOrg);
      ctx.prisma.ticket.update.mockResolvedValue({
        id: 'ticket-123',
        status: 'FAILED',
      });

      const mockResult = {
        runId: 'run-123',
        status: 'FAILED',
        errors: ['Deployment failed'],
        warnings: [],
      };

      const AutomationOrchestrator = (await import('@agentris/services')).AutomationOrchestrator;
      (AutomationOrchestrator as any).mockImplementation(() => ({
        orchestrateFieldCreation: vi.fn().mockResolvedValue(mockResult),
      }));

      const caller = automationRouter.createCaller(ctx);

      const result = await caller.deployAutomation({
        ticketId: 'ticket-123',
        targetOrgId: 'org-123',
      });

      expect(result.status).toBe('FAILED');
      expect(ctx.prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-123' },
        data: {
          status: 'FAILED',
          automationSuccess: false,
        },
      });
    });
  });

  describe('getAutomationStatus', () => {
    it('should return automation status', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'SUCCESS',
        metadata: { fields: [] },
        error: null,
        startedAt: new Date(),
        completedAt: new Date(),
        ticket: { userId: 'user-123' },
        steps: [
          {
            stepType: 'PARSE',
            status: 'COMPLETED',
            startedAt: new Date(),
            completedAt: new Date(),
            error: null,
          },
        ],
      };

      ctx.prisma.automationRun.findFirst.mockResolvedValue(mockRun);

      const caller = automationRouter.createCaller(ctx);

      const result = await caller.getAutomationStatus({
        runId: 'run-123',
      });

      expect(result.id).toBe('run-123');
      expect(result.status).toBe('SUCCESS');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].type).toBe('PARSE');
    });

    it('should throw error when run not found', async () => {
      ctx.prisma.automationRun.findFirst.mockResolvedValue(null);

      const caller = automationRouter.createCaller(ctx);

      await expect(
        caller.getAutomationStatus({
          runId: 'nonexistent',
        })
      ).rejects.toThrow('Automation run not found or access denied');
    });
  });

  describe('listAutomationRuns', () => {
    it('should list automation runs', async () => {
      const mockRuns = [
        {
          id: 'run-1',
          status: 'SUCCESS',
          ticketId: 'ticket-1',
          ticket: {
            id: 'ticket-1',
            jiraKey: 'JIRA-1',
            summary: 'Test ticket 1',
          },
          startedAt: new Date(),
          completedAt: new Date(),
          error: null,
        },
        {
          id: 'run-2',
          status: 'FAILED',
          ticketId: 'ticket-2',
          ticket: {
            id: 'ticket-2',
            jiraKey: 'JIRA-2',
            summary: 'Test ticket 2',
          },
          startedAt: new Date(),
          completedAt: new Date(),
          error: 'Test error',
        },
      ];

      ctx.prisma.automationRun.findMany.mockResolvedValue(mockRuns);
      ctx.prisma.automationRun.count.mockResolvedValue(2);

      const caller = automationRouter.createCaller(ctx);

      const result = await caller.listAutomationRuns({
        limit: 10,
        offset: 0,
      });

      expect(result.runs).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by status', async () => {
      ctx.prisma.automationRun.findMany.mockResolvedValue([]);
      ctx.prisma.automationRun.count.mockResolvedValue(0);

      const caller = automationRouter.createCaller(ctx);

      await caller.listAutomationRuns({
        status: 'SUCCESS',
        limit: 10,
        offset: 0,
      });

      expect(ctx.prisma.automationRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'SUCCESS',
          }),
        })
      );
    });
  });

  describe('cancelAutomation', () => {
    it('should cancel running automation', async () => {
      const mockRun = {
        id: 'run-123',
        status: 'RUNNING',
        ticket: { userId: 'user-123' },
      };

      ctx.prisma.automationRun.findFirst.mockResolvedValue(mockRun);
      ctx.prisma.automationRun.update.mockResolvedValue({
        ...mockRun,
        status: 'FAILED',
        error: 'Cancelled by user',
      });
      ctx.prisma.automationStep.create.mockResolvedValue({
        id: 'step-cancel',
        runId: 'run-123',
        stepType: 'CANCELLED',
        status: 'COMPLETED',
      });

      const caller = automationRouter.createCaller(ctx);

      const result = await caller.cancelAutomation({
        runId: 'run-123',
      });

      expect(result.success).toBe(true);
      expect(ctx.prisma.automationRun.update).toHaveBeenCalledWith({
        where: { id: 'run-123' },
        data: {
          status: 'FAILED',
          error: 'Cancelled by user',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should throw error when run not running', async () => {
      ctx.prisma.automationRun.findFirst.mockResolvedValue(null);

      const caller = automationRouter.createCaller(ctx);

      await expect(
        caller.cancelAutomation({
          runId: 'run-123',
        })
      ).rejects.toThrow('Active automation run not found or access denied');
    });
  });
});