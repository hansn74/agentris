export const PATTERN_DETECTION_PROMPT = `You are an expert requirements analyst. Analyze the following ticket text for missing information patterns.

Identify any missing or incomplete information that would be needed to implement this requirement. Focus on:
- Missing technical specifications
- Undefined acceptance criteria
- Missing context or background
- Undefined edge cases
- Missing dependencies or prerequisites
- Unspecified technical constraints
- Missing user personas or roles

Ticket Text:
{ticketText}

Return a JSON object with the following structure:
{
  "findings": [
    {
      "pattern": "MISSING_INFO | MISSING_ACCEPTANCE_CRITERIA | UNCLEAR_SCOPE | UNCLEAR_DEPENDENCIES",
      "text": "The specific missing information",
      "severity": "low | medium | high",
      "suggestion": "What information should be clarified"
    }
  ]
}`;

export const VAGUE_TERMS_PROMPT = `You are an expert requirements analyst. Identify vague or ambiguous terms in the following ticket text.

Look for:
- Ambiguous adjectives (e.g., "fast", "easy", "user-friendly")
- Unclear quantities (e.g., "some", "many", "few")
- Imprecise time frames (e.g., "soon", "quickly", "eventually")
- Undefined technical terms or acronyms
- Ambiguous pronouns without clear references
- Generic terms (e.g., "system", "process", "module")

Ticket Text:
{ticketText}

Return a JSON object with the following structure:
{
  "vagueTerms": [
    {
      "term": "The vague term or phrase",
      "context": "The sentence containing the term",
      "suggestion": "How to make it more specific"
    }
  ]
}`;

export const CONFLICT_DETECTION_PROMPT = `You are an expert requirements analyst. Identify any conflicting requirements in the following ticket text.

Look for:
- Contradictory statements
- Mutually exclusive requirements
- Conflicting constraints or limitations
- Incompatible technical specifications
- Conflicting user expectations
- Timeline conflicts

Ticket Text:
{ticketText}

Return a JSON object with the following structure:
{
  "conflicts": [
    {
      "requirement1": "First requirement",
      "requirement2": "Conflicting requirement",
      "description": "Why these requirements conflict"
    }
  ]
}`;

export const AMBIGUITY_SUMMARY_PROMPT = `You are an expert requirements analyst. Based on the analysis results below, provide an overall ambiguity assessment.

Analysis Results:
- Missing Information Count: {missingCount}
- Vague Terms Count: {vagueCount}
- Conflicts Count: {conflictCount}

Key Findings:
{findings}

Provide a brief summary (2-3 sentences) explaining the overall ambiguity level and the most critical issues that need clarification. Focus on actionable insights.`;