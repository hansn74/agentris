# Technical Assumptions

## Repository Structure: Monorepo

We'll use a monorepo structure to maintain all services, packages, and infrastructure code in a single repository. This enables atomic commits across services, simplified dependency management, and consistent tooling. The monorepo will have clear package boundaries for core logic, integrations (Jira, Salesforce, Bitbucket), UI, and shared utilities.

## Service Architecture

**Modular Monolith** - The system will be built as a modular monolith that can be split into microservices later if needed:

- **API Module** - REST API endpoints with authentication middleware
- **Auth Module** - Handle OAuth flows for Jira, Salesforce, Bitbucket integrations
- **Jira Integration Module** - Ticket reading, comment posting, status updates
- **Salesforce Integration Module** - Org authentication, metadata operations, deployments
- **AI Engine Module** - LLM interactions, ambiguity detection, recommendation generation
- **Preview Generator Module** - Create visual previews, diagrams, and change comparisons
- **Bitbucket Module** - Version control operations, PR creation
- **Audit Module** - Logging, tracking, and compliance reporting

This architecture maintains clear separation of concerns with module boundaries while avoiding the complexity of distributed systems for MVP. Modules communicate through well-defined interfaces that can become API calls if we split to microservices later.

## Testing Requirements

**Full Testing Pyramid** implementation:

- **Unit Tests:** Minimum 80% code coverage for all business logic
- **Integration Tests:** API contract testing between services, external API mocking
- **End-to-End Tests:** Critical user journeys automated with Playwright or Cypress
- **Manual Testing Support:** Feature flags and sandbox environments for safe testing
- **AI Output Validation:** Automated testing framework for LLM responses against known good outputs
- **Salesforce Deployment Testing:** Automated validation in sandbox before production deployment

## Additional Technical Assumptions and Requests

- **Frontend Framework:** React with TypeScript for type safety and developer productivity
- **Backend Language:** Node.js/TypeScript for consistency across stack
- **LLM Provider:** Claude (via Anthropic SDK) with abstraction layer for provider switching
- **Database:** PostgreSQL for transactional data, Redis for caching
- **Background Jobs:** Bull queue for Node.js for async LLM processing
- **Deployment:** Local development first, then simple cloud deployment (Heroku/Railway/Render)
- **Containers:** Docker for development consistency only
- **CI/CD:** GitHub Actions for automated testing on every commit
- **Monitoring:** Simple application logs initially, add monitoring as needed
- **API Documentation:** OpenAPI/Swagger for all endpoints
- **Security:** Environment variables for secrets, HTTPS for production
- **Scaling:** Not required for MVP - single instance sufficient
