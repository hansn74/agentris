import { PrismaClient } from '@prisma/client';
import pino from 'pino';

const logger = pino({ name: 'security-events' });

export interface SecurityEventData {
  userId: string;
  eventType: AuthEventType;
  service: 'SALESFORCE' | 'JIRA' | 'GITHUB';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export enum AuthEventType {
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_FAILURE = 'AUTH_FAILURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_STATE_TOKEN = 'INVALID_STATE_TOKEN',
  TOKEN_REFRESH_SUCCESS = 'TOKEN_REFRESH_SUCCESS',
  TOKEN_REFRESH_FAILURE = 'TOKEN_REFRESH_FAILURE',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY'
}

export class SecurityEventService {
  private prisma: PrismaClient;
  private readonly ALERT_THRESHOLDS = {
    AUTH_FAILURE: 5,        // Alert after 5 failures in time window
    RATE_LIMIT: 3,          // Alert after 3 rate limit hits
    TIME_WINDOW_MS: 15 * 60 * 1000  // 15 minutes
  };

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Log a security event
   */
  async logEvent(data: SecurityEventData): Promise<void> {
    try {
      await this.prisma.authSecurityEvent.create({
        data: {
          userId: data.userId,
          eventType: data.eventType,
          service: data.service,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: data.metadata || {}
        }
      });

      // Check if we need to trigger alerts
      await this.checkForAlerts(data);

      // Log to application logs as well
      logger.info({
        ...data,
        message: `Security event: ${data.eventType} for ${data.service}`
      });
    } catch (error) {
      logger.error({ error, data }, 'Failed to log security event');
    }
  }

  /**
   * Check if we need to trigger security alerts
   */
  private async checkForAlerts(event: SecurityEventData): Promise<void> {
    const timeWindowStart = new Date(Date.now() - this.ALERT_THRESHOLDS.TIME_WINDOW_MS);

    // Check for repeated auth failures
    if (event.eventType === AuthEventType.AUTH_FAILURE) {
      const failureCount = await this.prisma.authSecurityEvent.count({
        where: {
          userId: event.userId,
          eventType: AuthEventType.AUTH_FAILURE,
          service: event.service,
          createdAt: {
            gte: timeWindowStart
          }
        }
      });

      if (failureCount >= this.ALERT_THRESHOLDS.AUTH_FAILURE) {
        await this.triggerSecurityAlert({
          userId: event.userId,
          service: event.service,
          alertType: 'REPEATED_AUTH_FAILURES',
          count: failureCount,
          timeWindow: this.ALERT_THRESHOLDS.TIME_WINDOW_MS
        });
      }
    }

    // Check for repeated rate limit hits
    if (event.eventType === AuthEventType.RATE_LIMIT_EXCEEDED) {
      const rateLimitCount = await this.prisma.authSecurityEvent.count({
        where: {
          userId: event.userId,
          eventType: AuthEventType.RATE_LIMIT_EXCEEDED,
          service: event.service,
          createdAt: {
            gte: timeWindowStart
          }
        }
      });

      if (rateLimitCount >= this.ALERT_THRESHOLDS.RATE_LIMIT) {
        await this.triggerSecurityAlert({
          userId: event.userId,
          service: event.service,
          alertType: 'REPEATED_RATE_LIMIT_HITS',
          count: rateLimitCount,
          timeWindow: this.ALERT_THRESHOLDS.TIME_WINDOW_MS
        });
      }
    }
  }

  /**
   * Trigger a security alert
   */
  private async triggerSecurityAlert(alertData: any): Promise<void> {
    // Log critical security alert
    logger.warn({
      ...alertData,
      severity: 'HIGH',
      message: `SECURITY ALERT: ${alertData.alertType}`
    });

    // Log as a suspicious activity event
    await this.prisma.authSecurityEvent.create({
      data: {
        userId: alertData.userId,
        eventType: AuthEventType.SUSPICIOUS_ACTIVITY,
        service: alertData.service,
        metadata: alertData
      }
    });

    // In production, this would also:
    // - Send email/SMS alerts to admins
    // - Trigger incident response workflows
    // - Potentially lock the user account temporarily
  }

  /**
   * Get security events for a user
   */
  async getUserSecurityEvents(
    userId: string,
    limit: number = 100
  ): Promise<any[]> {
    return this.prisma.authSecurityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Get security summary for monitoring
   */
  async getSecuritySummary(timeWindowMs: number = 60 * 60 * 1000): Promise<any> {
    const timeWindowStart = new Date(Date.now() - timeWindowMs);

    const [totalEvents, failureEvents, rateLimitEvents, suspiciousEvents] = await Promise.all([
      this.prisma.authSecurityEvent.count({
        where: { createdAt: { gte: timeWindowStart } }
      }),
      this.prisma.authSecurityEvent.count({
        where: {
          eventType: AuthEventType.AUTH_FAILURE,
          createdAt: { gte: timeWindowStart }
        }
      }),
      this.prisma.authSecurityEvent.count({
        where: {
          eventType: AuthEventType.RATE_LIMIT_EXCEEDED,
          createdAt: { gte: timeWindowStart }
        }
      }),
      this.prisma.authSecurityEvent.count({
        where: {
          eventType: AuthEventType.SUSPICIOUS_ACTIVITY,
          createdAt: { gte: timeWindowStart }
        }
      })
    ]);

    return {
      timeWindow: timeWindowMs,
      totalEvents,
      failureEvents,
      rateLimitEvents,
      suspiciousEvents,
      timestamp: new Date()
    };
  }

  /**
   * Clean up old security events (data retention policy)
   */
  async cleanupOldEvents(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.authSecurityEvent.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    logger.info({
      retentionDays,
      deletedCount: result.count
    }, 'Cleaned up old security events');

    return result.count;
  }
}