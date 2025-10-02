import { PrismaClient, Prisma } from '@prisma/client';
import type { Recommendation } from '@agentris/shared';

interface HistoryEntry {
  ticketId: string;
  recommendationId: string;
  version: number;
  recommendation: Recommendation;
  confidence: number;
  action?: 'created' | 'updated' | 'accepted' | 'rejected' | 'modified';
  metadata?: any;
  timestamp: Date;
}

interface RecalculationHistory {
  ticketId: string;
  triggerType: 'manual' | 'auto' | 'context_change';
  changesCount: {
    added: number;
    removed: number;
    modified: number;
  };
  timestamp: Date;
}

export class RecommendationHistoryRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Add a history entry for a recommendation
   */
  async addHistoryEntry(entry: HistoryEntry): Promise<void> {
    await this.prisma.analysis.create({
      data: {
        ticketId: entry.ticketId,
        type: 'RECOMMENDATION_HISTORY',
        findings: entry as any,
        score: entry.confidence,
        confidence: entry.confidence,
        metadata: {
          recommendationId: entry.recommendationId,
          version: entry.version,
          action: entry.action
        } as Prisma.JsonObject
      }
    });
  }

  /**
   * Get history for a specific recommendation
   */
  async getRecommendationHistory(
    recommendationId: string,
    limit: number = 10
  ): Promise<HistoryEntry[]> {
    const analyses = await this.prisma.analysis.findMany({
      where: {
        type: 'RECOMMENDATION_HISTORY',
        metadata: {
          path: ['recommendationId'],
          equals: recommendationId
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return analyses.map(a => a.findings as HistoryEntry);
  }

  /**
   * Get history for a ticket
   */
  async getTicketHistory(
    ticketId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<HistoryEntry[]> {
    const where: any = {
      ticketId,
      type: 'RECOMMENDATION_HISTORY'
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const analyses = await this.prisma.analysis.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return analyses.map(a => a.findings as HistoryEntry);
  }

  /**
   * Track recommendation acceptance/rejection
   */
  async trackAction(
    ticketId: string,
    recommendationId: string,
    action: 'accepted' | 'rejected' | 'modified',
    metadata?: any
  ): Promise<void> {
    // Get current recommendation
    const current = await this.getCurrentRecommendation(ticketId, recommendationId);
    
    if (!current) {
      throw new Error('Recommendation not found');
    }

    // Add history entry
    await this.addHistoryEntry({
      ticketId,
      recommendationId,
      version: await this.getNextVersion(recommendationId),
      recommendation: current,
      confidence: current.confidence,
      action,
      metadata,
      timestamp: new Date()
    });

    // Update statistics
    await this.updateStatistics(recommendationId, action);
  }

  /**
   * Add recalculation history
   */
  async addRecalculationHistory(history: RecalculationHistory): Promise<void> {
    await this.prisma.analysis.create({
      data: {
        ticketId: history.ticketId,
        type: 'RECALCULATION',
        findings: history as any,
        score: 0,
        confidence: 0,
        metadata: {
          triggerType: history.triggerType,
          timestamp: history.timestamp.toISOString()
        } as Prisma.JsonObject
      }
    });
  }

  /**
   * Get recalculation history for a ticket
   */
  async getRecalculationHistory(
    ticketId: string,
    limit: number = 10
  ): Promise<RecalculationHistory[]> {
    const analyses = await this.prisma.analysis.findMany({
      where: {
        ticketId,
        type: 'RECALCULATION'
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return analyses.map(a => a.findings as RecalculationHistory);
  }

  /**
   * Get recommendation statistics
   */
  async getRecommendationStats(
    orgId?: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalRecommendations: number;
    acceptanceRate: number;
    rejectionRate: number;
    modificationRate: number;
    averageConfidence: number;
    byType: Record<string, {
      count: number;
      acceptanceRate: number;
    }>;
  }> {
    const where: any = {
      type: 'RECOMMENDATION_HISTORY'
    };

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end
      };
    }

    const analyses = await this.prisma.analysis.findMany({ where });
    
    const stats = {
      totalRecommendations: 0,
      accepted: 0,
      rejected: 0,
      modified: 0,
      confidenceSum: 0,
      byType: {} as Record<string, { count: number; accepted: number }>
    };

    for (const analysis of analyses) {
      const entry = analysis.findings as HistoryEntry;
      stats.totalRecommendations++;
      stats.confidenceSum += entry.confidence;

      if (entry.action === 'accepted') stats.accepted++;
      else if (entry.action === 'rejected') stats.rejected++;
      else if (entry.action === 'modified') stats.modified++;

      // Track by type
      const type = entry.recommendation.type;
      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, accepted: 0 };
      }
      stats.byType[type].count++;
      if (entry.action === 'accepted') {
        stats.byType[type].accepted++;
      }
    }

    const total = Math.max(1, stats.totalRecommendations);
    
    // Calculate by-type acceptance rates
    const byType: Record<string, { count: number; acceptanceRate: number }> = {};
    for (const [type, data] of Object.entries(stats.byType)) {
      byType[type] = {
        count: data.count,
        acceptanceRate: data.count > 0 ? data.accepted / data.count : 0
      };
    }

    return {
      totalRecommendations: stats.totalRecommendations,
      acceptanceRate: stats.accepted / total,
      rejectionRate: stats.rejected / total,
      modificationRate: stats.modified / total,
      averageConfidence: stats.confidenceSum / total,
      byType
    };
  }

  /**
   * Get trending recommendations
   */
  async getTrendingRecommendations(
    limit: number = 5
  ): Promise<Array<{
    type: string;
    count: number;
    acceptanceRate: number;
    trend: 'up' | 'down' | 'stable';
  }>> {
    // Get stats for last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const recentStats = await this.getRecommendationStats(undefined, {
      start: weekAgo,
      end: new Date()
    });

    // Get stats for previous 7 days
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    const previousStats = await this.getRecommendationStats(undefined, {
      start: twoWeeksAgo,
      end: weekAgo
    });

    // Calculate trends
    const trends: Array<{
      type: string;
      count: number;
      acceptanceRate: number;
      trend: 'up' | 'down' | 'stable';
    }> = [];

    for (const [type, recent] of Object.entries(recentStats.byType)) {
      const previous = previousStats.byType[type];
      let trend: 'up' | 'down' | 'stable' = 'stable';
      
      if (previous) {
        const diff = recent.acceptanceRate - previous.acceptanceRate;
        if (diff > 0.1) trend = 'up';
        else if (diff < -0.1) trend = 'down';
      }

      trends.push({
        type,
        count: recent.count,
        acceptanceRate: recent.acceptanceRate,
        trend
      });
    }

    // Sort by count and return top N
    return trends
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Helper: Get current recommendation
   */
  private async getCurrentRecommendation(
    ticketId: string,
    recommendationId: string
  ): Promise<Recommendation | null> {
    const analysis = await this.prisma.analysis.findFirst({
      where: {
        ticketId,
        type: 'RECOMMENDATION'
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!analysis?.suggestions) return null;

    const recommendations = analysis.suggestions as Recommendation[];
    return recommendations.find(r => r.id === recommendationId) || null;
  }

  /**
   * Helper: Get next version number
   */
  private async getNextVersion(recommendationId: string): Promise<number> {
    const latest = await this.prisma.analysis.findFirst({
      where: {
        type: 'RECOMMENDATION_HISTORY',
        metadata: {
          path: ['recommendationId'],
          equals: recommendationId
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!latest?.findings) return 1;
    
    const entry = latest.findings as HistoryEntry;
    return (entry.version || 0) + 1;
  }

  /**
   * Helper: Update statistics
   */
  private async updateStatistics(
    recommendationId: string,
    action: string
  ): Promise<void> {
    // This could update a dedicated stats table for real-time dashboards
    // For now, stats are calculated on-demand from history
  }
}

export const recommendationHistoryRepository = new RecommendationHistoryRepository();