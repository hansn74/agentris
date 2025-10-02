import { LLMService } from './llm-service';
import { ChangeDetector, ChangeType, ChangeDetectionResult } from './change-detector';
import { Ticket, Analysis, AnalysisType } from '@agentris/db';
import { getLLMCache } from './llm-cache';

export interface SimilarityScore {
  ticketId1: string;
  ticketId2: string;
  score: number;
  changeType: ChangeType;
  object?: string;
  confidence: number;
  reasoning: string;
}

export interface BatchGroupingSuggestion {
  name: string;
  tickets: string[];
  changeType: ChangeType;
  object?: string;
  averageSimilarity: number;
  criteria: {
    changeType: string;
    object?: string;
    threshold: number;
  };
}

export interface BatchAnalysisResult {
  similarityScores: SimilarityScore[];
  groupingSuggestions: BatchGroupingSuggestion[];
  totalAnalyzed: number;
  analysisTime: number;
}

export class BatchAnalyzer {
  private llmService: LLMService;
  private changeDetector: ChangeDetector;
  private similarityThreshold: number;
  private cache = getLLMCache({ prefix: 'batch_similarity' });

  constructor(
    llmService?: LLMService,
    changeDetector?: ChangeDetector,
    similarityThreshold: number = 0.7
  ) {
    this.llmService = llmService || new LLMService();
    this.changeDetector = changeDetector || new ChangeDetector();
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * Analyze tickets for batch processing similarity
   */
  async analyzeTicketsForBatching(
    tickets: Ticket[]
  ): Promise<BatchAnalysisResult> {
    const startTime = Date.now();
    
    if (tickets.length < 2) {
      return {
        similarityScores: [],
        groupingSuggestions: [],
        totalAnalyzed: tickets.length,
        analysisTime: Date.now() - startTime
      };
    }

    // Step 1: Detect change types for each ticket
    const changeDetections = await this.detectChangeTypes(tickets);
    
    // Step 2: Calculate pairwise similarity scores
    const similarityScores = await this.calculateSimilarityScores(
      tickets, 
      changeDetections
    );
    
    // Step 3: Group tickets based on similarity
    const groupingSuggestions = this.createGroupingSuggestions(
      tickets,
      similarityScores,
      changeDetections
    );

    return {
      similarityScores,
      groupingSuggestions,
      totalAnalyzed: tickets.length,
      analysisTime: Date.now() - startTime
    };
  }

  /**
   * Detect change types for all tickets
   */
  private async detectChangeTypes(
    tickets: Ticket[]
  ): Promise<Map<string, ChangeDetectionResult>> {
    const detections = new Map<string, ChangeDetectionResult>();
    
    for (const ticket of tickets) {
      const text = `${ticket.summary} ${ticket.description}`;
      const detection = this.changeDetector.detectChangeType(text);
      detections.set(ticket.id, detection);
    }
    
    return detections;
  }

  /**
   * Calculate similarity scores between ticket pairs
   */
  private async calculateSimilarityScores(
    tickets: Ticket[],
    changeDetections: Map<string, ChangeDetectionResult>
  ): Promise<SimilarityScore[]> {
    const scores: SimilarityScore[] = [];
    
    // Compare each ticket pair
    for (let i = 0; i < tickets.length - 1; i++) {
      for (let j = i + 1; j < tickets.length; j++) {
        const ticket1 = tickets[i];
        const ticket2 = tickets[j];
        const detection1 = changeDetections.get(ticket1.id);
        const detection2 = changeDetections.get(ticket2.id);
        
        if (!detection1 || !detection2) continue;
        
        // Quick check: if change types don't match, skip detailed analysis
        if (detection1.primaryType !== detection2.primaryType) {
          scores.push({
            ticketId1: ticket1.id,
            ticketId2: ticket2.id,
            score: 0.2, // Low similarity for different change types
            changeType: detection1.primaryType,
            confidence: 0.5,
            reasoning: 'Different change types detected'
          });
          continue;
        }
        
        // Detailed similarity analysis for matching change types
        const similarity = await this.calculateSemanticSimilarity(
          ticket1,
          ticket2,
          detection1,
          detection2
        );
        
        scores.push(similarity);
      }
    }
    
    return scores;
  }

  /**
   * Calculate semantic similarity between two tickets
   */
  private async calculateSemanticSimilarity(
    ticket1: Ticket,
    ticket2: Ticket,
    detection1: ChangeDetectionResult,
    detection2: ChangeDetectionResult
  ): Promise<SimilarityScore> {
    // Extract potential object names from metadata
    const object1 = detection1.metadata.objectNames?.[0];
    const object2 = detection2.metadata.objectNames?.[0];
    
    // If objects don't match, reduce similarity
    if (object1 && object2 && object1.toLowerCase() !== object2.toLowerCase()) {
      return {
        ticketId1: ticket1.id,
        ticketId2: ticket2.id,
        score: 0.3,
        changeType: detection1.primaryType,
        object: object1,
        confidence: 0.6,
        reasoning: `Different objects: ${object1} vs ${object2}`
      };
    }
    
    // Generate cache key for this comparison
    const cacheKey = this.cache.generateKey('similarity', {
      ticket1: ticket1.id,
      ticket2: ticket2.id,
      type1: detection1.primaryType,
      type2: detection2.primaryType,
      object1,
      object2
    });
    
    // Check cache first
    const cached = await this.cache.get<SimilarityScore>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Use LLM for detailed semantic similarity
    const prompt = this.buildSimilarityPrompt(ticket1, ticket2, detection1);
    
    try {
      const response = await this.llmService.analyzeText(prompt, {
        systemPrompt: SIMILARITY_SYSTEM_PROMPT,
        temperature: 0.3,
        maxTokens: 500
      });
      
      const analysis = this.parseSimilarityResponse(response);
      
      const result = {
        ticketId1: ticket1.id,
        ticketId2: ticket2.id,
        score: analysis.score,
        changeType: detection1.primaryType,
        object: object1 || object2,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning
      };
      
      // Cache the result
      await this.cache.set(cacheKey, result, 3600); // Cache for 1 hour
      
      return result;
    } catch (error) {
      console.error('Error calculating semantic similarity:', error);
      
      // Fallback to basic similarity
      return {
        ticketId1: ticket1.id,
        ticketId2: ticket2.id,
        score: 0.5,
        changeType: detection1.primaryType,
        object: object1 || object2,
        confidence: 0.4,
        reasoning: 'Fallback similarity calculation'
      };
    }
  }

  /**
   * Build prompt for similarity analysis
   */
  private buildSimilarityPrompt(
    ticket1: Ticket,
    ticket2: Ticket,
    detection: ChangeDetectionResult
  ): string {
    return `
Analyze the similarity between these two Salesforce configuration tickets for batch processing.
Both tickets involve ${detection.primaryType} changes.

Ticket 1:
- Summary: ${ticket1.summary}
- Description: ${ticket1.description}

Ticket 2:
- Summary: ${ticket2.summary}
- Description: ${ticket2.description}

Evaluate the following:
1. Are they targeting the same Salesforce object?
2. Are the changes similar in nature (e.g., both adding fields, both updating validation rules)?
3. Could they be efficiently processed together in a batch?
4. Are there any conflicts or dependencies between them?

Provide a similarity score from 0.0 to 1.0 and explain your reasoning.
Format: SCORE: [number] | CONFIDENCE: [number] | REASONING: [explanation]
`;
  }

  /**
   * Parse LLM response for similarity analysis
   */
  private parseSimilarityResponse(response: string): {
    score: number;
    confidence: number;
    reasoning: string;
  } {
    try {
      const scoreMatch = response.match(/SCORE:\s*([\d.]+)/i);
      const confidenceMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
      const reasoningMatch = response.match(/REASONING:\s*(.+)/i);
      
      return {
        score: scoreMatch ? parseFloat(scoreMatch[1]) : 0.5,
        confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5,
        reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'No reasoning provided'
      };
    } catch (error) {
      return {
        score: 0.5,
        confidence: 0.5,
        reasoning: 'Failed to parse similarity response'
      };
    }
  }

  /**
   * Create grouping suggestions based on similarity scores
   */
  private createGroupingSuggestions(
    tickets: Ticket[],
    similarityScores: SimilarityScore[],
    changeDetections: Map<string, ChangeDetectionResult>
  ): BatchGroupingSuggestion[] {
    const suggestions: BatchGroupingSuggestion[] = [];
    const processedTickets = new Set<string>();
    
    // Group tickets by change type and object
    const groups = new Map<string, Set<string>>();
    
    for (const score of similarityScores) {
      if (score.score < this.similarityThreshold) continue;
      
      const groupKey = `${score.changeType}_${score.object || 'unknown'}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, new Set());
      }
      
      groups.get(groupKey)!.add(score.ticketId1);
      groups.get(groupKey)!.add(score.ticketId2);
    }
    
    // Convert groups to suggestions
    for (const [groupKey, ticketIds] of groups.entries()) {
      const [changeType, object] = groupKey.split('_');
      
      // Skip if too few tickets
      if (ticketIds.size < 2) continue;
      
      // Calculate average similarity for the group
      const groupTicketIds = Array.from(ticketIds);
      let totalSimilarity = 0;
      let count = 0;
      
      for (const score of similarityScores) {
        if (groupTicketIds.includes(score.ticketId1) && 
            groupTicketIds.includes(score.ticketId2)) {
          totalSimilarity += score.score;
          count++;
        }
      }
      
      const avgSimilarity = count > 0 ? totalSimilarity / count : 0;
      
      suggestions.push({
        name: `${changeType} changes for ${object}`,
        tickets: groupTicketIds,
        changeType: changeType as ChangeType,
        object: object !== 'unknown' ? object : undefined,
        averageSimilarity: avgSimilarity,
        criteria: {
          changeType,
          object: object !== 'unknown' ? object : undefined,
          threshold: this.similarityThreshold
        }
      });
      
      // Mark tickets as processed
      groupTicketIds.forEach(id => processedTickets.add(id));
    }
    
    // Sort suggestions by average similarity (highest first)
    suggestions.sort((a, b) => b.averageSimilarity - a.averageSimilarity);
    
    return suggestions;
  }

  /**
   * Store analysis results in the database
   */
  async storeBatchAnalysis(
    ticketId: string,
    analysis: BatchAnalysisResult
  ): Promise<Analysis> {
    return {
      id: '', // Will be generated by database
      ticketId,
      type: AnalysisType.BATCH_SIMILARITY,
      findings: {
        similarityScores: analysis.similarityScores,
        groupingSuggestions: analysis.groupingSuggestions,
        totalAnalyzed: analysis.totalAnalyzed
      },
      confidence: this.calculateOverallConfidence(analysis),
      score: this.calculateOverallScore(analysis),
      patterns: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Calculate overall confidence for the analysis
   */
  private calculateOverallConfidence(analysis: BatchAnalysisResult): number {
    if (analysis.similarityScores.length === 0) return 0;
    
    const totalConfidence = analysis.similarityScores.reduce(
      (sum, score) => sum + score.confidence,
      0
    );
    
    return totalConfidence / analysis.similarityScores.length;
  }

  /**
   * Calculate overall score for the analysis
   */
  private calculateOverallScore(analysis: BatchAnalysisResult): number {
    if (analysis.groupingSuggestions.length === 0) return 0;
    
    // Score based on how many good groupings were found
    const maxGroups = Math.floor(analysis.totalAnalyzed / 2);
    const groupScore = Math.min(
      analysis.groupingSuggestions.length / maxGroups,
      1.0
    );
    
    // Factor in average similarity
    const avgSimilarity = analysis.groupingSuggestions.reduce(
      (sum, g) => sum + g.averageSimilarity,
      0
    ) / analysis.groupingSuggestions.length;
    
    return (groupScore + avgSimilarity) / 2;
  }
}

// System prompt for similarity analysis
const SIMILARITY_SYSTEM_PROMPT = `You are an expert Salesforce administrator analyzing ticket similarity for batch processing.
Focus on identifying tickets that can be efficiently processed together based on:
1. Target Salesforce object (Account, Contact, Opportunity, etc.)
2. Type of change (field creation, validation rule, flow, etc.)
3. Complexity and scope of changes
4. Potential conflicts or dependencies

Provide accurate similarity scores to enable efficient batch processing.`;