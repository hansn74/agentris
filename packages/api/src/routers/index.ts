import { router } from '../trpc';
import { authRouter } from './auth';
import { ticketRouter } from './ticket';
import { salesforceRouter } from './salesforce';
import { aiRouter } from './ai';
import { previewRouter } from './preview';
import { changePreviewRouter } from './change-preview';
import { deploymentRouter } from './deployment';
import { auditRouter } from './audit';
import { integrationRouter } from './integration';
import { healthRouter } from './health';
import { jiraRouter } from './jira';
import { automationRouter } from './automation';
import { approvalRouter } from './approval';
import { llmRouter } from './llm';
import { ambiguityRouter } from './ambiguity';
import { clarificationRouter } from './clarification';
import { recommendationsRouter } from './recommendations';
import { batchRouter } from './batch';

export const appRouter = router({
  auth: authRouter,
  ticket: ticketRouter,
  salesforce: salesforceRouter,
  ai: aiRouter,
  preview: previewRouter,
  changePreview: changePreviewRouter,
  deployment: deploymentRouter,
  audit: auditRouter,
  integration: integrationRouter,
  health: healthRouter,
  jira: jiraRouter,
  automation: automationRouter,
  approval: approvalRouter,
  llm: llmRouter,
  ambiguity: ambiguityRouter,
  clarification: clarificationRouter,
  recommendations: recommendationsRouter,
  batch: batchRouter,
});

export type AppRouter = typeof appRouter;
