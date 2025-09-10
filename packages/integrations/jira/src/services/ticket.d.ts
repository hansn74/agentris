import { JiraClient } from '../client';
import type { JiraTicket, JiraComment } from '../types';
export declare class TicketService {
    private client;
    constructor(client: JiraClient);
    /**
     * Fetch tickets assigned to the current user
     */
    fetchUserTickets(options?: {
        projectKeys?: string[];
        maxResults?: number;
        startAt?: number;
    }): Promise<{
        tickets: JiraTicket[];
        total: number;
    }>;
    /**
     * Fetch detailed information for a specific ticket
     */
    fetchTicketDetails(ticketKey: string): Promise<JiraTicket>;
    /**
     * Fetch all comments for a ticket
     */
    fetchTicketComments(ticketKey: string): Promise<JiraComment[]>;
    /**
     * Extract acceptance criteria from ticket description or custom field
     */
    extractAcceptanceCriteria(ticket: JiraTicket): string | null;
    /**
     * Parse description field from various Jira formats
     */
    parseDescription(ticket: JiraTicket): string;
    /**
     * Parse Atlassian Document Format to plain text
     */
    private parseADF;
    /**
     * Sync a specific ticket from Jira to the database
     */
    syncTicket(ticketKey: string): Promise<JiraTicket>;
    /**
     * Check if user has access to a specific project
     */
    checkProjectAccess(projectKey: string): Promise<boolean>;
}
//# sourceMappingURL=ticket.d.ts.map