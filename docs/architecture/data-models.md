# Data Models

## User

**Purpose:** Represents authenticated consultants who use the system

**Key Attributes:**

- id: UUID - Unique identifier
- email: String - Email address for login
- name: String - Display name
- role: Enum(CONSULTANT, MANAGER, ADMIN) - Access level
- createdAt: DateTime - Account creation timestamp
- lastActive: DateTime - Last activity timestamp

**TypeScript Interface:**

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'CONSULTANT' | 'MANAGER' | 'ADMIN';
  createdAt: Date;
  lastActive: Date;
  organizations: Organization[];
  tickets: Ticket[];
}
```

**Relationships:**

- Has many Organizations (Salesforce orgs)
- Has many assigned Tickets
- Has many AuditLogs

## Organization

**Purpose:** Represents a connected Salesforce org

**Key Attributes:**

- id: UUID - Unique identifier
- name: String - Org name/alias
- instanceUrl: String - Salesforce instance URL
- orgId: String - Salesforce org ID
- type: Enum(SANDBOX, PRODUCTION) - Org type
- refreshToken: String (encrypted) - OAuth refresh token
- lastSync: DateTime - Last metadata sync

**TypeScript Interface:**

```typescript
interface Organization {
  id: string;
  name: string;
  instanceUrl: string;
  orgId: string;
  type: 'SANDBOX' | 'PRODUCTION';
  lastSync: Date | null;
  userId: string;
  user: User;
  deployments: Deployment[];
}
```

**Relationships:**

- Belongs to User
- Has many Deployments
- Has many Tickets

## Ticket

**Purpose:** Represents a Jira ticket being processed

**Key Attributes:**

- id: UUID - Internal identifier
- jiraKey: String - Jira ticket key (e.g., PROJ-123)
- summary: String - Ticket title
- description: Text - Full ticket description
- status: Enum - Processing status
- ambiguityScore: Float - AI-detected ambiguity level
- assignedTo: UUID - Assigned user

**TypeScript Interface:**

```typescript
interface Ticket {
  id: string;
  jiraKey: string;
  jiraId: string;
  summary: string;
  description: string;
  status:
    | 'NEW'
    | 'ANALYZING'
    | 'CLARIFYING'
    | 'READY'
    | 'IMPLEMENTING'
    | 'TESTING'
    | 'COMPLETED'
    | 'FAILED';
  ambiguityScore: number;
  acceptanceCriteria: string | null;
  assignedToId: string;
  organizationId: string;
  assignedTo: User;
  organization: Organization;
  analyses: Analysis[];
  previews: Preview[];
  deployments: Deployment[];
  clarifications: Clarification[];
  createdAt: Date;
  updatedAt: Date;
}
```

**Relationships:**

- Belongs to User (assigned)
- Belongs to Organization
- Has many Analyses
- Has many Previews
- Has one Deployment
- Has many Clarifications

[Additional models: Analysis, Preview, Deployment, Clarification, AuditLog - see full schema below]
