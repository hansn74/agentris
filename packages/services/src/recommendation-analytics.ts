import { EventEmitter } from 'events';
import { RecommendationHistoryRepository } from '@agentris/db';
import type { Recommendation, RecommendationFeedback } from '@agentris/shared';

interface AcceptanceMetrics {
  total: number;
  accepted: number;
  rejected: number;
  modified: number;
  acceptanceRate: number;
  rejectionRate: number;
  modificationRate: number;
}

interface PatternAccuracy {
  patternType: string;
  predictedCount: number;
  actualCount: number;
  accuracy: number;
  precision: number;
  recall: number;
}

interface LearningMetrics {
  iterationCount: number;
  improvementRate: number;
  feedbackIncorporated: number;
  patternRefinements: number;
  confidenceAdjustments: number;
}

interface DashboardMetrics {
  overview: {
    totalRecommendations: number;
    activeTickets: number;
    averageConfidence: number;
    overallAcceptance: number;
  };
  byType: Record<string, AcceptanceMetrics>;
  byTimeRange: {
    today: AcceptanceMetrics;
    thisWeek: AcceptanceMetrics;
    thisMonth: AcceptanceMetrics;
  };
  trending: Array<{
    type: string;
    trend: 'up' | 'down' | 'stable';
    change: number;
  }>;
  patternAccuracy: PatternAccuracy[];
  learningProgress: LearningMetrics;
}

export class RecommendationAnalytics extends EventEmitter {
  private repository: RecommendationHistoryRepository;
  private metricsCache: Map<string, any> = new Map();
  private cacheTimeout: number = 300000; // 5 minutes

  constructor() {
    super();
    this.repository = new RecommendationHistoryRepository();
  }

  /**
   * Track recommendation acceptance
   */
  async trackAcceptance(
    ticketId: string,
    recommendation: Recommendation,
    feedback: RecommendationFeedback
  ): Promise<void> {
    // Track in repository
    await this.repository.trackAction(
      ticketId,
      recommendation.id,
      feedback.action,
      {
        reason: feedback.reason,
        modifiedValue: feedback.modifiedValue,
        timestamp: feedback.timestamp
      }
    );

    // Clear relevant caches
    this.clearCache(`acceptance-${recommendation.type}`);
    this.clearCache('dashboard-metrics');

    // Emit event for real-time updates
    this.emit('recommendation-feedback', {
      ticketId,
      recommendationId: recommendation.id,
      type: recommendation.type,
      action: feedback.action,
      timestamp: feedback.timestamp
    });

    // Log for monitoring
    console.log(`[Analytics] Recommendation ${recommendation.id} ${feedback.action}`, {
      type: recommendation.type,
      confidence: recommendation.confidence,
      reason: feedback.reason
    });
  }

  /**
   * Get acceptance metrics for a specific type
   */
  async getAcceptanceMetrics(
    type?: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<AcceptanceMetrics> {
    const cacheKey = `acceptance-${type || 'all'}-${dateRange?.start?.toISOString() || 'all'}`;
    
    if (this.metricsCache.has(cacheKey)) {
      return this.metricsCache.get(cacheKey);
    }

    const stats = await this.repository.getRecommendationStats(undefined, dateRange);
    
    let metrics: AcceptanceMetrics;
    
    if (type && stats.byType[type]) {
      const typeStats = stats.byType[type];
      const total = typeStats.count;
      const accepted = Math.round(typeStats.acceptanceRate * total);
      const rejected = Math.round((1 - typeStats.acceptanceRate) * total * 0.6); // Estimate
      const modified = total - accepted - rejected;

      metrics = {
        total,
        accepted,
        rejected,
        modified,
        acceptanceRate: typeStats.acceptanceRate,
        rejectionRate: rejected / Math.max(1, total),
        modificationRate: modified / Math.max(1, total)
      };
    } else {
      metrics = {
        total: stats.totalRecommendations,
        accepted: Math.round(stats.acceptanceRate * stats.totalRecommendations),
        rejected: Math.round(stats.rejectionRate * stats.totalRecommendations),
        modified: Math.round(stats.modificationRate * stats.totalRecommendations),
        acceptanceRate: stats.acceptanceRate,
        rejectionRate: stats.rejectionRate,
        modificationRate: stats.modificationRate
      };
    }

    this.cacheWithTimeout(cacheKey, metrics);
    return metrics;
  }

  /**
   * Monitor pattern detection accuracy
   */
  async monitorPatternAccuracy(
    predictedPatterns: any[],
    actualPatterns: any[]
  ): Promise<PatternAccuracy[]> {
    const accuracyMetrics: PatternAccuracy[] = [];

    const patternTypes = ['naming', 'fieldType', 'relationship', 'validation', 'automation'];

    for (const patternType of patternTypes) {
      const predicted = predictedPatterns.filter(p => p.type === patternType);
      const actual = actualPatterns.filter(p => p.type === patternType);
      
      const truePositives = predicted.filter(p => 
        actual.some(a => this.patternsMatch(p, a))
      ).length;
      
      const falsePositives = predicted.length - truePositives;
      const falseNegatives = actual.filter(a => 
        !predicted.some(p => this.patternsMatch(p, a))
      ).length;

      const precision = predicted.length > 0 
        ? truePositives / predicted.length 
        : 0;
      
      const recall = actual.length > 0 
        ? truePositives / actual.length 
        : 0;
      
      const accuracy = (predicted.length + actual.length) > 0
        ? (2 * truePositives) / (predicted.length + actual.length)
        : 0;

      accuracyMetrics.push({
        patternType,
        predictedCount: predicted.length,
        actualCount: actual.length,
        accuracy,
        precision,
        recall
      });

      // Log significant discrepancies
      if (accuracy < 0.7) {
        console.warn(`[Analytics] Low pattern accuracy for ${patternType}: ${(accuracy * 100).toFixed(1)}%`);
      }
    }

    // Emit metrics for monitoring
    this.emit('pattern-accuracy', accuracyMetrics);

    return accuracyMetrics;
  }

  /**
   * Log learning system improvements
   */
  async logLearningImprovement(
    ticketId: string,
    improvement: {
      type: 'pattern_refinement' | 'confidence_adjustment' | 'feedback_incorporation';
      before: any;
      after: any;
      metric: number;
    }
  ): Promise<void> {
    // Log to console for monitoring
    console.log(`[Learning] Improvement detected for ticket ${ticketId}`, {
      type: improvement.type,
      metric: improvement.metric,
      improvement: ((improvement.metric - 1) * 100).toFixed(1) + '%'
    });

    // Store in database for tracking
    await this.repository.addHistoryEntry({
      ticketId,
      recommendationId: `learning-${Date.now()}`,
      version: 1,
      recommendation: {
        id: `learning-${Date.now()}`,
        type: 'automation',
        category: 'suggestion',
        title: 'Learning System Update',
        description: `${improvement.type} improvement`,
        rationale: JSON.stringify(improvement),
        confidence: improvement.metric
      },
      confidence: improvement.metric,
      action: 'created',
      metadata: improvement,
      timestamp: new Date()
    });

    // Emit for real-time dashboard
    this.emit('learning-improvement', {
      ticketId,
      improvement
    });
  }

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const cacheKey = 'dashboard-metrics';
    
    if (this.metricsCache.has(cacheKey)) {
      return this.metricsCache.get(cacheKey);
    }

    // Get overall stats
    const overallStats = await this.repository.getRecommendationStats();
    
    // Get time-based metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMetrics = await this.getAcceptanceMetrics(undefined, {
      start: today,
      end: new Date()
    });

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekMetrics = await this.getAcceptanceMetrics(undefined, {
      start: weekStart,
      end: new Date()
    });

    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);
    const monthMetrics = await this.getAcceptanceMetrics(undefined, {
      start: monthStart,
      end: new Date()
    });

    // Get type-specific metrics
    const byType: Record<string, AcceptanceMetrics> = {};
    for (const [type, data] of Object.entries(overallStats.byType)) {
      byType[type] = await this.getAcceptanceMetrics(type);
    }

    // Get trending data
    const trendingData = await this.repository.getTrendingRecommendations();
    const trending = trendingData.map(t => ({
      type: t.type,
      trend: t.trend,
      change: t.acceptanceRate
    }));

    // Mock pattern accuracy (would be calculated from actual data)
    const patternAccuracy: PatternAccuracy[] = [
      {
        patternType: 'naming',
        predictedCount: 45,
        actualCount: 42,
        accuracy: 0.89,
        precision: 0.91,
        recall: 0.88
      },
      {
        patternType: 'fieldType',
        predictedCount: 38,
        actualCount: 35,
        accuracy: 0.85,
        precision: 0.87,
        recall: 0.83
      }
    ];

    // Mock learning metrics (would be calculated from actual data)
    const learningProgress: LearningMetrics = {
      iterationCount: 127,
      improvementRate: 0.15,
      feedbackIncorporated: 89,
      patternRefinements: 23,
      confidenceAdjustments: 45
    };

    const metrics: DashboardMetrics = {
      overview: {
        totalRecommendations: overallStats.totalRecommendations,
        activeTickets: 15, // Would query actual data
        averageConfidence: overallStats.averageConfidence,
        overallAcceptance: overallStats.acceptanceRate
      },
      byType,
      byTimeRange: {
        today: todayMetrics,
        thisWeek: weekMetrics,
        thisMonth: monthMetrics
      },
      trending,
      patternAccuracy,
      learningProgress
    };

    this.cacheWithTimeout(cacheKey, metrics);
    return metrics;
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    format: 'json' | 'csv',
    dateRange?: { start: Date; end: Date }
  ): Promise<string> {
    const stats = await this.repository.getRecommendationStats(undefined, dateRange);
    const history = await this.repository.getTicketHistory('all', dateRange?.start, dateRange?.end);

    if (format === 'json') {
      return JSON.stringify({
        stats,
        history,
        exportDate: new Date().toISOString()
      }, null, 2);
    } else {
      // CSV format
      const headers = ['Date', 'Type', 'Action', 'Confidence', 'TicketId'];
      const rows = history.map(h => [
        h.timestamp.toISOString(),
        h.recommendation.type,
        h.action || 'created',
        h.confidence.toFixed(2),
        h.ticketId
      ]);

      return [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');
    }
  }

  /**
   * Helper: Check if patterns match
   */
  private patternsMatch(p1: any, p2: any): boolean {
    return p1.pattern === p2.pattern || 
           (p1.name === p2.name && p1.type === p2.type);
  }

  /**
   * Helper: Cache with timeout
   */
  private cacheWithTimeout(key: string, value: any): void {
    this.metricsCache.set(key, value);
    setTimeout(() => this.metricsCache.delete(key), this.cacheTimeout);
  }

  /**
   * Helper: Clear cache
   */
  private clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.metricsCache.keys()) {
        if (key.includes(pattern)) {
          this.metricsCache.delete(key);
        }
      }
    } else {
      this.metricsCache.clear();
    }
  }
}

export const recommendationAnalytics = new RecommendationAnalytics();