export const namingConventionPrompt = `
You are a Salesforce configuration expert analyzing an organization's naming patterns.

Given the following naming patterns detected in the organization:
{patterns}

And the proposed field/object name:
{proposedName}

Provide naming convention recommendations that align with the organization's existing patterns.

Return a JSON response with:
{
  "recommendedName": "suggested name following org patterns",
  "pattern": "detected pattern it should follow",
  "rationale": "explanation of why this naming is recommended",
  "examples": ["existing similar names in the org"],
  "confidence": 0.0-1.0
}
`;

export const fieldTypeRecommendationPrompt = `
You are a Salesforce configuration expert analyzing field type patterns.

Given the following field type patterns in the organization:
{patterns}

And the proposed field:
- Name: {fieldName}
- Purpose: {fieldPurpose}
- Current Type: {currentType}

Recommend the most appropriate field type based on the organization's patterns.

Return a JSON response with:
{
  "recommendedType": "suggested Salesforce field type",
  "rationale": "explanation based on org patterns",
  "similarFields": [
    {
      "name": "existing field name",
      "type": "field type",
      "object": "object name"
    }
  ],
  "considerations": ["any special considerations"],
  "confidence": 0.0-1.0
}
`;

export const relatedChangesPrompt = `
You are a Salesforce configuration expert identifying related changes.

Given the proposed change:
{change}

And the organization's patterns:
{patterns}

Identify related changes that might be needed based on the organization's typical configuration patterns.

Return a JSON response with:
{
  "relatedChanges": [
    {
      "type": "validation_rule|workflow|permission_set|page_layout|etc",
      "description": "what needs to be changed",
      "rationale": "why this is typically needed",
      "priority": "required|recommended|optional"
    }
  ],
  "dependencies": [
    {
      "component": "component name",
      "type": "component type",
      "impact": "how it's affected"
    }
  ]
}
`;

export const conflictDetectionPrompt = `
You are a Salesforce configuration expert analyzing potential conflicts.

Given the proposed changes:
{changes}

And the existing metadata:
{metadata}

Identify any potential conflicts or issues.

Return a JSON response with:
{
  "conflicts": [
    {
      "type": "duplicate|dependency|naming|validation",
      "severity": "critical|high|medium|low",
      "description": "detailed description of the conflict",
      "conflictingComponent": "name of conflicting component",
      "resolution": "suggested resolution"
    }
  ],
  "warnings": [
    {
      "type": "warning type",
      "message": "warning message",
      "recommendation": "what to do"
    }
  ]
}
`;

export const intelligentSuggestionPrompt = `
You are a Salesforce configuration expert providing intelligent recommendations.

Context:
- Organization ID: {orgId}
- Ticket Description: {ticketDescription}
- Detected Patterns: {patterns}
- Proposed Changes: {proposedChanges}

Based on the organization's configuration patterns and best practices, provide comprehensive recommendations for implementing these changes.

Focus on:
1. Naming conventions alignment
2. Field type optimization
3. Related configuration needs
4. Potential conflicts or issues
5. Best practices specific to this organization

Return a JSON response with:
{
  "recommendations": [
    {
      "type": "naming|fieldType|relationship|validation|automation|conflict",
      "category": "suggestion|warning|error",
      "title": "brief title",
      "description": "detailed description",
      "rationale": "why this is recommended based on org patterns",
      "confidence": 0.0-1.0,
      "examples": ["relevant examples from the org"],
      "impact": "low|medium|high"
    }
  ],
  "summary": {
    "totalRecommendations": number,
    "criticalIssues": number,
    "estimatedEffort": "low|medium|high"
  }
}
`;