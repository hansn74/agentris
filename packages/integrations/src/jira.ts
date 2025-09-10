// Re-export Jira integration modules
export { JiraAuthService } from '../jira/src/auth';
export { JiraClient } from '../jira/src/client';
export { TicketService } from '../jira/src/services/ticket';
export { mapJiraTicketToInternal } from '../jira/src/mappers/ticket';
export type {
  JiraConfig,
  JiraOAuthTokens,
  JiraTicket,
  JiraComment,
  JiraWebhookPayload,
} from '../jira/src/types';
