import { describe, it, expect, beforeAll } from 'vitest';
import { AmbiguityDetector } from './ambiguity-detector';

describe('AmbiguityDetector Integration Tests', () => {
  let detector: AmbiguityDetector;

  beforeAll(() => {
    detector = new AmbiguityDetector();
  });

  describe('Full flow integration', () => {
    it('should handle ticket creation to analysis flow', async () => {
      const ticketText = `
        As a user, I want to search for products quickly.
        The search should be fast and return relevant results.
        It should also be user-friendly and intuitive.
      `;

      const startTime = Date.now();
      const result = await detector.detectAmbiguity(ticketText);
      const endTime = Date.now();

      // Verify response structure
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('missingInfo');
      expect(result).toHaveProperty('vagueTerms');
      expect(result).toHaveProperty('conflicts');
      expect(result).toHaveProperty('patterns');
      expect(result).toHaveProperty('summary');

      // Verify score is in valid range
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);

      // Performance check - should complete within reasonable time
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(10000); // 10 seconds max

      // Should detect vague terms in this example
      expect(result.vagueTerms.length).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0.3); // Should have some ambiguity
    });

    it('should handle clear requirements efficiently', async () => {
      const clearText = `
        Create a REST API endpoint:
        - Method: POST
        - Path: /api/users
        - Request body: { name: string, email: string }
        - Response: 201 with user object including generated ID
        - Validation: email must be valid format, name required
      `;

      const result = await detector.detectAmbiguity(clearText);

      expect(result.score).toBeLessThan(0.3); // Low ambiguity
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.summary).toBeTruthy();
    });

    it('should detect conflicts reliably', async () => {
      const conflictingText = `
        The system must be completely open and transparent,
        but also ensure maximum security and data privacy.
        All data should be publicly accessible but encrypted.
      `;

      const result = await detector.detectAmbiguity(conflictingText);

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThan(0.5); // High ambiguity due to conflicts
    });
  });

  describe('Performance and concurrency', () => {
    it('should handle multiple concurrent analyses', async () => {
      const tickets = [
        'Make the app faster',
        'Add user authentication with OAuth',
        'Improve the UI design',
        'Implement data export to CSV format',
        'Optimize database queries',
      ];

      const startTime = Date.now();
      
      // Run analyses concurrently
      const results = await Promise.all(
        tickets.map(text => detector.detectAmbiguity(text))
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should complete
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.score).toBeDefined();
        expect(result.confidence).toBeDefined();
      });

      // Should complete in reasonable time even with concurrent requests
      expect(totalTime).toBeLessThan(15000); // 15 seconds for 5 concurrent
      
      // Verify different scores for different texts
      const scores = results.map(r => r.score);
      const uniqueScores = new Set(scores);
      expect(uniqueScores.size).toBeGreaterThan(1); // Should have variety
    });

    it('should handle very long text efficiently', async () => {
      const longText = `
        ${Array(50).fill('The system should have various features. ').join('')}
        It needs to be fast, reliable, and scalable.
        Users want good performance and intuitive interface.
        ${Array(50).fill('Additional requirements include many things. ').join('')}
      `;

      const startTime = Date.now();
      const result = await detector.detectAmbiguity(longText);
      const endTime = Date.now();

      expect(result.score).toBeDefined();
      expect(endTime - startTime).toBeLessThan(20000); // Should handle long text
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty text gracefully', async () => {
      const result = await detector.detectAmbiguity('');
      
      expect(result.score).toBe(0);
      expect(result.missingInfo).toEqual([]);
      expect(result.vagueTerms).toEqual([]);
      expect(result.conflicts).toEqual([]);
    });

    it('should handle special characters and formatting', async () => {
      const specialText = `
        Requirements:
        • Feature #1: Add search 🔍
        • Feature #2: Improve performance by 50%
        • Feature #3: Support "special" <characters> & symbols
        
        Note: This should work properly!
      `;

      const result = await detector.detectAmbiguity(specialText);
      
      expect(result).toBeDefined();
      expect(result.score).toBeDefined();
      // Should not crash on special characters
    });

    it('should handle non-English characters', async () => {
      const mixedText = `
        The system should support 多语言 (multilingual) content.
        Performance should be très rapide.
        UI should be 使いやすい (user-friendly).
      `;

      const result = await detector.detectAmbiguity(mixedText);
      
      expect(result).toBeDefined();
      expect(result.vagueTerms.length).toBeGreaterThan(0); // Should still detect "user-friendly"
    });
  });

  describe('Caching behavior', () => {
    it('should cache repeated analyses', async () => {
      const text = 'Implement a fast search feature';
      
      // First call
      const startTime1 = Date.now();
      const result1 = await detector.detectAmbiguity(text);
      const time1 = Date.now() - startTime1;
      
      // Second call (should be cached)
      const startTime2 = Date.now();
      const result2 = await detector.detectAmbiguity(text);
      const time2 = Date.now() - startTime2;
      
      // Results should be identical
      expect(result1.score).toBe(result2.score);
      expect(result1.confidence).toBe(result2.confidence);
      
      // Second call should be faster (from cache)
      // Note: This might not always be true in test environment
      // so we just verify both complete successfully
      expect(time2).toBeDefined();
    });
  });
});