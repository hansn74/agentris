export const BATCH_SIMILARITY_PROMPTS = {
  SYSTEM_PROMPT: `You are an expert Salesforce administrator specializing in analyzing and grouping similar configuration requests for batch processing.

Your expertise includes:
- Identifying common patterns across multiple tickets
- Recognizing Salesforce objects and their relationships
- Understanding change types (fields, flows, validation rules, etc.)
- Detecting potential conflicts or dependencies
- Optimizing batch processing efficiency

When analyzing tickets, focus on:
1. Target Salesforce objects
2. Type of changes requested
3. Scope and complexity
4. Processing order requirements
5. Potential for automation`,

  SIMILARITY_ANALYSIS: `Analyze these Salesforce configuration tickets for batch processing potential.

Tickets to analyze:
{tickets}

Evaluation criteria:
1. Common Salesforce objects targeted
2. Similar change types (e.g., all field additions, all validation rules)
3. Shared business context or purpose
4. Absence of conflicting requirements
5. Potential for template-based processing

For each pair of similar tickets, provide:
- Similarity score (0.0 to 1.0)
- Primary reason for similarity
- Shared characteristics
- Any potential conflicts

Format your response as:
PAIR: [ticket1_id] - [ticket2_id]
SCORE: [0.0-1.0]
REASON: [primary similarity reason]
CHARACTERISTICS: [shared aspects]
CONFLICTS: [any conflicts or NONE]`,

  GROUP_FORMATION: `Based on the following similarity scores, suggest optimal batch groups for processing.

Similarity data:
{similarityScores}

Constraints:
- Maximum batch size: 50 tickets
- Minimum similarity threshold: {threshold}
- Groups must share the same change type
- Groups should target the same Salesforce object when possible

For each suggested group:
GROUP_NAME: [descriptive name]
TICKETS: [list of ticket IDs]
CHANGE_TYPE: [primary change type]
OBJECT: [Salesforce object or MULTIPLE]
AVG_SIMILARITY: [average similarity score]
PROCESSING_NOTES: [special considerations]`,

  CONFLICT_DETECTION: `Examine these tickets for potential conflicts if processed as a batch.

Tickets:
{tickets}

Check for:
1. Contradictory requirements
2. Dependency chains (one must complete before another)
3. Resource conflicts (same field, different definitions)
4. Business logic conflicts
5. Processing order requirements

Report any conflicts found:
CONFLICT_TYPE: [type of conflict]
TICKETS_INVOLVED: [ticket IDs]
DESCRIPTION: [conflict details]
RESOLUTION: [suggested resolution or MANUAL_REVIEW]`,

  BATCH_PREVIEW_GENERATION: `Generate a consolidated preview for batch processing these similar tickets.

Batch details:
- Change type: {changeType}
- Target object: {object}
- Number of tickets: {ticketCount}

Individual ticket requirements:
{ticketDetails}

Create a unified processing plan that:
1. Combines common elements efficiently
2. Preserves unique requirements per ticket
3. Identifies shared configuration patterns
4. Suggests optimal execution order
5. Highlights any special considerations

Format as:
COMMON_CHANGES:
- [shared configuration elements]

PER_TICKET_SPECIFICS:
- Ticket [ID]: [unique requirements]

EXECUTION_ORDER:
1. [step with rationale]

SPECIAL_CONSIDERATIONS:
- [any warnings or notes]`
};

/**
 * Build a prompt for analyzing ticket similarity
 */
export function buildSimilarityPrompt(
  tickets: Array<{ id: string; summary: string; description: string }>
): string {
  const ticketList = tickets
    .map(t => `ID: ${t.id}\nSummary: ${t.summary}\nDescription: ${t.description}`)
    .join('\n\n');
  
  return BATCH_SIMILARITY_PROMPTS.SIMILARITY_ANALYSIS.replace('{tickets}', ticketList);
}

/**
 * Build a prompt for group formation
 */
export function buildGroupFormationPrompt(
  similarityScores: Array<{ ticketId1: string; ticketId2: string; score: number }>,
  threshold: number = 0.7
): string {
  const scoresText = similarityScores
    .map(s => `${s.ticketId1} <-> ${s.ticketId2}: ${s.score.toFixed(2)}`)
    .join('\n');
  
  return BATCH_SIMILARITY_PROMPTS.GROUP_FORMATION
    .replace('{similarityScores}', scoresText)
    .replace('{threshold}', threshold.toString());
}

/**
 * Build a prompt for conflict detection
 */
export function buildConflictDetectionPrompt(
  tickets: Array<{ id: string; summary: string; description: string }>
): string {
  const ticketList = tickets
    .map(t => `ID: ${t.id}\nSummary: ${t.summary}\nDescription: ${t.description}`)
    .join('\n\n');
  
  return BATCH_SIMILARITY_PROMPTS.CONFLICT_DETECTION.replace('{tickets}', ticketList);
}

/**
 * Build a prompt for batch preview generation
 */
export function buildBatchPreviewPrompt(
  changeType: string,
  object: string,
  tickets: Array<{ id: string; summary: string; requirements: string }>
): string {
  const ticketDetails = tickets
    .map(t => `Ticket ${t.id}: ${t.summary}\nRequirements: ${t.requirements}`)
    .join('\n\n');
  
  return BATCH_SIMILARITY_PROMPTS.BATCH_PREVIEW_GENERATION
    .replace('{changeType}', changeType)
    .replace('{object}', object)
    .replace('{ticketCount}', tickets.length.toString())
    .replace('{ticketDetails}', ticketDetails);
}