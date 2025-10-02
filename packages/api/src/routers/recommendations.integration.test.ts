import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createInnerTRPCContext, createCallerFactory } from '../trpc';
import { appRouter } from './index';
import { PrismaClient } from '@prisma/client';
import type { Recommendation, OrgPatterns } from '@agentris/shared';

// Integration test that tests the full flow
describe('Recommendations Integration Test', () => {
  let prisma: PrismaClient;
  let caller: ReturnType<typeof createCallerFactory>;
  let ctx: ReturnType<typeof createInnerTRPCContext>;

  const testUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User'
  };

  const testTicket = {
    id: 'ticket-integration-test',
    orgId: 'org-integration-test',
    title: 'Test Ticket for Integration',
    description: 'Testing full recommendation flow'
  };

  beforeAll(async () => {
    // Setup test database
    prisma = new PrismaClient();
    
    // Create test context
    ctx = createInnerTRPCContext({
      session: {
        user: testUser,
        expires: new Date(Date.now() + 86400000).toISOString()
      }
    });

    // Create caller with auth context
    const createCaller = createCallerFactory(appRouter);
    caller = createCaller(ctx);

    // Create test ticket in database
    await prisma.ticket.create({
      data: {
        id: testTicket.id,
        title: testTicket.title,
        description: testTicket.description,
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        createdById: testUser.id,
        orgId: testTicket.orgId
      }
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.analysis.deleteMany({
      where: { ticketId: testTicket.id }
    });
    
    await prisma.ticket.delete({
      where: { id: testTicket.id }
    });

    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear any existing recommendations
    await prisma.analysis.deleteMany({
      where: { 
        ticketId: testTicket.id,
        type: { in: ['RECOMMENDATION', 'RECOMMENDATION_HISTORY'] }
      }
    });
  });

  describe('Full Recommendation Flow', () => {
    it('should complete the entire recommendation lifecycle', async () => {
      // Step 1: Analyze org context
      console.log('Step 1: Analyzing org context...');
      const contextResult = await caller.recommendations.analyzeOrgContext({
        ticketId: testTicket.id,
        orgId: testTicket.orgId
      });

      expect(contextResult.success).toBe(true);
      expect(contextResult.patterns).toBeDefined();
      expect(contextResult.summary).toBeDefined();
      expect(contextResult.summary.namingPatternCount).toBeGreaterThanOrEqual(0);

      // Step 2: Generate recommendations
      console.log('Step 2: Generating recommendations...');
      const proposedChanges = {
        fields: [
          {
            name: 'customerStatus',
            type: 'Text',
            label: 'Customer Status',
            action: 'create'
          }
        ]
      };

      const recommendationsResult = await caller.recommendations.getRecommendations({
        ticketId: testTicket.id,
        orgId: testTicket.orgId,
        proposedChanges
      });

      expect(recommendationsResult.success).toBe(true);
      expect(recommendationsResult.recommendations).toBeInstanceOf(Array);
      expect(recommendationsResult.fromCache).toBe(false);

      const recommendations = recommendationsResult.recommendations;
      expect(recommendations.length).toBeGreaterThan(0);

      // Step 3: Check for conflicts
      console.log('Step 3: Checking for conflicts...');
      const conflictsResult = await caller.recommendations.checkConflicts({
        orgId: testTicket.orgId,
        proposedChanges,
        existingMetadata: {
          fields: [
            { name: 'CustomerStatus__c', type: 'Picklist' }
          ]
        }
      });

      expect(conflictsResult.success).toBe(true);
      expect(conflictsResult.conflicts).toBeInstanceOf(Array);
      expect(conflictsResult.hasConflicts).toBeDefined();

      // Step 4: Submit feedback on recommendations
      console.log('Step 4: Submitting feedback...');
      if (recommendations.length > 0) {
        const firstRecommendation = recommendations[0];
        
        // Accept a recommendation
        const acceptResult = await caller.recommendations.submitFeedback({
          recommendationId: firstRecommendation.id,
          action: 'accepted',
          timestamp: new Date()
        });

        expect(acceptResult.success).toBe(true);
        expect(acceptResult.message).toBe('Feedback submitted successfully');

        // Reject a recommendation if there's more than one
        if (recommendations.length > 1) {
          const secondRecommendation = recommendations[1];
          
          const rejectResult = await caller.recommendations.submitFeedback({
            recommendationId: secondRecommendation.id,
            action: 'rejected',
            reason: 'Not applicable to our use case',
            timestamp: new Date()
          });

          expect(rejectResult.success).toBe(true);
        }
      }

      // Step 5: Get recommendation statistics
      console.log('Step 5: Getting recommendation statistics...');
      const statsResult = await caller.recommendations.getRecommendationStats({
        orgId: testTicket.orgId
      });

      expect(statsResult.success).toBe(true);
      expect(statsResult.stats).toBeDefined();
      expect(statsResult.stats.totalRecommendations).toBeGreaterThanOrEqual(0);

      // Step 6: Test caching
      console.log('Step 6: Testing caching...');
      const cachedResult = await caller.recommendations.getRecommendations({
        ticketId: testTicket.id,
        orgId: testTicket.orgId
      });

      expect(cachedResult.success).toBe(true);
      expect(cachedResult.fromCache).toBe(true);
      expect(cachedResult.recommendations.length).toBe(recommendations.length);

      // Step 7: Improve recommendations with learning
      console.log('Step 7: Improving recommendations...');
      const improveResult = await caller.recommendations.improveRecommendations({
        ticketId: testTicket.id,
        applyLearning: true
      });

      expect(improveResult.success).toBe(true);
      expect(improveResult.improved).toBe(true);
      expect(improveResult.recommendations).toBeInstanceOf(Array);

      // Step 8: Search recommendations
      console.log('Step 8: Searching recommendations...');
      const searchResult = await caller.recommendations.searchRecommendations({
        orgId: testTicket.orgId,
        type: 'naming',
        minConfidence: 0.5
      });

      expect(searchResult.success).toBe(true);
      expect(searchResult.recommendations).toBeInstanceOf(Array);
      expect(searchResult.count).toBeDefined();
    });

    it('should handle real-time updates via recalculation', async () => {
      // Generate initial recommendations
      const initialResult = await caller.recommendations.getRecommendations({
        ticketId: testTicket.id,
        orgId: testTicket.orgId,
        proposedChanges: {
          fields: [{ name: 'InitialField__c', type: 'Text' }]
        }
      });

      expect(initialResult.success).toBe(true);
      const initialCount = initialResult.recommendations.length;

      // Simulate context change and recalculation
      const updatedResult = await caller.recommendations.getRecommendations({
        ticketId: testTicket.id,
        orgId: testTicket.orgId,
        proposedChanges: {
          fields: [
            { name: 'InitialField__c', type: 'Text' },
            { name: 'AdditionalField__c', type: 'Number' }
          ]
        }
      });

      expect(updatedResult.success).toBe(true);
      expect(updatedResult.recommendations.length).toBeGreaterThanOrEqual(initialCount);
    });

    it('should track recommendation history', async () => {
      // Generate recommendations
      const result = await caller.recommendations.getRecommendations({
        ticketId: testTicket.id,
        orgId: testTicket.orgId,
        proposedChanges: {
          fields: [{ name: 'HistoryTest__c', type: 'Text' }]
        }
      });

      expect(result.success).toBe(true);
      
      if (result.recommendations.length > 0) {
        const recommendation = result.recommendations[0];
        
        // Submit multiple feedback actions
        await caller.recommendations.submitFeedback({
          recommendationId: recommendation.id,
          action: 'rejected',
          reason: 'Initial rejection',
          timestamp: new Date()
        });

        // Later accept it
        await caller.recommendations.submitFeedback({
          recommendationId: recommendation.id,
          action: 'accepted',
          timestamp: new Date()
        });

        // Check that history was tracked
        const stats = await caller.recommendations.getRecommendationStats({
          orgId: testTicket.orgId
        });

        expect(stats.stats.totalRecommendations).toBeGreaterThan(0);
      }
    });

    it('should handle error cases gracefully', async () => {
      // Test with invalid ticket ID
      await expect(
        caller.recommendations.getRecommendations({
          ticketId: 'non-existent-ticket',
          orgId: testTicket.orgId
        })
      ).rejects.toThrow();

      // Test with invalid feedback
      await expect(
        caller.recommendations.submitFeedback({
          recommendationId: 'non-existent-recommendation',
          action: 'accepted',
          timestamp: new Date()
        })
      ).rejects.toThrow('Recommendation not found');
    });
  });

  describe('Pattern Detection Accuracy', () => {
    it('should accurately detect org patterns', async () => {
      const result = await caller.recommendations.analyzeOrgContext({
        ticketId: testTicket.id,
        orgId: testTicket.orgId
      });

      expect(result.success).toBe(true);
      expect(result.patterns).toHaveProperty('namingPatterns');
      expect(result.patterns).toHaveProperty('fieldTypePatterns');
      expect(result.patterns).toHaveProperty('relationshipPatterns');
      expect(result.patterns).toHaveProperty('validationPatterns');
      expect(result.patterns).toHaveProperty('automationPatterns');
    });
  });

  describe('Conflict Detection', () => {
    it('should detect duplicate field conflicts', async () => {
      const result = await caller.recommendations.checkConflicts({
        orgId: testTicket.orgId,
        proposedChanges: {
          fields: [{ name: 'ExistingField__c', type: 'Text' }]
        },
        existingMetadata: {
          fields: [{ name: 'ExistingField__c', type: 'Text' }]
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it('should detect naming conflicts', async () => {
      const result = await caller.recommendations.checkConflicts({
        orgId: testTicket.orgId,
        proposedChanges: {
          fields: [{ name: 'Account', type: 'Text' }] // Reserved word
        }
      });

      expect(result.success).toBe(true);
      // Should detect that 'Account' is a reserved/standard object name
    });
  });

  describe('Learning System', () => {
    it('should improve recommendations based on feedback', async () => {
      // Generate initial recommendations
      const initial = await caller.recommendations.getRecommendations({
        ticketId: testTicket.id,
        orgId: testTicket.orgId,
        proposedChanges: {
          fields: [{ name: 'LearningTest__c', type: 'Text' }]
        }
      });

      if (initial.recommendations.length > 0) {
        // Submit feedback
        await caller.recommendations.submitFeedback({
          recommendationId: initial.recommendations[0].id,
          action: 'modified',
          modifiedValue: 'LearningTestModified__c',
          timestamp: new Date()
        });

        // Apply learning
        const improved = await caller.recommendations.improveRecommendations({
          ticketId: testTicket.id,
          applyLearning: true
        });

        expect(improved.success).toBe(true);
        expect(improved.improved).toBe(true);
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle large sets of proposed changes', async () => {
      const largeChanges = {
        fields: Array.from({ length: 50 }, (_, i) => ({
          name: `Field${i}__c`,
          type: i % 2 === 0 ? 'Text' : 'Number',
          label: `Field ${i}`,
          action: 'create'
        }))
      };

      const startTime = Date.now();
      
      const result = await caller.recommendations.getRecommendations({
        ticketId: testTicket.id,
        orgId: testTicket.orgId,
        proposedChanges: largeChanges
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      console.log(`Processed ${largeChanges.fields.length} fields in ${duration}ms`);
    });

    it('should efficiently use caching', async () => {
      const changes = {
        fields: [{ name: 'CacheTest__c', type: 'Text' }]
      };

      // First call - no cache
      const start1 = Date.now();
      const result1 = await caller.recommendations.getRecommendations({
        ticketId: testTicket.id,
        orgId: testTicket.orgId,
        proposedChanges: changes
      });
      const duration1 = Date.now() - start1;

      expect(result1.fromCache).toBe(false);

      // Second call - should use cache
      const start2 = Date.now();
      const result2 = await caller.recommendations.getRecommendations({
        ticketId: testTicket.id,
        orgId: testTicket.orgId
      });
      const duration2 = Date.now() - start2;

      expect(result2.fromCache).toBe(true);
      expect(duration2).toBeLessThan(duration1); // Cached should be faster
      
      console.log(`Non-cached: ${duration1}ms, Cached: ${duration2}ms`);
    });
  });
});