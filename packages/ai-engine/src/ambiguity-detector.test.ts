import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AmbiguityDetector } from './ambiguity-detector';
import { LLMService } from './llm-service';

// Mock LLMService
vi.mock('./llm-service', () => ({
  LLMService: vi.fn().mockImplementation(() => ({
    complete: vi.fn(),
  })),
}));

describe('AmbiguityDetector', () => {
  let detector: AmbiguityDetector;
  let mockLLMComplete: any;

  beforeEach(() => {
    detector = new AmbiguityDetector();
    mockLLMComplete = (detector as any).llmService.complete;
  });

  describe('detectPatterns', () => {
    it('should detect missing information patterns', async () => {
      const ticketText = 'As a user, I want to login to the system.';
      const mockResponse = {
        content: JSON.stringify({
          findings: [
            {
              pattern: 'MISSING_ACCEPTANCE_CRITERIA',
              text: 'No acceptance criteria specified',
              severity: 'high',
              suggestion: 'Define specific login success/failure criteria',
            },
            {
              pattern: 'MISSING_INFO',
              text: 'Authentication method not specified',
              severity: 'medium',
              suggestion: 'Specify OAuth, username/password, or SSO',
            },
          ],
        }),
      };

      mockLLMComplete.mockResolvedValueOnce(mockResponse);

      const result = await detector.detectPatterns(ticketText);

      expect(result).toHaveLength(2);
      expect(result[0].pattern).toBe('MISSING_ACCEPTANCE_CRITERIA');
      expect(result[0].severity).toBe('high');
      expect(result[1].pattern).toBe('MISSING_INFO');
    });

    it('should handle empty response gracefully', async () => {
      mockLLMComplete.mockResolvedValueOnce({ content: '{}' });

      const result = await detector.detectPatterns('Some text');

      expect(result).toEqual([]);
    });

    it('should handle LLM errors gracefully', async () => {
      mockLLMComplete.mockRejectedValueOnce(new Error('LLM error'));

      const result = await detector.detectPatterns('Some text');

      expect(result).toEqual([]);
    });
  });

  describe('detectVagueTerms', () => {
    it('should identify vague terms', async () => {
      const ticketText = 'The system should be fast and user-friendly.';
      const mockResponse = {
        content: JSON.stringify({
          vagueTerms: [
            {
              term: 'fast',
              context: 'The system should be fast',
              suggestion: 'Specify response time in milliseconds',
            },
            {
              term: 'user-friendly',
              context: 'The system should be fast and user-friendly',
              suggestion: 'Define specific usability requirements',
            },
          ],
        }),
      };

      mockLLMComplete.mockResolvedValueOnce(mockResponse);

      const result = await detector.detectVagueTerms(ticketText);

      expect(result).toHaveLength(2);
      expect(result[0].term).toBe('fast');
      expect(result[1].term).toBe('user-friendly');
    });
  });

  describe('detectConflicts', () => {
    it('should detect conflicting requirements', async () => {
      const ticketText = 'The system must be highly secure but also allow anonymous access.';
      const mockResponse = {
        content: JSON.stringify({
          conflicts: [
            {
              requirement1: 'highly secure',
              requirement2: 'allow anonymous access',
              description: 'High security typically requires authentication, conflicting with anonymous access',
            },
          ],
        }),
      };

      mockLLMComplete.mockResolvedValueOnce(mockResponse);

      const result = await detector.detectConflicts(ticketText);

      expect(result).toHaveLength(1);
      expect(result[0].requirement1).toBe('highly secure');
      expect(result[0].requirement2).toBe('allow anonymous access');
    });
  });

  describe('detectAmbiguity', () => {
    it('should provide complete ambiguity analysis', async () => {
      const ticketText = 'Build a fast system with good performance.';

      // Mock all three detection methods
      const patternsResponse = {
        content: JSON.stringify({
          findings: [
            {
              pattern: 'UNCLEAR_SCOPE',
              text: 'System type not specified',
              severity: 'high',
            },
          ],
        }),
      };

      const vagueResponse = {
        content: JSON.stringify({
          vagueTerms: [
            {
              term: 'fast',
              context: 'Build a fast system',
              suggestion: 'Define specific performance metrics',
            },
            {
              term: 'good performance',
              context: 'system with good performance',
              suggestion: 'Specify measurable performance criteria',
            },
          ],
        }),
      };

      const conflictsResponse = {
        content: JSON.stringify({ conflicts: [] }),
      };

      const summaryResponse = {
        content: 'High ambiguity detected. The requirements lack specific technical details and measurable criteria. Clarification needed on system type and performance metrics.',
      };

      mockLLMComplete
        .mockResolvedValueOnce(patternsResponse)
        .mockResolvedValueOnce(vagueResponse)
        .mockResolvedValueOnce(conflictsResponse)
        .mockResolvedValueOnce(summaryResponse);

      const result = await detector.detectAmbiguity(ticketText);

      expect(result.missingInfo).toHaveLength(1);
      expect(result.vagueTerms).toHaveLength(2);
      expect(result.conflicts).toHaveLength(0);
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.patterns).toContain('UNCLEAR_SCOPE');
      expect(result.summary).toContain('High ambiguity detected');
    });

    it('should handle low ambiguity tickets', async () => {
      const ticketText = 'Add a button that increments a counter by 1 when clicked.';

      // Mock responses with no issues
      mockLLMComplete
        .mockResolvedValueOnce({ content: JSON.stringify({ findings: [] }) })
        .mockResolvedValueOnce({ content: JSON.stringify({ vagueTerms: [] }) })
        .mockResolvedValueOnce({ content: JSON.stringify({ conflicts: [] }) })
        .mockResolvedValueOnce({ content: 'Clear requirements with no ambiguity detected.' });

      const result = await detector.detectAmbiguity(ticketText);

      expect(result.score).toBe(0);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.missingInfo).toHaveLength(0);
      expect(result.vagueTerms).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe('score calculation', () => {
    it('should calculate appropriate scores for different severity levels', async () => {
      // Test with high severity issues
      const highSeverityResponse = {
        content: JSON.stringify({
          findings: [
            { pattern: 'MISSING_INFO', text: 'Critical info', severity: 'high' },
            { pattern: 'UNCLEAR_SCOPE', text: 'Scope unclear', severity: 'high' },
          ],
        }),
      };

      mockLLMComplete
        .mockResolvedValueOnce(highSeverityResponse)
        .mockResolvedValueOnce({ content: JSON.stringify({ vagueTerms: [] }) })
        .mockResolvedValueOnce({ content: JSON.stringify({ conflicts: [] }) })
        .mockResolvedValueOnce({ content: 'Summary' });

      const highResult = await detector.detectAmbiguity('Text');
      
      // Clear mocks before second test
      mockLLMComplete.mockClear();
      
      // Create new detector instance for clean test
      const detector2 = new AmbiguityDetector();
      const mockLLMComplete2 = (detector2 as any).llmService.complete;
      
      // Test with low severity issues
      const lowSeverityResponse = {
        content: JSON.stringify({
          findings: [
            { pattern: 'MISSING_INFO', text: 'Minor detail', severity: 'low' },
          ],
        }),
      };

      mockLLMComplete2
        .mockResolvedValueOnce(lowSeverityResponse)
        .mockResolvedValueOnce({ content: JSON.stringify({ vagueTerms: [] }) })
        .mockResolvedValueOnce({ content: JSON.stringify({ conflicts: [] }) })
        .mockResolvedValueOnce({ content: 'Summary' });

      const lowResult = await detector2.detectAmbiguity('Text');

      expect(highResult.score).toBeGreaterThan(lowResult.score);
    });

    it('should heavily weight conflicts in scoring', async () => {
      // Test with conflicts
      mockLLMComplete
        .mockResolvedValueOnce({ content: JSON.stringify({ findings: [] }) })
        .mockResolvedValueOnce({ content: JSON.stringify({ vagueTerms: [] }) })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            conflicts: [{ requirement1: 'A', requirement2: 'B', description: 'Conflict' }],
          }),
        })
        .mockResolvedValueOnce({ content: 'Summary' });

      const conflictResult = await detector.detectAmbiguity('Text');

      // Test without conflicts
      mockLLMComplete
        .mockResolvedValueOnce({ content: JSON.stringify({ findings: [] }) })
        .mockResolvedValueOnce({ content: JSON.stringify({ vagueTerms: [] }) })
        .mockResolvedValueOnce({ content: JSON.stringify({ conflicts: [] }) })
        .mockResolvedValueOnce({ content: 'Summary' });

      const noConflictResult = await detector.detectAmbiguity('Text');

      expect(conflictResult.score).toBeGreaterThan(noConflictResult.score);
      expect(conflictResult.score).toBeGreaterThan(0.25); // Conflicts have 0.3 weight
    });
  });
});