import { JiraClient } from '../client';
import type { JiraTicket, JiraComment } from '../types';
import pino from 'pino';

const logger = pino({ name: 'jira-ticket-service' });

// Configuration for custom field IDs
// These can be overridden via environment variables
const CUSTOM_FIELDS = {
  acceptanceCriteria: process.env.JIRA_FIELD_ACCEPTANCE_CRITERIA || 'customfield_10000',
};

export class TicketService {
  private client: JiraClient;

  constructor(client: JiraClient) {
    this.client = client;
  }

  /**
   * Fetch tickets assigned to the current user
   */
  public async fetchUserTickets(options?: {
    projectKeys?: string[];
    maxResults?: number;
    startAt?: number;
  }): Promise<{ tickets: JiraTicket[]; total: number }> {
    try {
      // Build JQL query
      let jql = 'assignee = currentUser()';

      if (options?.projectKeys && options.projectKeys.length > 0) {
        const projectFilter = options.projectKeys.map((key) => `"${key}"`).join(', ');
        jql += ` AND project in (${projectFilter})`;
      }

      jql += ' ORDER BY updated DESC';

      logger.info({ jql, maxResults: options?.maxResults }, 'Fetching user tickets');

      const response = await this.client.searchIssues(jql, {
        maxResults: options?.maxResults || 50,
        startAt: options?.startAt || 0,
        fields: [
          'summary',
          'description',
          'status',
          'assignee',
          'reporter',
          'priority',
          'issuetype',
          'project',
          'created',
          'updated',
          'comment',
          CUSTOM_FIELDS.acceptanceCriteria, // Acceptance criteria
        ],
        expand: ['renderedFields'],
      });

      logger.info({
        count: (response as any).issues?.length || 0,
        total: (response as any).total,
      }, 'Tickets fetched successfully');

      return {
        tickets: ((response as any).issues || []) as unknown as JiraTicket[],
        total: (response as any).total || 0,
      };
    } catch (error) {
      logger.error(error as any, 'Failed to fetch user tickets');
      throw error;
    }
  }

  /**
   * Fetch detailed information for a specific ticket
   */
  public async fetchTicketDetails(ticketKey: string): Promise<JiraTicket> {
    try {
      logger.info({ ticketKey }, 'Fetching ticket details');

      const issue = await this.client.getIssue(ticketKey, {
        fields: [
          'summary',
          'description',
          'status',
          'assignee',
          'reporter',
          'priority',
          'issuetype',
          'project',
          'created',
          'updated',
          'comment',
          CUSTOM_FIELDS.acceptanceCriteria, // Acceptance criteria
          'attachment',
          'subtasks',
          'parent',
        ],
        expand: ['renderedFields', 'changelog'],
      });

      logger.info({ ticketKey }, 'Ticket details fetched successfully');

      return issue as unknown as JiraTicket;
    } catch (error) {
      logger.error({ ticketKey, error }, 'Failed to fetch ticket details');
      throw error;
    }
  }

  /**
   * Fetch all comments for a ticket
   */
  public async fetchTicketComments(ticketKey: string): Promise<JiraComment[]> {
    try {
      logger.info({ ticketKey }, 'Fetching ticket comments');

      const allComments: JiraComment[] = [];
      let startAt = 0;
      const maxResults = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await this.client.getComments(ticketKey, {
          maxResults,
          startAt,
        });

        allComments.push(...(((response as any).comments || []) as unknown as JiraComment[]));

        startAt += maxResults;
        hasMore = startAt < ((response as any).total || 0);
      }

      logger.info({
        ticketKey,
        count: allComments.length,
      }, 'Comments fetched successfully');

      return allComments;
    } catch (error) {
      logger.error({ ticketKey, error }, 'Failed to fetch ticket comments');
      throw error;
    }
  }

  /**
   * Extract acceptance criteria from ticket description or custom field
   */
  public extractAcceptanceCriteria(ticket: JiraTicket): string | null {
    try {
      // First check custom field (if configured)
      const customFieldValue = (ticket.fields as any)[CUSTOM_FIELDS.acceptanceCriteria];
      if (customFieldValue) {
        return customFieldValue;
      }

      // Otherwise, try to extract from description
      const description = ticket.fields.description;
      if (!description) {
        return null;
      }

      // Look for common acceptance criteria patterns
      const patterns = [
        /acceptance criteria:?\s*([\s\S]*?)(?:\n\n|$)/i,
        /AC:?\s*([\s\S]*?)(?:\n\n|$)/i,
        /given[\s\S]*?when[\s\S]*?then/i,
      ];

      for (const pattern of patterns) {
        const match = description.match(pattern);
        if (match) {
          return match[0].trim();
        }
      }

      // Check for bullet points that might be acceptance criteria
      const bulletPattern = /(?:^|\n)\s*[-*•]\s+.+(?:\n\s*[-*•]\s+.+)*/gm;
      const bullets = description.match(bulletPattern);
      if (bullets && bullets.length > 0) {
        // If we find a section with bullet points after "acceptance" keyword
        const acIndex = description.toLowerCase().indexOf('acceptance');
        if (acIndex !== -1) {
          const afterAc = description.substring(acIndex);
          const bulletMatch = afterAc.match(bulletPattern);
          if (bulletMatch) {
            return bulletMatch[0].trim();
          }
        }
      }

      return null;
    } catch (error) {
      logger.error({
        ticketKey: ticket.key,
        error,
      }, 'Failed to extract acceptance criteria');
      return null;
    }
  }

  /**
   * Parse description field from various Jira formats
   */
  public parseDescription(ticket: JiraTicket): string {
    const description = ticket.fields.description;

    if (!description) {
      return '';
    }

    // If description is already a string, return it
    if (typeof description === 'string') {
      return description;
    }

    // Handle Atlassian Document Format (ADF)
    if (description && typeof description === 'object' && 'content' in description) {
      return this.parseADF(description);
    }

    return String(description);
  }

  /**
   * Parse Atlassian Document Format to plain text
   */
  private parseADF(doc: any): string {
    if (!doc || !doc.content) {
      return '';
    }

    const parseNode = (node: any): string => {
      if (!node) return '';

      switch (node.type) {
        case 'text':
          return node.text || '';

        case 'paragraph':
        case 'heading':
          return (node.content || []).map((child: any) => parseNode(child)).join('') + '\n\n';

        case 'bulletList':
        case 'orderedList':
          return (node.content || []).map((item: any) => parseNode(item)).join('');

        case 'listItem':
          const bullet = node.type === 'orderedList' ? '1.' : '-';
          return `${bullet} ${(node.content || []).map((child: any) => parseNode(child)).join('')}`;

        case 'codeBlock':
          return `\`\`\`\n${node.content?.[0]?.text || ''}\n\`\`\`\n\n`;

        case 'blockquote':
          return `> ${(node.content || []).map((child: any) => parseNode(child)).join('')}`;

        case 'doc':
          return (node.content || []).map((child: any) => parseNode(child)).join('');

        default:
          // For unknown types, try to parse content if it exists
          if (node.content && Array.isArray(node.content)) {
            return node.content.map((child: any) => parseNode(child)).join('');
          }
          return '';
      }
    };

    return parseNode(doc).trim();
  }

  /**
   * Sync a specific ticket from Jira to the database
   */
  public async syncTicket(ticketKey: string): Promise<JiraTicket> {
    try {
      logger.info({ ticketKey }, 'Syncing ticket from Jira');

      // Fetch the latest ticket data
      const ticket = await this.fetchTicketDetails(ticketKey);

      // Fetch all comments
      const comments = await this.fetchTicketComments(ticketKey);

      // Add comments to ticket if not already included
      if (!ticket.fields.comment) {
        ticket.fields.comment = {
          total: comments.length,
          comments,
        };
      }

      logger.info({
        ticketKey,
        commentsCount: comments.length,
      }, 'Ticket synced successfully');

      return ticket;
    } catch (error) {
      logger.error({ ticketKey, error }, 'Failed to sync ticket');
      throw error;
    }
  }

  /**
   * Check if user has access to a specific project
   */
  public async checkProjectAccess(projectKey: string): Promise<boolean> {
    try {
      const projects = await this.client.getProjects();
      return (projects as any).values.some((project: any) => project.key === projectKey);
    } catch (error) {
      logger.error({ projectKey, error }, 'Failed to check project access');
      return false;
    }
  }
}
