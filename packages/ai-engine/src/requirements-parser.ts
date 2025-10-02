import { Anthropic } from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getApiKeyProvider } from './config/api-key-provider';
import { PromptSanitizer } from './utils/prompt-sanitizer';

export const fieldRequirementSchema = z.object({
  fieldName: z.string(),
  fieldLabel: z.string(),
  fieldType: z.string(),
  description: z.string(),
  required: z.boolean(),
  defaultValue: z.string().optional(),
  picklistValues: z.array(z.string()).optional(),
  formula: z.string().optional(),
  relatedObject: z.string().optional(),
  maxLength: z.number().optional(),
  precision: z.number().optional(),
  scale: z.number().optional(),
});

export const validationRuleRequirementSchema = z.object({
  ruleName: z.string(),
  description: z.string(),
  errorConditionFormula: z.string(),
  errorMessage: z.string(),
  errorLocation: z.enum(['TOP', 'FIELD']),
  relatedField: z.string().optional(),
});

export type FieldRequirement = z.infer<typeof fieldRequirementSchema>;
export type ValidationRuleRequirement = z.infer<typeof validationRuleRequirementSchema>;

export interface ParsedRequirements {
  fields: FieldRequirement[];
  validationRules: ValidationRuleRequirement[];
  summary: string;
  ambiguities: string[];
}

export class RequirementsParser {
  private anthropic: Anthropic;
  private apiKeyProvider = getApiKeyProvider();

  constructor(apiKey?: string) {
    // Support optional API key for backward compatibility, but prefer secure provider
    if (apiKey) {
      // TODO: Replace with Pino logger
      // logger.warn('Direct API key usage is deprecated. Use environment variables instead.');
      this.anthropic = new Anthropic({ apiKey });
    } else {
      // Use secure API key provider
      const secureApiKey = this.apiKeyProvider.getApiKey();
      this.anthropic = new Anthropic({ apiKey: secureApiKey });
    }
  }

  async parseTicketDescription(description: string, includeContext?: boolean): Promise<ParsedRequirements> {
    // Sanitize input to prevent prompt injection
    const sanitizedDescription = PromptSanitizer.sanitizeTicketDescription(description);
    
    const systemPrompt = `You are an expert Salesforce developer analyzing Jira tickets to extract field creation requirements.
Your task is to identify custom fields and validation rules that need to be created.

Output a JSON object with the following structure:
{
  "fields": [
    {
      "fieldName": "API_Name__c",
      "fieldLabel": "Display Label",
      "fieldType": "Text|Number|Date|DateTime|Checkbox|Picklist|Currency|Email|Phone|URL|Lookup|MasterDetail|Formula|TextArea|Percent",
      "description": "Field description",
      "required": true/false,
      "defaultValue": "optional default",
      "picklistValues": ["Value1", "Value2"], // for Picklist types
      "formula": "formula expression", // for Formula types
      "relatedObject": "ObjectName", // for Lookup/MasterDetail
      "maxLength": 255, // for Text fields
      "precision": 18, // for Number/Currency/Percent
      "scale": 2 // for Number/Currency/Percent
    }
  ],
  "validationRules": [
    {
      "ruleName": "Rule_Name",
      "description": "What this rule validates",
      "errorConditionFormula": "ISBLANK(Field__c)",
      "errorMessage": "Error message to display",
      "errorLocation": "TOP|FIELD",
      "relatedField": "Field__c" // if errorLocation is FIELD
    }
  ],
  "summary": "Brief summary of requirements",
  "ambiguities": ["List of unclear requirements needing clarification"]
}

Field Type Guidelines:
- Text: For short text (max 255 chars)
- TextArea: For long text (up to 131,072 chars for rich text)
- Number: For numeric values
- Currency: For monetary values
- Percent: For percentage values
- Date: For date only
- DateTime: For date and time
- Checkbox: For boolean values
- Picklist: For single-select dropdown
- Email/Phone/URL: For specific text formats
- Lookup: For many-to-one relationship
- MasterDetail: For parent-child relationship
- Formula: For calculated read-only fields`;

    const userPrompt = includeContext 
      ? `Analyze this Jira ticket description and extract Salesforce field requirements:\n\n${sanitizedDescription}\n\nInclude any contextual assumptions.`
      : `Analyze this Jira ticket description and extract Salesforce field requirements:\n\n${sanitizedDescription}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as ParsedRequirements;
      return parsed;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse requirements: ${error.message}`);
      }
      throw error;
    }
  }

  async parseAcceptanceCriteria(acceptanceCriteria: string): Promise<Partial<ParsedRequirements>> {
    // Sanitize input to prevent prompt injection
    const sanitizedCriteria = PromptSanitizer.sanitizeText(acceptanceCriteria, 5000);
    
    const systemPrompt = `You are an expert Salesforce developer analyzing acceptance criteria to extract specific field properties.
Focus on identifying validation rules, field constraints, and specific requirements.

Output a JSON object with only the relevant parts:
{
  "fields": [...], // Only if specific field properties are mentioned
  "validationRules": [...], // Validation rules from acceptance criteria
  "ambiguities": [...] // Any unclear requirements
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 2000,
        temperature: 0,
        system: systemPrompt,
        messages: [{ 
          role: 'user', 
          content: `Extract field properties and validation rules from these acceptance criteria:\n\n${sanitizedCriteria}` 
        }],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not extract JSON from response');
      }

      return JSON.parse(jsonMatch[0]) as Partial<ParsedRequirements>;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse acceptance criteria: ${error.message}`);
      }
      throw error;
    }
  }

  detectFieldType(requirementText: string): string {
    const text = requirementText.toLowerCase();
    
    if (text.includes('checkbox') || text.includes('boolean') || text.includes('yes/no')) {
      return 'Checkbox';
    }
    if (text.includes('picklist') || text.includes('dropdown') || text.includes('select from')) {
      return 'Picklist';
    }
    if (text.includes('currency') || text.includes('money') || text.includes('price') || text.includes('amount')) {
      return 'Currency';
    }
    if (text.includes('percent') || text.includes('percentage') || text.includes('%')) {
      return 'Percent';
    }
    if (text.includes('datetime') || text.includes('date and time') || text.includes('timestamp')) {
      return 'DateTime';
    }
    if (text.includes('date') && !text.includes('time')) {
      return 'Date';
    }
    if (text.includes('email')) {
      return 'Email';
    }
    if (text.includes('phone') || text.includes('telephone')) {
      return 'Phone';
    }
    if (text.includes('url') || text.includes('website') || text.includes('link')) {
      return 'URL';
    }
    if (text.includes('lookup') || text.includes('reference to') || text.includes('related to')) {
      return 'Lookup';
    }
    if (text.includes('master-detail') || text.includes('parent')) {
      return 'MasterDetail';
    }
    if (text.includes('formula') || text.includes('calculated') || text.includes('computed')) {
      return 'Formula';
    }
    if (text.includes('long text') || text.includes('description') || text.includes('notes')) {
      return 'TextArea';
    }
    if (text.includes('number') || text.includes('quantity') || text.includes('count')) {
      return 'Number';
    }
    
    return 'Text'; // Default to Text field
  }

  async extractValidationRules(description: string): Promise<ValidationRuleRequirement[]> {
    const systemPrompt = `You are an expert Salesforce developer extracting validation rules from requirements.
Focus ONLY on validation rules. Output a JSON array of validation rules.

Each validation rule should follow this structure:
{
  "ruleName": "Rule_API_Name",
  "description": "What this rule validates",
  "errorConditionFormula": "Formula that evaluates to true when data is INVALID",
  "errorMessage": "User-friendly error message",
  "errorLocation": "TOP" or "FIELD",
  "relatedField": "Field__c" // only if errorLocation is FIELD
}

Common validation formulas:
- ISBLANK(Field__c) - Field is required
- LEN(Field__c) > 100 - Text length limit
- Field__c < 0 - Number must be positive
- NOT(CONTAINS(Field__c, '@')) - Email validation
- Field1__c > Field2__c - Field comparison`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 2000,
        temperature: 0,
        system: systemPrompt,
        messages: [{ 
          role: 'user', 
          content: `Extract validation rules from this description:\n\n${description}` 
        }],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      const jsonMatch = content?.text?.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      return JSON.parse(jsonMatch[0]) as ValidationRuleRequirement[];
    } catch (error) {
      // Silently handle error - should use injected logger
      // TODO: Add proper error logging with Pino
      return [];
    }
  }
}