import type { Analysis } from '@prisma/client';
import type { Recommendation, RecommendationFeedback, LearningData } from '@agentris/shared';
export declare class RecommendationRepository {
    storeRecommendations(ticketId: string, recommendations: Recommendation[]): Promise<Analysis>;
    getRecommendations(ticketId: string): Promise<Recommendation[]>;
    getHistoricalRecommendations(orgId: string, limit?: number): Promise<Array<{
        ticketId: string;
        recommendations: Recommendation[];
        createdAt: Date;
    }>>;
    getRecommendationsByType(ticketId: string, type: string): Promise<Recommendation[]>;
    getLearningDataFromApprovals(recommendationType: string, startDate?: Date, endDate?: Date): Promise<LearningData>;
    updateRecommendationWithFeedback(ticketId: string, recommendationId: string, feedback: RecommendationFeedback): Promise<void>;
    getRecommendationVersionHistory(ticketId: string): Promise<Array<{
        version: number;
        recommendations: Recommendation[];
        createdAt: Date;
    }>>;
    searchRecommendations(criteria: {
        orgId?: string;
        type?: string;
        category?: string;
        minConfidence?: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<Recommendation[]>;
    getRecommendationStats(orgId: string): Promise<{
        totalRecommendations: number;
        byType: Record<string, number>;
        byCategory: Record<string, number>;
        averageConfidence: number;
        acceptanceRate: number;
    }>;
    private calculateRecommendationScore;
    private calculateAverageConfidence;
}
//# sourceMappingURL=RecommendationRepository.d.ts.map