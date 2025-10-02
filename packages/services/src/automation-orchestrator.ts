import { RequirementsParser, MetadataGenerator } from '@agentris/ai-engine';
import type { 
  ParsedRequirements, 
  FieldRequirement, 
  ValidationRuleRequirement,
  SalesforceFieldMetadata,
  SalesforceValidationRuleMetadata,
  GeneratedMetadata
} from '@agentris/ai-engine';
import type { MetadataService } from '@agentris/integrations-salesforce';
import type { DeploymentTracker } from '@agentris/integrations-salesforce';
import type { PrismaClient } from '@prisma/client';

export interface AutomationConfig {
  apiKey: string;
  metadataService: MetadataService;
  deploymentTracker: DeploymentTracker;
  prisma: PrismaClient;
}

export interface AutomationResult {
  runId: string;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  metadata?: GeneratedMetadata;
  deploymentId?: string;
  errors: string[];
  warnings: string[];
}

export interface FieldCreationOptions {
  ticketId: string;
  targetOrgId: string;
  deployToProduction?: boolean;
  includeContext?: boolean;
  dryRun?: boolean;
}

export class AutomationOrchestrator {
  private requirementsParser: RequirementsParser;
  private metadataGenerator: MetadataGenerator;
  private metadataService: MetadataService;
  private deploymentTracker: DeploymentTracker;
  private prisma: PrismaClient;

  constructor(config: AutomationConfig) {
    this.requirementsParser = new RequirementsParser(config.apiKey);
    this.metadataGenerator = new MetadataGenerator();
    this.metadataService = config.metadataService;
    this.deploymentTracker = config.deploymentTracker;
    this.prisma = config.prisma;
  }

  async orchestrateFieldCreation(options: FieldCreationOptions): Promise<AutomationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let runId: string = '';
    let deploymentId: string | undefined;

    try {
      // Create automation run record
      const automationRun = await this.prisma.automationRun.create({
        data: {
          ticketId: options.ticketId,
          status: 'RUNNING',
          metadata: {},
        },
      });
      runId = automationRun.id;

      // Step 1: Parse ticket requirements
      await this.recordStep(runId, 'PARSE', 'RUNNING', { ticketId: options.ticketId });
      
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: options.ticketId },
      });

      if (!ticket) {
        throw new Error(`Ticket ${options.ticketId} not found`);
      }

      const parsedRequirements = await this.requirementsParser.parseTicketDescription(
        ticket.description,
        options.includeContext
      );

      // If there are acceptance criteria, parse those too and merge
      if (ticket.acceptanceCriteria) {
        const acRequirements = await this.requirementsParser.parseAcceptanceCriteria(
          ticket.acceptanceCriteria
        );
        
        // Merge acceptance criteria requirements
        if (acRequirements.fields) {
          parsedRequirements.fields.push(...acRequirements.fields);
        }
        if (acRequirements.validationRules) {
          parsedRequirements.validationRules.push(...acRequirements.validationRules);
        }
        if (acRequirements.ambiguities) {
          parsedRequirements.ambiguities.push(...acRequirements.ambiguities);
        }
      }

      // Add ambiguities as warnings
      warnings.push(...parsedRequirements.ambiguities);

      await this.recordStep(runId, 'PARSE', 'COMPLETED', { 
        ticketId: options.ticketId 
      }, parsedRequirements);

      // Step 2: Generate metadata
      await this.recordStep(runId, 'GENERATE', 'RUNNING', parsedRequirements);

      const generatedMetadata: GeneratedMetadata = {
        fields: [],
        validationRules: [],
        isValid: true,
        errors: [],
      };

      // Generate field metadata
      for (const fieldReq of parsedRequirements.fields) {
        try {
          const fieldMetadata = this.metadataGenerator.generateCustomField(fieldReq);
          generatedMetadata.fields.push(fieldMetadata);
        } catch (error) {
          const errorMsg = `Failed to generate field ${fieldReq.fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
        }
      }

      // Generate validation rule metadata
      for (const ruleReq of parsedRequirements.validationRules) {
        try {
          const ruleMetadata = this.metadataGenerator.generateValidationRule(ruleReq);
          generatedMetadata.validationRules.push(ruleMetadata);
        } catch (error) {
          const errorMsg = `Failed to generate validation rule ${ruleReq.ruleName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
        }
      }

      await this.recordStep(runId, 'GENERATE', 'COMPLETED', parsedRequirements, generatedMetadata);

      // Step 3: Validate metadata
      await this.recordStep(runId, 'VALIDATE', 'RUNNING', generatedMetadata);

      const validation = this.metadataGenerator.validateMetadata(generatedMetadata);
      
      if (!validation.isValid) {
        errors.push(...validation.errors);
        warnings.push('Metadata validation failed. Review errors before deployment.');
      }

      generatedMetadata.isValid = validation.isValid;
      generatedMetadata.errors = validation.errors;

      await this.recordStep(runId, 'VALIDATE', validation.isValid ? 'COMPLETED' : 'FAILED', 
        generatedMetadata, { isValid: validation.isValid, errors: validation.errors });

      // If dry run, stop here
      if (options.dryRun) {
        const dryRunStatus = errors.length === 0 ? 'SUCCESS' : 'FAILED';
        await this.prisma.automationRun.update({
          where: { id: runId },
          data: {
            status: dryRunStatus,
            metadata: generatedMetadata as any,
            completedAt: new Date(),
            error: errors.length > 0 ? errors.join('; ') : null,
          },
        });

        return {
          runId,
          status: dryRunStatus,
          metadata: generatedMetadata,
          errors,
          warnings: [...warnings, 'Dry run completed. No deployment performed.'],
        };
      }

      // Step 4: Deploy to sandbox
      if (!validation.isValid) {
        throw new Error('Cannot deploy invalid metadata');
      }

      await this.recordStep(runId, 'DEPLOY', 'RUNNING', {
        targetOrgId: options.targetOrgId,
        metadata: generatedMetadata,
      });

      // Get org details
      const org = await this.prisma.organization.findUnique({
        where: { id: options.targetOrgId },
      });

      if (!org) {
        throw new Error(`Organization ${options.targetOrgId} not found`);
      }

      // Deploy to sandbox first (unless production deployment is forced)
      const targetOrg = !options.deployToProduction && org.orgType === 'PRODUCTION' 
        ? await this.findSandboxOrg(org.userId) 
        : org;

      if (!targetOrg) {
        throw new Error('No sandbox org found for deployment. Create a sandbox connection first.');
      }

      // Prepare deployment package
      const deploymentPackage = this.prepareDeploymentPackage(generatedMetadata);

      // Deploy via MetadataService
      deploymentId = await this.metadataService.deployMetadata(deploymentPackage);

      // Track deployment status
      const deploymentStatus = await this.deploymentTracker.pollDeploymentStatus(
        deploymentId,
        { maxPolls: 30, pollInterval: 2000 }
      );

      await this.recordStep(runId, 'DEPLOY', deploymentStatus.success ? 'COMPLETED' : 'FAILED', 
        { targetOrgId: options.targetOrgId, metadata: generatedMetadata }, 
        { deploymentId, status: deploymentStatus });

      if (!deploymentStatus.success) {
        const errorMsg = `Deployment failed: ${deploymentStatus.errorMessage || 'Unknown error'}`;
        errors.push(errorMsg);
        throw new Error(errorMsg);
      }

      // Step 5: Verify deployment
      await this.recordStep(runId, 'VERIFY', 'RUNNING', { deploymentId });

      const verificationResult = await this.verifyDeployment(
        targetOrg.id,
        generatedMetadata
      );

      await this.recordStep(runId, 'VERIFY', verificationResult.success ? 'COMPLETED' : 'FAILED',
        { deploymentId }, verificationResult);

      if (!verificationResult.success) {
        warnings.push('Deployment verification failed. Manual verification recommended.');
        
        // Attempt rollback if verification fails
        if (deploymentId) {
          const rollbackResult = await this.rollbackDeployment(deploymentId, targetOrg.id);
          if (rollbackResult.success) {
            warnings.push('Deployment rolled back due to verification failure.');
          } else {
            errors.push(`Rollback failed: ${rollbackResult.error || 'Unknown error'}`);
            warnings.push('CRITICAL: Deployment verification failed and rollback also failed. Manual intervention required.');
          }
        }
      }

      // Update automation run status
      const finalStatus = errors.length === 0 ? 'SUCCESS' : 'PARTIAL';
      await this.prisma.automationRun.update({
        where: { id: runId },
        data: {
          status: finalStatus,
          metadata: generatedMetadata as any,
          completedAt: new Date(),
          error: errors.length > 0 ? errors.join('; ') : null,
        },
      });

      return {
        runId,
        status: finalStatus,
        metadata: generatedMetadata,
        deploymentId,
        errors,
        warnings,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      errors.push(errorMessage);

      // Update automation run with failure
      if (runId) {
        await this.prisma.automationRun.update({
          where: { id: runId },
          data: {
            status: 'FAILED',
            error: errorMessage,
            completedAt: new Date(),
          },
        });

        await this.recordStep(runId, 'ERROR', 'FAILED', {}, { error: errorMessage });
      }

      return {
        runId,
        status: 'FAILED',
        errors,
        warnings,
      };
    }
  }

  async verifyDeployment(orgId: string, metadata: GeneratedMetadata): Promise<{ success: boolean; details: any }> {
    try {
      const verificationResults = {
        fields: [] as Array<{ name: string; found: boolean }>,
        validationRules: [] as Array<{ name: string; found: boolean }>,
      };

      // Verify each field was created
      for (const field of metadata.fields) {
        try {
          const objectName = await this.inferObjectName(field.fullName);
          const fieldMetadata = await this.metadataService.describeField(objectName, field.fullName);
          verificationResults.fields.push({
            name: field.fullName,
            found: !!fieldMetadata,
          });
        } catch (error) {
          verificationResults.fields.push({
            name: field.fullName,
            found: false,
          });
        }
      }

      // Verify validation rules
      for (const rule of metadata.validationRules) {
        try {
          const ruleMetadata = await this.metadataService.retrieveMetadata('ValidationRule', rule.fullName);
          verificationResults.validationRules.push({
            name: rule.fullName,
            found: !!ruleMetadata,
          });
        } catch (error) {
          verificationResults.validationRules.push({
            name: rule.fullName,
            found: false,
          });
        }
      }

      // Check if all components were found
      const allFieldsFound = verificationResults.fields.every(f => f.found);
      const allRulesFound = verificationResults.validationRules.every(r => r.found);
      const success = allFieldsFound && allRulesFound;

      return {
        success,
        details: verificationResults,
      };
    } catch (error) {
      return {
        success: false,
        details: { 
          error: error instanceof Error ? error.message : 'Verification failed' 
        },
      };
    }
  }

  async rollbackDeployment(deploymentId: string, orgId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Retrieve deployment details
      const deploymentDetails = await this.deploymentTracker.getDeploymentDetails(deploymentId);
      
      if (!deploymentDetails || !deploymentDetails.components) {
        const errorMsg = 'Cannot rollback: deployment details not found';
        console.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      // Create a deletion package for deployed components
      const deletionPackage = {
        types: deploymentDetails.components.map((component: any) => ({
          name: component.type,
          members: [component.fullName],
        })),
      };

      // Deploy the deletion
      const rollbackId = await this.metadataService.deployMetadata(deletionPackage, { 
        rollbackMode: true 
      });

      // Wait for rollback to complete
      const rollbackStatus = await this.deploymentTracker.pollDeploymentStatus(rollbackId, {
        maxPolls: 20,
        pollInterval: 2000,
      });

      if (rollbackStatus.status !== 'Succeeded') {
        const errorMsg = `Rollback failed with status: ${rollbackStatus.status}`;
        console.error(errorMsg, rollbackStatus.details);
        return { success: false, error: errorMsg };
      }

      console.log(`Rollback completed successfully for deployment ${deploymentId}`);
      return { success: true };
    } catch (error) {
      const errorMsg = `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg, error);
      return { success: false, error: errorMsg };
    }
  }

  private async recordStep(
    runId: string,
    stepType: string,
    status: string,
    input: any,
    output?: any
  ): Promise<void> {
    await this.prisma.automationStep.create({
      data: {
        runId,
        stepType,
        status,
        input,
        output: output || null,
        startedAt: status === 'RUNNING' ? new Date() : undefined,
        completedAt: status === 'COMPLETED' || status === 'FAILED' ? new Date() : undefined,
      },
    });
  }

  private async findSandboxOrg(userId: string): Promise<any> {
    return this.prisma.organization.findFirst({
      where: {
        userId,
        orgType: 'SANDBOX',
      },
    });
  }

  private prepareDeploymentPackage(metadata: GeneratedMetadata): any {
    const packageTypes: any[] = [];

    // Add custom fields
    if (metadata.fields.length > 0) {
      packageTypes.push({
        name: 'CustomField',
        members: metadata.fields.map(f => f.fullName),
      });
    }

    // Add validation rules
    if (metadata.validationRules.length > 0) {
      packageTypes.push({
        name: 'ValidationRule',
        members: metadata.validationRules.map(r => r.fullName),
      });
    }

    return {
      types: packageTypes,
      version: '58.0', // Latest Salesforce API version
    };
  }

  private async inferObjectName(fieldName: string): Promise<string> {
    // This is a simplified implementation
    // In a real scenario, you'd need to track which object the fields belong to
    // For now, assume Account object as default
    return 'Account';
  }

  async getAutomationStatus(runId: string): Promise<any> {
    const run = await this.prisma.automationRun.findUnique({
      where: { id: runId },
      include: {
        steps: {
          orderBy: { startedAt: 'asc' },
        },
      },
    });

    if (!run) {
      throw new Error(`Automation run ${runId} not found`);
    }

    return {
      id: run.id,
      status: run.status,
      metadata: run.metadata,
      error: run.error,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      steps: run.steps.map(step => ({
        type: step.stepType,
        status: step.status,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        error: step.error,
      })),
    };
  }
}