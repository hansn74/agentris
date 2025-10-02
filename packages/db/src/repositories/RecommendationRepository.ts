import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import type { Analysis } from '@prisma/client';
import type { 
  Recommendation,
  RecommendationFeedback,
  LearningData 
} from '@agentris/shared';

export class RecommendationRepository {
  async storeRecommendations(
    ticketId: string,
    recommendations: Recommendation[]
  ): Promise<Analysis> {
    const existingAnalysis = await prisma.analysis.findFirst({
      where: {
        ticketId,
        type: 'COMPLEXITY'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (existingAnalysis) {
      return await prisma.analysis.update({
        where: { id: existingAnalysis.id },
        data: {
          suggestions: recommendations as Prisma.JsonValue,
          updatedAt: new Date()
        }
      });
    }

    return await prisma.analysis.create({
      data: {
        ticketId,
        type: 'COMPLEXITY',
        findings: {},
        score: this.calculateRecommendationScore(recommendations),
        confidence: this.calculateAverageConfidence(recommendations),
        suggestions: recommendations as Prisma.JsonValue
      }
    });
  }

  async getRecommendations(ticketId: string): Promise<Recommendation[]> {
    const analysis = await prisma.analysis.findFirst({
      where: {
        ticketId,
        type: 'COMPLEXITY',
        suggestions: {
          not: Prisma.JsonNull
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!analysis || !analysis.suggestions) {
      return [];
    }

    return analysis.suggestions as unknown as Recommendation[];
  }

  async getHistoricalRecommendations(
    orgId: string,
    limit: number = 100
  ): Promise<Array<{ ticketId: string; recommendations: Recommendation[]; createdAt: Date }>> {
    const tickets = await prisma.ticket.findMany({
      where: {
        organizationId: orgId
      },
      select: {
        id: true
      },
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    });

    const ticketIds = tickets.map(t => t.id);

    const analyses = await prisma.analysis.findMany({
      where: {
        ticketId: {
          in: ticketIds
        },
        type: 'COMPLEXITY',
        suggestions: {
          not: Prisma.JsonNull
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return analyses.map(a => ({
      ticketId: a.ticketId,
      recommendations: a.suggestions as unknown as Recommendation[],
      createdAt: a.createdAt
    }));
  }

  async getRecommendationsByType(
    ticketId: string,
    type: string
  ): Promise<Recommendation[]> {
    const recommendations = await this.getRecommendations(ticketId);
    return recommendations.filter(r => r.type === type);
  }

  async getLearningDataFromApprovals(
    recommendationType: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<LearningData> {
    const where: Prisma.ApprovalItemWhereInput = {
      itemType: recommendationType
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const approvalItems = await prisma.approvalItem.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });

    const totalCount = approvalItems.length;
    const acceptedCount = approvalItems.filter(item => item.status === 'APPROVED').length;
    const acceptanceRate = totalCount > 0 ? acceptedCount / totalCount : 0;

    const modifications = approvalItems
      .filter(item => item.status === 'MODIFIED' && item.modifiedData)
      .map(item => {
        try {
          const data = JSON.parse(item.modifiedData as string);
          return {
            original: data.original,
            modified: data.modified,
            reason: item.reason
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return {
      patternId: recommendationType,
      feedbackCount: totalCount,
      acceptanceRate,
      modifications: modifications as any[]
    };
  }

  async updateRecommendationWithFeedback(
    ticketId: string,
    recommendationId: string,
    feedback: RecommendationFeedback
  ): Promise<void> {
    const recommendations = await this.getRecommendations(ticketId);
    
    const updatedRecommendations = recommendations.map(rec => {
      if (rec.id === recommendationId) {
        return {
          ...rec,
          feedback: {
            action: feedback.action,
            reason: feedback.reason,
            modifiedValue: feedback.modifiedValue,
            timestamp: feedback.timestamp
          }
        };
      }
      return rec;
    });

    await this.storeRecommendations(ticketId, updatedRecommendations);
  }

  async getRecommendationVersionHistory(
    ticketId: string
  ): Promise<Array<{ version: number; recommendations: Recommendation[]; createdAt: Date }>> {
    const analyses = await prisma.analysis.findMany({
      where: {
        ticketId,
        type: 'COMPLEXITY',
        suggestions: {
          not: Prisma.JsonNull
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return analyses.map((a, index) => ({
      version: index + 1,
      recommendations: a.suggestions as unknown as Recommendation[],
      createdAt: a.createdAt
    }));
  }

  async searchRecommendations(
    criteria: {
      orgId?: string;
      type?: string;
      category?: string;
      minConfidence?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Recommendation[]> {
    const whereClause: any = {};

    if (criteria.orgId) {
      const tickets = await prisma.ticket.findMany({
        where: {
          organizationId: criteria.orgId
        },
        select: {
          id: true
        }
      });
      whereClause.ticketId = {
        in: tickets.map(t => t.id)
      };
    }

    if (criteria.startDate || criteria.endDate) {
      whereClause.createdAt = {};
      if (criteria.startDate) whereClause.createdAt.gte = criteria.startDate;
      if (criteria.endDate) whereClause.createdAt.lte = criteria.endDate;
    }

    const analyses = await prisma.analysis.findMany({
      where: {
        ...whereClause,
        type: 'COMPLEXITY',
        suggestions: {
          not: Prisma.JsonNull
        }
      }
    });

    const allRecommendations: Recommendation[] = [];

    for (const analysis of analyses) {
      const recommendations = analysis.suggestions as unknown as Recommendation[];
      
      const filtered = recommendations.filter(rec => {
        if (criteria.type && rec.type !== criteria.type) return false;
        if (criteria.category && rec.category !== criteria.category) return false;
        if (criteria.minConfidence && rec.confidence < criteria.minConfidence) return false;
        return true;
      });

      allRecommendations.push(...filtered);
    }

    return allRecommendations;
  }

  async getRecommendationStats(
    orgId: string
  ): Promise<{
    totalRecommendations: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    averageConfidence: number;
    acceptanceRate: number;
  }> {
    const historicalData = await this.getHistoricalRecommendations(orgId, 1000);
    
    let totalRecommendations = 0;
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalConfidence = 0;

    for (const data of historicalData) {
      for (const rec of data.recommendations) {
        totalRecommendations++;
        
        byType[rec.type] = (byType[rec.type] || 0) + 1;
        byCategory[rec.category] = (byCategory[rec.category] || 0) + 1;
        totalConfidence += rec.confidence;
      }
    }

    const averageConfidence = totalRecommendations > 0 
      ? totalConfidence / totalRecommendations 
      : 0;

    const approvalItems = await prisma.approvalItem.findMany({
      where: {
        approval: {
          ticket: {
            organizationId: orgId
          }
        }
      }
    });

    const acceptedCount = approvalItems.filter(item => item.status === 'APPROVED').length;
    const acceptanceRate = approvalItems.length > 0 
      ? acceptedCount / approvalItems.length 
      : 0;

    return {
      totalRecommendations,
      byType,
      byCategory,
      averageConfidence,
      acceptanceRate
    };
  }

  private calculateRecommendationScore(recommendations: Recommendation[]): number {
    if (recommendations.length === 0) return 0;

    const weights = {
      error: 1.0,
      warning: 0.6,
      suggestion: 0.3
    };

    let totalScore = 0;
    
    for (const rec of recommendations) {
      const categoryWeight = weights[rec.category] || 0.3;
      totalScore += categoryWeight * rec.confidence;
    }

    return Math.min(1, totalScore / recommendations.length);
  }

  private calculateAverageConfidence(recommendations: Recommendation[]): number {
    if (recommendations.length === 0) return 0;
    
    const totalConfidence = recommendations.reduce((sum, rec) => sum + rec.confidence, 0);
    return totalConfidence / recommendations.length;
  }
}