import type { JiraTicket } from '../types';
import { TicketService } from '../services/ticket';
interface InternalTicket {
    jiraKey: string;
    jiraId: string;
    summary: string;
    description: string;
    status: 'NEW' | 'ANALYZING' | 'CLARIFYING' | 'READY' | 'IMPLEMENTING' | 'TESTING' | 'COMPLETED' | 'FAILED';
    acceptanceCriteria: string | null;
    assignedToEmail?: string;
    reporterEmail?: string;
    priority?: string;
    issueType: string;
    projectKey: string;
    projectName: string;
    comments: Array<{
        id: string;
        author: string;
        authorEmail?: string;
        body: string;
        created: Date;
        updated: Date;
    }>;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Map Jira ticket to internal ticket model
 */
export declare function mapJiraTicketToInternal(jiraTicket: JiraTicket, ticketService?: TicketService): InternalTicket;
/**
 * Map internal ticket status to Jira transition ID
 * Note: These IDs are examples and need to be configured per Jira instance
 */
export declare function mapStatusToTransition(status: InternalTicket['status'], availableTransitions: Array<{
    id: string;
    name: string;
}>): string | null;
export {};
//# sourceMappingURL=ticket.d.ts.map