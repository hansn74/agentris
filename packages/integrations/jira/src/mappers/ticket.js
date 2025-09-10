"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapJiraTicketToInternal = mapJiraTicketToInternal;
exports.mapStatusToTransition = mapStatusToTransition;
/**
 * Map Jira ticket to internal ticket model
 */
function mapJiraTicketToInternal(jiraTicket, ticketService) {
    // Map Jira status to internal status
    const mapStatus = (jiraStatus) => {
        const statusLower = jiraStatus.toLowerCase();
        const categoryKey = jiraTicket.fields.status.statusCategory?.key?.toLowerCase();
        // Map based on status category first
        if (categoryKey === 'done') {
            return 'COMPLETED';
        }
        if (categoryKey === 'indeterminate') {
            return 'IMPLEMENTING';
        }
        // Then map based on status name
        if (statusLower.includes('new') ||
            statusLower.includes('open') ||
            statusLower.includes('created')) {
            return 'NEW';
        }
        if (statusLower.includes('analy')) {
            return 'ANALYZING';
        }
        if (statusLower.includes('clarif') || statusLower.includes('review')) {
            return 'CLARIFYING';
        }
        if (statusLower.includes('ready') ||
            statusLower.includes('todo') ||
            statusLower.includes('to do')) {
            return 'READY';
        }
        if (statusLower.includes('progress') ||
            statusLower.includes('develop') ||
            statusLower.includes('implement')) {
            return 'IMPLEMENTING';
        }
        if (statusLower.includes('test') || statusLower.includes('qa')) {
            return 'TESTING';
        }
        if (statusLower.includes('done') ||
            statusLower.includes('complete') ||
            statusLower.includes('closed')) {
            return 'COMPLETED';
        }
        if (statusLower.includes('fail') ||
            statusLower.includes('reject') ||
            statusLower.includes('cancel')) {
            return 'FAILED';
        }
        // Default to NEW if we can't determine
        return 'NEW';
    };
    // Parse description (handle ADF format if needed)
    let description = '';
    if (ticketService) {
        description = ticketService.parseDescription(jiraTicket);
    }
    else if (typeof jiraTicket.fields.description === 'string') {
        description = jiraTicket.fields.description;
    }
    else if (jiraTicket.fields.description) {
        // Basic fallback for ADF format
        description = JSON.stringify(jiraTicket.fields.description);
    }
    // Extract acceptance criteria
    let acceptanceCriteria = null;
    if (ticketService) {
        acceptanceCriteria = ticketService.extractAcceptanceCriteria(jiraTicket);
    }
    else {
        // Fallback - check the default custom field location
        const customFieldId = process.env.JIRA_FIELD_ACCEPTANCE_CRITERIA || 'customfield_10000';
        acceptanceCriteria = jiraTicket.fields[customFieldId] || null;
    }
    // Map comments
    const comments = (jiraTicket.fields.comment?.comments || []).map((comment) => ({
        id: comment.id,
        author: comment.author.displayName,
        authorEmail: comment.author.emailAddress,
        body: typeof comment.body === 'string' ? comment.body : parseSimpleADF(comment.body),
        created: new Date(comment.created),
        updated: new Date(comment.updated),
    }));
    return {
        jiraKey: jiraTicket.key,
        jiraId: jiraTicket.id,
        summary: jiraTicket.fields.summary,
        description,
        status: mapStatus(jiraTicket.fields.status.name),
        acceptanceCriteria,
        assignedToEmail: jiraTicket.fields.assignee?.emailAddress,
        reporterEmail: jiraTicket.fields.reporter?.emailAddress,
        priority: jiraTicket.fields.priority?.name,
        issueType: jiraTicket.fields.issuetype.name,
        projectKey: jiraTicket.fields.project.key,
        projectName: jiraTicket.fields.project.name,
        comments,
        createdAt: new Date(jiraTicket.fields.created),
        updatedAt: new Date(jiraTicket.fields.updated),
    };
}
/**
 * Simple ADF parser for when TicketService is not available
 */
function parseSimpleADF(doc) {
    if (typeof doc === 'string') {
        return doc;
    }
    if (!doc || !doc.content) {
        return '';
    }
    const extractText = (node) => {
        if (node.type === 'text') {
            return node.text || '';
        }
        if (node.content && Array.isArray(node.content)) {
            return node.content.map(extractText).join('');
        }
        return '';
    };
    return doc.content.map(extractText).join('\n').trim();
}
/**
 * Map internal ticket status to Jira transition ID
 * Note: These IDs are examples and need to be configured per Jira instance
 */
function mapStatusToTransition(status, availableTransitions) {
    const transitionMap = {
        NEW: ['open', 'create', 'new'],
        ANALYZING: ['analyze', 'investigation', 'in analysis'],
        CLARIFYING: ['clarify', 'review', 'needs info'],
        READY: ['ready', 'to do', 'todo', 'approved'],
        IMPLEMENTING: ['in progress', 'start', 'develop'],
        TESTING: ['test', 'qa', 'testing'],
        COMPLETED: ['done', 'complete', 'resolve', 'close'],
        FAILED: ['fail', 'reject', 'cancel', "won't do"],
    };
    const targetNames = transitionMap[status] || [];
    for (const transition of availableTransitions) {
        const transitionNameLower = transition.name.toLowerCase();
        if (targetNames.some((name) => transitionNameLower.includes(name))) {
            return transition.id;
        }
    }
    return null;
}
//# sourceMappingURL=ticket.js.map