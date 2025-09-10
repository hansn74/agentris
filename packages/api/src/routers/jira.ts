import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { prisma } from '@agentris/db';
import { JiraAuthService, JiraClient, TicketService, mapJiraTicketToInternal } from '@agentris/integrations/jira';
import { createHmac } from 'crypto';
import pino from 'pino';
import { CryptoService } from '@agentris/shared/utils/crypto';
import { getEnvConfig, isJiraConfigured } from '@agentris/shared/utils/env-validation';
import type { JiraWebhookPayload } from '@agentris/integrations/jira';

const logger = pino({ name: 'jira-router' });

// Get validated environment configuration
const env = getEnvConfig();

// Configuration from validated environment variables
const JIRA_CONFIG = {
  clientId: env.JIRA_CLIENT_ID || '',
  clientSecret: env.JIRA_CLIENT_SECRET || '',
  redirectUri: env.JIRA_REDIRECT_URI || 'http://localhost:3000/api/auth/jira/callback',
  scopes: ['read:jira-work', 'write:jira-work', 'read:jira-user', 'offline_access']
};

// Webhook secret for signature verification
const JIRA_WEBHOOK_SECRET = env.JIRA_WEBHOOK_SECRET || '';

// Check if Jira is properly configured
if (!isJiraConfigured()) {
  logger.warn('Jira integration is not configured. Set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET to enable.');
}

export const jiraRouter = router({
  // OAuth Connection
  connect: protectedProcedure
    .input(z.object({
      instanceUrl: z.string().url(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!isJiraConfigured()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Jira integration is not configured. Please contact your administrator.'
        });
      }
      
      try {
        const authService = new JiraAuthService({
          ...JIRA_CONFIG,
          instanceUrl: input.instanceUrl
        });

        const { url, state } = authService.authorize();

        // Store state in session or database for verification
        // TODO: Store state with user ID for callback verification
        await ctx.prisma.jiraOAuthState.create({
          data: {
            state,
            userId: ctx.session.user.id,
            instanceUrl: input.instanceUrl,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
          }
        });

        return { authUrl: url, state };
      } catch (error) {
        logger.error({ error }, 'Failed to initiate Jira OAuth');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to initiate Jira connection'
        });
      }
    }),

  // OAuth Callback
  callback: protectedProcedure
    .input(z.object({
      code: z.string(),
      state: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        // Verify state
        const oauthState = await ctx.prisma.jiraOAuthState.findFirst({
          where: {
            state: input.state,
            userId: ctx.session.user.id,
            expiresAt: { gt: new Date() }
          }
        });

        if (!oauthState) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid or expired OAuth state'
          });
        }

        const authService = new JiraAuthService({
          ...JIRA_CONFIG,
          instanceUrl: oauthState.instanceUrl
        });

        const tokens = await authService.callback(input.code, input.state);

        // Encrypt sensitive tokens before storing
        const encryptedTokens = {
          accessToken: await CryptoService.encrypt(tokens.accessToken),
          refreshToken: await CryptoService.encrypt(tokens.refreshToken)
        };

        // Store tokens in database (encrypted)
        await ctx.prisma.integration.upsert({
          where: {
            userId_type: {
              userId: ctx.session.user.id,
              type: 'JIRA'
            }
          },
          create: {
            userId: ctx.session.user.id,
            type: 'JIRA',
            config: {
              instanceUrl: oauthState.instanceUrl,
              cloudId: tokens.cloudId,
              accessToken: encryptedTokens.accessToken,
              refreshToken: encryptedTokens.refreshToken,
              expiresAt: tokens.expiresAt.toISOString()
            },
            isActive: true
          },
          update: {
            config: {
              instanceUrl: oauthState.instanceUrl,
              cloudId: tokens.cloudId,
              accessToken: encryptedTokens.accessToken,
              refreshToken: encryptedTokens.refreshToken,
              expiresAt: tokens.expiresAt.toISOString()
            },
            isActive: true
          }
        });

        // Clean up OAuth state
        await ctx.prisma.jiraOAuthState.delete({
          where: { id: oauthState.id }
        });

        return { success: true };
      } catch (error) {
        logger.error({ error }, 'Jira OAuth callback failed');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to complete Jira connection'
        });
      }
    }),

  // Disconnect Jira
  disconnect: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        const integration = await ctx.prisma.integration.findFirst({
          where: {
            userId: ctx.session.user.id,
            type: 'JIRA'
          }
        });

        if (!integration) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Jira integration not found'
          });
        }

        const config = integration.config as any;
        const authService = new JiraAuthService({
          ...JIRA_CONFIG,
          instanceUrl: config.instanceUrl
        });

        // Decrypt refresh token before revoking
        const decryptedRefreshToken = await CryptoService.decrypt(config.refreshToken);
        
        // Revoke tokens
        await authService.revokeTokens(decryptedRefreshToken);

        // Remove from database
        await ctx.prisma.integration.delete({
          where: { id: integration.id }
        });

        return { success: true };
      } catch (error) {
        logger.error({ error }, 'Failed to disconnect Jira');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to disconnect Jira'
        });
      }
    }),

  // Fetch user's tickets
  fetchTickets: protectedProcedure
    .input(z.object({
      projectKey: z.string().optional(),
      maxResults: z.number().min(1).max(100).default(50),
      startAt: z.number().min(0).default(0)
    }))
    .query(async ({ input, ctx }) => {
      try {
        const integration = await ctx.prisma.integration.findFirst({
          where: {
            userId: ctx.session.user.id,
            type: 'JIRA',
            isActive: true
          }
        });

        if (!integration) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Jira integration not configured'
          });
        }

        const config = integration.config as any;
        
        // Decrypt tokens
        let accessToken = await CryptoService.decrypt(config.accessToken);
        let refreshToken = await CryptoService.decrypt(config.refreshToken);
        
        // Check if token needs refresh
        if (new Date(config.expiresAt) <= new Date()) {
          const authService = new JiraAuthService({
            ...JIRA_CONFIG,
            instanceUrl: config.instanceUrl
          });
          
          const newTokens = await authService.refreshToken(refreshToken);
          
          // Encrypt new tokens before storing
          const encryptedTokens = {
            accessToken: await CryptoService.encrypt(newTokens.accessToken),
            refreshToken: await CryptoService.encrypt(newTokens.refreshToken)
          };
          
          // Update stored tokens
          await ctx.prisma.integration.update({
            where: { id: integration.id },
            data: {
              config: {
                ...config,
                accessToken: encryptedTokens.accessToken,
                refreshToken: encryptedTokens.refreshToken,
                expiresAt: newTokens.expiresAt.toISOString()
              }
            }
          });
          
          accessToken = newTokens.accessToken;
          refreshToken = newTokens.refreshToken;
        }

        const client = new JiraClient({
          accessToken,
          refreshToken,
          expiresAt: new Date(config.expiresAt),
          cloudId: config.cloudId
        });

        const ticketService = new TicketService(client);
        
        const { tickets, total } = await ticketService.fetchUserTickets({
          projectKeys: input.projectKey ? [input.projectKey] : undefined,
          maxResults: input.maxResults,
          startAt: input.startAt
        });

        // Map to internal format
        const mappedTickets = tickets.map((ticket: any) => 
          mapJiraTicketToInternal(ticket, ticketService)
        );

        return {
          tickets: mappedTickets,
          total,
          hasMore: input.startAt + input.maxResults < total
        };
      } catch (error) {
        logger.error({ error }, 'Failed to fetch Jira tickets');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch tickets from Jira'
        });
      }
    }),

  // Fetch specific ticket details
  fetchTicketDetails: protectedProcedure
    .input(z.object({
      ticketKey: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const integration = await ctx.prisma.integration.findFirst({
          where: {
            userId: ctx.session.user.id,
            type: 'JIRA',
            isActive: true
          }
        });

        if (!integration) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Jira integration not configured'
          });
        }

        const config = integration.config as any;
        
        // Decrypt tokens
        const decryptedAccessToken = await CryptoService.decrypt(config.accessToken);
        const decryptedRefreshToken = await CryptoService.decrypt(config.refreshToken);
        
        const client = new JiraClient({
          accessToken: decryptedAccessToken,
          refreshToken: decryptedRefreshToken,
          expiresAt: new Date(config.expiresAt),
          cloudId: config.cloudId
        });

        const ticketService = new TicketService(client);
        const ticket = await ticketService.fetchTicketDetails(input.ticketKey);
        const comments = await ticketService.fetchTicketComments(input.ticketKey);
        
        // Add comments to ticket
        ticket.fields.comment = {
          total: comments.length,
          comments
        };

        return mapJiraTicketToInternal(ticket, ticketService);
      } catch (error) {
        logger.error({ error }, 'Failed to fetch ticket details');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch ticket details from Jira'
        });
      }
    }),

  // Manually sync a ticket
  syncTicket: protectedProcedure
    .input(z.object({
      ticketKey: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const integration = await ctx.prisma.integration.findFirst({
          where: {
            userId: ctx.session.user.id,
            type: 'JIRA',
            isActive: true
          }
        });

        if (!integration) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Jira integration not configured'
          });
        }

        const config = integration.config as any;
        
        // Decrypt tokens
        const decryptedAccessToken = await CryptoService.decrypt(config.accessToken);
        const decryptedRefreshToken = await CryptoService.decrypt(config.refreshToken);
        
        const client = new JiraClient({
          accessToken: decryptedAccessToken,
          refreshToken: decryptedRefreshToken,
          expiresAt: new Date(config.expiresAt),
          cloudId: config.cloudId
        });

        const ticketService = new TicketService(client);
        const jiraTicket = await ticketService.syncTicket(input.ticketKey);
        const internalTicket = mapJiraTicketToInternal(jiraTicket, ticketService);

        // Store or update in database
        await ctx.prisma.ticket.upsert({
          where: {
            jiraKey: input.ticketKey
          },
          create: {
            jiraKey: internalTicket.jiraKey,
            jiraId: internalTicket.jiraId,
            summary: internalTicket.summary,
            description: internalTicket.description,
            status: internalTicket.status,
            acceptanceCriteria: internalTicket.acceptanceCriteria,
            assignedToId: ctx.session.user.id,
            organizationId: 'default' // TODO: Get from user's organization
          },
          update: {
            summary: internalTicket.summary,
            description: internalTicket.description,
            status: internalTicket.status,
            acceptanceCriteria: internalTicket.acceptanceCriteria,
            updatedAt: new Date()
          }
        });

        return internalTicket;
      } catch (error) {
        logger.error({ error }, 'Failed to sync ticket');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to sync ticket from Jira'
        });
      }
    }),

  // Update Jira settings
  updateSettings: protectedProcedure
    .input(z.object({
      projectKeys: z.array(z.string()),
      syncEnabled: z.boolean(),
      webhookEnabled: z.boolean().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const integration = await ctx.prisma.integration.findFirst({
          where: {
            userId: ctx.session.user.id,
            type: 'JIRA'
          }
        });

        if (!integration) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Jira integration not found'
          });
        }

        const config = integration.config as any;
        
        await ctx.prisma.integration.update({
          where: { id: integration.id },
          data: {
            config: {
              ...config,
              projectKeys: input.projectKeys,
              syncEnabled: input.syncEnabled,
              webhookEnabled: input.webhookEnabled
            }
          }
        });

        return { success: true };
      } catch (error) {
        logger.error({ error }, 'Failed to update Jira settings');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update Jira settings'
        });
      }
    }),

  // Webhook handler
  webhook: publicProcedure
    .input(z.any()) // Accept any payload
    .mutation(async ({ input }) => {
      try {
        // Note: Webhook signature verification should be done at the HTTP layer
        // before the request reaches tRPC, as tRPC procedures don't have
        // direct access to raw request headers

        const payload = input as JiraWebhookPayload;
        logger.info('Received Jira webhook', {
          event: payload.webhookEvent,
          issueKey: payload.issue?.key
        });

        // Handle different webhook events
        switch (payload.webhookEvent) {
          case 'jira:issue_created':
          case 'jira:issue_updated':
            if (payload.issue) {
              // Find integration for the issue's assignee
              const assigneeEmail = payload.issue.fields.assignee?.emailAddress;
              if (assigneeEmail) {
                const user = await prisma.user.findUnique({
                  where: { email: assigneeEmail }
                });

                if (user) {
                  // Update ticket in database
                  await prisma.ticket.upsert({
                    where: { jiraKey: payload.issue.key },
                    create: {
                      jiraKey: payload.issue.key,
                      jiraId: payload.issue.id,
                      summary: payload.issue.fields.summary,
                      description: payload.issue.fields.description || '',
                      status: 'NEW',
                      assignedToId: user.id,
                      organizationId: 'default' // TODO: Get from user's organization
                    },
                    update: {
                      summary: payload.issue.fields.summary,
                      description: payload.issue.fields.description || '',
                      updatedAt: new Date()
                    }
                  });
                }
              }
            }
            break;

          case 'comment_created':
          case 'comment_updated':
            if (payload.comment && payload.issue) {
              // Store comment in database
              await prisma.clarification.create({
                data: {
                  ticketId: payload.issue.key,
                  question: 'Jira Comment',
                  answer: typeof payload.comment.body === 'string' 
                    ? payload.comment.body 
                    : JSON.stringify(payload.comment.body),
                  source: 'JIRA_WEBHOOK',
                  askedBy: payload.comment.author.displayName
                }
              });
            }
            break;

          default:
            logger.info('Unhandled webhook event', { event: payload.webhookEvent });
        }

        return { success: true };
      } catch (error) {
        logger.error({ error }, 'Webhook processing failed');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process webhook'
        });
      }
    })
});

/**
 * Verify Jira webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = 'sha256=' + createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}