import { describe, it, expect, beforeEach, vi } from 'vitest';
import { changePreviewRouter } from './change-preview';
import type { Session } from 'next-auth';

// Mock the shared module
vi.mock('@agentris/shared', () => ({
  sanitizeMetadata: vi.fn((data) => data),
  GeneratedMetadataSchema: {
    parse: vi.fn((data) => data)
  }
}));

// Mock the services
vi.mock('@agentris/services', () => ({
  ChangePreviewService: vi.fn().mockImplementation(() => ({
    generateFieldDescription: vi.fn().mockReturnValue('Field description'),
    generateValidationRuleDescription: vi.fn().mockReturnValue('Rule description'),
    formatFieldProperties: vi.fn().mockReturnValue({ name: 'field', label: 'Field', type: 'Text', attributes: {} }),
    getChangesSummary: vi.fn().mockReturnValue({
      totalChanges: 1,
      fields: { new: 1, modified: 0, deleted: 0 },
      validationRules: { new: 0, modified: 0, deleted: 0 },
      impacts: { high: 0, medium: 0, low: 1 }
    })
  })),
  ImpactAnalyzerService: vi.fn().mockImplementation(() => ({
    analyzeFieldImpacts: vi.fn().mockReturnValue([]),
    checkValidationRuleConflicts: vi.fn().mockReturnValue([]),
    getRiskScore: vi.fn().mockReturnValue({
      score: 10,
      level: 'low',
      factors: [],
      recommendations: []
    })
  })),
  MetadataComparatorService: vi.fn().mockImplementation(() => ({
    generateDiff: vi.fn().mockReturnValue({
      summary: {
        totalChanges: 1,
        fieldsAdded: 1,
        fieldsModified: 0,
        fieldsRemoved: 0,
        rulesAdded: 0,
        rulesModified: 0,
        rulesRemoved: 0
      },
      fields: [],
      validationRules: [],
      changePercentage: 100
    })
  }))
}));

describe('changePreviewRouter', () => {
  let ctx: any;
  let caller: ReturnType<typeof changePreviewRouter.createCaller>;
  let mockSession: Session;

  beforeEach(() => {
    mockSession = {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'CONSULTANT'
      },
      expires: new Date(Date.now() + 3600000).toISOString()
    };

    // Create manual mock context matching the pattern from automation.test.ts
    ctx = {
      session: mockSession,
      db: {
        ticket: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'ticket-123',
            jiraKey: 'TEST-123',
            summary: 'Test Ticket',
            automationRuns: [{
              id: 'run-123',
              metadata: {
                fields: [{
                  name: 'test_field__c',
                  label: 'Test Field',
                  type: 'Text'
                }],
                validationRules: [],
                objectName: 'CustomObject__c'
              }
            }]
          })
        },
        preview: {
          create: vi.fn().mockResolvedValue({
            id: 'preview-123',
            ticketId: 'ticket-123',
            runId: 'run-123',
            status: 'READY',
            metadata: {},
            generatedAt: new Date(),
            expiresAt: new Date(Date.now() + 3600000)
          }),
          findUnique: vi.fn().mockResolvedValue({
            id: 'preview-123',
            ticketId: 'ticket-123',
            runId: 'run-123',
            status: 'READY',
            metadata: {
              diffData: {},
              fieldDescriptions: [{
                name: 'test_field__c',
                description: 'Field description',
                properties: {}
              }],
              ruleDescriptions: [],
              fieldImpacts: [],
              ruleConflicts: [],
              riskAssessment: {
                score: 10,
                level: 'low',
                factors: [],
                recommendations: []
              }
            },
            generatedAt: new Date(),
            expiresAt: new Date(Date.now() + 3600000)
          }),
          findMany: vi.fn().mockResolvedValue([]),
          delete: vi.fn().mockResolvedValue({ id: 'preview-123' })
        }
      }
    };
    
    caller = changePreviewRouter.createCaller(ctx);
  });

  describe('generatePreview', () => {
    it('should generate a preview for a ticket', async () => {
      const result = await caller.generatePreview({
        ticketId: 'ticket-123'
      });
      
      expect(result).toHaveProperty('id');
      expect(result.status).toBe('ready');
      expect(result.riskLevel).toBe('low');
      expect(result.summary).toHaveProperty('totalChanges');
    });

    it('should throw error if ticket not found', async () => {
      ctx.db.ticket.findUnique = vi.fn().mockResolvedValue(null);
      
      await expect(caller.generatePreview({
        ticketId: 'non-existent'
      })).rejects.toThrow('Ticket not found');
    });

    it('should throw error if no automation run found', async () => {
      ctx.db.ticket.findUnique = vi.fn().mockResolvedValue({
        id: 'ticket-123',
        automationRuns: []
      });
      
      await expect(caller.generatePreview({
        ticketId: 'ticket-123'
      })).rejects.toThrow('No automation run found for this ticket');
    });
  });

  describe('getFieldPreview', () => {
    it('should return field preview details', async () => {
      const result = await caller.getFieldPreview({
        previewId: 'preview-123',
        fieldName: 'test_field__c'
      });
      
      expect(result).toHaveProperty('name', 'test_field__c');
      expect(result).toHaveProperty('description');
    });

    it('should throw error if preview not found', async () => {
      ctx.db.preview.findUnique = vi.fn().mockResolvedValue(null);
      
      await expect(caller.getFieldPreview({
        previewId: 'non-existent',
        fieldName: 'field'
      })).rejects.toThrow('Preview not found or expired');
    });

    it('should throw error if field not found in preview', async () => {
      await expect(caller.getFieldPreview({
        previewId: 'preview-123',
        fieldName: 'non_existent_field__c'
      })).rejects.toThrow('Field not found in preview');
    });
  });

  describe('getImpactAnalysis', () => {
    it('should return impact analysis for preview', async () => {
      const result = await caller.getImpactAnalysis({
        previewId: 'preview-123'
      });
      
      expect(result).toHaveProperty('fieldImpacts');
      expect(result).toHaveProperty('ruleConflicts');
      expect(result).toHaveProperty('riskAssessment');
      expect(result.riskAssessment.level).toBe('low');
    });

    it('should throw error if preview not found', async () => {
      ctx.db.preview.findUnique = vi.fn().mockResolvedValue(null);
      
      await expect(caller.getImpactAnalysis({
        previewId: 'non-existent'
      })).rejects.toThrow('Preview not found or expired');
    });
  });

  describe('getComparison', () => {
    it('should return diff data for preview', async () => {
      const result = await caller.getComparison({
        previewId: 'preview-123'
      });
      
      expect(result).toBeDefined();
    });

    it('should throw error if preview not found', async () => {
      ctx.db.preview.findUnique = vi.fn().mockResolvedValue(null);
      
      await expect(caller.getComparison({
        previewId: 'non-existent'
      })).rejects.toThrow('Preview not found or expired');
    });
  });

  describe('listPreviews', () => {
    it('should list previews', async () => {
      ctx.db.preview.findMany = vi.fn().mockResolvedValue([
        {
          id: 'preview-1',
          ticketId: 'ticket-123',
          runId: 'run-123',
          status: 'READY',
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000)
        }
      ]);
      
      const result = await caller.listPreviews({});
      
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 'preview-1');
    });

    it('should filter by ticketId', async () => {
      await caller.listPreviews({ ticketId: 'ticket-123' });
      
      expect(ctx.db.preview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ticketId: 'ticket-123'
          })
        })
      );
    });
  });

  describe('deletePreview', () => {
    it('should delete a preview', async () => {
      const result = await caller.deletePreview({
        previewId: 'preview-123'
      });
      
      expect(result.success).toBe(true);
      expect(ctx.db.preview.delete).toHaveBeenCalledWith({
        where: { id: 'preview-123' }
      });
    });
  });
});