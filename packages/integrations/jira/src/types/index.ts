export interface JiraConfig {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface JiraOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  cloudId: string;
}

export interface JiraTicket {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      id: string;
      name: string;
      statusCategory: {
        key: string;
        name: string;
      };
    };
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    reporter: {
      accountId: string;
      displayName: string;
      emailAddress?: string;
    };
    priority?: {
      id: string;
      name: string;
    };
    issuetype: {
      id: string;
      name: string;
    };
    project: {
      id: string;
      key: string;
      name: string;
    };
    created: string;
    updated: string;
    comment?: {
      total: number;
      comments: JiraComment[];
    };
    customfield_10000?: string; // Acceptance criteria custom field (example)
  };
}

export interface JiraComment {
  id: string;
  author: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
  };
  body: string;
  created: string;
  updated: string;
}

export interface JiraWebhookPayload {
  timestamp: number;
  webhookEvent: string;
  issue_event_type_name?: string;
  user?: {
    accountId: string;
    displayName: string;
  };
  issue?: JiraTicket;
  comment?: JiraComment;
  changelog?: {
    id: string;
    items: Array<{
      field: string;
      fieldtype: string;
      from: string | null;
      fromString: string | null;
      to: string | null;
      toString: string | null;
    }>;
  };
}

export interface JiraError extends Error {
  statusCode?: number;
  errorMessages?: string[];
  errors?: Record<string, string>;
}
