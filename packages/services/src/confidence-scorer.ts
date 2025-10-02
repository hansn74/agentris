import type { Recommendation, OrgPatterns } from '@agentris/shared';

interface ConfidenceFactors {
  patternStrength: number;
  historicalAccuracy: number;
  conflictSeverity: number;
  changeComplexity: number;
  userFeedback: number;
}

interface ScoringResult {
  recommendationId: string;
  originalConfidence: number;
  adjustedConfidence: number;
  factors: ConfidenceFactors;
  explanation: string[];
}

export class ConfidenceScorer {
  /**
   * Score confidence for a single recommendation
   */
  scoreRecommendation(
    recommendation: Recommendation,
    context: {
      patterns: OrgPatterns;
      historicalAcceptance?: number;
      relatedConflicts?: number;
      userFeedbackScore?: number;
    }
  ): ScoringResult {
    const factors = this.calculateFactors(recommendation, context);
    const adjustedConfidence = this.calculateAdjustedConfidence(
      recommendation.confidence,
      factors
    );
    const explanation = this.generateExplanation(factors);

    return {
      recommendationId: recommendation.id,
      originalConfidence: recommendation.confidence,
      adjustedConfidence,
      factors,
      explanation
    };
  }

  /**
   * Score confidence for multiple recommendations
   */
  scoreRecommendations(
    recommendations: Recommendation[],
    patterns: OrgPatterns,
    historicalData?: Map<string, number>
  ): Map<string, ScoringResult> {
    const results = new Map<string, ScoringResult>();

    for (const recommendation of recommendations) {
      const historicalAcceptance = historicalData?.get(recommendation.type) || 0.5;
      const relatedConflicts = recommendations.filter(
        r => r.type === 'conflict' && r.relatedChanges?.some(rc => rc.id === recommendation.id)
      ).length;

      const result = this.scoreRecommendation(recommendation, {
        patterns,
        historicalAcceptance,
        relatedConflicts
      });

      results.set(recommendation.id, result);
    }

    return results;
  }

  /**
   * Calculate confidence factors
   */
  private calculateFactors(
    recommendation: Recommendation,
    context: any
  ): ConfidenceFactors {
    const factors: ConfidenceFactors = {
      patternStrength: 0.5,
      historicalAccuracy: context.historicalAcceptance || 0.5,
      conflictSeverity: 1.0,
      changeComplexity: 0.7,
      userFeedback: context.userFeedbackScore || 0.5
    };

    // Calculate pattern strength
    if (context.patterns) {
      factors.patternStrength = this.calculatePatternStrength(
        recommendation.type,
        context.patterns
      );
    }

    // Adjust for conflicts
    if (context.relatedConflicts > 0) {
      factors.conflictSeverity = Math.max(0.3, 1 - (context.relatedConflicts * 0.2));
    }

    // Adjust for recommendation type
    if (recommendation.type === 'conflict') {
      factors.changeComplexity = 0.4; // Conflicts are complex
    } else if (recommendation.type === 'naming') {
      factors.changeComplexity = 0.9; // Naming is simple
    }

    return factors;
  }

  /**
   * Calculate pattern strength for a recommendation type
   */
  private calculatePatternStrength(
    type: string,
    patterns: OrgPatterns
  ): number {
    switch (type) {
      case 'naming':
        return patterns.namingPatterns.length > 0
          ? patterns.namingPatterns[0].confidence
          : 0.3;
      case 'fieldType':
        return patterns.fieldTypePatterns.length > 0
          ? patterns.fieldTypePatterns[0].confidence
          : 0.3;
      case 'relationship':
        return patterns.relationshipPatterns.length > 0
          ? patterns.relationshipPatterns[0].confidence
          : 0.3;
      case 'validation':
        return patterns.validationPatterns.length > 0
          ? patterns.validationPatterns[0].confidence
          : 0.3;
      case 'automation':
        return patterns.automationPatterns.length > 0
          ? patterns.automationPatterns[0].confidence
          : 0.3;
      default:
        return 0.5;
    }
  }

  /**
   * Calculate adjusted confidence based on factors
   */
  private calculateAdjustedConfidence(
    originalConfidence: number,
    factors: ConfidenceFactors
  ): number {
    // Weight the factors
    const weights = {
      patternStrength: 0.25,
      historicalAccuracy: 0.20,
      conflictSeverity: 0.20,
      changeComplexity: 0.15,
      userFeedback: 0.20
    };

    let adjustedScore = 0;
    for (const [key, value] of Object.entries(factors)) {
      adjustedScore += value * weights[key as keyof ConfidenceFactors];
    }

    // Blend with original confidence (60% original, 40% adjusted)
    const finalConfidence = (originalConfidence * 0.6) + (adjustedScore * 0.4);

    // Ensure within bounds
    return Math.max(0, Math.min(1, finalConfidence));
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(factors: ConfidenceFactors): string[] {
    const explanations: string[] = [];

    if (factors.patternStrength > 0.8) {
      explanations.push('Strong alignment with org patterns');
    } else if (factors.patternStrength < 0.4) {
      explanations.push('Weak alignment with org patterns');
    }

    if (factors.historicalAccuracy > 0.7) {
      explanations.push('Historically well-accepted recommendation type');
    } else if (factors.historicalAccuracy < 0.3) {
      explanations.push('Historically low acceptance for this type');
    }

    if (factors.conflictSeverity < 0.5) {
      explanations.push('Multiple conflicts detected');
    }

    if (factors.changeComplexity < 0.5) {
      explanations.push('Complex change with potential impacts');
    } else if (factors.changeComplexity > 0.8) {
      explanations.push('Simple, low-risk change');
    }

    if (factors.userFeedback > 0.7) {
      explanations.push('Positive user feedback trend');
    } else if (factors.userFeedback < 0.3) {
      explanations.push('Negative user feedback trend');
    }

    return explanations;
  }

  /**
   * Adjust confidence based on real-time feedback
   */
  adjustConfidenceFromFeedback(
    currentConfidence: number,
    feedback: {
      action: 'accepted' | 'rejected' | 'modified';
      similarAccepted: number;
      similarRejected: number;
    }
  ): number {
    let adjustment = 0;

    if (feedback.action === 'accepted') {
      adjustment = 0.05; // Boost confidence
    } else if (feedback.action === 'rejected') {
      adjustment = -0.05; // Reduce confidence
    } else {
      adjustment = -0.02; // Slight reduction for modified
    }

    // Consider historical feedback
    const acceptanceRate = feedback.similarAccepted / 
      Math.max(1, feedback.similarAccepted + feedback.similarRejected);
    
    if (acceptanceRate > 0.7) {
      adjustment += 0.03;
    } else if (acceptanceRate < 0.3) {
      adjustment -= 0.03;
    }

    return Math.max(0, Math.min(1, currentConfidence + adjustment));
  }
}

export const confidenceScorer = new ConfidenceScorer();