import { z } from 'zod';

export enum ChangeType {
  FIELD = 'FIELD',
  FLOW = 'FLOW',
  APEX = 'APEX',
  LAYOUT = 'LAYOUT',
  VALIDATION_RULE = 'VALIDATION_RULE',
  PROCESS_BUILDER = 'PROCESS_BUILDER',
  PERMISSION_SET = 'PERMISSION_SET',
  PROFILE = 'PROFILE',
  TRIGGER = 'TRIGGER',
  LIGHTNING_COMPONENT = 'LIGHTNING_COMPONENT',
  CUSTOM_OBJECT = 'CUSTOM_OBJECT',
  WORKFLOW = 'WORKFLOW',
  APPROVAL_PROCESS = 'APPROVAL_PROCESS',
  REPORT = 'REPORT',
  DASHBOARD = 'DASHBOARD',
  UNKNOWN = 'UNKNOWN',
}

export const changeTypeSchema = z.nativeEnum(ChangeType);

export interface ChangeDetectionResult {
  primaryType: ChangeType;
  detectedTypes: ChangeType[];
  confidence: number;
  metadata: {
    keywords: string[];
    patterns: string[];
    objectNames?: string[];
    fieldNames?: string[];
  };
}

interface DetectionPattern {
  type: ChangeType;
  keywords: string[];
  patterns: RegExp[];
  weight: number;
}

export class ChangeDetector {
  private readonly detectionPatterns: DetectionPattern[] = [
    {
      type: ChangeType.FIELD,
      keywords: [
        'field', 'custom field', 'data type', 'picklist', 'checkbox',
        'text field', 'number field', 'date field', 'formula field',
        'lookup', 'master-detail', 'relationship', 'required field',
      ],
      patterns: [
        /create.*field/i,
        /add.*field/i,
        /new.*field/i,
        /field.*type/i,
        /field.*label/i,
        /field.*api.*name/i,
        /custom.*field/i,
      ],
      weight: 1.0,
    },
    {
      type: ChangeType.FLOW,
      keywords: [
        'flow', 'flow builder', 'screen flow', 'record-triggered flow',
        'scheduled flow', 'platform event', 'auto-launched flow',
        'decision', 'assignment', 'loop', 'create records', 'update records',
      ],
      patterns: [
        /create.*flow/i,
        /build.*flow/i,
        /flow.*builder/i,
        /screen.*flow/i,
        /record.*triggered/i,
        /flow.*element/i,
        /flow.*variable/i,
      ],
      weight: 1.2,
    },
    {
      type: ChangeType.APEX,
      keywords: [
        'apex', 'class', 'trigger', 'apex code', 'soql', 'sosl',
        'dml', 'governor limits', 'batch apex', 'scheduled apex',
        'queueable', 'future method', 'test class', 'code coverage',
      ],
      patterns: [
        /apex.*class/i,
        /apex.*trigger/i,
        /write.*apex/i,
        /apex.*code/i,
        /soql.*query/i,
        /test.*class/i,
        /batch.*apex/i,
      ],
      weight: 1.3,
    },
    {
      type: ChangeType.LAYOUT,
      keywords: [
        'page layout', 'lightning page', 'record page', 'home page',
        'app page', 'compact layout', 'related list', 'field section',
        'button', 'action', 'component', 'tab',
      ],
      patterns: [
        /page.*layout/i,
        /lightning.*page/i,
        /record.*page/i,
        /modify.*layout/i,
        /update.*layout/i,
        /add.*to.*layout/i,
        /layout.*assignment/i,
      ],
      weight: 1.1,
    },
    {
      type: ChangeType.VALIDATION_RULE,
      keywords: [
        'validation rule', 'validation', 'error message', 'formula',
        'error condition', 'field validation', 'business rule',
      ],
      patterns: [
        /validation.*rule/i,
        /create.*validation/i,
        /validation.*formula/i,
        /error.*message/i,
        /validation.*error/i,
      ],
      weight: 1.0,
    },
    {
      type: ChangeType.PROCESS_BUILDER,
      keywords: [
        'process builder', 'process', 'criteria', 'immediate action',
        'scheduled action', 'process criteria', 'process action',
      ],
      patterns: [
        /process.*builder/i,
        /create.*process/i,
        /process.*criteria/i,
        /process.*action/i,
      ],
      weight: 1.1,
    },
    {
      type: ChangeType.PERMISSION_SET,
      keywords: [
        'permission set', 'permissions', 'field permissions',
        'object permissions', 'tab visibility', 'app access',
        'system permissions', 'permission set group',
      ],
      patterns: [
        /permission.*set/i,
        /create.*permission/i,
        /assign.*permission/i,
        /field.*permission/i,
        /object.*permission/i,
      ],
      weight: 1.0,
    },
    {
      type: ChangeType.PROFILE,
      keywords: [
        'profile', 'user profile', 'profile permissions',
        'profile settings', 'login hours', 'ip ranges',
        'record type access', 'default record type',
      ],
      patterns: [
        /update.*profile/i,
        /modify.*profile/i,
        /profile.*permission/i,
        /profile.*setting/i,
      ],
      weight: 1.0,
    },
    {
      type: ChangeType.TRIGGER,
      keywords: [
        'trigger', 'before trigger', 'after trigger',
        'before insert', 'after insert', 'before update',
        'after update', 'before delete', 'after delete',
      ],
      patterns: [
        /create.*trigger/i,
        /apex.*trigger/i,
        /trigger.*handler/i,
        /before.*trigger/i,
        /after.*trigger/i,
      ],
      weight: 1.2,
    },
    {
      type: ChangeType.LIGHTNING_COMPONENT,
      keywords: [
        'lightning component', 'lwc', 'lightning web component',
        'aura component', 'component bundle', 'lightning app',
        'component controller', 'component helper',
      ],
      patterns: [
        /lightning.*component/i,
        /lwc/i,
        /web.*component/i,
        /aura.*component/i,
        /create.*component/i,
      ],
      weight: 1.2,
    },
    {
      type: ChangeType.CUSTOM_OBJECT,
      keywords: [
        'custom object', 'object', 'create object',
        'object settings', 'object permissions',
        'record name', 'object relationship',
      ],
      patterns: [
        /custom.*object/i,
        /create.*object/i,
        /new.*object/i,
        /object.*setting/i,
      ],
      weight: 1.3,
    },
    {
      type: ChangeType.WORKFLOW,
      keywords: [
        'workflow', 'workflow rule', 'workflow action',
        'field update', 'email alert', 'task creation',
        'outbound message', 'time-dependent',
      ],
      patterns: [
        /workflow.*rule/i,
        /create.*workflow/i,
        /workflow.*action/i,
        /field.*update/i,
      ],
      weight: 1.0,
    },
    {
      type: ChangeType.APPROVAL_PROCESS,
      keywords: [
        'approval process', 'approval', 'approver',
        'approval step', 'approval criteria',
        'approval action', 'submit for approval',
      ],
      patterns: [
        /approval.*process/i,
        /create.*approval/i,
        /approval.*step/i,
        /approval.*criteria/i,
      ],
      weight: 1.1,
    },
    {
      type: ChangeType.REPORT,
      keywords: [
        'report', 'report type', 'report filter',
        'report criteria', 'summary report',
        'matrix report', 'tabular report', 'joined report',
      ],
      patterns: [
        /create.*report/i,
        /build.*report/i,
        /report.*type/i,
        /report.*filter/i,
      ],
      weight: 0.9,
    },
    {
      type: ChangeType.DASHBOARD,
      keywords: [
        'dashboard', 'dashboard component',
        'chart', 'gauge', 'metric', 'table',
        'dashboard filter', 'dynamic dashboard',
      ],
      patterns: [
        /create.*dashboard/i,
        /build.*dashboard/i,
        /dashboard.*component/i,
        /add.*chart/i,
      ],
      weight: 0.9,
    },
  ];

  public detectChangeType(ticketContent: string): ChangeDetectionResult {
    const normalizedContent = ticketContent.toLowerCase();
    const detectionScores = new Map<ChangeType, number>();
    const detectedKeywords: Set<string> = new Set();
    const detectedPatterns: Set<string> = new Set();

    for (const pattern of this.detectionPatterns) {
      let score = 0;

      for (const keyword of pattern.keywords) {
        if (normalizedContent.includes(keyword)) {
          score += pattern.weight;
          detectedKeywords.add(keyword);
        }
      }

      for (const regex of pattern.patterns) {
        const matches = normalizedContent.match(regex);
        if (matches) {
          score += pattern.weight * 1.5;
          detectedPatterns.add(matches[0]);
        }
      }

      if (score > 0) {
        detectionScores.set(pattern.type, score);
      }
    }

    const sortedScores = Array.from(detectionScores.entries())
      .sort(([, a], [, b]) => b - a);

    if (sortedScores.length === 0) {
      return {
        primaryType: ChangeType.UNKNOWN,
        detectedTypes: [ChangeType.UNKNOWN],
        confidence: 0,
        metadata: {
          keywords: [],
          patterns: [],
        },
      };
    }

    const primaryType = sortedScores[0][0];
    const maxScore = sortedScores[0][1];
    const detectedTypes = sortedScores.map(([type]) => type);

    const confidence = Math.min(
      100,
      Math.round((maxScore / (this.detectionPatterns.find(p => p.type === primaryType)?.weight ?? 1)) * 20)
    );

    const objectNames = this.extractObjectNames(ticketContent);
    const fieldNames = this.extractFieldNames(ticketContent);

    return {
      primaryType,
      detectedTypes,
      confidence,
      metadata: {
        keywords: Array.from(detectedKeywords),
        patterns: Array.from(detectedPatterns),
        ...(objectNames.length > 0 && { objectNames }),
        ...(fieldNames.length > 0 && { fieldNames }),
      },
    };
  }

  private extractObjectNames(content: string): string[] {
    const objectPattern = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)*__c|[Aa]ccount|[Cc]ontact|[Ll]ead|[Oo]pportunity|[Cc]ase|[Cc]ampaign|[Tt]ask|[Ee]vent)\b/g;
    const matches = content.match(objectPattern);
    if (!matches) return [];
    
    return [...new Set(matches.map(m => {
      const standardized = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
      const standardObjects = ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Campaign', 'Task', 'Event'];
      return standardObjects.includes(standardized) ? standardized : m;
    }))];
  }

  private extractFieldNames(content: string): string[] {
    const fieldPattern = /\b([A-Z][a-z]+(?:[_][A-Za-z]+)*__c|Name|Id|Status|Type|Amount|CloseDate|StageName)\b/g;
    const matches = content.match(fieldPattern);
    return matches ? [...new Set(matches)] : [];
  }

  public determineOptimalPreviewFormat(changeType: ChangeType): string {
    const formatMap: Record<ChangeType, string> = {
      [ChangeType.FIELD]: 'mockup',
      [ChangeType.FLOW]: 'diagram',
      [ChangeType.APEX]: 'code-diff',
      [ChangeType.LAYOUT]: 'mockup',
      [ChangeType.VALIDATION_RULE]: 'code-diff',
      [ChangeType.PROCESS_BUILDER]: 'diagram',
      [ChangeType.PERMISSION_SET]: 'table',
      [ChangeType.PROFILE]: 'table',
      [ChangeType.TRIGGER]: 'code-diff',
      [ChangeType.LIGHTNING_COMPONENT]: 'mockup',
      [ChangeType.CUSTOM_OBJECT]: 'dependency-graph',
      [ChangeType.WORKFLOW]: 'diagram',
      [ChangeType.APPROVAL_PROCESS]: 'diagram',
      [ChangeType.REPORT]: 'mockup',
      [ChangeType.DASHBOARD]: 'mockup',
      [ChangeType.UNKNOWN]: 'text',
    };

    return formatMap[changeType];
  }
}