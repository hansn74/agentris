# Epic 2: Salesforce Integration & Basic Automation

**Goal:** Connect to Salesforce orgs and implement basic configuration automation for simple objects like custom fields and validation rules. This epic delivers the core value proposition - actual automation of Salesforce work with full transparency and control.

## Story 2.1: Salesforce Authentication Service

**As a** consultant,  
**I want** to securely connect to my Salesforce orgs,  
**So that** Agentris can make changes on my behalf.

**Acceptance Criteria:**

1. JSForce OAuth 2.0 flow implemented for Salesforce authentication
2. One-time authorization per org with token storage
3. Support for both sandbox and production orgs
4. Connection testing endpoint validates org access
5. Multiple org connections supported per user
6. Automatic token refresh before expiration

## Story 2.2: Salesforce Metadata Service

**As a** developer,  
**I want** a service that handles all Salesforce metadata operations,  
**So that** we have a consistent interface for org modifications.

**Acceptance Criteria:**

1. Service can retrieve org metadata (objects, fields, layouts)
2. Metadata API wrapper for create/update/delete operations
3. Deployment status tracking for async operations
4. Error handling for governor limits and API restrictions
5. Metadata caching to reduce API calls
6. Unit tests mock Salesforce API responses

## Story 2.3: Simple Configuration Automation

**As a** consultant,  
**I want** the system to automate creation of custom fields and validation rules,  
**So that** I can focus on more complex tasks.

**Acceptance Criteria:**

1. Parse Jira ticket to identify field creation requirements
2. Generate custom field metadata from requirements
3. Create validation rules with proper syntax
4. Deploy changes to sandbox org first
5. Verify deployment success before marking complete
6. Support for all standard field types

## Story 2.4: Change Preview System

**As a** consultant,  
**I want** to preview changes before they're applied,  
**So that** I can verify the automation understands my requirements.

**Acceptance Criteria:**

1. Generate text descriptions for simple changes
2. Show field properties in readable format
3. Display validation rule logic clearly
4. Highlight potential impacts on existing configuration
5. Preview updates immediately when requirements change
6. Side-by-side comparison of current vs proposed state

## Story 2.5: Approval Workflow UI

**As a** consultant,  
**I want** to approve or reject proposed changes,  
**So that** I maintain control over what gets deployed.

**Acceptance Criteria:**

1. Clear approve/reject/modify interface in UI
2. Ability to edit proposed changes before approval
3. Comments can be added to explain decisions
4. Bulk approval for similar changes
5. Approval history tracked and displayed
6. Keyboard shortcuts for quick approval workflow

## Story 2.6: Basic Deployment & Rollback

**As a** consultant,  
**I want** changes deployed safely with rollback capability,  
**So that** mistakes can be quickly corrected.

**Acceptance Criteria:**

1. Deploy approved changes to selected Salesforce org
2. Real-time deployment status updates in UI
3. Automatic rollback on deployment failure
4. Manual rollback option available post-deployment
5. Deployment logs accessible for debugging
6. Success/failure notifications to user
