import { LLMService, LLMServiceConfig } from './llm-service';
import { 
  AmbiguityDetectionResult,
  AmbiguityFinding,
  VagueTerm,
  Conflict
} from '@agentris/shared';
import {
  PATTERN_DETECTION_PROMPT,
  VAGUE_TERMS_PROMPT,
  CONFLICT_DETECTION_PROMPT,
  AMBIGUITY_SUMMARY_PROMPT,
} from './prompts/ambiguity-detection';

export class AmbiguityDetector {
  private llmService: LLMService;

  constructor(config?: LLMServiceConfig) {
    this.llmService = new LLMService(config);
  }

  async detectAmbiguity(ticketText: string): Promise<AmbiguityDetectionResult> {
    // Run all detection methods in parallel for efficiency
    const [patterns, vagueTerms, conflicts] = await Promise.all([
      this.detectPatterns(ticketText),
      this.detectVagueTerms(ticketText),
      this.detectConflicts(ticketText),
    ]);

    // Calculate overall score and confidence
    const { score, confidence } = this.calculateScore(patterns, vagueTerms, conflicts);

    // Generate summary
    const summary = await this.generateSummary(patterns, vagueTerms, conflicts);

    return {
      score,
      confidence,
      missingInfo: patterns,
      vagueTerms,
      conflicts,
      patterns: this.extractPatternTypes(patterns),
      summary,
    };
  }

  async detectPatterns(ticketText: string): Promise<AmbiguityFinding[]> {
    const prompt = PATTERN_DETECTION_PROMPT.replace('{ticketText}', ticketText);

    try {
      const response = await this.llmService.generateResponse([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.1,
        maxTokens: 1500,
      }) as any;

      const content = response.content.trim();
      
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Failed to extract JSON from pattern detection response');
        return [];
      }

      const result = JSON.parse(jsonMatch[0]);
      return result.findings || [];
    } catch (error) {
      console.error('Error detecting patterns:', error);
      return [];
    }
  }

  async detectVagueTerms(ticketText: string): Promise<VagueTerm[]> {
    const prompt = VAGUE_TERMS_PROMPT.replace('{ticketText}', ticketText);

    try {
      const response = await this.llmService.generateResponse([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.1,
        maxTokens: 1500,
      }) as any;

      const content = response.content.trim();
      
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Failed to extract JSON from vague terms response');
        return [];
      }

      const result = JSON.parse(jsonMatch[0]);
      return result.vagueTerms || [];
    } catch (error) {
      console.error('Error detecting vague terms:', error);
      return [];
    }
  }

  async detectConflicts(ticketText: string): Promise<Conflict[]> {
    const prompt = CONFLICT_DETECTION_PROMPT.replace('{ticketText}', ticketText);

    try {
      const response = await this.llmService.generateResponse([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.1,
        maxTokens: 1500,
      }) as any;

      const content = response.content.trim();
      
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Failed to extract JSON from conflict detection response');
        return [];
      }

      const result = JSON.parse(jsonMatch[0]);
      return result.conflicts || [];
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      return [];
    }
  }

  private calculateScore(
    patterns: AmbiguityFinding[],
    vagueTerms: VagueTerm[],
    conflicts: Conflict[]
  ): { score: number; confidence: number } {
    // Weight factors for each type of ambiguity
    const weights = {
      pattern: 0.4,
      vague: 0.3,
      conflict: 0.3,
    };

    // Severity multipliers
    const severityMultipliers = {
      low: 0.3,
      medium: 0.6,
      high: 1.0,
    };

    // Calculate pattern score (0 to 1)
    let patternScore = 0;
    if (patterns.length > 0) {
      const severitySum = patterns.reduce((sum, p) => {
        const severity = p.severity || 'medium';
        return sum + severityMultipliers[severity];
      }, 0);
      patternScore = Math.min(1, severitySum / 5); // Normalize to max of 1
    }

    // Calculate vague terms score (0 to 1)
    const vagueScore = Math.min(1, vagueTerms.length / 10); // Normalize to max of 1

    // Calculate conflict score (0 to 1)
    const conflictScore = conflicts.length > 0 ? 1 : 0; // Binary - conflicts are critical

    // Calculate weighted score
    const score = 
      patternScore * weights.pattern +
      vagueScore * weights.vague +
      conflictScore * weights.conflict;

    // Calculate confidence based on total findings
    const totalFindings = patterns.length + vagueTerms.length + conflicts.length;
    let confidence = 0.5; // Base confidence
    
    if (totalFindings > 0) {
      // Higher confidence with more findings
      confidence = Math.min(0.95, 0.5 + (totalFindings * 0.05));
    } else if (totalFindings === 0) {
      // Low ambiguity with high confidence if no issues found
      confidence = 0.85;
    }

    return {
      score: Math.min(1, Math.max(0, score)), // Ensure 0-1 range
      confidence: Math.min(1, Math.max(0, confidence)), // Ensure 0-1 range
    };
  }

  private extractPatternTypes(patterns: AmbiguityFinding[]): string[] {
    const uniquePatterns = new Set<string>();
    patterns.forEach(p => {
      if (p.pattern) {
        uniquePatterns.add(p.pattern);
      }
    });
    return Array.from(uniquePatterns);
  }

  private async generateSummary(
    patterns: AmbiguityFinding[],
    vagueTerms: VagueTerm[],
    conflicts: Conflict[]
  ): Promise<string> {
    const findings = [
      ...patterns.map(p => `Missing: ${p.text}`),
      ...vagueTerms.map(v => `Vague: "${v.term}" in "${v.context}"`),
      ...conflicts.map(c => `Conflict: ${c.description}`),
    ].slice(0, 5).join('\n'); // Limit to top 5 findings

    const prompt = AMBIGUITY_SUMMARY_PROMPT
      .replace('{missingCount}', patterns.length.toString())
      .replace('{vagueCount}', vagueTerms.length.toString())
      .replace('{conflictCount}', conflicts.length.toString())
      .replace('{findings}', findings || 'No significant issues found.');

    try {
      const response = await this.llmService.generateResponse([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        maxTokens: 200,
      });

      return response.content.trim();
    } catch (error) {
      console.error('Error generating summary:', error);
      return 'Unable to generate summary due to an error.';
    }
  }
}