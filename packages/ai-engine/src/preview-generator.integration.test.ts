import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PreviewGenerator } from './preview-generator';
import { ChangeDetector } from './change-detector';
import { PreviewFormat } from '@agentris/shared';

describe('Preview Generator - E2E Integration', () => {
  let generator: PreviewGenerator;
  let detector: ChangeDetector;

  beforeAll(() => {
    generator = new PreviewGenerator();
    detector = new ChangeDetector();
  });

  describe('Full workflow integration', () => {
    it('should detect field change and generate appropriate preview', async () => {
      const ticketContent = `
        Add a new field called "Customer Priority" to the Account object.
        This should be a picklist field with values: High, Medium, Low.
        Make this field required and add a help text: "Select the customer priority level".
      `;

      // Step 1: Detect change type
      const detectionResult = detector.detectChangeType(ticketContent);
      expect(detectionResult.type).toBe('field');
      expect(detectionResult.confidence).toBeGreaterThan(0.7);

      // Step 2: Determine optimal format
      const optimalFormat = detector.determineOptimalPreviewFormat(detectionResult.type);
      expect(['mockup', 'table']).toContain(optimalFormat);

      // Step 3: Generate preview
      const preview = await generator.generatePreview({
        ticketId: 'test-123',
        ticketContent,
        format: optimalFormat as PreviewFormat,
      });

      expect(preview).toBeDefined();
      expect(preview.format).toBe(optimalFormat);
      expect(preview.data).toBeDefined();
      expect(preview.availableFormats).toContain(optimalFormat);
    });

    it('should detect flow change and generate diagram preview', async () => {
      const ticketContent = `
        Create an approval process for Opportunities over $100,000.
        The flow should route to the regional manager first, then to the VP of Sales.
        If approved by both, update the opportunity stage to "Approved".
        Send email notifications at each step.
      `;

      // Step 1: Detect change type
      const detectionResult = detector.detectChangeType(ticketContent);
      expect(detectionResult.type).toBe('flow');
      expect(detectionResult.confidence).toBeGreaterThan(0.7);

      // Step 2: Generate preview with optimal format
      const preview = await generator.generatePreview({
        ticketId: 'test-456',
        ticketContent,
      });

      expect(preview.format).toBe('diagram');
      expect(preview.data.type).toBe('diagram');
      
      // Verify diagram data structure
      const diagramData = preview.data as any;
      expect(diagramData.mermaidSyntax).toBeDefined();
      expect(diagramData.nodes).toBeInstanceOf(Array);
      expect(diagramData.edges).toBeInstanceOf(Array);
    });

    it('should detect validation rule and generate code-diff preview', async () => {
      const ticketContent = `
        Add a validation rule to prevent closing opportunities without a close reason.
        The rule should check that the Close_Reason__c field is not blank when 
        the stage is changed to "Closed Won" or "Closed Lost".
        Error message: "Please provide a close reason before closing the opportunity."
      `;

      const detectionResult = detector.detectChangeType(ticketContent);
      expect(detectionResult.type).toBe('validationRule');

      const preview = await generator.generatePreview({
        ticketId: 'test-789',
        ticketContent,
      });

      expect(['code-diff', 'text']).toContain(preview.format);
      expect(preview.data).toBeDefined();
    });

    it('should handle complex multi-object dependencies', async () => {
      const ticketContent = `
        Create a master-detail relationship between Account and a new custom object 
        called "Service Agreement". The Service Agreement should have fields for 
        start date, end date, and total value. Add a roll-up summary field on 
        Account to calculate the total value of all service agreements.
      `;

      const detectionResult = detector.detectChangeType(ticketContent);
      expect(['object', 'field']).toContain(detectionResult.type);

      const preview = await generator.generatePreview({
        ticketId: 'test-complex',
        ticketContent,
        format: 'dependency-graph',
      });

      expect(preview.format).toBe('dependency-graph');
      
      const depData = preview.data as any;
      expect(depData.objects).toBeInstanceOf(Array);
      expect(depData.relationships).toBeInstanceOf(Array);
      expect(depData.mermaidSyntax).toContain('graph');
    });

    it('should support format switching for same content', async () => {
      const ticketContent = `
        Update the Lead conversion process to include a new custom field 
        for "Lead Source Detail" that maps to the Opportunity.
      `;

      // Generate in default format
      const preview1 = await generator.generatePreview({
        ticketId: 'test-switch',
        ticketContent,
      });

      const firstFormat = preview1.format;

      // Switch to different format
      const alternativeFormat = preview1.availableFormats.find(f => f !== firstFormat);
      expect(alternativeFormat).toBeDefined();

      const preview2 = await generator.generatePreview({
        ticketId: 'test-switch',
        ticketContent,
        format: alternativeFormat,
      });

      expect(preview2.format).toBe(alternativeFormat);
      expect(preview2.format).not.toBe(firstFormat);
      expect(preview2.data.type).toBe(alternativeFormat);
    });

    it('should handle ambiguous requests gracefully', async () => {
      const ticketContent = 'Make some changes to improve the system.';

      const detectionResult = detector.detectChangeType(ticketContent);
      expect(detectionResult.confidence).toBeLessThan(0.5);

      const preview = await generator.generatePreview({
        ticketId: 'test-ambiguous',
        ticketContent,
      });

      // Should default to text format for ambiguous content
      expect(preview.format).toBe('text');
      expect(preview.data.type).toBe('text');
    });

    it('should generate all available format types', async () => {
      const formats: PreviewFormat[] = [
        'diagram',
        'mockup', 
        'code-diff',
        'dependency-graph',
        'table',
        'text'
      ];

      for (const format of formats) {
        const ticketContent = `Test content for ${format} format generation`;
        
        const preview = await generator.generatePreview({
          ticketId: `test-format-${format}`,
          ticketContent,
          format,
        });

        expect(preview.format).toBe(format);
        expect(preview.data.type).toBe(format);
        expect(preview.data).toBeDefined();
      }
    });
  });

  describe('Error handling', () => {
    it('should handle empty ticket content', async () => {
      const preview = await generator.generatePreview({
        ticketId: 'test-empty',
        ticketContent: '',
      });

      expect(preview.format).toBe('text');
      expect(preview.data).toBeDefined();
    });

    it('should handle very long ticket content', async () => {
      const longContent = 'Add a field. '.repeat(1000);
      
      const preview = await generator.generatePreview({
        ticketId: 'test-long',
        ticketContent: longContent,
      });

      expect(preview).toBeDefined();
      expect(preview.format).toBeDefined();
      expect(preview.data).toBeDefined();
    });

    it('should handle special characters in content', async () => {
      const specialContent = `
        Add a field called "Test<Field>" with formula: 
        IF(Amount > 1000, "High", "Low") && Status != 'Closed'
        <script>alert('test')</script>
      `;

      const preview = await generator.generatePreview({
        ticketId: 'test-special',
        ticketContent: specialContent,
      });

      expect(preview).toBeDefined();
      // Verify no script tags in output
      const jsonStr = JSON.stringify(preview.data);
      expect(jsonStr).not.toContain('<script>');
      expect(jsonStr).not.toContain('alert(');
    });
  });

  describe('Performance', () => {
    it('should generate preview within reasonable time', async () => {
      const ticketContent = 'Add a new required email field to Contact object.';
      
      const startTime = Date.now();
      const preview = await generator.generatePreview({
        ticketId: 'test-perf',
        ticketContent,
      });
      const endTime = Date.now();

      expect(preview).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent preview generations', async () => {
      const tickets = [
        { id: 'concurrent-1', content: 'Add field to Account' },
        { id: 'concurrent-2', content: 'Create validation rule' },
        { id: 'concurrent-3', content: 'Build approval flow' },
      ];

      const promises = tickets.map(ticket =>
        generator.generatePreview({
          ticketId: ticket.id,
          ticketContent: ticket.content,
        })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.format).toBeDefined();
        expect(result.data).toBeDefined();
      });
    });
  });

  afterAll(() => {
    // Cleanup if needed
  });
});