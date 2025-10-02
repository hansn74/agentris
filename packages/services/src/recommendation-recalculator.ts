import { EventEmitter } from 'events';
import { 
  PatternAnalyzer, 
  RecommendationEngine,
  ConflictDetector,
  LLMService
} from '@agentris/ai-engine';
import { MetadataService } from '@agentris/integrations-salesforce';
import { ImpactAnalyzerService } from './impact-analyzer';
import { RecommendationRepository } from '@agentris/db';
import type { Recommendation, OrgPatterns } from '@agentris/shared';

interface RecalculationContext {
  ticketId: string;
  orgId: string;
  proposedChanges: any;
  previousRecommendations?: Recommendation[];
  triggerType: 'manual' | 'auto' | 'context_change';
}

interface RecalculationResult {
  recommendations: Recommendation[];
  changes: {
    added: Recommendation[];
    removed: Recommendation[];
    modified: Recommendation[];
  };
  confidence: {
    overall: number;
    factors: string[];
  };
}

export class RecommendationRecalculator extends EventEmitter {
  private metadataService: MetadataService;
  private patternAnalyzer: PatternAnalyzer;
  private recommendationEngine: RecommendationEngine;
  private conflictDetector: ConflictDetector;
  private repository: RecommendationRepository;
  private recalculationQueue: Map<string, RecalculationContext[]> = new Map();
  private processing: boolean = false;

  constructor() {
    super();
    this.metadataService = new MetadataService();
    this.patternAnalyzer = new PatternAnalyzer(this.metadataService);
    
    const llmService = new LLMService({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: 'claude-3-opus-20240229'
    });
    
    this.recommendationEngine = new RecommendationEngine({
      llmService,
      patternAnalyzer: this.patternAnalyzer,
      metadataService: this.metadataService
    });
    
    this.conflictDetector = new ConflictDetector({
      metadataService: this.metadataService,
      impactAnalyzer: new ImpactAnalyzerService()
    });
    
    this.repository = new RecommendationRepository();
  }

  /**
   * Queue a recalculation request
   */
  async queueRecalculation(context: RecalculationContext): Promise<void> {
    const { ticketId } = context;
    
    if (!this.recalculationQueue.has(ticketId)) {
      this.recalculationQueue.set(ticketId, []);
    }
    
    this.recalculationQueue.get(ticketId)!.push(context);
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process the recalculation queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.recalculationQueue.size === 0) {
      return;
    }
    
    this.processing = true;
    
    try {
      for (const [ticketId, contexts] of this.recalculationQueue.entries()) {
        if (contexts.length > 0) {
          // Take the latest context (debouncing)
          const latestContext = contexts[contexts.length - 1];
          this.recalculationQueue.set(ticketId, []);
          
          // Perform recalculation
          const result = await this.recalculateRecommendations(latestContext);
          
          // Emit events
          this.emit('recalculated', {
            ticketId,
            result,
            context: latestContext
          });
        }
      }
    } finally {
      this.processing = false;
      
      // Check if more items were added while processing
      if (this.recalculationQueue.size > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  /**
   * Recalculate recommendations based on context changes
   */
  async recalculateRecommendations(
    context: RecalculationContext
  ): Promise<RecalculationResult> {
    const { ticketId, orgId, proposedChanges, previousRecommendations } = context;
    
    try {
      // Step 1: Re-analyze org patterns if context changed significantly
      const patterns = await this.analyzeContextChanges(orgId, ticketId, proposedChanges);
      
      // Step 2: Generate new recommendations
      const newRecommendations = await this.recommendationEngine.generateRecommendations({
        ticketId,
        orgId,
        proposedChanges,
        patterns
      });
      
      // Step 3: Detect new conflicts
      const conflicts = await this.conflictDetector.detectConflicts(
        orgId,
        proposedChanges
      );
      
      // Step 4: Merge conflict recommendations
      const conflictRecommendations = this.convertConflictsToRecommendations(conflicts);
      const allRecommendations = [...newRecommendations, ...conflictRecommendations];
      
      // Step 5: Calculate confidence scores
      const confidence = this.calculateConfidenceScores(
        allRecommendations,
        patterns,
        proposedChanges
      );
      
      // Step 6: Compare with previous recommendations
      const changes = this.compareRecommendations(
        previousRecommendations || [],
        allRecommendations
      );
      
      // Step 7: Store updated recommendations
      await this.repository.storeRecommendations(ticketId, allRecommendations);
      
      // Step 8: Track recalculation history
      await this.trackRecalculationHistory(ticketId, context, changes);
      
      return {
        recommendations: allRecommendations,
        changes,
        confidence
      };
    } catch (error) {
      console.error('Error recalculating recommendations:', error);
      throw error;
    }
  }

  /**
   * Analyze context changes to determine if pattern re-analysis is needed
   */
  private async analyzeContextChanges(
    orgId: string,
    ticketId: string,
    proposedChanges: any
  ): Promise<OrgPatterns> {
    // Check if changes affect pattern analysis
    const significantChange = this.isSignificantChange(proposedChanges);
    
    if (significantChange) {
      // Re-analyze patterns with new context
      return await this.patternAnalyzer.analyzeOrgPatterns(orgId, ticketId);
    }
    
    // Use cached patterns
    const analysis = await this.repository.getLatestAnalysis(ticketId);
    if (analysis?.findings) {
      return analysis.findings as OrgPatterns;
    }
    
    // Fallback to new analysis
    return await this.patternAnalyzer.analyzeOrgPatterns(orgId, ticketId);
  }

  /**
   * Determine if changes are significant enough to warrant re-analysis
   */
  private isSignificantChange(proposedChanges: any): boolean {
    if (!proposedChanges) return false;
    
    // Check for structural changes
    const hasNewObjects = proposedChanges.objects?.some((o: any) => o.action === 'create');
    const hasFieldTypeChanges = proposedChanges.fields?.some((f: any) => 
      f.action === 'modify' && f.changes?.type
    );
    const hasRelationshipChanges = proposedChanges.relationships?.length > 0;
    
    return hasNewObjects || hasFieldTypeChanges || hasRelationshipChanges;
  }

  /**
   * Convert conflicts to recommendations
   */
  private convertConflictsToRecommendations(conflicts: any[]): Recommendation[] {
    return conflicts.map(conflict => ({
      id: `conflict-${conflict.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'conflict',
      category: conflict.severity === 'critical' ? 'error' : 
                conflict.severity === 'high' ? 'warning' : 'suggestion',
      title: conflict.message,
      description: conflict.details,
      rationale: conflict.resolution,
      confidence: 0.95,
      impact: conflict.severity as 'high' | 'medium' | 'low',
      examples: conflict.affectedComponents
    }));
  }

  /**
   * Calculate confidence scores for recommendations
   */
  private calculateConfidenceScores(
    recommendations: Recommendation[],
    patterns: OrgPatterns,
    proposedChanges: any
  ): { overall: number; factors: string[] } {
    const factors: string[] = [];
    let totalConfidence = 0;
    let weightSum = 0;
    
    // Factor 1: Pattern consistency
    const patternScore = this.calculatePatternConsistency(patterns);
    if (patternScore > 0.8) {
      factors.push('Strong org patterns detected');
      totalConfidence += patternScore * 2;
      weightSum += 2;
    } else if (patternScore > 0.5) {
      factors.push('Moderate org patterns detected');
      totalConfidence += patternScore;
      weightSum += 1;
    } else {
      factors.push('Weak org patterns');
      totalConfidence += patternScore * 0.5;
      weightSum += 0.5;
    }
    
    // Factor 2: Recommendation consistency
    const avgRecommendationConfidence = recommendations.reduce(
      (sum, r) => sum + r.confidence, 0
    ) / Math.max(recommendations.length, 1);
    
    if (avgRecommendationConfidence > 0.8) {
      factors.push('High recommendation confidence');
    } else if (avgRecommendationConfidence > 0.6) {
      factors.push('Moderate recommendation confidence');
    } else {
      factors.push('Low recommendation confidence');
    }
    totalConfidence += avgRecommendationConfidence;
    weightSum += 1;
    
    // Factor 3: Conflict severity
    const criticalConflicts = recommendations.filter(
      r => r.type === 'conflict' && r.impact === 'high'
    ).length;
    
    if (criticalConflicts === 0) {
      factors.push('No critical conflicts');
      totalConfidence += 1;
      weightSum += 1;
    } else if (criticalConflicts <= 2) {
      factors.push(`${criticalConflicts} critical conflict(s)`);
      totalConfidence += 0.5;
      weightSum += 1;
    } else {
      factors.push(`${criticalConflicts} critical conflicts detected`);
      totalConfidence += 0.2;
      weightSum += 1;
    }
    
    // Factor 4: Change complexity
    const complexity = this.calculateChangeComplexity(proposedChanges);
    if (complexity < 0.3) {
      factors.push('Simple changes');
      totalConfidence += 0.9;
      weightSum += 0.5;
    } else if (complexity < 0.6) {
      factors.push('Moderate complexity');
      totalConfidence += 0.6;
      weightSum += 0.5;
    } else {
      factors.push('Complex changes');
      totalConfidence += 0.3;
      weightSum += 0.5;
    }
    
    return {
      overall: totalConfidence / weightSum,
      factors
    };
  }

  /**
   * Calculate pattern consistency score
   */
  private calculatePatternConsistency(patterns: OrgPatterns): number {
    let score = 0;
    let count = 0;
    
    // Check naming pattern consistency
    if (patterns.namingPatterns.length > 0) {
      const avgConfidence = patterns.namingPatterns.reduce(
        (sum, p) => sum + p.confidence, 0
      ) / patterns.namingPatterns.length;
      score += avgConfidence;
      count++;
    }
    
    // Check field type pattern consistency
    if (patterns.fieldTypePatterns.length > 0) {
      const avgConfidence = patterns.fieldTypePatterns.reduce(
        (sum, p) => sum + p.confidence, 0
      ) / patterns.fieldTypePatterns.length;
      score += avgConfidence;
      count++;
    }
    
    return count > 0 ? score / count : 0.5;
  }

  /**
   * Calculate change complexity
   */
  private calculateChangeComplexity(proposedChanges: any): number {
    if (!proposedChanges) return 0;
    
    let complexity = 0;
    
    // Count different types of changes
    const objectChanges = proposedChanges.objects?.length || 0;
    const fieldChanges = proposedChanges.fields?.length || 0;
    const relationshipChanges = proposedChanges.relationships?.length || 0;
    const validationChanges = proposedChanges.validations?.length || 0;
    
    // Weight different change types
    complexity = (
      objectChanges * 0.3 +
      fieldChanges * 0.2 +
      relationshipChanges * 0.3 +
      validationChanges * 0.2
    ) / 10;
    
    return Math.min(complexity, 1);
  }

  /**
   * Compare previous and new recommendations
   */
  private compareRecommendations(
    previous: Recommendation[],
    current: Recommendation[]
  ): RecalculationResult['changes'] {
    const previousIds = new Set(previous.map(r => r.id));
    const currentIds = new Set(current.map(r => r.id));
    
    const added = current.filter(r => !previousIds.has(r.id));
    const removed = previous.filter(r => !currentIds.has(r.id));
    
    // Find modified recommendations
    const modified: Recommendation[] = [];
    for (const curr of current) {
      const prev = previous.find(p => p.id === curr.id);
      if (prev && (
        prev.confidence !== curr.confidence ||
        prev.description !== curr.description ||
        prev.impact !== curr.impact
      )) {
        modified.push(curr);
      }
    }
    
    return { added, removed, modified };
  }

  /**
   * Track recalculation history
   */
  private async trackRecalculationHistory(
    ticketId: string,
    context: RecalculationContext,
    changes: RecalculationResult['changes']
  ): Promise<void> {
    await this.repository.addRecalculationHistory({
      ticketId,
      timestamp: new Date(),
      triggerType: context.triggerType,
      changesCount: {
        added: changes.added.length,
        removed: changes.removed.length,
        modified: changes.modified.length
      }
    });
  }
}

// Singleton instance
export const recommendationRecalculator = new RecommendationRecalculator();