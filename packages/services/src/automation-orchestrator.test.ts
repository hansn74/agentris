import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutomationOrchestrator } from './automation-orchestrator';
import type { AutomationConfig, FieldCreationOptions } from './automation-orchestrator';

// Mock the dependencies
vi.mock('@agentris/ai-engine', () => ({
  RequirementsParser: vi.fn().mockImplementation(() => ({
    parseTicketDescription: vi.fn(),
    parseAcceptanceCriteria: vi.fn(),
  })),
  MetadataGenerator: vi.fn().mockImplementation(() => ({
    generateCustomField: vi.fn(),
    generateValidationRule: vi.fn(),
    validateMetadata: vi.fn(),
  })),
}));

describe('AutomationOrchestrator', () => {
  let orchestrator: AutomationOrchestrator;
  let mockConfig: AutomationConfig;
  let mockPrisma: any;
  let mockMetadataService: any;
  let mockDeploymentTracker: any;

  beforeEach(() => {
    // Mock Prisma client
    mockPrisma = {
      automationRun: {
        create: vi.fn().mockResolvedValue({ id: 'run-123', status: 'RUNNING' }),
        update: vi.fn(),
      },
      automationStep: {
        create: vi.fn(),
      },
      ticket: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ticket-123',
          description: 'Create a status field',
          acceptanceCriteria: 'Field should be required',
        }),
      },
      organization: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'org-123',
          orgType: 'SANDBOX',
          userId: 'user-123',
        }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'org-sandbox-123',
          orgType: 'SANDBOX',
          userId: 'user-123',
        }),
      },
    };

    // Mock Metadata Service
    mockMetadataService = {
      deployMetadata: vi.fn().mockResolvedValue('deploy-123'),
      describeField: vi.fn().mockResolvedValue({ name: 'Test_Field__c' }),
      retrieveMetadata: vi.fn().mockResolvedValue({ fullName: 'Test_Rule' }),
    };

    // Mock Deployment Tracker
    mockDeploymentTracker = {
      pollDeploymentStatus: vi.fn().mockResolvedValue({
        success: true,
        status: 'Succeeded',
      }),
      getDeploymentDetails: vi.fn().mockResolvedValue({
        components: [
          { type: 'CustomField', fullName: 'Test_Field__c' },
        ],
      }),
    };

    mockConfig = {
      apiKey: 'test-api-key',
      metadataService: mockMetadataService,
      deploymentTracker: mockDeploymentTracker,
      prisma: mockPrisma,
    };

    orchestrator = new AutomationOrchestrator(mockConfig);
  });

  describe('orchestrateFieldCreation', () => {
    it('should successfully orchestrate field creation', async () => {
      // Mock the parser and generator methods
      const mockParser = (orchestrator as any).requirementsParser;
      mockParser.parseTicketDescription.mockResolvedValue({
        fields: [
          {
            fieldName: 'Status',
            fieldLabel: 'Status',
            fieldType: 'Picklist',
            description: 'Status field',
            required: true,
            picklistValues: ['New', 'In Progress', 'Done'],
          },
        ],
        validationRules: [],
        summary: 'Create status field',
        ambiguities: [],
      });

      mockParser.parseAcceptanceCriteria.mockResolvedValue({
        validationRules: [
          {
            ruleName: 'Status_Required',
            description: 'Status is required',
            errorConditionFormula: 'ISBLANK(Status__c)',
            errorMessage: 'Status is required',
            errorLocation: 'FIELD',
            relatedField: 'Status__c',
          },
        ],
      });

      const mockGenerator = (orchestrator as any).metadataGenerator;
      mockGenerator.generateCustomField.mockReturnValue({
        fullName: 'Status__c',
        label: 'Status',
        type: 'Picklist',
        required: true,
      });

      mockGenerator.generateValidationRule.mockReturnValue({
        fullName: 'Status_Required',
        active: true,
        description: 'Status is required',
        errorConditionFormula: 'ISBLANK(Status__c)',
        errorMessage: 'Status is required',
      });

      mockGenerator.validateMetadata.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const options: FieldCreationOptions = {
        ticketId: 'ticket-123',
        targetOrgId: 'org-123',
        deployToProduction: false,
      };

      const result = await orchestrator.orchestrateFieldCreation(options);

      expect(result.status).toBe('SUCCESS');
      expect(result.runId).toBe('run-123');
      expect(result.deploymentId).toBe('deploy-123');
      expect(result.errors).toHaveLength(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.fields).toHaveLength(1);
      expect(result.metadata?.validationRules).toHaveLength(1);

      // Verify steps were recorded
      expect(mockPrisma.automationStep.create).toHaveBeenCalled();
      
      // Verify deployment was called
      expect(mockMetadataService.deployMetadata).toHaveBeenCalled();
      
      // Verify deployment was tracked
      expect(mockDeploymentTracker.pollDeploymentStatus).toHaveBeenCalled();
    });

    it('should handle dry run without deployment', async () => {
      const mockParser = (orchestrator as any).requirementsParser;
      mockParser.parseTicketDescription.mockResolvedValue({
        fields: [{
          fieldName: 'Test',
          fieldLabel: 'Test',
          fieldType: 'Text',
          description: 'Test field',
          required: false,
        }],
        validationRules: [],
        summary: 'Test',
        ambiguities: [],
      });

      const mockGenerator = (orchestrator as any).metadataGenerator;
      mockGenerator.generateCustomField.mockReturnValue({
        fullName: 'Test__c',
        label: 'Test',
        type: 'Text',
      });

      mockGenerator.validateMetadata.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const options: FieldCreationOptions = {
        ticketId: 'ticket-123',
        targetOrgId: 'org-123',
        dryRun: true,
      };

      const result = await orchestrator.orchestrateFieldCreation(options);

      expect(result.status).toBe('SUCCESS');
      expect(result.deploymentId).toBeUndefined();
      expect(result.warnings).toContain('Dry run completed. No deployment performed.');
      
      // Verify deployment was NOT called
      expect(mockMetadataService.deployMetadata).not.toHaveBeenCalled();
    });

    it('should handle ticket not found error', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      const options: FieldCreationOptions = {
        ticketId: 'nonexistent',
        targetOrgId: 'org-123',
      };

      const result = await orchestrator.orchestrateFieldCreation(options);

      expect(result.status).toBe('FAILED');
      expect(result.errors).toContain('Ticket nonexistent not found');
    });

    it('should handle validation errors', async () => {
      const mockParser = (orchestrator as any).requirementsParser;
      mockParser.parseTicketDescription.mockResolvedValue({
        fields: [{
          fieldName: 'Invalid Field',
          fieldLabel: 'Invalid',
          fieldType: 'Text',
          description: 'Invalid field',
          required: false,
        }],
        validationRules: [],
        summary: 'Test',
        ambiguities: [],
      });

      const mockGenerator = (orchestrator as any).metadataGenerator;
      mockGenerator.generateCustomField.mockReturnValue({
        fullName: 'Invalid_Field__c',
        label: 'Invalid',
        type: 'Text',
      });

      mockGenerator.validateMetadata.mockReturnValue({
        isValid: false,
        errors: ['Invalid field name format'],
      });

      const options: FieldCreationOptions = {
        ticketId: 'ticket-123',
        targetOrgId: 'org-123',
      };

      const result = await orchestrator.orchestrateFieldCreation(options);

      expect(result.status).toBe('FAILED');
      expect(result.errors).toContain('Cannot deploy invalid metadata');
      
      // Verify deployment was NOT called due to validation failure
      expect(mockMetadataService.deployMetadata).not.toHaveBeenCalled();
    });

    it('should handle deployment failure', async () => {
      const mockParser = (orchestrator as any).requirementsParser;
      mockParser.parseTicketDescription.mockResolvedValue({
        fields: [{
          fieldName: 'Test',
          fieldLabel: 'Test',
          fieldType: 'Text',
          description: 'Test field',
          required: false,
        }],
        validationRules: [],
        summary: 'Test',
        ambiguities: [],
      });

      const mockGenerator = (orchestrator as any).metadataGenerator;
      mockGenerator.generateCustomField.mockReturnValue({
        fullName: 'Test__c',
        label: 'Test',
        type: 'Text',
      });

      mockGenerator.validateMetadata.mockReturnValue({
        isValid: true,
        errors: [],
      });

      // Mock deployment failure
      mockDeploymentTracker.pollDeploymentStatus.mockResolvedValue({
        success: false,
        status: 'Failed',
        errorMessage: 'Deployment failed due to permission error',
      });

      const options: FieldCreationOptions = {
        ticketId: 'ticket-123',
        targetOrgId: 'org-123',
      };

      const result = await orchestrator.orchestrateFieldCreation(options);

      expect(result.status).toBe('FAILED');
      expect(result.errors).toContain('Deployment failed: Deployment failed due to permission error');
    });

    it('should handle organization not found', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);

      const mockParser = (orchestrator as any).requirementsParser;
      mockParser.parseTicketDescription.mockResolvedValue({
        fields: [{
          fieldName: 'Test',
          fieldLabel: 'Test',
          fieldType: 'Text',
          description: 'Test field',
          required: false,
        }],
        validationRules: [],
        summary: 'Test',
        ambiguities: [],
      });

      const mockGenerator = (orchestrator as any).metadataGenerator;
      mockGenerator.generateCustomField.mockReturnValue({
        fullName: 'Test__c',
        label: 'Test',
        type: 'Text',
      });

      mockGenerator.validateMetadata.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const options: FieldCreationOptions = {
        ticketId: 'ticket-123',
        targetOrgId: 'org-invalid',
      };

      const result = await orchestrator.orchestrateFieldCreation(options);

      expect(result.status).toBe('FAILED');
      expect(result.errors).toContain('Organization org-invalid not found');
    });

    it('should include ambiguities as warnings', async () => {
      const mockParser = (orchestrator as any).requirementsParser;
      mockParser.parseTicketDescription.mockResolvedValue({
        fields: [{
          fieldName: 'Test',
          fieldLabel: 'Test',
          fieldType: 'Text',
          description: 'Test field',
          required: false,
        }],
        validationRules: [],
        summary: 'Test',
        ambiguities: ['Field length not specified', 'Default value unclear'],
      });

      const mockGenerator = (orchestrator as any).metadataGenerator;
      mockGenerator.generateCustomField.mockReturnValue({
        fullName: 'Test__c',
        label: 'Test',
        type: 'Text',
      });

      mockGenerator.validateMetadata.mockReturnValue({
        isValid: true,
        errors: [],
      });

      const options: FieldCreationOptions = {
        ticketId: 'ticket-123',
        targetOrgId: 'org-123',
      };

      const result = await orchestrator.orchestrateFieldCreation(options);

      expect(result.warnings).toContain('Field length not specified');
      expect(result.warnings).toContain('Default value unclear');
    });
  });

  describe('verifyDeployment', () => {
    it('should successfully verify deployment', async () => {
      const metadata = {
        fields: [{
          fullName: 'Test_Field__c',
          label: 'Test Field',
          type: 'Text',
        }],
        validationRules: [{
          fullName: 'Test_Rule',
          active: true,
          description: 'Test',
          errorConditionFormula: 'TRUE',
          errorMessage: 'Test',
        }],
        isValid: true,
        errors: [],
      };

      const result = await orchestrator.verifyDeployment('org-123', metadata);

      expect(result.success).toBe(true);
      expect(result.details.fields).toHaveLength(1);
      expect(result.details.fields[0].found).toBe(true);
      expect(result.details.validationRules).toHaveLength(1);
      expect(result.details.validationRules[0].found).toBe(true);
    });

    it('should handle verification failure', async () => {
      mockMetadataService.describeField.mockRejectedValue(new Error('Field not found'));
      mockMetadataService.retrieveMetadata.mockRejectedValue(new Error('Rule not found'));

      const metadata = {
        fields: [{
          fullName: 'Test_Field__c',
          label: 'Test Field',
          type: 'Text',
        }],
        validationRules: [{
          fullName: 'Test_Rule',
          active: true,
          description: 'Test',
          errorConditionFormula: 'TRUE',
          errorMessage: 'Test',
        }],
        isValid: true,
        errors: [],
      };

      const result = await orchestrator.verifyDeployment('org-123', metadata);

      expect(result.success).toBe(false);
      expect(result.details.fields[0].found).toBe(false);
      expect(result.details.validationRules[0].found).toBe(false);
    });
  });

  describe('getAutomationStatus', () => {
    it('should return automation run status', async () => {
      mockPrisma.automationRun.findUnique = vi.fn().mockResolvedValue({
        id: 'run-123',
        status: 'SUCCESS',
        metadata: { fields: [] },
        error: null,
        startedAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-01'),
        steps: [
          {
            stepType: 'PARSE',
            status: 'COMPLETED',
            startedAt: new Date('2024-01-01'),
            completedAt: new Date('2024-01-01'),
            error: null,
          },
        ],
      });

      const status = await orchestrator.getAutomationStatus('run-123');

      expect(status.id).toBe('run-123');
      expect(status.status).toBe('SUCCESS');
      expect(status.steps).toHaveLength(1);
      expect(status.steps[0].type).toBe('PARSE');
    });

    it('should throw error for non-existent run', async () => {
      mockPrisma.automationRun.findUnique = vi.fn().mockResolvedValue(null);

      await expect(orchestrator.getAutomationStatus('invalid'))
        .rejects.toThrow('Automation run invalid not found');
    });
  });

  describe('rollbackDeployment', () => {
    it('should rollback deployment successfully', async () => {
      mockMetadataService.deployMetadata.mockResolvedValue('rollback-123');
      mockDeploymentTracker.pollDeploymentStatus.mockResolvedValue({
        success: true,
        status: 'Succeeded',
      });

      await orchestrator.rollbackDeployment('deploy-123', 'org-123');

      expect(mockDeploymentTracker.getDeploymentDetails).toHaveBeenCalledWith('deploy-123');
      expect(mockMetadataService.deployMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          types: expect.arrayContaining([
            expect.objectContaining({
              name: 'CustomField',
              members: ['Test_Field__c'],
            }),
          ]),
        }),
        expect.objectContaining({ rollbackMode: true })
      );
    });

    it('should handle rollback errors gracefully', async () => {
      mockDeploymentTracker.getDeploymentDetails.mockRejectedValue(new Error('Details not found'));

      // Should not throw, just log error
      await expect(orchestrator.rollbackDeployment('deploy-123', 'org-123'))
        .resolves.not.toThrow();
    });
  });
});