import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AutomationOrchestrator } from '@agentris/services';
import type { AutomationConfig } from '@agentris/services';
import { fieldRequirementSchema, validationRuleRequirementSchema } from '@agentris/ai-engine';
import { checkRateLimit } from '../middleware/rateLimit';

const fieldRequirementsSchema = z.object({
  fields: z.array(fieldRequirementSchema),
  validationRules: z.array(validationRuleRequirementSchema),
  summary: z.string(),
  ambiguities: z.array(z.string()),
});

export const automationRouter = router({
  parseTicketRequirements: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        includeContext: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { ticketId, includeContext } = input;

      // Apply rate limiting for AI parsing operations
      checkRateLimit(ctx.session.user.id, 'automationParsing');

      // Get ticket from database
      const ticket = await ctx.prisma.ticket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      // Initialize orchestrator with config
      const config: AutomationConfig = {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        metadataService: ctx.salesforceMetadataService,
        deploymentTracker: ctx.salesforceDeploymentTracker,
        prisma: ctx.prisma,
      };

      const orchestrator = new AutomationOrchestrator(config);

      // Parse requirements using the orchestrator's parser
      const parser = (orchestrator as any).requirementsParser;
      const parsedRequirements = await parser.parseTicketDescription(
        ticket.description,
        includeContext
      );

      // If there are acceptance criteria, parse those too
      if (ticket.acceptanceCriteria) {
        const acRequirements = await parser.parseAcceptanceCriteria(
          ticket.acceptanceCriteria
        );

        // Merge acceptance criteria requirements
        if (acRequirements.fields) {
          parsedRequirements.fields.push(...acRequirements.fields);
        }
        if (acRequirements.validationRules) {
          parsedRequirements.validationRules.push(...acRequirements.validationRules);
        }
        if (acRequirements.ambiguities) {
          parsedRequirements.ambiguities.push(...acRequirements.ambiguities);
        }
      }

      // Update ticket with ambiguity score
      const ambiguityScore = Math.min(parsedRequirements.ambiguities.length * 20, 100);
      await ctx.prisma.ticket.update({
        where: { id: ticketId },
        data: { ambiguityScore },
      });

      return parsedRequirements;
    }),

  generateFieldMetadata: protectedProcedure
    .input(
      z.object({
        requirements: fieldRequirementsSchema,
        targetOrgId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { requirements, targetOrgId } = input;

      // Apply rate limiting for AI generation operations
      checkRateLimit(ctx.session.user.id, 'automationGeneration');

      // Verify org exists and user has access
      const org = await ctx.prisma.organization.findFirst({
        where: {
          id: targetOrgId,
          userId: ctx.session.user.id,
        },
      });

      if (!org) {
        throw new Error('Organization not found or access denied');
      }

      // Initialize orchestrator
      const config: AutomationConfig = {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        metadataService: ctx.salesforceMetadataService,
        deploymentTracker: ctx.salesforceDeploymentTracker,
        prisma: ctx.prisma,
      };

      const orchestrator = new AutomationOrchestrator(config);
      const generator = (orchestrator as any).metadataGenerator;

      // Generate metadata for each field
      const generatedMetadata = {
        fields: [],
        validationRules: [],
        isValid: true,
        errors: [],
      };

      for (const fieldReq of requirements.fields) {
        try {
          const fieldMetadata = generator.generateCustomField(fieldReq);
          generatedMetadata.fields.push(fieldMetadata);
        } catch (error) {
          generatedMetadata.errors.push(
            `Failed to generate field ${fieldReq.fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      for (const ruleReq of requirements.validationRules) {
        try {
          const ruleMetadata = generator.generateValidationRule(ruleReq);
          generatedMetadata.validationRules.push(ruleMetadata);
        } catch (error) {
          generatedMetadata.errors.push(
            `Failed to generate validation rule ${ruleReq.ruleName}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Validate the generated metadata
      const validation = generator.validateMetadata(generatedMetadata);
      generatedMetadata.isValid = validation.isValid;
      generatedMetadata.errors.push(...validation.errors);

      return generatedMetadata;
    }),

  deployAutomation: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        targetOrgId: z.string(),
        deployToProduction: z.boolean().default(false),
        dryRun: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Apply rate limiting for deployment operations
      checkRateLimit(ctx.session.user.id, 'automationDeployment');
      
      // Verify org access
      const org = await ctx.prisma.organization.findFirst({
        where: {
          id: input.targetOrgId,
          userId: ctx.session.user.id,
        },
      });

      if (!org) {
        throw new Error('Organization not found or access denied');
      }

      // Initialize orchestrator
      const config: AutomationConfig = {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        metadataService: ctx.salesforceMetadataService,
        deploymentTracker: ctx.salesforceDeploymentTracker,
        prisma: ctx.prisma,
      };

      const orchestrator = new AutomationOrchestrator(config);

      // Execute the full orchestration
      const result = await orchestrator.orchestrateFieldCreation({
        ticketId: input.ticketId,
        targetOrgId: input.targetOrgId,
        deployToProduction: input.deployToProduction,
        dryRun: input.dryRun,
        includeContext: true,
      });

      // Update ticket status based on result
      if (result.status === 'SUCCESS') {
        await ctx.prisma.ticket.update({
          where: { id: input.ticketId },
          data: { 
            status: 'AUTOMATED',
            automationSuccess: true,
          },
        });
      } else if (result.status === 'FAILED') {
        await ctx.prisma.ticket.update({
          where: { id: input.ticketId },
          data: { 
            status: 'FAILED',
            automationSuccess: false,
          },
        });
      }

      return result;
    }),

  getAutomationStatus: protectedProcedure
    .input(
      z.object({
        runId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify user has access to this run
      const run = await ctx.prisma.automationRun.findFirst({
        where: {
          id: input.runId,
          ticket: {
            userId: ctx.session.user.id,
          },
        },
        include: {
          steps: {
            orderBy: { startedAt: 'asc' },
          },
        },
      });

      if (!run) {
        throw new Error('Automation run not found or access denied');
      }

      return {
        id: run.id,
        status: run.status,
        metadata: run.metadata,
        error: run.error,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        steps: run.steps.map(step => ({
          type: step.stepType,
          status: step.status,
          startedAt: step.startedAt,
          completedAt: step.completedAt,
          error: step.error,
        })),
      };
    }),

  listAutomationRuns: protectedProcedure
    .input(
      z.object({
        ticketId: z.string().optional(),
        status: z.enum(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL']).optional(),
        limit: z.number().min(1).max(100).default(10),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        ticket: {
          userId: ctx.session.user.id,
        },
      };

      if (input.ticketId) {
        where.ticketId = input.ticketId;
      }

      if (input.status) {
        where.status = input.status;
      }

      const [runs, total] = await Promise.all([
        ctx.prisma.automationRun.findMany({
          where,
          include: {
            ticket: {
              select: {
                id: true,
                jiraKey: true,
                summary: true,
              },
            },
          },
          orderBy: { startedAt: 'desc' },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.automationRun.count({ where }),
      ]);

      return {
        runs: runs.map(run => ({
          id: run.id,
          status: run.status,
          ticketId: run.ticketId,
          ticket: run.ticket,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          error: run.error,
        })),
        total,
        hasMore: input.offset + input.limit < total,
      };
    }),

  validateFieldMetadata: protectedProcedure
    .input(
      z.object({
        metadata: z.object({
          fields: z.array(z.object({
            name: z.string(),
            label: z.string().optional(),
            type: z.string(),
            required: z.boolean().optional(),
            length: z.number().optional(),
            precision: z.number().optional(),
            scale: z.number().optional(),
            defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
            helpText: z.string().optional(),
            formula: z.string().optional(),
            picklistValues: z.array(z.string()).optional(),
            referenceTo: z.array(z.string()).optional(),
          })),
          validationRules: z.array(z.object({
            name: z.string(),
            description: z.string().optional(),
            errorConditionFormula: z.string(),
            errorMessage: z.string(),
            active: z.boolean().optional(),
            errorDisplayField: z.string().optional(),
          })),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Initialize orchestrator just to use the generator
      const config: AutomationConfig = {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        metadataService: ctx.salesforceMetadataService,
        deploymentTracker: ctx.salesforceDeploymentTracker,
        prisma: ctx.prisma,
      };

      const orchestrator = new AutomationOrchestrator(config);
      const generator = (orchestrator as any).metadataGenerator;

      const validationResult = generator.validateMetadata({
        ...input.metadata,
        isValid: true,
        errors: [],
      });

      return validationResult;
    }),

  retryAutomation: protectedProcedure
    .input(
      z.object({
        runId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the original run
      const originalRun = await ctx.prisma.automationRun.findFirst({
        where: {
          id: input.runId,
          ticket: {
            userId: ctx.session.user.id,
          },
        },
      });

      if (!originalRun) {
        throw new Error('Automation run not found or access denied');
      }

      // Get the target org from the last deployment step
      const deployStep = await ctx.prisma.automationStep.findFirst({
        where: {
          runId: input.runId,
          stepType: 'DEPLOY',
        },
        orderBy: { startedAt: 'desc' },
      });

      const targetOrgId = deployStep?.input?.targetOrgId;
      if (!targetOrgId) {
        throw new Error('Cannot determine target organization from previous run');
      }

      // Initialize orchestrator
      const config: AutomationConfig = {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        metadataService: ctx.salesforceMetadataService,
        deploymentTracker: ctx.salesforceDeploymentTracker,
        prisma: ctx.prisma,
      };

      const orchestrator = new AutomationOrchestrator(config);

      // Retry the automation
      const result = await orchestrator.orchestrateFieldCreation({
        ticketId: originalRun.ticketId,
        targetOrgId,
        deployToProduction: false,
        includeContext: true,
      });

      return result;
    }),

  cancelAutomation: protectedProcedure
    .input(
      z.object({
        runId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user has access
      const run = await ctx.prisma.automationRun.findFirst({
        where: {
          id: input.runId,
          status: 'RUNNING',
          ticket: {
            userId: ctx.session.user.id,
          },
        },
      });

      if (!run) {
        throw new Error('Active automation run not found or access denied');
      }

      // Update run status to cancelled
      await ctx.prisma.automationRun.update({
        where: { id: input.runId },
        data: {
          status: 'FAILED',
          error: 'Cancelled by user',
          completedAt: new Date(),
        },
      });

      // Record cancellation step
      await ctx.prisma.automationStep.create({
        data: {
          runId: input.runId,
          stepType: 'CANCELLED',
          status: 'COMPLETED',
          input: { cancelledBy: ctx.session.user.id },
          completedAt: new Date(),
        },
      });

      return { success: true };
    }),
});