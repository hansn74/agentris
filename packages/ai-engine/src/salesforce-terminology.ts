export class SalesforceTerminologyValidator {
  private standardObjects = new Set([
    'Account', 'Contact', 'Lead', 'Opportunity', 'Case',
    'Campaign', 'Product', 'PricebookEntry', 'Quote', 'Order',
    'Contract', 'Asset', 'User', 'Profile', 'PermissionSet',
    'Task', 'Event', 'ContentDocument', 'ContentVersion', 'ContentDocumentLink',
    'Attachment', 'Note', 'EmailMessage', 'FeedItem', 'FeedComment',
    'Group', 'GroupMember', 'QueueSObject', 'Topic', 'TopicAssignment'
  ]);

  private standardFields = new Map<string, string[]>([
    ['Account', ['Name', 'Type', 'Industry', 'AnnualRevenue', 'NumberOfEmployees', 
                 'BillingAddress', 'ShippingAddress', 'Phone', 'Website', 'OwnerId']],
    ['Contact', ['FirstName', 'LastName', 'Email', 'Phone', 'Title', 
                 'Department', 'AccountId', 'MailingAddress', 'OwnerId']],
    ['Lead', ['FirstName', 'LastName', 'Company', 'Title', 'Email', 
              'Phone', 'Status', 'Rating', 'LeadSource', 'OwnerId']],
    ['Opportunity', ['Name', 'StageName', 'Amount', 'CloseDate', 'Probability', 
                     'Type', 'NextStep', 'LeadSource', 'AccountId', 'OwnerId']],
    ['Case', ['Subject', 'Description', 'Status', 'Priority', 'Origin', 
              'Type', 'Reason', 'ContactId', 'AccountId', 'OwnerId']],
    ['User', ['Username', 'Email', 'FirstName', 'LastName', 'Alias', 
              'TimeZoneSidKey', 'LocaleSidKey', 'EmailEncodingKey', 'ProfileId', 'UserRoleId']]
  ]);

  private salesforceTerms = new Map<string, string>([
    // Generic to Salesforce mappings
    ['user', 'User record'],
    ['users', 'User records'],
    ['customer', 'Account or Contact'],
    ['customers', 'Accounts and Contacts'],
    ['company', 'Account'],
    ['companies', 'Accounts'],
    ['person', 'Contact or Lead'],
    ['people', 'Contacts or Leads'],
    ['deal', 'Opportunity'],
    ['deals', 'Opportunities'],
    ['ticket', 'Case'],
    ['tickets', 'Cases'],
    ['product', 'Product2'],
    ['products', 'Product2 records'],
    
    // Feature mappings
    ['workflow', 'Workflow Rule or Flow'],
    ['automation', 'Flow, Process Builder, or Workflow Rule'],
    ['validation', 'Validation Rule'],
    ['permission', 'Permission Set or Profile'],
    ['permissions', 'Permission Sets or Profiles'],
    ['access', 'Sharing Rules or Object Permissions'],
    ['layout', 'Page Layout or Lightning Page'],
    ['form', 'Page Layout or Screen Flow'],
    ['report', 'Report or Dashboard'],
    ['integration', 'Connected App or External Service'],
    ['api', 'REST API, SOAP API, or Bulk API'],
    ['custom field', 'Custom Field (API name with __c suffix)'],
    ['relationship', 'Lookup or Master-Detail Relationship'],
    ['formula', 'Formula Field or Validation Rule Formula'],
    ['trigger', 'Apex Trigger'],
    ['class', 'Apex Class'],
    ['component', 'Lightning Component or Lightning Web Component'],
    ['page', 'Visualforce Page or Lightning Page'],
    ['email', 'Email Template or Email Alert'],
    ['approval', 'Approval Process'],
    ['queue', 'Queue for Case or Lead assignment'],
    ['role', 'Role Hierarchy'],
    ['group', 'Public Group'],
    ['folder', 'Report Folder or Document Folder'],
    ['file', 'ContentDocument or Attachment'],
    ['record type', 'Record Type for object differentiation'],
    ['picklist', 'Picklist or Multi-Select Picklist Field'],
    ['lookup', 'Lookup Relationship Field'],
    ['master-detail', 'Master-Detail Relationship Field']
  ]);

  private apiNamePatterns = {
    customObject: /__c$/,
    customField: /__c$/,
    customMetadata: /__mdt$/,
    relationship: /__r$/,
    externalId: /__x$/
  };

  isStandardObject(term: string): boolean {
    return this.standardObjects.has(term);
  }

  getStandardFields(objectName: string): string[] | undefined {
    return this.standardFields.get(objectName);
  }

  getSalesforceEquivalent(term: string): string | undefined {
    const lowerTerm = term.toLowerCase();
    return this.salesforceTerms.get(lowerTerm);
  }

  enhanceWithSalesforceContext(text: string): string {
    let enhanced = text;
    
    // Replace generic terms with Salesforce equivalents
    this.salesforceTerms.forEach((sfTerm, genericTerm) => {
      const regex = new RegExp(`\\b${genericTerm}\\b`, 'gi');
      enhanced = enhanced.replace(regex, sfTerm);
    });

    return enhanced;
  }

  validateApiName(apiName: string): {
    valid: boolean;
    type?: string;
    suggestion?: string;
  } {
    // Check for custom object
    if (apiName.endsWith('__c')) {
      return { valid: true, type: 'custom' };
    }
    
    // Check for standard object
    if (this.standardObjects.has(apiName)) {
      return { valid: true, type: 'standard' };
    }
    
    // Check for relationship
    if (apiName.endsWith('__r')) {
      return { valid: true, type: 'relationship' };
    }
    
    // Check for custom metadata
    if (apiName.endsWith('__mdt')) {
      return { valid: true, type: 'customMetadata' };
    }
    
    // Suggest proper format
    const suggestion = this.suggestApiName(apiName);
    return { 
      valid: false, 
      suggestion 
    };
  }

  private suggestApiName(input: string): string {
    // Remove spaces and special characters
    let cleaned = input.replace(/[^a-zA-Z0-9_]/g, '_');
    
    // Ensure it starts with a letter
    if (!/^[a-zA-Z]/.test(cleaned)) {
      cleaned = 'Custom_' + cleaned;
    }
    
    // Add custom suffix if not present
    if (!cleaned.match(/__[crmx]$/)) {
      cleaned += '__c';
    }
    
    return cleaned;
  }

  detectSalesforceReferences(text: string): {
    objects: string[];
    fields: string[];
    features: string[];
  } {
    const detected = {
      objects: [] as string[],
      fields: [] as string[],
      features: [] as string[]
    };
    
    // Detect standard objects
    this.standardObjects.forEach(obj => {
      const regex = new RegExp(`\\b${obj}\\b`, 'g');
      if (regex.test(text)) {
        detected.objects.push(obj);
      }
    });
    
    // Detect custom objects/fields (API names)
    const customPattern = /\b\w+__[crmx]\b/g;
    const customMatches = text.match(customPattern);
    if (customMatches) {
      detected.fields.push(...customMatches);
    }
    
    // Detect Salesforce features
    const features = [
      'Workflow Rule', 'Process Builder', 'Flow', 'Validation Rule',
      'Page Layout', 'Lightning Component', 'Apex Trigger', 'Apex Class',
      'Permission Set', 'Profile', 'Sharing Rule', 'Record Type'
    ];
    
    features.forEach(feature => {
      if (text.includes(feature)) {
        detected.features.push(feature);
      }
    });
    
    return detected;
  }
}