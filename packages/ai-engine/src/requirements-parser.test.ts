import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RequirementsParser } from './requirements-parser';
import { Anthropic } from '@anthropic-ai/sdk';

vi.mock('@anthropic-ai/sdk');

describe('RequirementsParser', () => {
  let parser: RequirementsParser;
  let mockAnthropicClient: any;

  beforeEach(() => {
    mockAnthropicClient = {
      messages: {
        create: vi.fn(),
      },
    };
    
    (Anthropic as any).mockImplementation(() => mockAnthropicClient);
    parser = new RequirementsParser('test-api-key');
  });

  describe('parseTicketDescription', () => {
    it('should parse field requirements from ticket description', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            fields: [
              {
                fieldName: 'Project_Status__c',
                fieldLabel: 'Project Status',
                fieldType: 'Picklist',
                description: 'Current status of the project',
                required: true,
                picklistValues: ['Not Started', 'In Progress', 'Completed', 'On Hold'],
              },
              {
                fieldName: 'Completion_Date__c',
                fieldLabel: 'Completion Date',
                fieldType: 'Date',
                description: 'Expected completion date',
                required: false,
              },
            ],
            validationRules: [
              {
                ruleName: 'Completion_Date_Required_When_Complete',
                description: 'Completion date is required when status is Completed',
                errorConditionFormula: "AND(ISPICKVAL(Project_Status__c, 'Completed'), ISBLANK(Completion_Date__c))",
                errorMessage: 'Completion Date is required when Project Status is Completed',
                errorLocation: 'FIELD',
                relatedField: 'Completion_Date__c',
              },
            ],
            summary: 'Create project tracking fields with status and completion date',
            ambiguities: [],
          }),
        }],
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const result = await parser.parseTicketDescription('Create fields for project tracking');

      expect(result.fields).toHaveLength(2);
      expect(result.fields[0]?.fieldName).toBe('Project_Status__c');
      expect(result.fields[0]?.fieldType).toBe('Picklist');
      expect(result.fields[0]?.picklistValues).toEqual(['Not Started', 'In Progress', 'Completed', 'On Hold']);
      
      expect(result.validationRules).toHaveLength(1);
      expect(result.validationRules[0]?.ruleName).toBe('Completion_Date_Required_When_Complete');
      
      expect(result.summary).toBe('Create project tracking fields with status and completion date');
      expect(result.ambiguities).toEqual([]);
    });

    it('should handle errors from Claude API', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(new Error('API error'));

      await expect(parser.parseTicketDescription('test description'))
        .rejects.toThrow('Failed to parse requirements: API error');
    });

    it('should handle non-JSON responses', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: 'This is not JSON',
        }],
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      await expect(parser.parseTicketDescription('test description'))
        .rejects.toThrow('Could not extract JSON from response');
    });
  });

  describe('parseAcceptanceCriteria', () => {
    it('should extract validation rules from acceptance criteria', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            validationRules: [
              {
                ruleName: 'Email_Format_Validation',
                description: 'Ensure email field contains valid email format',
                errorConditionFormula: "NOT(REGEX(Email__c, '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'))",
                errorMessage: 'Please enter a valid email address',
                errorLocation: 'FIELD',
                relatedField: 'Email__c',
              },
            ],
            ambiguities: ['Email domain restrictions not specified'],
          }),
        }],
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const result = await parser.parseAcceptanceCriteria('Email field must be validated for proper format');

      expect(result.validationRules).toHaveLength(1);
      expect(result.validationRules![0]?.ruleName).toBe('Email_Format_Validation');
      expect(result.ambiguities).toContain('Email domain restrictions not specified');
    });
  });

  describe('detectFieldType', () => {
    it('should detect Checkbox field type', () => {
      expect(parser.detectFieldType('Add a checkbox for active status')).toBe('Checkbox');
      expect(parser.detectFieldType('Boolean field for enabled')).toBe('Checkbox');
      expect(parser.detectFieldType('yes/no selection')).toBe('Checkbox');
    });

    it('should detect Picklist field type', () => {
      expect(parser.detectFieldType('Create a dropdown for status')).toBe('Picklist');
      expect(parser.detectFieldType('Picklist with values')).toBe('Picklist');
      expect(parser.detectFieldType('Select from list of options')).toBe('Picklist');
    });

    it('should detect Currency field type', () => {
      expect(parser.detectFieldType('Add currency field for price')).toBe('Currency');
      expect(parser.detectFieldType('Money amount field')).toBe('Currency');
      expect(parser.detectFieldType('Total amount in dollars')).toBe('Currency');
    });

    it('should detect Date and DateTime field types', () => {
      expect(parser.detectFieldType('Add date field for birthday')).toBe('Date');
      expect(parser.detectFieldType('DateTime for appointment')).toBe('DateTime');
      expect(parser.detectFieldType('Timestamp of creation')).toBe('DateTime');
      expect(parser.detectFieldType('Date and time of meeting')).toBe('DateTime');
    });

    it('should detect Email field type', () => {
      expect(parser.detectFieldType('Email address field')).toBe('Email');
      expect(parser.detectFieldType('Contact email')).toBe('Email');
    });

    it('should detect Phone field type', () => {
      expect(parser.detectFieldType('Phone number field')).toBe('Phone');
      expect(parser.detectFieldType('Telephone contact')).toBe('Phone');
    });

    it('should detect URL field type', () => {
      expect(parser.detectFieldType('Website URL field')).toBe('URL');
      expect(parser.detectFieldType('Link to documentation')).toBe('URL');
    });

    it('should detect Lookup field type', () => {
      expect(parser.detectFieldType('Lookup to Account')).toBe('Lookup');
      expect(parser.detectFieldType('Reference to User')).toBe('Lookup');
      expect(parser.detectFieldType('Related to Contact')).toBe('Lookup');
    });

    it('should detect MasterDetail field type', () => {
      expect(parser.detectFieldType('Master-detail relationship')).toBe('MasterDetail');
      expect(parser.detectFieldType('Parent account field')).toBe('MasterDetail');
    });

    it('should detect Formula field type', () => {
      expect(parser.detectFieldType('Formula to calculate total')).toBe('Formula');
      expect(parser.detectFieldType('Calculated field')).toBe('Formula');
      expect(parser.detectFieldType('Computed value')).toBe('Formula');
    });

    it('should detect TextArea field type', () => {
      expect(parser.detectFieldType('Long text for description')).toBe('TextArea');
      expect(parser.detectFieldType('Notes field')).toBe('TextArea');
    });

    it('should detect Number field type', () => {
      expect(parser.detectFieldType('Number of items')).toBe('Number');
      expect(parser.detectFieldType('Quantity field')).toBe('Number');
      expect(parser.detectFieldType('Count of records')).toBe('Number');
    });

    it('should detect Percent field type', () => {
      expect(parser.detectFieldType('Percentage complete')).toBe('Percent');
      expect(parser.detectFieldType('Discount percent')).toBe('Percent');
      expect(parser.detectFieldType('50% threshold')).toBe('Percent');
    });

    it('should default to Text field type', () => {
      expect(parser.detectFieldType('Some random field')).toBe('Text');
      expect(parser.detectFieldType('Name field')).toBe('Text');
    });
  });

  describe('extractValidationRules', () => {
    it('should extract validation rules from description', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify([
            {
              ruleName: 'Amount_Positive',
              description: 'Amount must be positive',
              errorConditionFormula: 'Amount__c < 0',
              errorMessage: 'Amount must be greater than or equal to 0',
              errorLocation: 'FIELD',
              relatedField: 'Amount__c',
            },
          ]),
        }],
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const result = await parser.extractValidationRules('Amount field must be positive');

      expect(result).toHaveLength(1);
      expect(result[0]?.ruleName).toBe('Amount_Positive');
      expect(result[0]?.errorConditionFormula).toBe('Amount__c < 0');
    });

    it('should return empty array on error', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(new Error('API error'));

      const result = await parser.extractValidationRules('test description');
      
      expect(result).toEqual([]);
    });

    it('should return empty array when no validation rules found', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: 'No validation rules found',
        }],
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const result = await parser.extractValidationRules('test description');
      
      expect(result).toEqual([]);
    });
  });
});