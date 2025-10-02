import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchPreviewGenerator } from './batch-preview-generator';
import { PreviewGenerator } from './preview-generator';
import { ChangeDetector, ChangeType } from './change-detector';
import { LLMService } from './llm-service';
import { Ticket, TicketBatch, BatchStatus, TicketStatus } from '@agentris/db';
import { PreviewFormat } from '@agentris/shared';

// Mock dependencies
vi.mock('./preview-generator');
vi.mock('./change-detector');
vi.mock('./llm-service');

describe('BatchPreviewGenerator', () => {
  let generator: BatchPreviewGenerator;
  let mockPreviewGenerator: PreviewGenerator;
  let mockChangeDetector: ChangeDetector;
  let mockLLMService: LLMService;

  const createMockTicket = (id: string, summary: string, description: string): Ticket => ({
    id,
    jiraKey: `JIRA-${id}`,
    jiraId: `jira-id-${id}`,
    summary,
    description,
    status: TicketStatus.NEW,
    ambiguityScore: null,
    acceptanceCriteria: null,
    assignedToId: 'user-1',
    organizationId: 'org-1',
    userId: 'user-1',
    automationSuccess: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const createMockBatch = (): TicketBatch => ({
    id: 'batch-1',
    name: 'Test Batch',
    groupingCriteria: { changeType: 'FIELD', object: 'Account' },
    status: BatchStatus.PENDING,
    metadata: {},
    createdById: 'user-1',
    approvedById: null,
    processedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockPreviewGenerator = new PreviewGenerator();
    mockChangeDetector = new ChangeDetector();
    mockLLMService = new LLMService();
    
    // Default mock for generatePreview to prevent undefined errors
    vi.spyOn(mockPreviewGenerator, 'generatePreview').mockResolvedValue({
      format: PreviewFormat.TABLE,
      data: {
        headers: ['Field', 'Type'],
        rows: [['field', 'text']],
        caption: 'Field Preview'
      },
      availableFormats: [PreviewFormat.TABLE, PreviewFormat.TEXT]
    });
    
    generator = new BatchPreviewGenerator(
      mockPreviewGenerator,
      mockChangeDetector,
      mockLLMService
    );
  });

  describe('generateBatchPreview', () => {
    it('should generate a combined preview for a batch of tickets', async () => {
      const batch = createMockBatch();
      const tickets = [
        createMockTicket('1', 'Add phone field', 'Add phone field to Account'),
        createMockTicket('2', 'Add email field', 'Add email field to Account')
      ];

      // Mock change detection
      vi.spyOn(mockChangeDetector, 'detectChangeType').mockReturnValue({
        primaryType: ChangeType.FIELD,
        detectedTypes: [ChangeType.FIELD],
        confidence: 0.9,
        metadata: {
          keywords: ['field'],
          patterns: [],
          objectNames: ['Account'],
          fieldNames: ['phone', 'email']
        }
      });

      // Mock LLM for change extraction
      vi.spyOn(mockLLMService, 'analyzeText')
        .mockResolvedValueOnce('["Add phone field to Account object"]')
        .mockResolvedValueOnce('["Add email field to Account object"]')
        .mockResolvedValueOnce('[]'); // No conflicts

      // Mock individual previews
      vi.spyOn(mockPreviewGenerator, 'generatePreview').mockResolvedValue({
        format: PreviewFormat.TABLE,
        data: {
          headers: ['Field', 'Type'],
          rows: [['phone', 'text']],
          caption: 'Field Preview'
        },
        availableFormats: [PreviewFormat.TABLE, PreviewFormat.TEXT]
      });

      const result = await generator.generateBatchPreview(batch, tickets);

      expect(result.format).toBe(PreviewFormat.TABLE);
      expect(result.commonChanges).toHaveLength(0); // Different field names
      expect(result.executionOrder).toHaveLength(2);
      expect(result.ticketPreviews.size).toBe(2);
    });

    it('should detect common changes across tickets', async () => {
      const batch = createMockBatch();
      const tickets = [
        createMockTicket('1', 'Add required field', 'Add required field to Account'),
        createMockTicket('2', 'Add required field', 'Add required field to Account'),
        createMockTicket('3', 'Add optional field', 'Add optional field to Account')
      ];

      vi.spyOn(mockChangeDetector, 'detectChangeType').mockReturnValue({
        primaryType: ChangeType.FIELD,
        detectedTypes: [ChangeType.FIELD],
        confidence: 0.9,
        metadata: {
          keywords: ['field'],
          patterns: [],
          objectNames: ['Account']
        }
      });

      // Mock same change for tickets 1 and 2
      vi.spyOn(mockLLMService, 'analyzeText')
        .mockResolvedValueOnce('["add required field to account"]')
        .mockResolvedValueOnce('["add required field to account"]')
        .mockResolvedValueOnce('["add optional field to account"]')
        .mockResolvedValueOnce('[]'); // No conflicts

      const result = await generator.generateBatchPreview(batch, tickets);

      expect(result.commonChanges).toHaveLength(1);
      expect(result.commonChanges[0]).toContain('add required field to account');
      expect(result.commonChanges[0]).toContain('2 tickets');
    });

    it('should detect conflicts between tickets', async () => {
      const batch = createMockBatch();
      const tickets = [
        createMockTicket('1', 'Update status field', 'Change status field to required'),
        createMockTicket('2', 'Update status field', 'Change status field to optional')
      ];

      vi.spyOn(mockChangeDetector, 'detectChangeType').mockReturnValue({
        primaryType: ChangeType.FIELD,
        detectedTypes: [ChangeType.FIELD],
        confidence: 0.9,
        metadata: {
          keywords: ['field'],
          patterns: [],
          objectNames: ['Account'],
          fieldNames: ['status']
        }
      });

      // Mock conflicting changes
      vi.spyOn(mockLLMService, 'analyzeText')
        .mockResolvedValueOnce('["Make status field required"]')
        .mockResolvedValueOnce('["Make status field optional"]')
        .mockResolvedValueOnce('["Conflicting requirements for status field: one ticket makes it required, another makes it optional"]');

      const result = await generator.generateBatchPreview(batch, tickets, {
        showConflicts: true
      });

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts.some(c => c.toLowerCase().includes('status') || c.toLowerCase().includes('conflict'))).toBe(true);
    });

    it('should determine execution order based on change type priority', async () => {
      const batch = createMockBatch();
      const tickets = [
        createMockTicket('1', 'Create flow', 'Create approval flow'),
        createMockTicket('2', 'Add field', 'Add field to Account'),
        createMockTicket('3', 'Create object', 'Create custom object')
      ];

      // Mock different change types
      vi.spyOn(mockChangeDetector, 'detectChangeType')
        .mockReturnValueOnce({
          primaryType: ChangeType.FLOW,
          detectedTypes: [ChangeType.FLOW],
          confidence: 0.9,
          metadata: { keywords: [], patterns: [], objectNames: [] }
        })
        .mockReturnValueOnce({
          primaryType: ChangeType.FIELD,
          detectedTypes: [ChangeType.FIELD],
          confidence: 0.9,
          metadata: { keywords: [], patterns: [], objectNames: ['Account'] }
        })
        .mockReturnValueOnce({
          primaryType: ChangeType.CUSTOM_OBJECT,
          detectedTypes: [ChangeType.CUSTOM_OBJECT],
          confidence: 0.9,
          metadata: { keywords: [], patterns: [], objectNames: [] }
        });

      vi.spyOn(mockLLMService, 'analyzeText')
        .mockResolvedValueOnce('["Create approval flow"]')
        .mockResolvedValueOnce('["Add field to Account"]')
        .mockResolvedValueOnce('["Create custom object"]')
        .mockResolvedValueOnce('[]');

      const result = await generator.generateBatchPreview(batch, tickets, {
        showDependencies: true
      });

      // Should order: Custom Object (1) -> Field (2) -> Flow (5)
      expect(result.executionOrder).toEqual(['3', '2', '1']);
    });

    it('should generate text preview format', async () => {
      const batch = createMockBatch();
      const tickets = [
        createMockTicket('1', 'Add field', 'Add field to Account')
      ];

      vi.spyOn(mockChangeDetector, 'detectChangeType').mockReturnValue({
        primaryType: ChangeType.FIELD,
        detectedTypes: [ChangeType.FIELD],
        confidence: 0.9,
        metadata: { keywords: [], patterns: [], objectNames: ['Account'] }
      });

      vi.spyOn(mockLLMService, 'analyzeText')
        .mockResolvedValueOnce('["Add field to Account"]')
        .mockResolvedValueOnce('[]');

      const result = await generator.generateBatchPreview(batch, tickets, {
        format: PreviewFormat.TEXT,
        showIndividualChanges: false
      });

      expect(result.format).toBe(PreviewFormat.TEXT);
      expect(result.data).toHaveProperty('content');
      expect(result.data).toHaveProperty('mimeType', 'text/markdown');
      
      const textData = result.data as any;
      expect(textData.content).toContain('Batch Preview: Test Batch');
      expect(textData.content).toContain('JIRA-1');
    });

    it('should generate diagram preview format', async () => {
      const batch = createMockBatch();
      const tickets = [
        createMockTicket('1', 'Step 1', 'First change'),
        createMockTicket('2', 'Step 2', 'Second change')
      ];

      vi.spyOn(mockChangeDetector, 'detectChangeType').mockReturnValue({
        primaryType: ChangeType.FIELD,
        detectedTypes: [ChangeType.FIELD],
        confidence: 0.9,
        metadata: { keywords: [], patterns: [] }
      });

      vi.spyOn(mockLLMService, 'analyzeText')
        .mockResolvedValueOnce('["First change"]')
        .mockResolvedValueOnce('["Second change"]')
        .mockResolvedValueOnce('[]');

      const result = await generator.generateBatchPreview(batch, tickets, {
        format: PreviewFormat.DIAGRAM,
        showIndividualChanges: false
      });

      expect(result.format).toBe(PreviewFormat.DIAGRAM);
      
      const diagramData = result.data as any;
      expect(diagramData.type).toBe('flow');
      expect(diagramData.nodes).toHaveLength(2);
      expect(diagramData.edges).toHaveLength(1); // Connection between tickets
      expect(diagramData.edges[0].label).toBe('then');
    });

    it('should handle errors in change extraction gracefully', async () => {
      const batch = createMockBatch();
      const tickets = [
        createMockTicket('1', 'Invalid', 'Invalid ticket')
      ];

      vi.spyOn(mockChangeDetector, 'detectChangeType').mockReturnValue({
        primaryType: ChangeType.UNKNOWN,
        detectedTypes: [ChangeType.UNKNOWN],
        confidence: 0.3,
        metadata: { keywords: [], patterns: [] }
      });

      // Mock LLM failure
      vi.spyOn(mockLLMService, 'analyzeText')
        .mockRejectedValueOnce(new Error('LLM error'))
        .mockResolvedValueOnce('[]');

      const result = await generator.generateBatchPreview(batch, tickets, {
        showIndividualChanges: false // Explicitly disable individual previews
      });

      // Should have fallback change description
      expect(result.ticketPreviews.size).toBe(0); // No individual previews
      expect(result.conflicts).toHaveLength(0);
      expect(result.executionOrder).toHaveLength(1);
    });
  });
});