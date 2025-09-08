# Components

## AI Engine Module

**Responsibility:** Orchestrates all LLM interactions and intelligence features

**Key Interfaces:**

- `analyzeRequirements()` - Detect ambiguities in tickets
- `generateClarifications()` - Create clarifying questions
- `generateImplementation()` - Create Salesforce metadata

**Dependencies:** Anthropic SDK, Prisma, Redis cache

**Technology Stack:** TypeScript, Claude API, Langchain

## Salesforce Integration Module

**Responsibility:** Handles all Salesforce API operations and metadata management

**Key Interfaces:**

- `authenticate()` - OAuth and session management
- `deployMetadata()` - Deploy changes to org
- `retrieveMetadata()` - Fetch org configuration
- `runTests()` - Execute Apex tests

**Dependencies:** JSForce, Salesforce CLI, Database

**Technology Stack:** TypeScript, JSForce, child_process for CLI

## Jira Integration Module

**Responsibility:** Syncs with Jira for ticket management

**Key Interfaces:**

- `fetchTicket()` - Get ticket details
- `postComment()` - Add clarifications
- `updateStatus()` - Sync ticket status
- `attachFile()` - Add deployment reports

**Dependencies:** Jira.js client, Database

**Technology Stack:** TypeScript, Jira REST API v3

[Additional components detailed above]
