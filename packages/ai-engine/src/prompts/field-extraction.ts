export const FIELD_EXTRACTION_SYSTEM_PROMPT = `You are an expert Salesforce developer analyzing requirements to extract field definitions.
Your role is to identify custom fields and validation rules that need to be created in Salesforce.

Key Guidelines:
1. Field names must follow Salesforce naming conventions (ending with __c for custom fields)
2. Choose the most appropriate field type based on the requirement
3. Identify validation rules that ensure data integrity
4. Flag any ambiguous requirements that need clarification
5. Consider Salesforce best practices and limitations

Field Type Selection:
- Text: For short text up to 255 characters
- TextArea: For long text (32,768 chars standard, 131,072 for rich text)
- Number: For numeric values with optional decimal places
- Currency: For monetary values
- Percent: For percentage values
- Date: For date only (no time component)
- DateTime: For date with time
- Checkbox: For true/false values
- Picklist: For single-select from predefined values
- MultiSelectPicklist: For multiple selections
- Email: For email addresses with built-in validation
- Phone: For phone numbers
- URL: For web addresses
- Lookup: For many-to-one relationships
- MasterDetail: For parent-child relationships with cascade delete
- Formula: For calculated read-only fields

Validation Rule Guidelines:
- Formula must evaluate to TRUE when data is INVALID
- Use Salesforce formula functions (ISBLANK, LEN, CONTAINS, etc.)
- Provide clear, user-friendly error messages
- Specify whether error should appear at field or top of page`;

export const FIELD_EXTRACTION_USER_PROMPT = (description: string, includeContext: boolean = false) => {
  const basePrompt = `Analyze the following requirement and extract Salesforce field definitions and validation rules.

Requirement:
${description}

Return a JSON object with this structure:
{
  "fields": [
    {
      "fieldName": "API_Name__c",
      "fieldLabel": "Display Label",
      "fieldType": "FieldType",
      "description": "Field purpose and usage",
      "required": true/false,
      "defaultValue": "optional",
      "picklistValues": ["Value1", "Value2"],
      "formula": "formula expression",
      "relatedObject": "ObjectName",
      "maxLength": 255,
      "precision": 18,
      "scale": 2
    }
  ],
  "validationRules": [
    {
      "ruleName": "Rule_Name",
      "description": "What this validates",
      "errorConditionFormula": "Formula",
      "errorMessage": "User-friendly message",
      "errorLocation": "TOP|FIELD",
      "relatedField": "Field__c"
    }
  ],
  "summary": "Brief summary",
  "ambiguities": ["List of unclear items"]
}`;

  if (includeContext) {
    return `${basePrompt}\n\nInclude contextual assumptions based on common Salesforce patterns.`;
  }
  
  return basePrompt;
};

export const VALIDATION_EXTRACTION_PROMPT = `You are an expert at extracting validation rules from requirements.
Focus ONLY on identifying validation rules and data integrity constraints.

Common validation patterns:
- Required field validation: ISBLANK(Field__c)
- Length validation: LEN(Field__c) > max_length
- Range validation: Field__c < min OR Field__c > max
- Format validation: NOT(REGEX(Field__c, pattern))
- Cross-field validation: Field1__c > Field2__c
- Conditional requirements: AND(condition, ISBLANK(Field__c))

Return a JSON array of validation rules only.`;

export const FIELD_TYPE_DETECTION_PROMPT = `Analyze the text and determine the most appropriate Salesforce field type.
Consider keywords, context, and common patterns.

Keywords mapping:
- checkbox, boolean, yes/no, true/false → Checkbox
- dropdown, picklist, select, choose from → Picklist
- currency, money, price, cost, amount, dollar → Currency
- percent, percentage, % → Percent
- email, e-mail → Email
- phone, telephone, mobile → Phone
- url, website, link → URL
- date and time, datetime, timestamp → DateTime
- date (without time) → Date
- formula, calculated, computed → Formula
- lookup, reference, related → Lookup
- master-detail, parent → MasterDetail
- long text, description, notes, comments → TextArea
- number, quantity, count, total → Number
- text, name, code, id → Text (default)`;

export interface PromptTemplate {
  name: string;
  version: string;
  systemPrompt: string;
  userPromptTemplate: (input: any) => string;
}

export const fieldExtractionTemplate: PromptTemplate = {
  name: 'field-extraction',
  version: '1.0.0',
  systemPrompt: FIELD_EXTRACTION_SYSTEM_PROMPT,
  userPromptTemplate: FIELD_EXTRACTION_USER_PROMPT,
};

export const validationExtractionTemplate: PromptTemplate = {
  name: 'validation-extraction',
  version: '1.0.0',
  systemPrompt: VALIDATION_EXTRACTION_PROMPT,
  userPromptTemplate: (description: string) => `Extract validation rules from: ${description}`,
};

export class PromptVersionManager {
  private templates: Map<string, PromptTemplate[]> = new Map();

  registerTemplate(template: PromptTemplate): void {
    const key = template.name;
    if (!this.templates.has(key)) {
      this.templates.set(key, []);
    }
    this.templates.get(key)!.push(template);
  }

  getTemplate(name: string, version?: string): PromptTemplate | undefined {
    const templates = this.templates.get(name);
    if (!templates || templates.length === 0) return undefined;
    
    if (version) {
      return templates.find(t => t.version === version);
    }
    
    // Return latest version
    return templates[templates.length - 1];
  }

  getAllVersions(name: string): PromptTemplate[] {
    return this.templates.get(name) || [];
  }
}