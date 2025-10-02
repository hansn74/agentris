import { 
  BatchRepository, 
  prisma,
  TicketBatch,
  BatchStatus,
  Ticket
} from '@agentris/db';
import { 
  BatchAnalyzer, 
  BatchGroupingSuggestion,
  SimilarityScore 
} from '@agentris/ai-engine';

export interface BatchGroupingConfig {
  minBatchSize?: number;
  maxBatchSize?: number;
  similarityThreshold?: number;
  autoCreateBatches?: boolean;
}

export interface BatchGroupingResult {
  batches: TicketBatch[];
  ungroupedTickets: Ticket[];
  totalProcessed: number;
  errors: string[];
}

export interface BatchValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class BatchProcessor {
  private repository: BatchRepository;
  private analyzer: BatchAnalyzer;
  private config: BatchGroupingConfig;

  constructor(
    repository?: BatchRepository,
    analyzer?: BatchAnalyzer,
    config: BatchGroupingConfig = {}
  ) {
    this.repository = repository || new BatchRepository(prisma);
    this.analyzer = analyzer || new BatchAnalyzer();
    this.config = {
      minBatchSize: 2,
      maxBatchSize: 50,
      similarityThreshold: 0.7,
      autoCreateBatches: false,
      ...config
    };
  }

  /**
   * Group tickets into batches based on similarity
   */
  async groupTickets(
    tickets: Ticket[],
    userId: string
  ): Promise<BatchGroupingResult> {
    const result: BatchGroupingResult = {
      batches: [],
      ungroupedTickets: [],
      totalProcessed: tickets.length,
      errors: []
    };

    if (tickets.length < this.config.minBatchSize!) {
      result.ungroupedTickets = tickets;
      result.errors.push(`Minimum ${this.config.minBatchSize} tickets required for batching`);
      return result;
    }

    try {
      // Analyze tickets for similarity
      const analysis = await this.analyzer.analyzeTicketsForBatching(tickets);
      
      // Create batches from grouping suggestions
      const batches = await this.createBatchesFromSuggestions(
        analysis.groupingSuggestions,
        tickets,
        userId
      );

      result.batches = batches;

      // Find ungrouped tickets
      const groupedTicketIds = new Set<string>();
      batches.forEach(batch => {
        batch.tickets?.forEach(bt => groupedTicketIds.add(bt.ticketId));
      });
      
      result.ungroupedTickets = tickets.filter(t => !groupedTicketIds.has(t.id));

    } catch (error) {
      console.error('Error grouping tickets:', error);
      result.errors.push(`Grouping failed: ${(error as Error).message}`);
      result.ungroupedTickets = tickets;
    }

    return result;
  }

  /**
   * Create batches from grouping suggestions
   */
  private async createBatchesFromSuggestions(
    suggestions: BatchGroupingSuggestion[],
    tickets: Ticket[],
    userId: string
  ): Promise<TicketBatch[]> {
    const batches: TicketBatch[] = [];
    const ticketMap = new Map(tickets.map(t => [t.id, t]));

    for (const suggestion of suggestions) {
      // Validate batch size
      if (suggestion.tickets.length < this.config.minBatchSize!) {
        continue;
      }

      if (suggestion.tickets.length > this.config.maxBatchSize!) {
        // Split large batches
        const splitBatches = this.splitLargeBatch(suggestion);
        for (const split of splitBatches) {
          const batch = await this.createBatchFromSuggestion(split, ticketMap, userId);
          if (batch) batches.push(batch);
        }
      } else {
        const batch = await this.createBatchFromSuggestion(suggestion, ticketMap, userId);
        if (batch) batches.push(batch);
      }
    }

    return batches;
  }

  /**
   * Create a single batch from a suggestion
   */
  private async createBatchFromSuggestion(
    suggestion: BatchGroupingSuggestion,
    ticketMap: Map<string, Ticket>,
    userId: string
  ): Promise<TicketBatch | null> {
    try {
      // Validate tickets exist
      const validTicketIds = suggestion.tickets.filter(id => ticketMap.has(id));
      
      if (validTicketIds.length < this.config.minBatchSize!) {
        return null;
      }

      // Create batch if auto-create is enabled
      if (this.config.autoCreateBatches) {
        const batch = await this.repository.createBatch({
          name: suggestion.name,
          groupingCriteria: suggestion.criteria,
          createdById: userId,
          ticketIds: validTicketIds,
          metadata: {
            averageSimilarity: suggestion.averageSimilarity,
            changeType: suggestion.changeType,
            object: suggestion.object
          }
        });

        return batch;
      } else {
        // Return batch structure without persisting
        return {
          id: `temp-${Date.now()}`,
          name: suggestion.name,
          groupingCriteria: suggestion.criteria as any,
          status: BatchStatus.PENDING,
          metadata: {
            averageSimilarity: suggestion.averageSimilarity,
            changeType: suggestion.changeType,
            object: suggestion.object
          },
          createdById: userId,
          approvedById: null,
          processedAt: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          tickets: validTicketIds.map(id => ({
            id: `temp-bt-${id}`,
            batchId: `temp-${Date.now()}`,
            ticketId: id,
            excluded: false,
            addedAt: new Date(),
            excludedAt: null,
            ticket: ticketMap.get(id)!
          }))
        } as any;
      }
    } catch (error) {
      console.error('Error creating batch:', error);
      return null;
    }
  }

  /**
   * Split a large batch into smaller ones
   */
  private splitLargeBatch(
    suggestion: BatchGroupingSuggestion
  ): BatchGroupingSuggestion[] {
    const splits: BatchGroupingSuggestion[] = [];
    const maxSize = this.config.maxBatchSize!;
    const tickets = [...suggestion.tickets];

    while (tickets.length > 0) {
      const splitTickets = tickets.splice(0, maxSize);
      splits.push({
        ...suggestion,
        name: `${suggestion.name} (Part ${splits.length + 1})`,
        tickets: splitTickets
      });
    }

    return splits;
  }

  /**
   * Validate a batch before processing
   */
  async validateBatch(batchId: string): Promise<BatchValidationResult> {
    const result: BatchValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      const batch = await this.repository.getBatchById(batchId);
      
      if (!batch) {
        result.isValid = false;
        result.errors.push('Batch not found');
        return result;
      }

      // Check batch status
      if (batch.status !== BatchStatus.PENDING && batch.status !== BatchStatus.APPROVED) {
        result.isValid = false;
        result.errors.push(`Batch is in ${batch.status} status and cannot be processed`);
      }

      // Check ticket count
      const activeTickets = batch.tickets?.filter(t => !t.excluded) || [];
      
      if (activeTickets.length < this.config.minBatchSize!) {
        result.isValid = false;
        result.errors.push(`Batch has ${activeTickets.length} tickets, minimum is ${this.config.minBatchSize}`);
      }

      if (activeTickets.length > this.config.maxBatchSize!) {
        result.warnings.push(`Batch has ${activeTickets.length} tickets, maximum recommended is ${this.config.maxBatchSize}`);
      }

      // Check for conflicting tickets
      const conflicts = await this.checkForConflicts(activeTickets.map(t => t.ticket));
      if (conflicts.length > 0) {
        result.warnings.push(...conflicts);
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation failed: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Check for conflicts between tickets in a batch
   */
  private async checkForConflicts(tickets: any[]): Promise<string[]> {
    const conflicts: string[] = [];
    const fieldsByObject = new Map<string, Set<string>>();

    // Group fields by object
    for (const ticket of tickets) {
      // This is a simplified check - in reality, you'd parse ticket details
      const object = ticket.description?.match(/object:\s*(\w+)/i)?.[1];
      const field = ticket.description?.match(/field:\s*(\w+)/i)?.[1];
      
      if (object && field) {
        if (!fieldsByObject.has(object)) {
          fieldsByObject.set(object, new Set());
        }
        
        const fields = fieldsByObject.get(object)!;
        if (fields.has(field)) {
          conflicts.push(`Multiple tickets modify the same field "${field}" on object "${object}"`);
        }
        fields.add(field);
      }
    }

    return conflicts;
  }

  /**
   * Process a batch (execute changes)
   */
  async processBatch(batchId: string): Promise<void> {
    // Validate batch first
    const validation = await this.validateBatch(batchId);
    if (!validation.isValid) {
      throw new Error(`Batch validation failed: ${validation.errors.join(', ')}`);
    }

    // Update status to processing
    await this.repository.updateBatchStatus(batchId, BatchStatus.PROCESSING);

    try {
      const batch = await this.repository.getBatchById(batchId);
      if (!batch) throw new Error('Batch not found');

      const activeTickets = batch.tickets?.filter(t => !t.excluded) || [];
      
      // Process each ticket in the batch
      for (const batchTicket of activeTickets) {
        try {
          // This would integrate with actual Salesforce deployment
          await this.processTicket(batchTicket.ticket, batchId);
          
          // Record success
          await this.repository.recordProcessingResult({
            batchId,
            ticketId: batchTicket.ticketId,
            success: true,
            metadata: { processedAt: new Date() }
          });
        } catch (error) {
          // Record failure
          await this.repository.recordProcessingResult({
            batchId,
            ticketId: batchTicket.ticketId,
            success: false,
            error: (error as Error).message,
            metadata: { failedAt: new Date() }
          });
        }
      }

      // Check results and update status
      const results = await this.repository.getBatchResults(batchId);
      const allSuccess = results.every(r => r.success);
      const someSuccess = results.some(r => r.success);

      if (allSuccess) {
        await this.repository.updateBatchStatus(batchId, BatchStatus.COMPLETED);
      } else if (someSuccess) {
        await this.repository.updateBatchStatus(batchId, BatchStatus.PARTIALLY_COMPLETED);
      } else {
        await this.repository.updateBatchStatus(batchId, BatchStatus.FAILED);
      }

    } catch (error) {
      await this.repository.updateBatchStatus(batchId, BatchStatus.FAILED);
      throw error;
    }
  }

  /**
   * Process an individual ticket
   */
  private async processTicket(ticket: any, batchId: string): Promise<void> {
    // This would integrate with the actual Salesforce deployment service
    // For now, it's a placeholder
    console.log(`Processing ticket ${ticket.id} in batch ${batchId}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Randomly fail 10% of tickets for testing
    if (Math.random() < 0.1) {
      throw new Error(`Failed to process ticket ${ticket.id}`);
    }
  }

  /**
   * Get batch statistics
   */
  async getBatchStatistics(batchId: string) {
    return this.repository.getBatchStatistics(batchId);
  }

  /**
   * Exclude a ticket from a batch
   */
  async excludeTicketFromBatch(
    batchId: string, 
    ticketId: string,
    reason?: string
  ): Promise<void> {
    // Validate batch exists
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Check if ticket is in the batch
    const batchTicket = batch.tickets?.find(t => t.ticketId === ticketId);
    if (!batchTicket) {
      throw new Error(`Ticket ${ticketId} not found in batch ${batchId}`);
    }

    // Check if already excluded
    if (batchTicket.excluded) {
      throw new Error(`Ticket ${ticketId} is already excluded from batch ${batchId}`);
    }

    // Exclude the ticket
    await this.repository.excludeTicketFromBatch(batchId, ticketId);

    // Check if batch still has minimum required tickets
    const remainingTickets = batch.tickets?.filter(
      t => t.ticketId !== ticketId && !t.excluded
    ).length || 0;

    if (remainingTickets < this.config.minBatchSize!) {
      console.warn(
        `Batch ${batchId} now has ${remainingTickets} tickets, below minimum of ${this.config.minBatchSize}`
      );
    }
  }

  /**
   * Re-include an excluded ticket in a batch
   */
  async includeTicketInBatch(
    batchId: string,
    ticketId: string
  ): Promise<void> {
    // Validate batch exists
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Check if ticket is in the batch
    const batchTicket = batch.tickets?.find(t => t.ticketId === ticketId);
    if (!batchTicket) {
      throw new Error(`Ticket ${ticketId} not found in batch ${batchId}`);
    }

    // Check if not excluded
    if (!batchTicket.excluded) {
      throw new Error(`Ticket ${ticketId} is not excluded from batch ${batchId}`);
    }

    // Re-include the ticket
    await this.repository.includeTicketInBatch(batchId, ticketId);

    // Check if batch exceeds maximum size
    const activeTickets = batch.tickets?.filter(
      t => (t.ticketId === ticketId || !t.excluded)
    ).length || 0;

    if (activeTickets > this.config.maxBatchSize!) {
      console.warn(
        `Batch ${batchId} now has ${activeTickets} tickets, above maximum of ${this.config.maxBatchSize}`
      );
    }
  }

  /**
   * Get excluded tickets from a batch
   */
  async getExcludedTickets(batchId: string): Promise<any[]> {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    return batch.tickets?.filter(t => t.excluded) || [];
  }

  /**
   * Recalculate batch after exclusions/inclusions
   */
  async recalculateBatch(batchId: string): Promise<void> {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    const activeTickets = batch.tickets?.filter(t => !t.excluded) || [];
    
    // Update batch metadata with new ticket count
    await this.repository.updateBatchStatus(
      batchId, 
      batch.status,
      batch.approvedById || undefined
    );
  }
}