import { describe, it, expect } from 'vitest';
import { SalesforceTerminologyValidator } from './salesforce-terminology';

describe('SalesforceTerminologyValidator', () => {
  const validator = new SalesforceTerminologyValidator();

  describe('isStandardObject', () => {
    it('should identify standard Salesforce objects', () => {
      expect(validator.isStandardObject('Account')).toBe(true);
      expect(validator.isStandardObject('Contact')).toBe(true);
      expect(validator.isStandardObject('Lead')).toBe(true);
      expect(validator.isStandardObject('CustomObject__c')).toBe(false);
      expect(validator.isStandardObject('NotAnObject')).toBe(false);
    });
  });

  describe('getStandardFields', () => {
    it('should return standard fields for known objects', () => {
      const accountFields = validator.getStandardFields('Account');
      expect(accountFields).toContain('Name');
      expect(accountFields).toContain('Type');
      expect(accountFields).toContain('OwnerId');

      const contactFields = validator.getStandardFields('Contact');
      expect(contactFields).toContain('FirstName');
      expect(contactFields).toContain('LastName');
      expect(contactFields).toContain('Email');
    });

    it('should return undefined for unknown objects', () => {
      expect(validator.getStandardFields('CustomObject__c')).toBeUndefined();
      expect(validator.getStandardFields('NotAnObject')).toBeUndefined();
    });
  });

  describe('getSalesforceEquivalent', () => {
    it('should map generic terms to Salesforce terms', () => {
      expect(validator.getSalesforceEquivalent('customer')).toBe('Account or Contact');
      expect(validator.getSalesforceEquivalent('deal')).toBe('Opportunity');
      expect(validator.getSalesforceEquivalent('ticket')).toBe('Case');
      expect(validator.getSalesforceEquivalent('workflow')).toBe('Workflow Rule or Flow');
    });

    it('should be case insensitive', () => {
      expect(validator.getSalesforceEquivalent('CUSTOMER')).toBe('Account or Contact');
      expect(validator.getSalesforceEquivalent('Customer')).toBe('Account or Contact');
    });

    it('should return undefined for unknown terms', () => {
      expect(validator.getSalesforceEquivalent('unknown')).toBeUndefined();
    });
  });

  describe('enhanceWithSalesforceContext', () => {
    it('should replace generic terms with Salesforce equivalents', () => {
      const input = 'How should we handle customer data when a deal is closed?';
      const enhanced = validator.enhanceWithSalesforceContext(input);
      expect(enhanced).toContain('Account or Contact');
      expect(enhanced).toContain('Opportunity');
    });

    it('should handle multiple replacements', () => {
      const input = 'The user needs permission to access the workflow';
      const enhanced = validator.enhanceWithSalesforceContext(input);
      expect(enhanced).toContain('User record');
      expect(enhanced).toContain('Permission Set or Profile');
      expect(enhanced).toContain('Workflow Rule or Flow');
    });
  });

  describe('validateApiName', () => {
    it('should validate custom object/field names', () => {
      expect(validator.validateApiName('CustomObject__c')).toEqual({
        valid: true,
        type: 'custom'
      });
      expect(validator.validateApiName('Custom_Field__c')).toEqual({
        valid: true,
        type: 'custom'
      });
    });

    it('should validate standard object names', () => {
      expect(validator.validateApiName('Account')).toEqual({
        valid: true,
        type: 'standard'
      });
      expect(validator.validateApiName('Contact')).toEqual({
        valid: true,
        type: 'standard'
      });
    });

    it('should validate relationship names', () => {
      expect(validator.validateApiName('Account__r')).toEqual({
        valid: true,
        type: 'relationship'
      });
    });

    it('should validate custom metadata names', () => {
      expect(validator.validateApiName('Setting__mdt')).toEqual({
        valid: true,
        type: 'customMetadata'
      });
    });

    it('should suggest valid API names for invalid inputs', () => {
      const result = validator.validateApiName('My Custom Field');
      expect(result.valid).toBe(false);
      expect(result.suggestion).toBe('My_Custom_Field__c');
    });

    it('should handle names that start with numbers', () => {
      const result = validator.validateApiName('123Field');
      expect(result.valid).toBe(false);
      expect(result.suggestion).toBe('Custom_123Field__c');
    });
  });

  describe('detectSalesforceReferences', () => {
    it('should detect standard objects in text', () => {
      const text = 'Update the Account record and create a new Contact for the Lead';
      const detected = validator.detectSalesforceReferences(text);
      expect(detected.objects).toContain('Account');
      expect(detected.objects).toContain('Contact');
      expect(detected.objects).toContain('Lead');
    });

    it('should detect custom API names', () => {
      const text = 'The Custom_Object__c has a field called Special_Field__c and relates via Parent__r';
      const detected = validator.detectSalesforceReferences(text);
      expect(detected.fields).toContain('Custom_Object__c');
      expect(detected.fields).toContain('Special_Field__c');
      expect(detected.fields).toContain('Parent__r');
    });

    it('should detect Salesforce features', () => {
      const text = 'Create a Validation Rule and update the Page Layout. Also need an Apex Trigger.';
      const detected = validator.detectSalesforceReferences(text);
      expect(detected.features).toContain('Validation Rule');
      expect(detected.features).toContain('Page Layout');
      expect(detected.features).toContain('Apex Trigger');
    });

    it('should handle text with multiple references', () => {
      const text = `
        The Account object needs a new Validation Rule.
        Create a custom field Account_Status__c and update the Page Layout.
        Add a Process Builder to update related Contacts.
      `;
      const detected = validator.detectSalesforceReferences(text);
      expect(detected.objects).toContain('Account');
      expect(detected.fields).toContain('Account_Status__c');
      expect(detected.features).toContain('Validation Rule');
      expect(detected.features).toContain('Page Layout');
      expect(detected.features).toContain('Process Builder');
    });
  });
});