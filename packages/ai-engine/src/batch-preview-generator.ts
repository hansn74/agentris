import { Ticket, TicketBatch } from '@agentris/db';
import { 
  PreviewFormat, 
  PreviewData,
  TableData,
  TextData,
  DiagramData
} from '@agentris/shared';
import { PreviewGenerator } from './preview-generator';
import { ChangeDetector, ChangeType } from './change-detector';
import { LLMService } from './llm-service';
import { buildBatchPreviewPrompt } from './prompts/batch-similarity';

export interface BatchPreviewOptions {
  format?: PreviewFormat;
  showIndividualChanges?: boolean;
  showConflicts?: boolean;
  showDependencies?: boolean;
}

export interface BatchPreviewResult {
  format: PreviewFormat;
  data: PreviewData;
  ticketPreviews: Map<string, PreviewData>;
  commonChanges: string[];
  conflicts: string[];
  executionOrder: string[];
}

export interface TicketChange {
  ticketId: string;
  ticketKey: string;
  summary: string;
  changes: string[];
  metadata?: Record<string, any>;
}

export class BatchPreviewGenerator {
  private previewGenerator: PreviewGenerator;
  private changeDetector: ChangeDetector;
  private llmService: LLMService;

  constructor(
    previewGenerator?: PreviewGenerator,
    changeDetector?: ChangeDetector,
    llmService?: LLMService
  ) {
    this.previewGenerator = previewGenerator || new PreviewGenerator();
    this.changeDetector = changeDetector || new ChangeDetector();
    this.llmService = llmService || new LLMService();
  }

  /**
   * Generate a combined preview for a batch of tickets
   */
  async generateBatchPreview(
    batch: TicketBatch,
    tickets: Ticket[],
    options: BatchPreviewOptions = {}
  ): Promise<BatchPreviewResult> {
    const {
      format = PreviewFormat.TABLE,
      showIndividualChanges = true,
      showConflicts = true,
      showDependencies = true
    } = options;

    // Extract change information from each ticket
    const ticketChanges = await this.extractTicketChanges(tickets);
    
    // Identify common changes across tickets
    const commonChanges = this.identifyCommonChanges(ticketChanges);
    
    // Detect conflicts between tickets
    const conflicts = showConflicts ? await this.detectConflicts(ticketChanges) : [];
    
    // Determine optimal execution order
    const executionOrder = showDependencies ? 
      await this.determineExecutionOrder(ticketChanges) : 
      ticketChanges.map(tc => tc.ticketId);

    // Generate individual previews if requested
    const ticketPreviews = new Map<string, PreviewData>();
    if (showIndividualChanges) {
      for (const ticket of tickets) {
        const preview = await this.previewGenerator.generatePreview({
          ticketId: ticket.id,
          ticketContent: `${ticket.summary}\n${ticket.description}`,
          format
        });
        ticketPreviews.set(ticket.id, preview.data);
      }
    }

    // Generate combined preview
    const combinedPreview = await this.generateCombinedPreview(
      batch,
      ticketChanges,
      commonChanges,
      conflicts,
      executionOrder,
      format
    );

    return {
      format,
      data: combinedPreview,
      ticketPreviews,
      commonChanges,
      conflicts,
      executionOrder
    };
  }

  /**
   * Extract change information from tickets
   */
  private async extractTicketChanges(tickets: Ticket[]): Promise<TicketChange[]> {
    const changes: TicketChange[] = [];

    for (const ticket of tickets) {
      const text = `${ticket.summary}\n${ticket.description}`;
      const detection = this.changeDetector.detectChangeType(text);
      
      // Extract specific changes using LLM
      const extractedChanges = await this.extractChangesWithLLM(text, detection);
      
      changes.push({
        ticketId: ticket.id,
        ticketKey: ticket.jiraKey,
        summary: ticket.summary,
        changes: extractedChanges,
        metadata: {
          changeType: detection.primaryType,
          objectNames: detection.metadata.objectNames,
          fieldNames: detection.metadata.fieldNames
        }
      });
    }

    return changes;
  }

  /**
   * Extract changes using LLM
   */
  private async extractChangesWithLLM(
    ticketContent: string,
    detection: any
  ): Promise<string[]> {
    const prompt = `Extract the specific changes requested in this ticket.
List each change as a separate item.

Ticket Content:
${ticketContent}

Detected Change Type: ${detection.primaryType}
Objects: ${detection.metadata.objectNames?.join(', ') || 'Not specified'}
Fields: ${detection.metadata.fieldNames?.join(', ') || 'Not specified'}

Format your response as a JSON array of strings:
["change 1", "change 2", ...]`;

    try {
      const response = await this.llmService.analyzeText(prompt, {
        temperature: 0.3,
        maxTokens: 500
      });
      
      // Parse JSON response
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error extracting changes:', error);
      return [`${detection.primaryType} change for ${detection.metadata.objectNames?.[0] || 'unknown object'}`];
    }
  }

  /**
   * Identify common changes across multiple tickets
   */
  private identifyCommonChanges(ticketChanges: TicketChange[]): string[] {
    const changeFrequency = new Map<string, number>();
    
    // Count frequency of each change
    for (const tc of ticketChanges) {
      for (const change of tc.changes) {
        const normalized = change.toLowerCase().trim();
        changeFrequency.set(normalized, (changeFrequency.get(normalized) || 0) + 1);
      }
    }
    
    // Find changes that appear in multiple tickets
    const commonChanges: string[] = [];
    for (const [change, frequency] of changeFrequency.entries()) {
      if (frequency > 1) {
        commonChanges.push(`${change} (${frequency} tickets)`);
      }
    }
    
    return commonChanges;
  }

  /**
   * Detect conflicts between ticket changes
   */
  private async detectConflicts(ticketChanges: TicketChange[]): Promise<string[]> {
    const conflicts: string[] = [];
    const objectFieldMap = new Map<string, Set<string>>();
    
    // Check for overlapping field changes on same objects
    for (const tc of ticketChanges) {
      const objects = tc.metadata?.objectNames || [];
      const fields = tc.metadata?.fieldNames || [];
      
      for (const obj of objects) {
        for (const field of fields) {
          const key = `${obj}.${field}`;
          if (objectFieldMap.has(key)) {
            conflicts.push(
              `Multiple tickets modify field "${field}" on object "${obj}"`
            );
          } else {
            if (!objectFieldMap.has(obj)) {
              objectFieldMap.set(obj, new Set());
            }
            objectFieldMap.get(obj)!.add(field);
          }
        }
      }
    }
    
    // Check for logical conflicts using LLM
    if (ticketChanges.length > 1 && ticketChanges.length <= 10) {
      const llmConflicts = await this.detectLogicalConflicts(ticketChanges);
      conflicts.push(...llmConflicts);
    }
    
    return [...new Set(conflicts)]; // Remove duplicates
  }

  /**
   * Detect logical conflicts using LLM
   */
  private async detectLogicalConflicts(ticketChanges: TicketChange[]): Promise<string[]> {
    const ticketSummaries = ticketChanges.map(tc => 
      `- ${tc.ticketKey}: ${tc.summary}\n  Changes: ${tc.changes.join(', ')}`
    ).join('\n');

    const prompt = `Analyze these ticket changes for logical conflicts or dependencies:

${ticketSummaries}

Identify any conflicts where:
1. Changes contradict each other
2. One change would break another
3. Changes must be done in a specific order
4. Changes affect the same business logic differently

Format response as JSON array of conflict descriptions:
["conflict 1", "conflict 2", ...]

If no conflicts, return empty array: []`;

    try {
      const response = await this.llmService.analyzeText(prompt, {
        temperature: 0.3,
        maxTokens: 500
      });
      
      const parsed = JSON.parse(response);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error detecting logical conflicts:', error);
      return [];
    }
  }

  /**
   * Determine optimal execution order for tickets
   */
  private async determineExecutionOrder(ticketChanges: TicketChange[]): Promise<string[]> {
    // Simple heuristic: process in order of change type priority
    const priorityMap: Record<string, number> = {
      [ChangeType.CUSTOM_OBJECT]: 1,
      [ChangeType.FIELD]: 2,
      [ChangeType.VALIDATION_RULE]: 3,
      [ChangeType.LAYOUT]: 4,
      [ChangeType.FLOW]: 5,
      [ChangeType.APEX]: 6,
      [ChangeType.TRIGGER]: 7,
      [ChangeType.PERMISSION_SET]: 8,
      [ChangeType.PROFILE]: 9
    };

    const sorted = [...ticketChanges].sort((a, b) => {
      const priorityA = priorityMap[a.metadata?.changeType] || 99;
      const priorityB = priorityMap[b.metadata?.changeType] || 99;
      return priorityA - priorityB;
    });

    return sorted.map(tc => tc.ticketId);
  }

  /**
   * Generate the combined preview
   */
  private async generateCombinedPreview(
    batch: TicketBatch,
    ticketChanges: TicketChange[],
    commonChanges: string[],
    conflicts: string[],
    executionOrder: string[],
    format: PreviewFormat
  ): Promise<PreviewData> {
    switch (format) {
      case PreviewFormat.TABLE:
        return this.generateTablePreview(
          batch,
          ticketChanges,
          commonChanges,
          conflicts,
          executionOrder
        );
        
      case PreviewFormat.TEXT:
        return this.generateTextPreview(
          batch,
          ticketChanges,
          commonChanges,
          conflicts,
          executionOrder
        );
        
      case PreviewFormat.DIAGRAM:
        return this.generateDiagramPreview(
          batch,
          ticketChanges,
          executionOrder
        );
        
      default:
        return this.generateTextPreview(
          batch,
          ticketChanges,
          commonChanges,
          conflicts,
          executionOrder
        );
    }
  }

  /**
   * Generate table format preview
   */
  private generateTablePreview(
    batch: TicketBatch,
    ticketChanges: TicketChange[],
    commonChanges: string[],
    conflicts: string[],
    executionOrder: string[]
  ): TableData {
    const rows = [];
    
    // Add header section
    rows.push(['Batch Name', batch.name]);
    rows.push(['Total Tickets', String(ticketChanges.length)]);
    rows.push(['Status', batch.status]);
    
    // Add common changes section
    if (commonChanges.length > 0) {
      rows.push(['', '']); // Empty row
      rows.push(['Common Changes', '']);
      for (const change of commonChanges) {
        rows.push(['', change]);
      }
    }
    
    // Add conflicts section
    if (conflicts.length > 0) {
      rows.push(['', '']); // Empty row
      rows.push(['⚠️ Conflicts', '']);
      for (const conflict of conflicts) {
        rows.push(['', conflict]);
      }
    }
    
    // Add ticket details
    rows.push(['', '']); // Empty row
    rows.push(['Ticket', 'Changes']);
    
    const orderedChanges = executionOrder.map(id => 
      ticketChanges.find(tc => tc.ticketId === id)!
    );
    
    for (const tc of orderedChanges) {
      rows.push([
        tc.ticketKey,
        tc.changes.join('\n')
      ]);
    }

    return {
      headers: ['Property', 'Value'],
      rows,
      caption: `Batch Preview: ${batch.name}`
    };
  }

  /**
   * Generate text format preview
   */
  private generateTextPreview(
    batch: TicketBatch,
    ticketChanges: TicketChange[],
    commonChanges: string[],
    conflicts: string[],
    executionOrder: string[]
  ): TextData {
    let content = `# Batch Preview: ${batch.name}\n\n`;
    
    content += `**Status:** ${batch.status}\n`;
    content += `**Total Tickets:** ${ticketChanges.length}\n\n`;
    
    if (commonChanges.length > 0) {
      content += `## Common Changes\n`;
      for (const change of commonChanges) {
        content += `- ${change}\n`;
      }
      content += '\n';
    }
    
    if (conflicts.length > 0) {
      content += `## ⚠️ Conflicts Detected\n`;
      for (const conflict of conflicts) {
        content += `- ${conflict}\n`;
      }
      content += '\n';
    }
    
    content += `## Execution Order\n`;
    const orderedChanges = executionOrder.map(id => 
      ticketChanges.find(tc => tc.ticketId === id)!
    );
    
    for (let i = 0; i < orderedChanges.length; i++) {
      const tc = orderedChanges[i];
      content += `\n### ${i + 1}. ${tc.ticketKey}: ${tc.summary}\n`;
      content += `**Changes:**\n`;
      for (const change of tc.changes) {
        content += `- ${change}\n`;
      }
    }

    return {
      content,
      mimeType: 'text/markdown'
    };
  }

  /**
   * Generate diagram format preview
   */
  private generateDiagramPreview(
    batch: TicketBatch,
    ticketChanges: TicketChange[],
    executionOrder: string[]
  ): DiagramData {
    const nodes: any[] = [];
    const edges: any[] = [];
    
    // Create nodes for each ticket
    for (let i = 0; i < executionOrder.length; i++) {
      const ticketId = executionOrder[i];
      const tc = ticketChanges.find(t => t.ticketId === ticketId)!;
      
      nodes.push({
        id: ticketId,
        label: tc.ticketKey,
        type: tc.metadata?.changeType || 'unknown',
        metadata: {
          summary: tc.summary,
          changes: tc.changes
        }
      });
      
      // Create edges to show execution order
      if (i > 0) {
        edges.push({
          from: executionOrder[i - 1],
          to: ticketId,
          label: 'then'
        });
      }
    }

    return {
      type: 'flow',
      nodes,
      edges,
      layout: 'hierarchical',
      direction: 'TB'
    };
  }
}