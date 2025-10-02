"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationRepository = void 0;
const index_1 = require("../index");
const client_1 = require("@prisma/client");
class RecommendationRepository {
    async storeRecommendations(ticketId, recommendations) {
        const existingAnalysis = await index_1.prisma.analysis.findFirst({
            where: {
                ticketId,
                type: 'COMPLEXITY'
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        if (existingAnalysis) {
            return await index_1.prisma.analysis.update({
                where: { id: existingAnalysis.id },
                data: {
                    findings: { recommendations: recommendations },
                    updatedAt: new Date()
                }
            });
        }
        return await index_1.prisma.analysis.create({
            data: {
                ticketId,
                type: 'COMPLEXITY',
                findings: { recommendations: recommendations },
                score: this.calculateRecommendationScore(recommendations),
                confidence: this.calculateAverageConfidence(recommendations)
            }
        });
    }
    async getRecommendations(ticketId) {
        const analysis = await index_1.prisma.analysis.findFirst({
            where: {
                ticketId,
                type: 'COMPLEXITY',
                findings: {
                    not: client_1.Prisma.JsonNull
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        if (!analysis || !analysis.findings) {
            return [];
        }
        return analysis.findings;
    }
    async getHistoricalRecommendations(orgId, limit = 100) {
        const tickets = await index_1.prisma.ticket.findMany({
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
        const analyses = await index_1.prisma.analysis.findMany({
            where: {
                ticketId: {
                    in: ticketIds
                },
                type: 'COMPLEXITY',
                findings: {
                    not: client_1.Prisma.JsonNull
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return analyses.map(a => ({
            ticketId: a.ticketId,
            recommendations: a.findings,
            createdAt: a.createdAt
        }));
    }
    async getRecommendationsByType(ticketId, type) {
        const recommendations = await this.getRecommendations(ticketId);
        return recommendations.filter(r => r.type === type);
    }
    async getLearningDataFromApprovals(recommendationType, startDate, endDate) {
        const where = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = startDate;
            if (endDate)
                where.createdAt.lte = endDate;
        }
        const approvalItems = await index_1.prisma.approvalItem.findMany({
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
                const data = JSON.parse(item.modifiedData);
                return {
                    original: data.original,
                    modified: data.modified,
                    reason: item.reason
                };
            }
            catch {
                return null;
            }
        })
            .filter(Boolean);
        return {
            patternId: recommendationType,
            feedbackCount: totalCount,
            acceptanceRate,
            modifications: modifications
        };
    }
    async updateRecommendationWithFeedback(ticketId, recommendationId, feedback) {
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
    async getRecommendationVersionHistory(ticketId) {
        const analyses = await index_1.prisma.analysis.findMany({
            where: {
                ticketId,
                type: 'COMPLEXITY',
                findings: {
                    not: client_1.Prisma.JsonNull
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
        return analyses.map((a, index) => ({
            version: index + 1,
            recommendations: a.findings,
            createdAt: a.createdAt
        }));
    }
    async searchRecommendations(criteria) {
        const whereClause = {};
        if (criteria.orgId) {
            const tickets = await index_1.prisma.ticket.findMany({
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
            if (criteria.startDate)
                whereClause.createdAt.gte = criteria.startDate;
            if (criteria.endDate)
                whereClause.createdAt.lte = criteria.endDate;
        }
        const analyses = await index_1.prisma.analysis.findMany({
            where: {
                ...whereClause,
                type: 'COMPLEXITY',
                findings: {
                    not: client_1.Prisma.JsonNull
                }
            }
        });
        const allRecommendations = [];
        for (const analysis of analyses) {
            const recommendations = analysis.findings;
            const filtered = recommendations.filter(rec => {
                if (criteria.type && rec.type !== criteria.type)
                    return false;
                if (criteria.category && rec.category !== criteria.category)
                    return false;
                if (criteria.minConfidence && rec.confidence < criteria.minConfidence)
                    return false;
                return true;
            });
            allRecommendations.push(...filtered);
        }
        return allRecommendations;
    }
    async getRecommendationStats(orgId) {
        const historicalData = await this.getHistoricalRecommendations(orgId, 1000);
        let totalRecommendations = 0;
        const byType = {};
        const byCategory = {};
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
        const approvalItems = await index_1.prisma.approvalItem.findMany({
            where: {}
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
    calculateRecommendationScore(recommendations) {
        if (recommendations.length === 0)
            return 0;
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
    calculateAverageConfidence(recommendations) {
        if (recommendations.length === 0)
            return 0;
        const totalConfidence = recommendations.reduce((sum, rec) => sum + rec.confidence, 0);
        return totalConfidence / recommendations.length;
    }
}
exports.RecommendationRepository = RecommendationRepository;
//# sourceMappingURL=RecommendationRepository.js.map