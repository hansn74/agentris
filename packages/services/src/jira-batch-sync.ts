import {
  BatchRepository,
  prisma,
  TicketBatch,
  BatchProcessingResult,
  Ticket,
  TicketStatus
} from '@agentris/db';

export interface JiraSyncConfig {
  updateIndividualTickets?: boolean;
  linkRelatedTickets?: boolean;
  addBatchComments?: boolean;
  updateCustomFields?: boolean;
}

export interface JiraSyncResult {
  batchId: string;
  syncedTickets: number;
  failedTickets: number;
  errors: string[];
  linkedTickets?: string[];
}

export interface JiraTicketUpdate {
  ticketId: string;
  jiraKey: string;
  status: string;
  comment?: string;
  customFields?: Record<string, any>;
}

// Mock Jira client interface - in production, this would use actual Jira API client
interface JiraClient {
  updateTicket(jiraKey: string, updates: any): Promise<void>;
  addComment(jiraKey: string, comment: string): Promise<void>;
  linkTickets(fromKey: string, toKey: string, linkType: string): Promise<void>;
  getTicket(jiraKey: string): Promise<any>;
  transitionTicket(jiraKey: string, transition: string): Promise<void>;
}

export class JiraBatchSyncService {
  private repository: BatchRepository;
  private config: JiraSyncConfig;
  private jiraClient: JiraClient;

  constructor(
    repository?: BatchRepository,
    jiraClient?: JiraClient,
    config: JiraSyncConfig = {}
  ) {
    this.repository = repository || new BatchRepository(prisma);
    this.jiraClient = jiraClient || this.createMockJiraClient();
    this.config = {
      updateIndividualTickets: true,
      linkRelatedTickets: true,
      addBatchComments: true,
      updateCustomFields: false,
      ...config
    };
  }

  /**
   * Sync batch status with Jira
   */
  async syncBatchWithJira(
    batchId: string,
    status: 'started' | 'completed' | 'failed'
  ): Promise<JiraSyncResult> {
    const result: JiraSyncResult = {
      batchId,
      syncedTickets: 0,
      failedTickets: 0,
      errors: [],
      linkedTickets: []
    };

    try {
      const batch = await this.repository.getBatchById(batchId);
      if (!batch) {
        throw new Error(`Batch ${batchId} not found`);
      }

      const activeTickets = batch.tickets?.filter(t => !t.excluded) || [];

      // Update individual tickets
      if (this.config.updateIndividualTickets) {
        for (const batchTicket of activeTickets) {
          try {
            await this.updateTicketInJira(
              batchTicket.ticket,
              batch,
              status
            );
            result.syncedTickets++;
          } catch (error) {
            result.failedTickets++;
            result.errors.push(
              `Failed to update ${batchTicket.ticket.jiraKey}: ${(error as Error).message}`
            );
          }
        }
      }

      // Link related tickets
      if (this.config.linkRelatedTickets && activeTickets.length > 1) {
        result.linkedTickets = await this.linkTicketsInJira(activeTickets);
      }

      // Add batch comments
      if (this.config.addBatchComments) {
        await this.addBatchCommentsToTickets(batch, activeTickets, status);
      }

    } catch (error) {
      result.errors.push(`Batch sync failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Update individual ticket in Jira
   */
  private async updateTicketInJira(
    ticket: Ticket,
    batch: TicketBatch,
    status: 'started' | 'completed' | 'failed'
  ): Promise<void> {
    const jiraStatus = this.mapBatchStatusToJira(status);
    
    // Transition ticket to appropriate status
    if (jiraStatus) {
      await this.jiraClient.transitionTicket(ticket.jiraKey, jiraStatus);
    }

    // Add comment about batch processing
    if (this.config.addBatchComments) {
      const comment = this.generateBatchComment(batch, status);
      await this.jiraClient.addComment(ticket.jiraKey, comment);
    }

    // Update custom fields if configured
    if (this.config.updateCustomFields) {
      await this.jiraClient.updateTicket(ticket.jiraKey, {
        customFields: {
          batchId: batch.id,
          batchName: batch.name,
          batchStatus: status,
          processedAt: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Link related tickets in Jira
   */
  private async linkTicketsInJira(
    batchTickets: any[]
  ): Promise<string[]> {
    const linkedPairs: string[] = [];

    // Link each ticket to the next one in the batch
    for (let i = 0; i < batchTickets.length - 1; i++) {
      const fromTicket = batchTickets[i].ticket;
      const toTicket = batchTickets[i + 1].ticket;

      try {
        await this.jiraClient.linkTickets(
          fromTicket.jiraKey,
          toTicket.jiraKey,
          'relates to'
        );
        linkedPairs.push(`${fromTicket.jiraKey}->${toTicket.jiraKey}`);
      } catch (error) {
        console.error(
          `Failed to link ${fromTicket.jiraKey} to ${toTicket.jiraKey}:`,
          error
        );
      }
    }

    return linkedPairs;
  }

  /**
   * Add batch processing comments to tickets
   */
  private async addBatchCommentsToTickets(
    batch: TicketBatch,
    batchTickets: any[],
    status: 'started' | 'completed' | 'failed'
  ): Promise<void> {
    const comment = this.generateBatchComment(batch, status);

    for (const batchTicket of batchTickets) {
      try {
        await this.jiraClient.addComment(batchTicket.ticket.jiraKey, comment);
      } catch (error) {
        console.error(
          `Failed to add comment to ${batchTicket.ticket.jiraKey}:`,
          error
        );
      }
    }
  }

  /**
   * Generate batch processing comment
   */
  private generateBatchComment(
    batch: TicketBatch,
    status: 'started' | 'completed' | 'failed'
  ): string {
    const statusEmoji = {
      started: '🚀',
      completed: '✅',
      failed: '❌'
    };

    const statusText = {
      started: 'has been started',
      completed: 'has been completed successfully',
      failed: 'has failed'
    };

    return `${statusEmoji[status]} Batch processing ${statusText[status]}

Batch: ${batch.name}
Batch ID: ${batch.id}
Status: ${status.toUpperCase()}
Timestamp: ${new Date().toISOString()}

This ticket was processed as part of a batch containing ${batch.tickets?.length || 0} related tickets.`;
  }

  /**
   * Map batch status to Jira transition
   */
  private mapBatchStatusToJira(status: 'started' | 'completed' | 'failed'): string | null {
    const statusMap = {
      started: 'In Progress',
      completed: 'Done',
      failed: 'To Do'
    };

    return statusMap[status] || null;
  }

  /**
   * Sync individual ticket result
   */
  async syncTicketResult(
    batchId: string,
    ticketId: string,
    result: BatchProcessingResult
  ): Promise<void> {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const ticket = batch.tickets?.find(t => t.ticketId === ticketId)?.ticket;
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found in batch ${batchId}`);
    }

    const status = result.success ? 'completed' : 'failed';
    const comment = `Batch processing ${status} for ticket.
    
${result.success ? 'Successfully processed' : `Failed with error: ${result.error}`}
Processed at: ${result.processedAt}`;

    await this.jiraClient.addComment(ticket.jiraKey, comment);

    if (result.success) {
      await this.jiraClient.transitionTicket(ticket.jiraKey, 'Done');
    } else {
      await this.jiraClient.transitionTicket(ticket.jiraKey, 'To Do');
    }
  }

  /**
   * Handle batch rollback in Jira
   */
  async handleBatchRollback(
    batchId: string,
    reason: string
  ): Promise<JiraSyncResult> {
    const result: JiraSyncResult = {
      batchId,
      syncedTickets: 0,
      failedTickets: 0,
      errors: []
    };

    try {
      const batch = await this.repository.getBatchById(batchId);
      if (!batch) {
        throw new Error(`Batch ${batchId} not found`);
      }

      const rollbackComment = `⚠️ Batch processing has been rolled back

Batch: ${batch.name}
Reason: ${reason}
Rolled back at: ${new Date().toISOString()}

This ticket's changes have been reverted. Please review and resubmit if necessary.`;

      const activeTickets = batch.tickets?.filter(t => !t.excluded) || [];

      for (const batchTicket of activeTickets) {
        try {
          // Add rollback comment
          await this.jiraClient.addComment(
            batchTicket.ticket.jiraKey,
            rollbackComment
          );

          // Transition back to "To Do"
          await this.jiraClient.transitionTicket(
            batchTicket.ticket.jiraKey,
            'To Do'
          );

          result.syncedTickets++;
        } catch (error) {
          result.failedTickets++;
          result.errors.push(
            `Failed to rollback ${batchTicket.ticket.jiraKey}: ${(error as Error).message}`
          );
        }
      }

    } catch (error) {
      result.errors.push(`Rollback sync failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Create mock Jira client for testing
   */
  private createMockJiraClient(): JiraClient {
    return {
      async updateTicket(jiraKey: string, updates: any): Promise<void> {
        console.log(`Mock: Updating ${jiraKey} with`, updates);
      },
      
      async addComment(jiraKey: string, comment: string): Promise<void> {
        console.log(`Mock: Adding comment to ${jiraKey}:`, comment);
      },
      
      async linkTickets(fromKey: string, toKey: string, linkType: string): Promise<void> {
        console.log(`Mock: Linking ${fromKey} to ${toKey} with type ${linkType}`);
      },
      
      async getTicket(jiraKey: string): Promise<any> {
        console.log(`Mock: Getting ticket ${jiraKey}`);
        return { key: jiraKey, status: 'To Do' };
      },
      
      async transitionTicket(jiraKey: string, transition: string): Promise<void> {
        console.log(`Mock: Transitioning ${jiraKey} to ${transition}`);
      }
    };
  }

  /**
   * Get batch sync status
   */
  async getBatchSyncStatus(batchId: string): Promise<any> {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const results = await this.repository.getBatchResults(batchId);
    
    const syncStatus = {
      batchId,
      batchName: batch.name,
      totalTickets: batch.tickets?.length || 0,
      activeTickets: batch.tickets?.filter(t => !t.excluded).length || 0,
      processedTickets: results.length,
      successfulSyncs: results.filter(r => r.success).length,
      failedSyncs: results.filter(r => !r.success).length,
      lastSyncAt: results.length > 0 ? 
        results[results.length - 1].processedAt : 
        null
    };

    return syncStatus;
  }
}