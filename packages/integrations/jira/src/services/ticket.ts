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

  /**
   * Add a comment to a ticket
   */
  public async addComment(ticketKey: string, comment: { body: string }): Promise<{ id: string }> {
    try {
      logger.info({ ticketKey }, 'Adding comment to ticket');

      const response = await this.client.addComment(ticketKey, comment.body);

      logger.info({ 
        ticketKey, 
        commentId: (response as any).id 
      }, 'Comment added successfully');

      return { id: (response as any).id };
    } catch (error) {
      logger.error({ ticketKey, error }, 'Failed to add comment');
      throw error;
    }
  }

  /**
   * Post clarification questions to a ticket with AI-CLARIFIED tag
   */
  public async postClarificationQuestions(
    ticketKey: string, 
    questions: string[],
    includeTag: boolean = true
  ): Promise<{ id: string; url?: string }> {
    try {
      logger.info({ 
        ticketKey, 
        questionsCount: questions.length 
      }, 'Posting clarification questions');

      // Format the comment body
      let commentBody = '';
      
      if (includeTag) {
        commentBody = '[AI-CLARIFIED] Clarification Questions:\n\n';
      } else {
        commentBody = 'Clarification Questions:\n\n';
      }
      
      // Add questions with numbering
      questions.forEach((question, index) => {
        commentBody += `${index + 1}. ${question}\n`;
      });
      
      // Add footer
      commentBody += '\n---\n';
      commentBody += '_Generated by Agentris AI - Please provide answers to help clarify requirements._';

      // Post the comment
      const response = await this.client.addComment(ticketKey, commentBody);

      // Try to construct the URL to the comment
      const baseUrl = process.env.JIRA_BASE_URL || '';
      const commentUrl = baseUrl ? `${baseUrl}/browse/${ticketKey}?focusedCommentId=${(response as any).id}` : undefined;

      logger.info({ 
        ticketKey, 
        commentId: (response as any).id,
        url: commentUrl 
      }, 'Clarification questions posted successfully');

      return { 
        id: (response as any).id,
        url: commentUrl
      };
    } catch (error) {
      logger.error({ ticketKey, error }, 'Failed to post clarification questions');
      throw error;
    }
  }

  /**
   * Search for comments with specific tags
   */
  public async findTaggedComments(
    ticketKey: string,
    tag: string
  ): Promise<JiraComment[]> {
    try {
      logger.info({ ticketKey, tag }, 'Searching for tagged comments');

      const allComments = await this.fetchTicketComments(ticketKey);
      
      // Filter comments that contain the tag
      const taggedComments = allComments.filter(comment => {
        const body = typeof comment.body === 'string' 
          ? comment.body 
          : this.parseADF(comment.body);
        return body.includes(`[${tag}]`);
      });

      logger.info({ 
        ticketKey, 
        tag,
        found: taggedComments.length 
      }, 'Tagged comments found');

      return taggedComments;
    } catch (error) {
      logger.error({ ticketKey, tag, error }, 'Failed to find tagged comments');
      throw error;
    }
  }

  /**
   * Parse answers from Jira comments for clarification questions
   */
  public async parseAnswersFromComments(
    ticketKey: string,
    clarificationCommentId: string
  ): Promise<Map<string, string>> {
    try {
      logger.info({ 
        ticketKey, 
        clarificationCommentId 
      }, 'Parsing answers from comments');

      // Fetch all comments after the clarification comment
      const allComments = await this.fetchTicketComments(ticketKey);
      
      // Find the index of our clarification comment
      const clarificationIndex = allComments.findIndex(
        c => (c as any).id === clarificationCommentId
      );
      
      if (clarificationIndex === -1) {
        logger.warn({ 
          ticketKey, 
          clarificationCommentId 
        }, 'Clarification comment not found');
        return new Map();
      }

      // Get comments after the clarification
      const subsequentComments = allComments.slice(clarificationIndex + 1);
      
      // Parse the original questions from the clarification comment
      const clarificationComment = allComments[clarificationIndex];
      if (!clarificationComment) {
        return new Map<string, string>();
      }
      const clarificationBody = typeof clarificationComment.body === 'string'
        ? clarificationComment.body
        : this.parseADF(clarificationComment.body);
      
      const questions = this.extractQuestionsFromComment(clarificationBody);
      
      // Look for answers in subsequent comments
      const answers = new Map<string, string>();
      
      for (const comment of subsequentComments) {
        const body = typeof comment.body === 'string' 
          ? comment.body 
          : this.parseADF(comment.body);
        
        // Check if this comment contains answers
        // Look for patterns like "Q1:", "Question 1:", "#1", etc.
        const answerPatterns = [
          /(?:Q|Question|#)\s*(\d+)(?:\s*:|\.)\s*(.+?)(?=(?:Q|Question|#)\s*\d+|$)/gis,
          /(\d+)(?:\)|\.)\s*(.+?)(?=\d+(?:\)|\.)|\n\n|$)/gis
        ];
        
        for (const pattern of answerPatterns) {
          const matches = Array.from(body.matchAll(pattern));
          for (const match of matches) {
            const questionIndex = parseInt(match[1]!) - 1;
            if (questionIndex >= 0 && questionIndex < questions.length) {
              const answer = match[2]?.trim();
              const question = questions[questionIndex];
              if (answer && question && !answers.has(question)) {
                answers.set(question, answer);
              }
            }
          }
        }
        
        // If this comment mentions it's answering the clarifications
        if (body.toLowerCase().includes('answer') || 
            body.toLowerCase().includes('response') ||
            body.toLowerCase().includes('clarification')) {
          // Try to match answers more loosely
          questions.forEach((question, index) => {
            if (!answers.has(question)) {
              // Check if the comment references this question number
              const questionRef = new RegExp(`(?:${index + 1}|Q${index + 1}|#${index + 1})`, 'i');
              if (questionRef.test(body)) {
                // Extract the text after the question reference
                const afterRef = body.split(questionRef)[1];
                if (afterRef) {
                  const answer = afterRef.split(/\n\n|\d+\.|Q\d+|#\d+/)[0]?.trim();
                  if (answer) {
                    answers.set(question, answer);
                  }
                }
              }
            }
          });
        }
      }

      logger.info({ 
        ticketKey, 
        questionsCount: questions.length,
        answersCount: answers.size 
      }, 'Answers parsed from comments');

      return answers;
    } catch (error) {
      logger.error({ ticketKey, error }, 'Failed to parse answers from comments');
      return new Map();
    }
  }

  /**
   * Extract numbered questions from a comment body
   */
  private extractQuestionsFromComment(body: string): string[] {
    const questions: string[] = [];
    
    // Look for numbered questions
    const patterns = [
      /\d+\.\s*(.+?)(?=\n\d+\.|\n\n|$)/gs,
      /(?:Q|Question)\s*\d+:\s*(.+?)(?=(?:Q|Question)\s*\d+:|$)/gis
    ];
    
    for (const pattern of patterns) {
      const matches = Array.from(body.matchAll(pattern));
      if (matches.length > 0) {
        for (const match of matches) {
          if (match[1]) {
            questions.push(match[1].trim());
          }
        }
        break; // Use first matching pattern
      }
    }
    
    return questions;
  }

  /**
   * Add answer tracking metadata to ticket
   */
  public async updateTicketWithAnswerStatus(
    ticketKey: string,
    answeredCount: number,
    totalCount: number
  ): Promise<void> {
    try {
      logger.info({ 
        ticketKey, 
        answeredCount,
        totalCount 
      }, 'Updating ticket with answer status');

      // Add a label to indicate clarification status
      const label = answeredCount === totalCount 
        ? 'clarifications-answered'
        : 'clarifications-pending';

      // TODO: updateIssue method needs to be implemented in JiraClient
      // await this.client.updateIssue(ticketKey, {
      //   update: {
      //     labels: [{ add: label }]
      //   }
      // });

      logger.info({ 
        ticketKey, 
        label 
      }, 'Ticket updated with answer status');
    } catch (error) {
      logger.error({ ticketKey, error }, 'Failed to update ticket with answer status');
      // Don't throw - this is not critical
    }
  }
}
