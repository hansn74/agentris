import { router } from '../trpc';
import { authRouter } from './auth';
import { ticketRouter } from './ticket';
import { salesforceRouter } from './salesforce';
import { aiRouter } from './ai';
import { previewRouter } from './preview';
import { deploymentRouter } from './deployment';
import { auditRouter } from './audit';
import { integrationRouter } from './integration';
import { healthRouter } from './health';

export const appRouter = router({
  auth: authRouter,
  ticket: ticketRouter,
  salesforce: salesforceRouter,
  ai: aiRouter,
  preview: previewRouter,
  deployment: deploymentRouter,
  audit: auditRouter,
  integration: integrationRouter,
  health: healthRouter,
});

export type AppRouter = typeof appRouter;
