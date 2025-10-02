import { prisma } from '@agentris/db';
import type { 
  RecommendationFeedback, 
  LearningData,
  Recommendation 
} from '@agentris/shared';

export interface FeedbackMetrics {
  totalFeedback: number;
  acceptanceRate: number;
  rejectionRate: number;
  modificationRate: number;
  patternAccuracy: Map<string, number>;
  commonModifications: Array<{
    original: string;
    modified: string;
    frequency: number;
  }>;
}

export class FeedbackProcessor {
  async processFeedback(
    feedback: RecommendationFeedback,
    recommendation: Recommendation
  ): Promise<void> {
    const approvalItem = await prisma.approvalItem.create({
      data: {
        approvalId: feedback.recommendationId,
        itemId: recommendation.id,
        itemType: recommendation.type,
        status: this.mapFeedbackToStatus(feedback.action),
        modifiedData: feedback.modifiedValue ? JSON.stringify(feedback.modifiedValue) : null,
        reason: feedback.reason
      }
    });

    await this.updatePatternWeights(recommendation, feedback);
    await this.analyzeFeedbackTrends(recommendation.type, feedback);
  }

  async trackApprovedRecommendation(
    recommendationId: string,
    recommendation: Recommendation,
    approvalId: string
  ): Promise<void> {
    await prisma.approvalItem.create({
      data: {
        approvalId,
        itemId: recommendationId,
        itemType: recommendation.type,
        status: 'APPROVED',
        modifiedData: JSON.stringify({
          confidence: recommendation.confidence,
          timestamp: new Date(),
          metadata: {
            title: recommendation.title,
            description: recommendation.description,
            rationale: recommendation.rationale
          }
        })
      }
    });

    await this.incrementPatternSuccess(recommendation.type);
  }

  async trackRejectedRecommendation(
    recommendationId: string,
    recommendation: Recommendation,
    approvalId: string,
    reason?: string
  ): Promise<void> {
    await prisma.approvalItem.create({
      data: {
        approvalId,
        itemId: recommendationId,
        itemType: recommendation.type,
        status: 'REJECTED',
        reason,
        modifiedData: JSON.stringify({
          confidence: recommendation.confidence,
          timestamp: new Date(),
          rejectionContext: {
            category: recommendation.category,
            impact: recommendation.impact
          }
        })
      }
    });

    await this.decrementPatternSuccess(recommendation.type);
  }

  async trackModifiedRecommendation(
    recommendationId: string,
    recommendation: Recommendation,
    approvalId: string,
    modifiedData: any,
    reason?: string
  ): Promise<void> {
    const modification = {
      original: recommendation,
      modified: modifiedData,
      timestamp: new Date(),
      changeType: this.detectChangeType(recommendation, modifiedData)
    };

    await prisma.approvalItem.create({
      data: {
        approvalId,
        itemId: recommendationId,
        itemType: recommendation.type,
        status: 'MODIFIED',
        modifiedData: JSON.stringify(modification),
        reason
      }
    });

    await this.learnFromModification(recommendation.type, modification);
  }

  async analyzeFeedbackTrends(
    recommendationType: string,
    feedback: RecommendationFeedback
  ): Promise<void> {
    const recentFeedback = await prisma.approvalItem.findMany({
      where: {
        itemType: recommendationType,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100
    });

    const trends = this.calculateTrends(recentFeedback);
    
    if (trends.significantChange) {
      await this.adjustRecommendationStrategy(recommendationType, trends);
    }
  }

  async updatePatternWeights(
    recommendation: Recommendation,
    feedback: RecommendationFeedback
  ): Promise<void> {
    const existingAnalysis = await prisma.analysis.findFirst({
      where: {
        ticketId: feedback.recommendationId.split('-')[0],
        type: 'COMPLEXITY'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (existingAnalysis?.findings) {
      const findings = existingAnalysis.findings as any;
      const weight = this.calculateNewWeight(feedback.action, recommendation.confidence);
      
      if (findings.patternWeights) {
        findings.patternWeights[recommendation.type] = weight;
      } else {
        findings.patternWeights = { [recommendation.type]: weight };
      }

      await prisma.analysis.update({
        where: { id: existingAnalysis.id },
        data: {
          findings: findings
        }
      });
    }
  }

  async getPatternLearningData(patternType: string): Promise<LearningData> {
    const feedback = await prisma.approvalItem.findMany({
      where: {
        itemType: patternType
      }
    });

    const acceptedCount = feedback.filter(f => f.status === 'APPROVED').length;
    const totalCount = feedback.length;
    const acceptanceRate = totalCount > 0 ? acceptedCount / totalCount : 0;

    const modifications = feedback
      .filter(f => f.status === 'MODIFIED' && f.modifiedData)
      .map(f => {
        const data = JSON.parse(f.modifiedData as string);
        return {
          original: data.original,
          modified: data.modified,
          reason: f.reason
        };
      });

    return {
      patternId: patternType,
      feedbackCount: totalCount,
      acceptanceRate,
      modifications
    };
  }

  async getFeedbackMetrics(startDate?: Date, endDate?: Date): Promise<FeedbackMetrics> {
    const whereClause: any = {};
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const allFeedback = await prisma.approvalItem.findMany({
      where: whereClause
    });

    const totalFeedback = allFeedback.length;
    const approved = allFeedback.filter(f => f.status === 'APPROVED').length;
    const rejected = allFeedback.filter(f => f.status === 'REJECTED').length;
    const modified = allFeedback.filter(f => f.status === 'MODIFIED').length;

    const patternAccuracy = new Map<string, number>();
    const itemTypes = [...new Set(allFeedback.map(f => f.itemType))];
    
    for (const itemType of itemTypes) {
      const typeItems = allFeedback.filter(f => f.itemType === itemType);
      const typeApproved = typeItems.filter(f => f.status === 'APPROVED').length;
      const accuracy = typeItems.length > 0 ? typeApproved / typeItems.length : 0;
      patternAccuracy.set(itemType, accuracy);
    }

    const modifications = allFeedback
      .filter(f => f.status === 'MODIFIED' && f.modifiedData)
      .map(f => {
        try {
          const data = JSON.parse(f.modifiedData as string);
          return {
            original: JSON.stringify(data.original),
            modified: JSON.stringify(data.modified)
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const modificationFrequency = new Map<string, number>();
    
    for (const mod of modifications) {
      if (!mod) continue;
      const key = `${mod.original}->${mod.modified}`;
      modificationFrequency.set(key, (modificationFrequency.get(key) || 0) + 1);
    }

    const commonModifications = Array.from(modificationFrequency.entries())
      .map(([key, frequency]) => {
        const [original, modified] = key.split('->');
        return { original, modified, frequency };
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    return {
      totalFeedback,
      acceptanceRate: totalFeedback > 0 ? approved / totalFeedback : 0,
      rejectionRate: totalFeedback > 0 ? rejected / totalFeedback : 0,
      modificationRate: totalFeedback > 0 ? modified / totalFeedback : 0,
      patternAccuracy,
      commonModifications
    };
  }

  async improveRecommendations(
    ticketId: string,
    previousRecommendations: Recommendation[]
  ): Promise<Recommendation[]> {
    const learningData = new Map<string, LearningData>();
    
    for (const rec of previousRecommendations) {
      const data = await this.getPatternLearningData(rec.type);
      learningData.set(rec.type, data);
    }

    const improvedRecommendations = previousRecommendations.map(rec => {
      const learning = learningData.get(rec.type);
      
      if (!learning || learning.feedbackCount < 5) {
        return rec;
      }

      const adjustedConfidence = this.adjustConfidence(
        rec.confidence,
        learning.acceptanceRate
      );

      const improvedRec = { ...rec, confidence: adjustedConfidence };

      if (learning.acceptanceRate < 0.3) {
        improvedRec.category = 'suggestion';
        improvedRec.description = `[Low acceptance rate] ${rec.description}`;
      } else if (learning.acceptanceRate >= 0.8) {
        if (rec.category === 'suggestion') {
          improvedRec.category = 'warning';
        }
        improvedRec.description = `[Highly recommended] ${rec.description}`;
      }

      if (learning.modifications.length > 0) {
        const commonMod = this.findCommonModificationPattern(learning.modifications);
        if (commonMod) {
          improvedRec.description += ` Note: Users often modify this to ${commonMod}`;
        }
      }

      return improvedRec;
    });

    return improvedRecommendations;
  }

  private mapFeedbackToStatus(action: 'accepted' | 'rejected' | 'modified'): 'APPROVED' | 'REJECTED' | 'MODIFIED' {
    switch (action) {
      case 'accepted':
        return 'APPROVED';
      case 'rejected':
        return 'REJECTED';
      case 'modified':
        return 'MODIFIED';
      default:
        return 'REJECTED';
    }
  }

  private async incrementPatternSuccess(patternType: string): Promise<void> {
    const key = `pattern_success_${patternType}`;
    await this.updateMetric(key, 1);
  }

  private async decrementPatternSuccess(patternType: string): Promise<void> {
    const key = `pattern_success_${patternType}`;
    await this.updateMetric(key, -1);
  }

  private async updateMetric(key: string, delta: number): Promise<void> {
    console.log(`Updating metric ${key} by ${delta}`);
  }

  private detectChangeType(original: any, modified: any): string {
    const changes: string[] = [];
    
    if (original.title !== modified.title) changes.push('title');
    if (original.description !== modified.description) changes.push('description');
    if (original.type !== modified.type) changes.push('type');
    if (original.category !== modified.category) changes.push('category');
    
    return changes.join(',') || 'unknown';
  }

  private async learnFromModification(
    patternType: string,
    modification: any
  ): Promise<void> {
    console.log(`Learning from modification in pattern ${patternType}:`, modification);
  }

  private calculateTrends(recentFeedback: any[]): any {
    if (!recentFeedback || recentFeedback.length === 0) {
      return {
        significantChange: false,
        trend: 'stable',
        acceptanceChange: 0
      };
    }
    
    const firstHalf = recentFeedback.slice(0, Math.floor(recentFeedback.length / 2));
    const secondHalf = recentFeedback.slice(Math.floor(recentFeedback.length / 2));

    const firstHalfAcceptance = firstHalf.filter(f => f.status === 'APPROVED').length / firstHalf.length;
    const secondHalfAcceptance = secondHalf.filter(f => f.status === 'APPROVED').length / secondHalf.length;

    const acceptanceChange = secondHalfAcceptance - firstHalfAcceptance;

    return {
      significantChange: Math.abs(acceptanceChange) > 0.2,
      trend: acceptanceChange > 0 ? 'improving' : 'declining',
      acceptanceChange
    };
  }

  private async adjustRecommendationStrategy(
    patternType: string,
    trends: any
  ): Promise<void> {
    console.log(`Adjusting strategy for ${patternType} based on trends:`, trends);
  }

  private calculateNewWeight(
    action: 'accepted' | 'rejected' | 'modified',
    currentConfidence: number
  ): number {
    const learningRate = 0.1;
    
    switch (action) {
      case 'accepted':
        return Math.min(1, currentConfidence + learningRate);
      case 'rejected':
        return Math.max(0, currentConfidence - learningRate * 2);
      case 'modified':
        return Math.max(0.3, currentConfidence - learningRate * 0.5);
      default:
        return currentConfidence;
    }
  }

  private adjustConfidence(
    baseConfidence: number,
    acceptanceRate: number
  ): number {
    const adjustment = (acceptanceRate - 0.5) * 0.3;
    const adjusted = baseConfidence + adjustment;
    return Math.max(0.1, Math.min(0.95, adjusted));
  }

  private findCommonModificationPattern(modifications: any[]): string | null {
    if (modifications.length === 0) return null;

    const modificationStrings = modifications.map(m => 
      typeof m.modified === 'string' ? m.modified : JSON.stringify(m.modified)
    );

    const frequency = new Map<string, number>();
    
    for (const mod of modificationStrings) {
      frequency.set(mod, (frequency.get(mod) || 0) + 1);
    }

    const mostCommon = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (mostCommon && mostCommon[1] >= modifications.length * 0.3) {
      return mostCommon[0];
    }

    return null;
  }
}