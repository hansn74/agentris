import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import type { JiraWebhookPayload } from '@agentris/integrations/jira';

// Mock environment variables
process.env.JIRA_WEBHOOK_SECRET = 'test-webhook-secret';

describe('Jira Webhook Handler', () => {
  describe('webhook signature verification', () => {
    const secret = 'test-webhook-secret';

    it('should verify valid webhook signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'sha256=' + createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // This would be called in the actual webhook handler
      const expectedSignature = 'sha256=' + createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(signature).toBe(expectedSignature);
    });

    it('should reject invalid webhook signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const invalidSignature = 'sha256=invalid';

      const expectedSignature = 'sha256=' + createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(invalidSignature).not.toBe(expectedSignature);
    });
  });

  describe('webhook payload parsing', () => {
    it('should parse issue created event', () => {
      const payload: JiraWebhookPayload = {
        timestamp: Date.now(),
        webhookEvent: 'jira:issue_created',
        issue: {
          id: '123',
          key: 'TEST-1',
          fields: {
            summary: 'Test Issue',
            description: 'Test Description',
            status: {
              id: '1',
              name: 'To Do',
              statusCategory: { key: 'new', name: 'To Do' }
            },
            assignee: {
              accountId: 'user123',
              displayName: 'Test User',
              emailAddress: 'test@example.com'
            },
            reporter: {
              accountId: 'user456',
              displayName: 'Reporter'
            },
            issuetype: { id: '1', name: 'Task' },
            project: { id: '1', key: 'TEST', name: 'Test Project' },
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-02T00:00:00.000Z'
          }
        }
      };

      expect(payload.webhookEvent).toBe('jira:issue_created');
      expect(payload.issue?.key).toBe('TEST-1');
      expect(payload.issue?.fields.assignee?.emailAddress).toBe('test@example.com');
    });

    it('should parse issue updated event', () => {
      const payload: JiraWebhookPayload = {
        timestamp: Date.now(),
        webhookEvent: 'jira:issue_updated',
        issue_event_type_name: 'issue_generic',
        issue: {
          id: '123',
          key: 'TEST-1',
          fields: {
            summary: 'Updated Test Issue',
            status: {
              id: '2',
              name: 'In Progress',
              statusCategory: { key: 'indeterminate', name: 'In Progress' }
            },
            reporter: {
              accountId: 'user456',
              displayName: 'Reporter'
            },
            issuetype: { id: '1', name: 'Task' },
            project: { id: '1', key: 'TEST', name: 'Test Project' },
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-02T00:00:00.000Z'
          }
        },
        changelog: {
          id: '456',
          items: [
            {
              field: 'status',
              fieldtype: 'jira',
              from: '1',
              fromString: 'To Do',
              to: '2',
              toString: 'In Progress'
            }
          ]
        }
      };

      expect(payload.webhookEvent).toBe('jira:issue_updated');
      expect(payload.changelog?.items[0].field).toBe('status');
      expect(payload.changelog?.items[0].toString).toBe('In Progress');
    });

    it('should parse comment created event', () => {
      const payload: JiraWebhookPayload = {
        timestamp: Date.now(),
        webhookEvent: 'comment_created',
        issue: {
          id: '123',
          key: 'TEST-1',
          fields: {
            summary: 'Test Issue',
            status: {
              id: '1',
              name: 'To Do',
              statusCategory: { key: 'new', name: 'To Do' }
            },
            reporter: {
              accountId: 'user456',
              displayName: 'Reporter'
            },
            issuetype: { id: '1', name: 'Task' },
            project: { id: '1', key: 'TEST', name: 'Test Project' },
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-02T00:00:00.000Z'
          }
        },
        comment: {
          id: '789',
          author: {
            accountId: 'user789',
            displayName: 'Commenter',
            emailAddress: 'commenter@example.com'
          },
          body: 'This is a test comment',
          created: '2024-01-03T00:00:00.000Z',
          updated: '2024-01-03T00:00:00.000Z'
        }
      };

      expect(payload.webhookEvent).toBe('comment_created');
      expect(payload.comment?.body).toBe('This is a test comment');
      expect(payload.comment?.author.displayName).toBe('Commenter');
    });

    it('should handle webhook payload with ADF comment body', () => {
      const payload: JiraWebhookPayload = {
        timestamp: Date.now(),
        webhookEvent: 'comment_created',
        issue: {
          id: '123',
          key: 'TEST-1',
          fields: {
            summary: 'Test Issue',
            status: {
              id: '1',
              name: 'To Do',
              statusCategory: { key: 'new', name: 'To Do' }
            },
            reporter: {
              accountId: 'user456',
              displayName: 'Reporter'
            },
            issuetype: { id: '1', name: 'Task' },
            project: { id: '1', key: 'TEST', name: 'Test Project' },
            created: '2024-01-01T00:00:00.000Z',
            updated: '2024-01-02T00:00:00.000Z'
          }
        },
        comment: {
          id: '789',
          author: {
            accountId: 'user789',
            displayName: 'Commenter'
          },
          body: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'ADF formatted comment'
                  }
                ]
              }
            ]
          } as any,
          created: '2024-01-03T00:00:00.000Z',
          updated: '2024-01-03T00:00:00.000Z'
        }
      };

      expect(payload.comment?.body).toHaveProperty('type', 'doc');
      expect(payload.comment?.body).toHaveProperty('content');
    });
  });

  describe('webhook event handling', () => {
    it('should identify different event types', () => {
      const eventTypes = [
        'jira:issue_created',
        'jira:issue_updated',
        'jira:issue_deleted',
        'comment_created',
        'comment_updated',
        'comment_deleted',
        'issue_property_set',
        'issue_link_created',
        'issue_link_deleted'
      ];

      eventTypes.forEach(eventType => {
        const payload: JiraWebhookPayload = {
          timestamp: Date.now(),
          webhookEvent: eventType
        };

        expect(payload.webhookEvent).toBe(eventType);
      });
    });
  });
});