import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClarificationGenerator } from './clarification-generator';
import { LLMService } from './llm-service';
import type { Analysis } from '@agentris/db';

vi.mock('./llm-service');

describe('ClarificationGenerator', () => {
  let generator: ClarificationGenerator;
  let mockLLMService: any;

  beforeEach(() => {
    mockLLMService = {
      generateResponse: vi.fn()
    };
    generator = new ClarificationGenerator(mockLLMService);
  });

  describe('generateQuestions', () => {
    it('should generate questions from analysis findings', async () => {
      const analysis: Partial<Analysis> = {
        findings: JSON.stringify({
          vagueTerms: [
            { term: 'soon', reason: 'No specific timeline provided' }
          ],
          missingDetails: [
            { area: 'data migration', description: 'No source system specified' }
          ]
        }),
        patterns: 'User management system integration'
      };

      mockLLMService.generateResponse.mockResolvedValueOnce({
        content: JSON.stringify([
          {
            question: 'What is the specific timeline for implementation?',
            ambiguityArea: 'Vague term: "soon"',
            importanceScore: 0.9,
            impactLevel: 'high',
            requirementDependency: []
          },
          {
            question: 'Which source system will data be migrated from?',
            ambiguityArea: 'Missing detail: data migration',
            importanceScore: 0.8,
            impactLevel: 'high',
            requirementDependency: ['data mapping']
          }
        ])
      });

      // Mock ranking response
      mockLLMService.generateResponse.mockResolvedValueOnce({
        content: JSON.stringify([
          {
            question: 'What is the specific timeline for implementation?',
            score: 0.95,
            impactLevel: 'high',
            reason: 'Critical for project planning'
          },
          {
            question: 'Which source system will data be migrated from?',
            score: 0.85,
            impactLevel: 'high',
            reason: 'Required for data mapping'
          }
        ])
      });

      const questions = await generator.generateQuestions(analysis as Analysis, {
        minQuestions: 2,
        maxQuestions: 5,
        includeSalesforceTerminology: false
      });

      expect(questions).toHaveLength(2);
      expect(questions[0].question).toContain('timeline');
      expect(questions[0].importanceScore).toBeGreaterThan(0.8);
    });

    it('should return empty array when no findings exist', async () => {
      const analysis: Partial<Analysis> = {
        findings: null,
        patterns: null
      };

      const questions = await generator.generateQuestions(analysis as Analysis);
      expect(questions).toEqual([]);
    });

    it('should enhance questions with Salesforce terminology', async () => {
      const analysis: Partial<Analysis> = {
        findings: JSON.stringify({
          vagueTerms: [
            { term: 'user data', reason: 'Unclear which user fields' }
          ]
        })
      };

      mockLLMService.generateResponse.mockResolvedValueOnce({
        content: JSON.stringify([
          {
            question: 'Which user data fields need to be included?',
            ambiguityArea: 'Vague term: "user data"',
            importanceScore: 0.7,
            impactLevel: 'medium',
            requirementDependency: []
          }
        ])
      });

      // Mock Salesforce terminology enhancement
      mockLLMService.generateResponse.mockResolvedValueOnce({
        content: JSON.stringify([
          {
            question: 'Which User object fields (e.g., Profile, Role, Permission Sets) need to be included?',
            originalQuestion: 'Which user data fields need to be included?',
            changesApplied: 'Added Salesforce User object context'
          }
        ])
      });

      // Mock ranking
      mockLLMService.generateResponse.mockResolvedValueOnce({
        content: JSON.stringify([
          {
            question: 'Which User object fields',
            score: 0.75,
            impactLevel: 'medium'
          }
        ])
      });

      const questions = await generator.generateQuestions(analysis as Analysis, {
        includeSalesforceTerminology: true
      });

      expect(mockLLMService.generateResponse).toHaveBeenCalledTimes(3);
      expect(questions[0].question).toContain('User object');
    });

    it('should limit questions to maxQuestions', async () => {
      const analysis: Partial<Analysis> = {
        findings: JSON.stringify({
          vagueTerms: Array(10).fill(null).map((_, i) => ({
            term: `term${i}`,
            reason: `reason${i}`
          }))
        })
      };

      const manyQuestions = Array(10).fill(null).map((_, i) => ({
        question: `Question ${i}?`,
        ambiguityArea: `Area ${i}`,
        importanceScore: 1 - (i * 0.1),
        impactLevel: 'medium',
        requirementDependency: []
      }));

      mockLLMService.generateResponse.mockResolvedValueOnce({
        content: JSON.stringify(manyQuestions)
      });

      mockLLMService.generateResponse.mockResolvedValueOnce({
        content: JSON.stringify(manyQuestions)
      });

      const questions = await generator.generateQuestions(analysis as Analysis, {
        maxQuestions: 3
      });

      expect(questions).toHaveLength(3);
    });
  });

  describe('rankQuestions', () => {
    it('should sort questions by importance score', async () => {
      const questions = [
        {
          question: 'Question 1',
          ambiguityArea: 'Area 1',
          importanceScore: 0.5,
          impactLevel: 'medium' as const,
          requirementDependency: []
        },
        {
          question: 'Question 2',
          ambiguityArea: 'Area 2',
          importanceScore: 0.3,
          impactLevel: 'low' as const,
          requirementDependency: []
        },
        {
          question: 'Question 3 with security',
          ambiguityArea: 'Area 3',
          importanceScore: 0.9,
          impactLevel: 'high' as const,
          requirementDependency: []
        }
      ];

      mockLLMService.generateResponse.mockResolvedValueOnce({
        content: JSON.stringify([
          { question: 'Question 3 with security', score: 0.95, impactLevel: 'high' },
          { question: 'Question 1', score: 0.6, impactLevel: 'medium' },
          { question: 'Question 2', score: 0.3, impactLevel: 'low' }
        ])
      });

      const ranked = await generator.rankQuestions(questions, {});

      expect(ranked[0].question).toBe('Question 3 with security');
      expect(ranked[0].importanceScore).toBeGreaterThan(0.8);
      expect(ranked[2].question).toBe('Question 2');
    });

    it('should handle ranking failures gracefully', async () => {
      const questions = [
        {
          question: 'Question 1',
          ambiguityArea: 'Area 1',
          importanceScore: 0,
          impactLevel: 'medium' as const,
          requirementDependency: []
        },
        {
          question: 'Question 2',
          ambiguityArea: 'Area 2',
          importanceScore: 0,
          impactLevel: 'high' as const,
          requirementDependency: []
        }
      ];

      mockLLMService.generateResponse.mockResolvedValueOnce({
        content: 'Invalid JSON response'
      });

      const ranked = await generator.rankQuestions(questions, {});

      // Should apply algorithmic ranking based on impact level
      expect(ranked[0].impactLevel).toBe('high');
      expect(ranked[0].importanceScore).toBeGreaterThan(0.5);
    });

    it('should rank questions with critical keywords higher', async () => {
      const questions = [
        {
          question: 'What color should the button be?',
          ambiguityArea: 'UI design',
          importanceScore: 0,
          impactLevel: 'low' as const,
          requirementDependency: []
        },
        {
          question: 'How should authentication be handled?',
          ambiguityArea: 'Security',
          importanceScore: 0,
          impactLevel: 'high' as const,
          requirementDependency: []
        },
        {
          question: 'What is the data migration strategy?',
          ambiguityArea: 'Data',
          importanceScore: 0,
          impactLevel: 'high' as const,
          requirementDependency: ['database']
        }
      ];

      mockLLMService.generateResponse.mockResolvedValueOnce({
        content: JSON.stringify([
          { question: 'How should authentication be handled?', score: 0.9, impactLevel: 'high' },
          { question: 'What is the data migration strategy?', score: 0.85, impactLevel: 'high' },
          { question: 'What color should the button be?', score: 0.2, impactLevel: 'low' }
        ])
      });

      const ranked = await generator.rankQuestions(questions, {});

      // Authentication and data migration should rank higher
      expect(ranked[0].question).toContain('authentication');
      expect(ranked[1].question).toContain('data migration');
      expect(ranked[2].question).toContain('color');
    });

    it('should consider dependency count in ranking', async () => {
      const questions = [
        {
          question: 'Question with many dependencies',
          ambiguityArea: 'Complex',
          importanceScore: 0,
          impactLevel: 'medium' as const,
          requirementDependency: ['dep1', 'dep2', 'dep3']
        },
        {
          question: 'Question with no dependencies',
          ambiguityArea: 'Simple',
          importanceScore: 0,
          impactLevel: 'medium' as const,
          requirementDependency: []
        }
      ];

      mockLLMService.generateResponse.mockResolvedValueOnce({
        content: JSON.stringify([
          { question: 'Question with many dependencies', score: 0.7, impactLevel: 'medium' },
          { question: 'Question with no dependencies', score: 0.6, impactLevel: 'medium' }
        ])
      });

      const ranked = await generator.rankQuestions(questions, {});

      expect(ranked[0].requirementDependency.length).toBe(3);
      expect(ranked[0].importanceScore).toBeGreaterThan(ranked[1].importanceScore);
    });
  });
});