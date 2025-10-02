import { describe, it, expect } from 'vitest';
import { ChangeDetector, ChangeType } from './change-detector';

describe('ChangeDetector', () => {
  const detector = new ChangeDetector();

  describe('detectChangeType', () => {
    it('should detect field changes', () => {
      const ticketContent = `
        We need to create a new custom field on the Account object.
        The field should be a text field with a label "Customer Priority"
        and API name Customer_Priority__c.
      `;

      const result = detector.detectChangeType(ticketContent);

      expect(result.primaryType).toBe(ChangeType.FIELD);
      expect(result.detectedTypes).toContain(ChangeType.FIELD);
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.metadata.keywords).toContain('custom field');
      expect(result.metadata.keywords).toContain('text field');
      expect(result.metadata.objectNames).toContain('Account');
      expect(result.metadata.fieldNames).toContain('Customer_Priority__c');
    });

    it('should detect flow changes', () => {
      const ticketContent = `
        Build a screen flow for lead conversion process.
        The flow should include decision elements to route based on lead score,
        and create records in the opportunity object.
      `;

      const result = detector.detectChangeType(ticketContent);

      expect(result.primaryType).toBe(ChangeType.FLOW);
      expect(result.detectedTypes).toContain(ChangeType.FLOW);
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.metadata.keywords).toContain('screen flow');
      expect(result.metadata.keywords).toContain('decision');
      expect(result.metadata.keywords).toContain('create records');
      expect(result.metadata.objectNames).toBeDefined();
      expect(result.metadata.objectNames).toContain('Lead');
      expect(result.metadata.objectNames).toContain('Opportunity');
    });

    it('should detect apex changes', () => {
      const ticketContent = `
        Write an Apex trigger on Contact object that fires before insert
        and before update. The trigger should validate email format
        and update a custom field. Also create a test class with 90% coverage.
      `;

      const result = detector.detectChangeType(ticketContent);

      expect(result.primaryType).toBe(ChangeType.APEX);
      expect(result.detectedTypes).toContain(ChangeType.APEX);
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.metadata.keywords).toContain('apex');
      expect(result.metadata.keywords).toContain('trigger');
      expect(result.metadata.keywords).toContain('test class');
      expect(result.metadata.objectNames).toContain('Contact');
    });

    it('should detect layout changes', () => {
      const ticketContent = `
        Modify the Account page layout to include new fields in the Details section.
        Add related list for custom object Orders__c.
        Update the lightning page with new components.
      `;

      const result = detector.detectChangeType(ticketContent);

      expect(result.primaryType).toBe(ChangeType.LAYOUT);
      expect(result.detectedTypes).toContain(ChangeType.LAYOUT);
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.metadata.keywords).toContain('page layout');
      expect(result.metadata.keywords).toContain('related list');
      expect(result.metadata.keywords).toContain('lightning page');
      expect(result.metadata.objectNames).toContain('Account');
      expect(result.metadata.objectNames).toContain('Orders__c');
    });

    it('should detect validation rule changes', () => {
      const ticketContent = `
        Create a validation rule on Opportunity to ensure Amount is greater than 0
        when Stage is Closed Won. Display error message "Amount must be positive for closed opportunities".
      `;

      const result = detector.detectChangeType(ticketContent);

      expect(result.primaryType).toBe(ChangeType.VALIDATION_RULE);
      expect(result.detectedTypes).toContain(ChangeType.VALIDATION_RULE);
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.metadata.keywords).toContain('validation rule');
      expect(result.metadata.keywords).toContain('error message');
      expect(result.metadata.objectNames).toContain('Opportunity');
      expect(result.metadata.fieldNames).toContain('Amount');
    });

    it('should detect multiple change types and rank them', () => {
      const ticketContent = `
        Create a new custom field on Account, then update the page layout to show it.
        Also write an Apex trigger to populate this field automatically.
        The field should be visible based on user profile permissions.
      `;

      const result = detector.detectChangeType(ticketContent);

      expect(result.detectedTypes).toContain(ChangeType.FIELD);
      expect(result.detectedTypes).toContain(ChangeType.LAYOUT);
      expect(result.detectedTypes).toContain(ChangeType.APEX);
      expect(result.detectedTypes).toContain(ChangeType.PROFILE);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.metadata.objectNames).toContain('Account');
    });

    it('should handle unknown change types', () => {
      const ticketContent = `
        This is a generic request without specific Salesforce terminology.
        Just need some general updates.
      `;

      const result = detector.detectChangeType(ticketContent);

      expect(result.primaryType).toBe(ChangeType.UNKNOWN);
      expect(result.confidence).toBe(0);
      expect(result.metadata.keywords).toHaveLength(0);
    });

    it('should detect process builder changes', () => {
      const ticketContent = `
        Create a process builder on Lead object with criteria when Lead Status changes.
        Add immediate action to send email alert and scheduled action after 2 days.
      `;

      const result = detector.detectChangeType(ticketContent);

      expect(result.primaryType).toBe(ChangeType.PROCESS_BUILDER);
      expect(result.detectedTypes).toContain(ChangeType.PROCESS_BUILDER);
      expect(result.metadata.keywords).toContain('process builder');
      expect(result.metadata.keywords).toContain('scheduled action');
    });

    it('should detect lightning component changes', () => {
      const ticketContent = `
        Build a Lightning Web Component for displaying account hierarchy.
        The LWC should use wire service to fetch data and include proper error handling.
      `;

      const result = detector.detectChangeType(ticketContent);

      expect(result.primaryType).toBe(ChangeType.LIGHTNING_COMPONENT);
      expect(result.detectedTypes).toContain(ChangeType.LIGHTNING_COMPONENT);
      expect(result.metadata.keywords).toContain('lwc');
    });

    it('should detect custom object creation', () => {
      const ticketContent = `
        Create a new custom object called Project__c with fields for project name,
        start date, and status. Set up object relationships with Account.
      `;

      const result = detector.detectChangeType(ticketContent);

      expect(result.primaryType).toBe(ChangeType.CUSTOM_OBJECT);
      expect(result.detectedTypes).toContain(ChangeType.CUSTOM_OBJECT);
      expect(result.metadata.keywords).toContain('custom object');
      expect(result.metadata.objectNames).toContain('Project__c');
      expect(result.metadata.objectNames).toContain('Account');
    });
  });

  describe('determineOptimalPreviewFormat', () => {
    it('should return diagram for flow types', () => {
      expect(detector.determineOptimalPreviewFormat(ChangeType.FLOW)).toBe('diagram');
      expect(detector.determineOptimalPreviewFormat(ChangeType.PROCESS_BUILDER)).toBe('diagram');
      expect(detector.determineOptimalPreviewFormat(ChangeType.WORKFLOW)).toBe('diagram');
      expect(detector.determineOptimalPreviewFormat(ChangeType.APPROVAL_PROCESS)).toBe('diagram');
    });

    it('should return code-diff for code types', () => {
      expect(detector.determineOptimalPreviewFormat(ChangeType.APEX)).toBe('code-diff');
      expect(detector.determineOptimalPreviewFormat(ChangeType.TRIGGER)).toBe('code-diff');
      expect(detector.determineOptimalPreviewFormat(ChangeType.VALIDATION_RULE)).toBe('code-diff');
    });

    it('should return mockup for UI types', () => {
      expect(detector.determineOptimalPreviewFormat(ChangeType.FIELD)).toBe('mockup');
      expect(detector.determineOptimalPreviewFormat(ChangeType.LAYOUT)).toBe('mockup');
      expect(detector.determineOptimalPreviewFormat(ChangeType.LIGHTNING_COMPONENT)).toBe('mockup');
      expect(detector.determineOptimalPreviewFormat(ChangeType.REPORT)).toBe('mockup');
      expect(detector.determineOptimalPreviewFormat(ChangeType.DASHBOARD)).toBe('mockup');
    });

    it('should return table for permission types', () => {
      expect(detector.determineOptimalPreviewFormat(ChangeType.PERMISSION_SET)).toBe('table');
      expect(detector.determineOptimalPreviewFormat(ChangeType.PROFILE)).toBe('table');
    });

    it('should return dependency-graph for object types', () => {
      expect(detector.determineOptimalPreviewFormat(ChangeType.CUSTOM_OBJECT)).toBe('dependency-graph');
    });

    it('should return text for unknown types', () => {
      expect(detector.determineOptimalPreviewFormat(ChangeType.UNKNOWN)).toBe('text');
    });
  });
});