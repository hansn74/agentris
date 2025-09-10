import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TicketService } from './ticket';
import { JiraClient } from '../client';
import type { JiraTicket } from '../types';

describe('TicketService', () => {
  let ticketService: TicketService;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      searchIssues: vi.fn(),
      getIssue: vi.fn(),
      getComments: vi.fn(),
      getProjects: vi.fn(),
    };
    ticketService = new TicketService(mockClient as JiraClient);
  });

  describe('fetchUserTickets', () => {
    it('should fetch tickets assigned to current user', async () => {
      const mockResponse = {
        issues: [
          { key: 'TEST-1', fields: { summary: 'Test Issue 1' } },
          { key: 'TEST-2', fields: { summary: 'Test Issue 2' } },
        ],
        total: 2,
      };

      mockClient.searchIssues.mockResolvedValue(mockResponse);

      const result = await ticketService.fetchUserTickets();

      expect(result.tickets).toEqual(mockResponse.issues);
      expect(result.total).toBe(2);
      expect(mockClient.searchIssues).toHaveBeenCalledWith(
        'assignee = currentUser() ORDER BY updated DESC',
        expect.objectContaining({
          maxResults: 50,
          startAt: 0,
        })
      );
    });

    it('should filter by project keys when provided', async () => {
      const mockResponse = { issues: [], total: 0 };
      mockClient.searchIssues.mockResolvedValue(mockResponse);

      await ticketService.fetchUserTickets({
        projectKeys: ['PROJ1', 'PROJ2'],
      });

      expect(mockClient.searchIssues).toHaveBeenCalledWith(
        'assignee = currentUser() AND project in ("PROJ1", "PROJ2") ORDER BY updated DESC',
        expect.any(Object)
      );
    });

    it('should handle pagination parameters', async () => {
      const mockResponse = { issues: [], total: 100 };
      mockClient.searchIssues.mockResolvedValue(mockResponse);

      await ticketService.fetchUserTickets({
        maxResults: 25,
        startAt: 50,
      });

      expect(mockClient.searchIssues).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          maxResults: 25,
          startAt: 50,
        })
      );
    });
  });

  describe('fetchTicketDetails', () => {
    it('should fetch detailed ticket information', async () => {
      const mockTicket: JiraTicket = {
        id: '123',
        key: 'TEST-1',
        fields: {
          summary: 'Test Issue',
          description: 'Test Description',
          status: {
            id: '1',
            name: 'To Do',
            statusCategory: { key: 'new', name: 'To Do' },
          },
          assignee: {
            accountId: 'user123',
            displayName: 'Test User',
          },
          reporter: {
            accountId: 'user456',
            displayName: 'Reporter',
          },
          issuetype: { id: '1', name: 'Task' },
          project: { id: '1', key: 'TEST', name: 'Test Project' },
          created: '2024-01-01T00:00:00.000Z',
          updated: '2024-01-02T00:00:00.000Z',
        },
      };

      mockClient.getIssue.mockResolvedValue(mockTicket);

      const result = await ticketService.fetchTicketDetails('TEST-1');

      expect(result).toEqual(mockTicket);
      expect(mockClient.getIssue).toHaveBeenCalledWith('TEST-1', {
        fields: expect.arrayContaining(['summary', 'description', 'status']),
        expand: expect.arrayContaining(['renderedFields', 'changelog']),
      });
    });
  });

  describe('fetchTicketComments', () => {
    it('should fetch all comments with pagination', async () => {
      const comments1 = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `comment-${i}`,
          body: `Comment ${i}`,
        }));

      const comments2 = Array(50)
        .fill(null)
        .map((_, i) => ({
          id: `comment-${100 + i}`,
          body: `Comment ${100 + i}`,
        }));

      mockClient.getComments
        .mockResolvedValueOnce({ comments: comments1, total: 150 })
        .mockResolvedValueOnce({ comments: comments2, total: 150 });

      const result = await ticketService.fetchTicketComments('TEST-1');

      expect(result).toHaveLength(150);
      expect(mockClient.getComments).toHaveBeenCalledTimes(2);
      expect(mockClient.getComments).toHaveBeenNthCalledWith(1, 'TEST-1', {
        maxResults: 100,
        startAt: 0,
      });
      expect(mockClient.getComments).toHaveBeenNthCalledWith(2, 'TEST-1', {
        maxResults: 100,
        startAt: 100,
      });
    });
  });

  describe('extractAcceptanceCriteria', () => {
    it('should extract from custom field if present', () => {
      const ticket: JiraTicket = {
        id: '1',
        key: 'TEST-1',
        fields: {
          customfield_10000: 'Given X, When Y, Then Z',
          description: 'Some description',
          summary: 'Test',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
          reporter: { accountId: '1', displayName: 'Reporter' },
          issuetype: { id: '1', name: 'Task' },
          project: { id: '1', key: 'TEST', name: 'Test' },
          created: '2024-01-01',
          updated: '2024-01-01',
        },
      };

      const result = ticketService.extractAcceptanceCriteria(ticket);
      expect(result).toBe('Given X, When Y, Then Z');
    });

    it('should extract from description with "Acceptance Criteria:" pattern', () => {
      const ticket: JiraTicket = {
        id: '1',
        key: 'TEST-1',
        fields: {
          description:
            'Some description\n\nAcceptance Criteria:\n- Criteria 1\n- Criteria 2\n\nOther text',
          summary: 'Test',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
          reporter: { accountId: '1', displayName: 'Reporter' },
          issuetype: { id: '1', name: 'Task' },
          project: { id: '1', key: 'TEST', name: 'Test' },
          created: '2024-01-01',
          updated: '2024-01-01',
        },
      };

      const result = ticketService.extractAcceptanceCriteria(ticket);
      expect(result).toContain('Acceptance Criteria:');
      expect(result).toContain('Criteria 1');
      expect(result).toContain('Criteria 2');
    });

    it('should extract Given/When/Then pattern', () => {
      const ticket: JiraTicket = {
        id: '1',
        key: 'TEST-1',
        fields: {
          description:
            'Description\n\nGiven a user is logged in\nWhen they click logout\nThen they are redirected',
          summary: 'Test',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
          reporter: { accountId: '1', displayName: 'Reporter' },
          issuetype: { id: '1', name: 'Task' },
          project: { id: '1', key: 'TEST', name: 'Test' },
          created: '2024-01-01',
          updated: '2024-01-01',
        },
      };

      const result = ticketService.extractAcceptanceCriteria(ticket);
      expect(result).toContain('Given');
      expect(result).toContain('When');
      expect(result).toContain('Then');
    });

    it('should return null if no acceptance criteria found', () => {
      const ticket: JiraTicket = {
        id: '1',
        key: 'TEST-1',
        fields: {
          description: 'Just a regular description without criteria',
          summary: 'Test',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
          reporter: { accountId: '1', displayName: 'Reporter' },
          issuetype: { id: '1', name: 'Task' },
          project: { id: '1', key: 'TEST', name: 'Test' },
          created: '2024-01-01',
          updated: '2024-01-01',
        },
      };

      const result = ticketService.extractAcceptanceCriteria(ticket);
      expect(result).toBeNull();
    });
  });

  describe('parseDescription', () => {
    it('should return string description as-is', () => {
      const ticket: JiraTicket = {
        id: '1',
        key: 'TEST-1',
        fields: {
          description: 'Simple string description',
          summary: 'Test',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
          reporter: { accountId: '1', displayName: 'Reporter' },
          issuetype: { id: '1', name: 'Task' },
          project: { id: '1', key: 'TEST', name: 'Test' },
          created: '2024-01-01',
          updated: '2024-01-01',
        },
      };

      const result = ticketService.parseDescription(ticket);
      expect(result).toBe('Simple string description');
    });

    it('should parse ADF format', () => {
      const ticket: JiraTicket = {
        id: '1',
        key: 'TEST-1',
        fields: {
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'This is a paragraph' }],
              },
              {
                type: 'bulletList',
                content: [
                  {
                    type: 'listItem',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Bullet point 1' }],
                      },
                    ],
                  },
                ],
              },
            ],
          } as any,
          summary: 'Test',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
          reporter: { accountId: '1', displayName: 'Reporter' },
          issuetype: { id: '1', name: 'Task' },
          project: { id: '1', key: 'TEST', name: 'Test' },
          created: '2024-01-01',
          updated: '2024-01-01',
        },
      };

      const result = ticketService.parseDescription(ticket);
      expect(result).toContain('This is a paragraph');
      expect(result).toContain('Bullet point 1');
    });

    it('should return empty string for null description', () => {
      const ticket: JiraTicket = {
        id: '1',
        key: 'TEST-1',
        fields: {
          description: undefined as any,
          summary: 'Test',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
          reporter: { accountId: '1', displayName: 'Reporter' },
          issuetype: { id: '1', name: 'Task' },
          project: { id: '1', key: 'TEST', name: 'Test' },
          created: '2024-01-01',
          updated: '2024-01-01',
        },
      };

      const result = ticketService.parseDescription(ticket);
      expect(result).toBe('');
    });
  });

  describe('syncTicket', () => {
    it('should fetch ticket details and comments', async () => {
      const mockTicket: JiraTicket = {
        id: '123',
        key: 'TEST-1',
        fields: {
          summary: 'Test Issue',
          description: 'Description',
          status: { id: '1', name: 'To Do', statusCategory: { key: 'new', name: 'To Do' } },
          reporter: { accountId: '1', displayName: 'Reporter' },
          issuetype: { id: '1', name: 'Task' },
          project: { id: '1', key: 'TEST', name: 'Test' },
          created: '2024-01-01',
          updated: '2024-01-01',
        },
      };

      const mockComments = [
        { id: '1', body: 'Comment 1' },
        { id: '2', body: 'Comment 2' },
      ];

      mockClient.getIssue.mockResolvedValue(mockTicket);
      mockClient.getComments.mockResolvedValue({
        comments: mockComments,
        total: 2,
      });

      const result = await ticketService.syncTicket('TEST-1');

      expect(result.key).toBe('TEST-1');
      expect(result.fields.comment).toBeDefined();
      expect(result.fields.comment?.comments).toEqual(mockComments);
      expect(result.fields.comment?.total).toBe(2);
    });
  });

  describe('checkProjectAccess', () => {
    it('should return true if user has access to project', async () => {
      mockClient.getProjects.mockResolvedValue({
        values: [
          { key: 'PROJ1', name: 'Project 1' },
          { key: 'PROJ2', name: 'Project 2' },
        ],
      });

      const result = await ticketService.checkProjectAccess('PROJ1');
      expect(result).toBe(true);
    });

    it('should return false if user does not have access', async () => {
      mockClient.getProjects.mockResolvedValue({
        values: [{ key: 'PROJ1', name: 'Project 1' }],
      });

      const result = await ticketService.checkProjectAccess('PROJ3');
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockClient.getProjects.mockRejectedValue(new Error('API Error'));

      const result = await ticketService.checkProjectAccess('PROJ1');
      expect(result).toBe(false);
    });
  });
});
