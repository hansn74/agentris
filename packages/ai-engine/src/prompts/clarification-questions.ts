import type { ClarificationQuestion } from '../clarification-generator';

export function clarificationQuestionsPrompt(params: {
  ambiguousAreas: string[];
  minQuestions: number;
  maxQuestions: number;
  ticketContext: string;
}): string {
  return `You are a Salesforce consultant helping to clarify requirements in a JIRA ticket.

Given the following ambiguous areas identified in a ticket, generate ${params.minQuestions} to ${params.maxQuestions} targeted clarification questions.

AMBIGUOUS AREAS:
${params.ambiguousAreas.map((area, idx) => `${idx + 1}. ${area}`).join('\n')}

TICKET CONTEXT:
${params.ticketContext || 'No additional context available'}

Generate clarifying questions that:
1. Are specific and actionable
2. Focus on implementation details
3. Help resolve the ambiguity
4. Are relevant to Salesforce development
5. Can be answered concretely by the business team

Return the questions in JSON format:
[
  {
    "question": "The clarification question",
    "ambiguityArea": "Which ambiguous area this addresses",
    "importanceScore": 0.0 to 1.0,
    "impactLevel": "high" | "medium" | "low",
    "requirementDependency": ["list", "of", "related", "requirements"]
  }
]

Focus on questions that will have the most impact on successful implementation.`;
}

export function questionRankingPrompt(
  questions: ClarificationQuestion[],
  findings: any
): string {
  return `You are evaluating clarification questions for importance in a Salesforce project.

QUESTIONS TO RANK:
${questions.map((q, idx) => `${idx + 1}. ${q.question}`).join('\n')}

ANALYSIS FINDINGS:
${JSON.stringify(findings, null, 2)}

Rank these questions based on:
1. Impact on implementation complexity (40% weight)
2. Criticality to business requirements (30% weight)
3. Dependencies on other requirements (20% weight)
4. Risk of misunderstanding (10% weight)

Return rankings in JSON format:
[
  {
    "question": "The question text",
    "score": 0.0 to 1.0,
    "impactLevel": "high" | "medium" | "low",
    "reason": "Brief explanation of ranking"
  }
]

Order from most important (highest score) to least important.`;
}

export function salesforceTerminologyPrompt(
  questions: ClarificationQuestion[]
): string {
  const standardObjects = [
    'Account', 'Contact', 'Lead', 'Opportunity', 'Case',
    'Campaign', 'Product', 'PricebookEntry', 'Quote', 'Order',
    'Contract', 'Asset', 'User', 'Profile', 'Permission Set'
  ];

  const salesforceTerms = [
    'record type', 'page layout', 'validation rule', 'workflow rule',
    'process builder', 'flow', 'trigger', 'apex class', 'visualforce page',
    'lightning component', 'lightning web component', 'custom field',
    'custom object', 'sharing rule', 'role hierarchy', 'public group',
    'queue', 'assignment rule', 'escalation rule', 'approval process',
    'field-level security', 'object permissions', 'data loader',
    'change set', 'sandbox', 'production org', 'custom metadata',
    'platform event', 'custom setting', 'connected app', 'named credential'
  ];

  return `You are a Salesforce expert. Review these clarification questions and enhance them with proper Salesforce terminology where appropriate.

QUESTIONS:
${questions.map((q, idx) => `${idx + 1}. ${q.question}`).join('\n')}

STANDARD SALESFORCE OBJECTS:
${standardObjects.join(', ')}

COMMON SALESFORCE TERMS:
${salesforceTerms.join(', ')}

Instructions:
1. Replace generic terms with Salesforce-specific equivalents
2. Use proper Salesforce object and field naming conventions
3. Include relevant Salesforce features when asking about functionality
4. Maintain the original intent of each question
5. Make questions more precise using Salesforce context

Return enhanced questions in JSON format:
[
  {
    "question": "Enhanced question with Salesforce terminology",
    "originalQuestion": "The original question",
    "changesApplied": "Brief description of terminology changes"
  }
]

Only modify questions where Salesforce terminology improves clarity.`;
}