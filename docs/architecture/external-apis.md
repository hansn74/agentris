# External APIs

## Anthropic Claude API

- **Purpose:** LLM for requirement analysis, ambiguity detection, code generation
- **Documentation:** https://docs.anthropic.com/claude/reference/
- **Base URL(s):** https://api.anthropic.com/v1
- **Authentication:** API Key in header (X-API-Key)
- **Rate Limits:** 50 requests/minute, 40,000 tokens/minute

**Key Endpoints Used:**

- `POST /messages` - Send messages for analysis and generation

**Integration Notes:** Use streaming for long responses, implement exponential backoff, cache responses for similar inputs to reduce costs

[Additional external APIs: Salesforce, Jira, Bitbucket - see sections above]
