import { PrismaClient, OrgType, SalesforceOAuthState } from '@prisma/client';
import crypto from 'crypto';

export class SalesforceStateService {
  private prisma: PrismaClient;
  private readonly STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new OAuth state token
   */
  async createState(userId: string, orgType: OrgType): Promise<string> {
    const state = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.STATE_EXPIRY_MS);

    await this.prisma.salesforceOAuthState.create({
      data: {
        state,
        userId,
        orgType,
        expiresAt
      }
    });

    return state;
  }

  /**
   * Validate and consume a state token
   */
  async validateState(state: string, userId: string): Promise<{ valid: boolean; orgType?: OrgType; error?: string }> {
    const stateRecord = await this.prisma.salesforceOAuthState.findUnique({
      where: { state }
    });

    if (!stateRecord) {
      return { valid: false, error: 'Invalid state token' };
    }

    // Check if expired
    if (new Date() > stateRecord.expiresAt) {
      // Clean up expired state
      await this.prisma.salesforceOAuthState.delete({
        where: { id: stateRecord.id }
      });
      return { valid: false, error: 'State token expired' };
    }

    // Check if state belongs to the user
    if (stateRecord.userId !== userId) {
      return { valid: false, error: 'State token does not match user' };
    }

    // Delete the state after successful validation (one-time use)
    await this.prisma.salesforceOAuthState.delete({
      where: { id: stateRecord.id }
    });

    return { valid: true, orgType: stateRecord.orgType };
  }

  /**
   * Clean up expired states
   */
  async cleanupExpiredStates(): Promise<number> {
    const result = await this.prisma.salesforceOAuthState.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    return result.count;
  }

  /**
   * Schedule periodic cleanup of expired states
   */
  startCleanupSchedule(): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        const count = await this.cleanupExpiredStates();
        if (count > 0) {
          console.log(`Cleaned up ${count} expired Salesforce OAuth states`);
        }
      } catch (error) {
        console.error('Error cleaning up expired states:', error);
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }
}