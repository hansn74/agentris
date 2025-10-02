import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TicketService } from './ticket';
import { JiraClient } from '../client';
import type { JiraComment } from '../types';

vi.mock('../client');

describe('TicketService - Enhanced Clarification Features', () => {
  let ticketService: TicketService;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      searchIssues: vi.fn(),
      getIssue: vi.fn(),
      getComments: vi.fn(),
      addComment: vi.fn(),
      updateIssue: vi.fn(),
      getProjects: vi.fn()
    };
    ticketService = new TicketService(mockClient);
  });

  describe('addComment', () => {
    it('should add a comment to a ticket', async () => {
      mockClient.addComment.mockResolvedValueOnce({
        id: 'comment-123',
        body: 'Test comment',
        created: '2024-01-01T00:00:00Z'
      });

      const result = await ticketService.addComment('JIRA-123', {
        body: 'Test comment'
      });

      expect(mockClient.addComment).toHaveBeenCalledWith('JIRA-123', 'Test comment');
      expect(result.id).toBe('comment-123');
    });
  });

  describe('postClarificationQuestions', () => {
    it('should post clarification questions with AI-CLARIFIED tag', async () => {
      const questions = [
        'What is the expected timeline?',
        'Which users should have access?',
        'What happens on error?'
      ];

      mockClient.addComment.mockResolvedValueOnce({
        id: 'comment-456',
        created: '2024-01-01T00:00:00Z'
      });

      const result = await ticketService.postClarificationQuestions(
        'JIRA-123',
        questions,
        true
      );

      expect(mockClient.addComment).toHaveBeenCalledWith(
        'JIRA-123',
        expect.stringContaining('[AI-CLARIFIED]')
      );
      expect(mockClient.addComment).toHaveBeenCalledWith(
        'JIRA-123',
        expect.stringContaining('1. What is the expected timeline?')
      );
      expect(mockClient.addComment).toHaveBeenCalledWith(
        'JIRA-123',
        expect.stringContaining('2. Which users should have access?')
      );
      expect(mockClient.addComment).toHaveBeenCalledWith(
        'JIRA-123',
        expect.stringContaining('3. What happens on error?')
      );
      expect(result.id).toBe('comment-456');
    });

    it('should post questions without tag when includeTag is false', async () => {
      const questions = ['Question 1?'];

      mockClient.addComment.mockResolvedValueOnce({
        id: 'comment-789'
      });

      await ticketService.postClarificationQuestions(
        'JIRA-123',
        questions,
        false
      );

      expect(mockClient.addComment).toHaveBeenCalledWith(
        'JIRA-123',
        expect.not.stringContaining('[AI-CLARIFIED]')
      );
      expect(mockClient.addComment).toHaveBeenCalledWith(
        'JIRA-123',
        expect.stringContaining('Clarification Questions:')
      );
    });

    it('should include URL when JIRA_BASE_URL is set', async () => {
      const originalEnv = process.env.JIRA_BASE_URL;
      process.env.JIRA_BASE_URL = 'https://jira.example.com';

      mockClient.addComment.mockResolvedValueOnce({
        id: 'comment-999'
      });

      const result = await ticketService.postClarificationQuestions(
        'JIRA-123',
        ['Question?'],
        true
      );

      expect(result.url).toBe('https://jira.example.com/browse/JIRA-123?focusedCommentId=comment-999');

      process.env.JIRA_BASE_URL = originalEnv;
    });
  });

  describe('findTaggedComments', () => {
    it('should find comments with specific tag', async () => {
      const mockComments = [
        {
          id: '1',
          body: 'Regular comment',
          created: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          body: '[AI-CLARIFIED] Questions here',
          created: '2024-01-02T00:00:00Z'
        },
        {
          id: '3',
          body: 'Another regular comment',
          created: '2024-01-03T00:00:00Z'
        },
        {
          id: '4',
          body: '[AI-CLARIFIED] More questions',
          created: '2024-01-04T00:00:00Z'
        }
      ];

      mockClient.getComments.mockResolvedValueOnce({
        comments: mockComments,
        total: 4
      });

      const result = await ticketService.findTaggedComments('JIRA-123', 'AI-CLARIFIED');

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('2');
      expect(result[1]?.id).toBe('4');
    });

    it('should handle ADF formatted comments', async () => {
      const mockComments = [
        {
          id: '1',
          body: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: '[AI-CLARIFIED] Questions in ADF' }
                ]
              }
            ]
          },
          created: '2024-01-01T00:00:00Z'
        }
      ];

      mockClient.getComments.mockResolvedValueOnce({
        comments: mockComments,
        total: 1
      });

      const result = await ticketService.findTaggedComments('JIRA-123', 'AI-CLARIFIED');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('1');
    });
  });

  describe('parseAnswersFromComments', () => {
    it('should parse numbered answers from subsequent comments', async () => {
      const mockComments = [
        {
          id: 'clarif-1',
          body: '[AI-CLARIFIED] Clarification Questions:\n\n1. What is the timeline?\n2. Who are the users?\n3. What about errors?',
          created: '2024-01-01T00:00:00Z'
        },
        {
          id: 'answer-1',
          body: 'Answers to clarifications:\n1. Timeline is 2 weeks\n2. All authenticated users\n3. Log and retry',
          created: '2024-01-02T00:00:00Z'
        }
      ];

      mockClient.getComments.mockResolvedValueOnce({
        comments: mockComments,
        total: 2
      });

      const answers = await ticketService.parseAnswersFromComments('JIRA-123', 'clarif-1');

      expect(answers.size).toBe(3);
      expect(answers.get('What is the timeline?')).toBe('Timeline is 2 weeks');
      expect(answers.get('Who are the users?')).toBe('All authenticated users');
      expect(answers.get('What about errors?')).toBe('Log and retry');
    });

    it('should parse answers with Q notation', async () => {
      const mockComments = [
        {
          id: 'clarif-1',
          body: '1. First question?\n2. Second question?',
          created: '2024-01-01T00:00:00Z'
        },
        {
          id: 'answer-1',
          body: 'Q1: Answer to first\nQ2: Answer to second',
          created: '2024-01-02T00:00:00Z'
        }
      ];

      mockClient.getComments.mockResolvedValueOnce({
        comments: mockComments,
        total: 2
      });

      const answers = await ticketService.parseAnswersFromComments('JIRA-123', 'clarif-1');

      expect(answers.size).toBe(2);
      expect(answers.get('First question?')).toBe('Answer to first');
      expect(answers.get('Second question?')).toBe('Answer to second');
    });

    it('should handle partial answers', async () => {
      const mockComments = [
        {
          id: 'clarif-1',
          body: '1. Question one?\n2. Question two?\n3. Question three?',
          created: '2024-01-01T00:00:00Z'
        },
        {
          id: 'answer-1',
          body: 'I can answer #1: First answer',
          created: '2024-01-02T00:00:00Z'
        },
        {
          id: 'answer-2',
          body: 'For question 3, the answer is: Third answer',
          created: '2024-01-03T00:00:00Z'
        }
      ];

      mockClient.getComments.mockResolvedValueOnce({
        comments: mockComments,
        total: 3
      });

      const answers = await ticketService.parseAnswersFromComments('JIRA-123', 'clarif-1');

      expect(answers.size).toBe(2);
      expect(answers.get('Question one?')).toBe('First answer');
      expect(answers.get('Question two?')).toBeUndefined();
      expect(answers.get('Question three?')).toBe('Third answer');
    });

    it('should return empty map if clarification comment not found', async () => {
      mockClient.getComments.mockResolvedValueOnce({
        comments: [],
        total: 0
      });

      const answers = await ticketService.parseAnswersFromComments('JIRA-123', 'nonexistent');

      expect(answers.size).toBe(0);
    });
  });

  describe('updateTicketWithAnswerStatus', () => {
    it('should add clarifications-answered label when all answered', async () => {
      mockClient.updateIssue.mockResolvedValueOnce({});

      await ticketService.updateTicketWithAnswerStatus('JIRA-123', 3, 3);

      expect(mockClient.updateIssue).toHaveBeenCalledWith('JIRA-123', {
        update: {
          labels: [{ add: 'clarifications-answered' }]
        }
      });
    });

    it('should add clarifications-pending label when some unanswered', async () => {
      mockClient.updateIssue.mockResolvedValueOnce({});

      await ticketService.updateTicketWithAnswerStatus('JIRA-123', 1, 3);

      expect(mockClient.updateIssue).toHaveBeenCalledWith('JIRA-123', {
        update: {
          labels: [{ add: 'clarifications-pending' }]
        }
      });
    });

    it('should not throw on update failure', async () => {
      mockClient.updateIssue.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        ticketService.updateTicketWithAnswerStatus('JIRA-123', 1, 3)
      ).resolves.not.toThrow();
    });
  });

  describe('extractQuestionsFromComment', () => {
    it('should extract numbered questions with dots', () => {
      const body = '1. First question?\n2. Second question?\n3. Third question?';
      const questions = (ticketService as any).extractQuestionsFromComment(body);

      expect(questions).toEqual([
        'First question?',
        'Second question?',
        'Third question?'
      ]);
    });

    it('should extract questions with Q notation', () => {
      const body = 'Q1: What about this?\nQ2: How about that?\nQ3: Why this way?';
      const questions = (ticketService as any).extractQuestionsFromComment(body);

      expect(questions).toEqual([
        'What about this?',
        'How about that?',
        'Why this way?'
      ]);
    });

    it('should handle multi-line questions', () => {
      const body = '1. This is a long question\nthat spans multiple lines?\n2. Short question?';
      const questions = (ticketService as any).extractQuestionsFromComment(body);

      expect(questions.length).toBe(2);
      expect(questions[0]).toContain('This is a long question');
      expect(questions[1]).toBe('Short question?');
    });
  });
});