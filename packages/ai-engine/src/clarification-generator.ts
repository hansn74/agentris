import { LLMService } from './llm-service';
import { AmbiguityDetector } from './ambiguity-detector';
import { clarificationQuestionsPrompt, questionRankingPrompt, salesforceTerminologyPrompt } from './prompts/clarification-questions';
import { SalesforceTerminologyValidator } from './salesforce-terminology';
import type { Analysis } from '@agentris/db';

export interface ClarificationQuestion {
  question: string;
  ambiguityArea: string;
  importanceScore: number;
  impactLevel: 'high' | 'medium' | 'low';
  requirementDependency: string[];
  salesforceContext?: {
    objects: string[];
    fields: string[];
    features: string[];
  };
}

export interface GenerateQuestionsOptions {
  minQuestions?: number;
  maxQuestions?: number;
  includeSalesforceTerminology?: boolean;
}

export class ClarificationGenerator {
  private llmService: LLMService;
  private terminologyValidator: SalesforceTerminologyValidator;

  constructor(llmService?: LLMService) {
    this.llmService = llmService || new LLMService();
    this.terminologyValidator = new SalesforceTerminologyValidator();
  }

  async generateQuestions(
    analysis: Analysis,
    options: GenerateQuestionsOptions = {}
  ): Promise<ClarificationQuestion[]> {
    const {
      minQuestions = 3,
      maxQuestions = 5,
      includeSalesforceTerminology = true
    } = options;

    if (!analysis.findings) {
      return [];
    }

    const findings = typeof analysis.findings === 'string' 
      ? JSON.parse(analysis.findings) 
      : analysis.findings;

    // Extract ambiguous areas from the analysis
    const ambiguousAreas = this.extractAmbiguousAreas(findings);
    
    if (ambiguousAreas.length === 0) {
      return [];
    }

    // Generate questions for each ambiguous area
    const questionPrompt = clarificationQuestionsPrompt({
      ambiguousAreas,
      minQuestions,
      maxQuestions,
      ticketContext: typeof analysis.patterns === 'string' ? analysis.patterns : ''
    });

    const questionsResponse = await this.llmService.generateResponse(
      [{ role: 'user', content: questionPrompt }],
      {
        temperature: 0.7,
        maxTokens: 2000
      }
    ) as any;

    let questions = this.parseQuestions(questionsResponse.content);

    // Apply Salesforce terminology if requested
    if (includeSalesforceTerminology && questions.length > 0) {
      questions = await this.enhanceWithSalesforceTerminology(questions);
    }

    // Rank questions by importance
    questions = await this.rankQuestions(questions, findings);

    // Return top questions within the specified range
    return questions.slice(0, maxQuestions);
  }

  private extractAmbiguousAreas(findings: any): string[] {
    const areas: string[] = [];

    if (findings.vagueTerms?.length > 0) {
      areas.push(...findings.vagueTerms.map((term: any) => 
        `Vague term: "${term.term}" - ${term.reason}`
      ));
    }

    if (findings.missingDetails?.length > 0) {
      areas.push(...findings.missingDetails.map((detail: any) =>
        `Missing detail: ${detail.area} - ${detail.description}`
      ));
    }

    if (findings.conflictingRequirements?.length > 0) {
      areas.push(...findings.conflictingRequirements.map((conflict: any) =>
        `Conflict: ${conflict.description}`
      ));
    }

    if (findings.unclearAcceptanceCriteria?.length > 0) {
      areas.push(...findings.unclearAcceptanceCriteria.map((criteria: any) =>
        `Unclear criteria: ${criteria.issue}`
      ));
    }

    return areas;
  }

  private parseQuestions(content: string): ClarificationQuestion[] {
    try {
      // Expect JSON response from LLM
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map(q => ({
          question: q.question || '',
          ambiguityArea: q.ambiguityArea || '',
          importanceScore: q.importanceScore || 0.5,
          impactLevel: q.impactLevel || 'medium',
          requirementDependency: q.requirementDependency || []
        }));
      }
    } catch (e) {
      // Fallback to text parsing if JSON fails
      const lines = content.split('\n').filter(line => line.trim());
      return lines.map(line => ({
        question: line.replace(/^\d+\.\s*/, '').trim(),
        ambiguityArea: 'general',
        importanceScore: 0.5,
        impactLevel: 'medium' as const,
        requirementDependency: []
      }));
    }
    return [];
  }

  private async enhanceWithSalesforceTerminology(
    questions: ClarificationQuestion[]
  ): Promise<ClarificationQuestion[]> {
    // First apply basic terminology replacement
    const preEnhanced = questions.map(q => ({
      ...q,
      question: this.terminologyValidator.enhanceWithSalesforceContext(q.question)
    }));
    
    // Then use LLM for more sophisticated enhancement
    const terminologyPrompt = salesforceTerminologyPrompt(preEnhanced);
    
    const response = await this.llmService.generateResponse(
      [{ role: 'user', content: terminologyPrompt }],
      {
        temperature: 0.3,
        maxTokens: 2000
      }
    ) as any;

    try {
      const enhanced = JSON.parse(response.content);
      if (Array.isArray(enhanced)) {
        return enhanced.map((q, idx) => {
          // Detect Salesforce references in the enhanced question
          const detected = this.terminologyValidator.detectSalesforceReferences(q.question || preEnhanced[idx]?.question || '');
          
          return {
            ...preEnhanced[idx],
            question: q.question || preEnhanced[idx]?.question || '',
            // Add metadata about detected Salesforce elements
            salesforceContext: {
              objects: detected.objects,
              fields: detected.fields,
              features: detected.features
            }
          } as ClarificationQuestion;
        });
      }
    } catch (e) {
      // If parsing fails, return pre-enhanced questions
      return preEnhanced;
    }

    return preEnhanced;
  }

  async rankQuestions(
    questions: ClarificationQuestion[],
    findings: any
  ): Promise<ClarificationQuestion[]> {
    // Apply initial algorithmic ranking
    const algorithmicScores = this.calculateAlgorithmicScores(questions, findings);
    
    // Get AI-based ranking
    const rankingPrompt = questionRankingPrompt(questions, findings);
    
    const response = await this.llmService.generateResponse(
      [{ role: 'user', content: rankingPrompt }],
      {
        temperature: 0.3,
        maxTokens: 1500
      }
    ) as any;

    try {
      const rankings = JSON.parse(response.content);
      if (Array.isArray(rankings)) {
        // Combine algorithmic and AI scores
        rankings.forEach((ranking, index) => {
          const question = questions.find(q => 
            q.question === ranking.question || 
            q.question.includes(ranking.question.substring(0, 50))
          );
          if (question) {
            const algorithmicScore = algorithmicScores.get(question.question) || 0.5;
            // Weighted average: 60% AI score, 40% algorithmic score
            question.importanceScore = (ranking.score * 0.6) + (algorithmicScore * 0.4);
            question.impactLevel = ranking.impactLevel || question.impactLevel;
          }
        });
      }
    } catch (e) {
      // If parsing fails, use algorithmic scores only
      questions.forEach(q => {
        q.importanceScore = algorithmicScores.get(q.question) || 0.5;
      });
    }

    // Sort by importance score
    return questions.sort((a, b) => b.importanceScore - a.importanceScore);
  }

  private calculateAlgorithmicScores(
    questions: ClarificationQuestion[],
    findings: any
  ): Map<string, number> {
    const scores = new Map<string, number>();
    
    questions.forEach(question => {
      let score = 0.5; // Base score
      
      // Impact on implementation complexity (40% weight)
      if (question.impactLevel === 'high') score += 0.4;
      else if (question.impactLevel === 'medium') score += 0.2;
      else score += 0.1;
      
      // Criticality based on keywords (30% weight)
      const criticalKeywords = ['authentication', 'security', 'data migration', 'integration', 'api', 'performance'];
      const hasCriticalKeyword = criticalKeywords.some(keyword => 
        question.question.toLowerCase().includes(keyword)
      );
      if (hasCriticalKeyword) score += 0.3;
      else score += 0.15;
      
      // Dependencies (20% weight)
      const dependencyScore = Math.min(question.requirementDependency.length * 0.1, 0.2);
      score += dependencyScore;
      
      // Risk based on ambiguity type (10% weight)
      if (question.ambiguityArea.includes('conflict')) score += 0.1;
      else if (question.ambiguityArea.includes('missing')) score += 0.08;
      else if (question.ambiguityArea.includes('vague')) score += 0.06;
      else score += 0.04;
      
      scores.set(question.question, Math.min(score, 1.0));
    });
    
    return scores;
  }
}