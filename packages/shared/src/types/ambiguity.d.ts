export interface AmbiguityFinding {
    pattern: string;
    text: string;
    startIndex?: number;
    endIndex?: number;
    severity: 'low' | 'medium' | 'high';
    suggestion?: string;
}
export interface VagueTerm {
    term: string;
    context: string;
    suggestion?: string;
}
export interface Conflict {
    requirement1: string;
    requirement2: string;
    description: string;
}
export interface AmbiguityDetectionResult {
    score: number;
    confidence: number;
    missingInfo: AmbiguityFinding[];
    vagueTerms: VagueTerm[];
    conflicts: Conflict[];
    patterns: string[];
    summary: string;
}
export interface AmbiguityHighlight {
    text: string;
    startIndex: number;
    endIndex: number;
    type: 'missing' | 'vague' | 'conflict';
    severity: 'low' | 'medium' | 'high';
    tooltip: string;
}
export type AmbiguityPattern = string[];
//# sourceMappingURL=ambiguity.d.ts.map