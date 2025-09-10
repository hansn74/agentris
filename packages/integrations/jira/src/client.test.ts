import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { JiraClient } from './client';
import type { JiraOAuthTokens } from './types';
import { Version3Client } from 'jira.js';

// Mock jira.js
vi.mock('jira.js');

describe('JiraClient', () => {
  let client: JiraClient;
  let tokens: JiraOAuthTokens;
  let mockJiraClient: any;
  let mockVersion3Client: MockedFunction<typeof Version3Client>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock client
    mockJiraClient = {
      issueSearch: {
        searchForIssuesUsingJql: vi.fn(),
      },
      issues: {
        getIssue: vi.fn(),
        doTransition: vi.fn(),
        getTransitions: vi.fn(),
      },
      issueComments: {
        getComments: vi.fn(),
        addComment: vi.fn(),
      },
      myself: {
        getCurrentUser: vi.fn(),
      },
      projects: {
        searchProjects: vi.fn(),
      },
    };

    // Mock the Version3Client constructor
    mockVersion3Client = vi.mocked(Version3Client);
    mockVersion3Client.mockImplementation(() => mockJiraClient as any);

    tokens = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      cloudId: 'test-cloud-id',
    };

    client = new JiraClient(tokens);
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(mockVersion3Client).toHaveBeenCalledWith({
        host: `https://api.atlassian.com/ex/jira/${tokens.cloudId}`,
        authentication: {
          oauth2: {
            accessToken: tokens.accessToken,
          },
        },
        telemetry: false,
      });
    });
  });

  describe('searchIssues', () => {
    it('should search issues with JQL', async () => {
      const mockResults = {
        issues: [
          { key: 'TEST-1', fields: { summary: 'Test Issue 1' } },
          { key: 'TEST-2', fields: { summary: 'Test Issue 2' } },
        ],
        total: 2,
      };

      mockJiraClient.issueSearch.searchForIssuesUsingJql.mockResolvedValue(mockResults);

      const result = await client.searchIssues('assignee = currentUser()', {
        maxResults: 10,
        fields: ['summary', 'status'],
      });

      expect(result).toEqual(mockResults);
      expect(mockJiraClient.issueSearch.searchForIssuesUsingJql).toHaveBeenCalledWith({
        jql: 'assignee = currentUser()',
        maxResults: 10,
        startAt: 0,
        fields: ['summary', 'status'],
        expand: undefined,
      });
    });
  });

  describe('error handling', () => {
    it('should retry on rate limit error (429)', async () => {
      const mockError = new Error('Rate limited');
      (mockError as any).status = 429;

      const mockResults = { issues: [], total: 0 };

      mockJiraClient.issueSearch.searchForIssuesUsingJql
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockResults);

      // Speed up the test by reducing delays
      (client as any).baseDelay = 10;

      const result = await client.searchIssues('test');

      expect(result).toEqual(mockResults);
      expect(mockJiraClient.issueSearch.searchForIssuesUsingJql).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries on rate limit', async () => {
      const mockError = new Error('Rate limited');
      (mockError as any).status = 429;

      mockJiraClient.issueSearch.searchForIssuesUsingJql.mockRejectedValue(mockError);

      // Speed up the test
      (client as any).baseDelay = 10;
      (client as any).maxRetries = 2;

      await expect(client.searchIssues('test')).rejects.toThrow(
        'Rate limit exceeded after 2 retries'
      );
    });

    it('should retry on connection error', async () => {
      const mockError = new Error('Connection failed');
      (mockError as any).code = 'ECONNREFUSED';

      const mockResults = { issues: [], total: 0 };

      mockJiraClient.issueSearch.searchForIssuesUsingJql
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockResults);

      // Speed up the test
      (client as any).baseDelay = 10;

      const result = await client.searchIssues('test');

      expect(result).toEqual(mockResults);
      expect(mockJiraClient.issueSearch.searchForIssuesUsingJql).toHaveBeenCalledTimes(2);
    });

    it('should throw authentication error without retry', async () => {
      const mockError = new Error('Unauthorized');
      (mockError as any).status = 401;

      mockJiraClient.issueSearch.searchForIssuesUsingJql.mockRejectedValue(mockError);

      await expect(client.searchIssues('test')).rejects.toThrow(
        'Authentication failed. Token may be expired or invalid.'
      );

      expect(mockJiraClient.issueSearch.searchForIssuesUsingJql).toHaveBeenCalledTimes(1);
    });
  });

  describe('getIssue', () => {
    it('should get issue details', async () => {
      const mockIssue = {
        key: 'TEST-1',
        fields: {
          summary: 'Test Issue',
          description: 'Test Description',
          status: { name: 'To Do' },
        },
      };

      mockJiraClient.issues.getIssue.mockResolvedValue(mockIssue);

      const result = await client.getIssue('TEST-1', {
        fields: ['summary', 'description', 'status'],
      });

      expect(result).toEqual(mockIssue);
      expect(mockJiraClient.issues.getIssue).toHaveBeenCalledWith({
        issueIdOrKey: 'TEST-1',
        fields: ['summary', 'description', 'status'],
        expand: undefined,
      });
    });
  });

  describe('getComments', () => {
    it('should get issue comments', async () => {
      const mockComments = {
        comments: [
          { id: '1', body: 'Comment 1' },
          { id: '2', body: 'Comment 2' },
        ],
        total: 2,
      };

      mockJiraClient.issueComments.getComments.mockResolvedValue(mockComments);

      const result = await client.getComments('TEST-1');

      expect(result).toEqual(mockComments);
      expect(mockJiraClient.issueComments.getComments).toHaveBeenCalledWith({
        issueIdOrKey: 'TEST-1',
        maxResults: 50,
        startAt: 0,
      });
    });
  });

  describe('addComment', () => {
    it('should add comment to issue', async () => {
      const mockComment = { id: '123', body: 'Test comment' };

      mockJiraClient.issueComments.addComment.mockResolvedValue(mockComment);

      const result = await client.addComment('TEST-1', 'Test comment');

      expect(result).toEqual(mockComment);
      expect(mockJiraClient.issueComments.addComment).toHaveBeenCalledWith({
        issueIdOrKey: 'TEST-1',
        body: {
          body: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Test comment',
                  },
                ],
              },
            ],
          },
        },
      });
    });
  });

  describe('updateAccessToken', () => {
    it('should update access token and reinitialize client', () => {
      const newToken = 'new-access-token';
      client.updateAccessToken(newToken);

      expect(mockVersion3Client).toHaveBeenCalledWith({
        host: `https://api.atlassian.com/ex/jira/${tokens.cloudId}`,
        authentication: {
          oauth2: {
            accessToken: newToken,
          },
        },
        telemetry: false,
      });
    });
  });
});
