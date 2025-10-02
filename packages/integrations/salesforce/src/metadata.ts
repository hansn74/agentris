import { PrismaClient } from '@prisma/client';
import jsforce from 'jsforce';
import pino from 'pino';
import { ConnectionManager } from './connection';
import {
  CustomObject,
  CustomField,
  ValidationRule,
  PageLayout,
  MetadataComponent,
  DescribeGlobalResult,
  DescribeSObjectResult,
  FieldDescription,
  MetadataListResult,
  MetadataError,
  DeploymentInfo,
  DeploymentStatus,
} from './types/metadata';

const logger = pino({ name: 'salesforce-metadata' });

export class MetadataService {
  private connectionManager: ConnectionManager;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.connectionManager = new ConnectionManager(prisma);
  }

  // Metadata Retrieval Operations

  async describeGlobal(userId: string, orgId: string): Promise<DescribeGlobalResult> {
    try {
      const conn = await this.connectionManager.getConnection(userId, orgId);
      if (!conn) {
        throw new MetadataError('No connection available', 'describeGlobal');
      }

      logger.info({ orgId }, 'Fetching global describe');
      const result = await conn.describeGlobal();

      logger.info({ orgId, objectCount: result.sobjects.length }, 'Global describe completed');
      return result;
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to describe global');
      throw new MetadataError(
        `Failed to retrieve global describe: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'describeGlobal'
      );
    }
  }

  async describeObject(
    userId: string,
    orgId: string,
    objectName: string
  ): Promise<DescribeSObjectResult> {
    try {
      const conn = await this.connectionManager.getConnection(userId, orgId);
      if (!conn) {
        throw new MetadataError('No connection available', 'describeObject', 'SObject', objectName);
      }

      logger.info({ orgId, objectName }, 'Describing object');
      const result = await conn.sobject(objectName).describe();

      logger.info(
        {
          orgId,
          objectName,
          fieldCount: result.fields.length,
        },
        'Object describe completed'
      );

      return result;
    } catch (error) {
      logger.error({ error, orgId, objectName }, 'Failed to describe object');
      throw new MetadataError(
        `Failed to describe object ${objectName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'describeObject',
        'SObject',
        objectName
      );
    }
  }

  async listFields(userId: string, orgId: string, objectName: string): Promise<FieldDescription[]> {
    try {
      const objectDescription = await this.describeObject(userId, orgId, objectName);
      return objectDescription.fields;
    } catch (error) {
      logger.error({ error, orgId, objectName }, 'Failed to list fields');
      throw new MetadataError(
        `Failed to list fields for ${objectName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'listFields',
        'CustomField',
        objectName
      );
    }
  }

  async listLayouts(
    userId: string,
    orgId: string,
    objectName: string
  ): Promise<MetadataListResult[]> {
    try {
      const conn = await this.connectionManager.getConnection(userId, orgId);
      if (!conn) {
        throw new MetadataError('No connection available', 'listLayouts', 'Layout', objectName);
      }

      logger.info({ orgId, objectName }, 'Listing layouts');

      const layoutType = `Layout`;
      const query = [{ type: layoutType, folder: null }];
      const result = await conn.metadata.list(query, '59.0');

      // Filter layouts for the specific object
      const objectLayouts = Array.isArray(result)
        ? result.filter((layout) => layout.fullName.startsWith(`${objectName}-`))
        : result
          ? [result].filter((layout) => layout.fullName.startsWith(`${objectName}-`))
          : [];

      logger.info(
        {
          orgId,
          objectName,
          layoutCount: objectLayouts.length,
        },
        'Layouts listed'
      );

      return objectLayouts;
    } catch (error) {
      logger.error({ error, orgId, objectName }, 'Failed to list layouts');
      throw new MetadataError(
        `Failed to list layouts for ${objectName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'listLayouts',
        'Layout',
        objectName
      );
    }
  }

  async listValidationRules(
    userId: string,
    orgId: string,
    objectName: string
  ): Promise<MetadataListResult[]> {
    try {
      const conn = await this.connectionManager.getConnection(userId, orgId);
      if (!conn) {
        throw new MetadataError(
          'No connection available',
          'listValidationRules',
          'ValidationRule',
          objectName
        );
      }

      logger.info({ orgId, objectName }, 'Listing validation rules');

      const validationRuleType = 'ValidationRule';
      const query = [{ type: validationRuleType, folder: objectName }];
      const result = await conn.metadata.list(query, '59.0');

      const validationRules = Array.isArray(result) ? result : result ? [result] : [];

      logger.info(
        {
          orgId,
          objectName,
          ruleCount: validationRules.length,
        },
        'Validation rules listed'
      );

      return validationRules;
    } catch (error) {
      logger.error({ error, orgId, objectName }, 'Failed to list validation rules');
      throw new MetadataError(
        `Failed to list validation rules for ${objectName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'listValidationRules',
        'ValidationRule',
        objectName
      );
    }
  }

  // Metadata CRUD Operations

  async createMetadata(
    userId: string,
    orgId: string,
    metadataType: string,
    metadata: MetadataComponent[]
  ): Promise<any[]> {
    try {
      const conn = await this.connectionManager.getConnection(userId, orgId);
      if (!conn) {
        throw new MetadataError('No connection available', 'createMetadata', metadataType);
      }

      logger.info(
        {
          orgId,
          metadataType,
          count: metadata.length,
        },
        'Creating metadata'
      );

      const result = await conn.metadata.create(metadataType, metadata);
      const results = Array.isArray(result) ? result : [result];

      // Check for errors
      const errors = results.filter((r) => !r.success);
      if (errors.length > 0) {
        const errorMessages = errors
          .map((e) => e.errors?.map((err: any) => err.message).join(', '))
          .join('; ');
        throw new MetadataError(
          `Failed to create metadata: ${errorMessages}`,
          'createMetadata',
          metadataType
        );
      }

      logger.info(
        {
          orgId,
          metadataType,
          successCount: results.filter((r) => r.success).length,
        },
        'Metadata created successfully'
      );

      return results;
    } catch (error) {
      logger.error({ error, orgId, metadataType }, 'Failed to create metadata');
      if (error instanceof MetadataError) throw error;
      throw new MetadataError(
        `Failed to create metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'createMetadata',
        metadataType
      );
    }
  }

  async updateMetadata(
    userId: string,
    orgId: string,
    metadataType: string,
    metadata: MetadataComponent[]
  ): Promise<any[]> {
    try {
      const conn = await this.connectionManager.getConnection(userId, orgId);
      if (!conn) {
        throw new MetadataError('No connection available', 'updateMetadata', metadataType);
      }

      logger.info(
        {
          orgId,
          metadataType,
          count: metadata.length,
        },
        'Updating metadata'
      );

      const result = await conn.metadata.update(metadataType, metadata);
      const results = Array.isArray(result) ? result : [result];

      // Check for errors
      const errors = results.filter((r) => !r.success);
      if (errors.length > 0) {
        const errorMessages = errors
          .map((e) => e.errors?.map((err: any) => err.message).join(', '))
          .join('; ');
        throw new MetadataError(
          `Failed to update metadata: ${errorMessages}`,
          'updateMetadata',
          metadataType
        );
      }

      logger.info(
        {
          orgId,
          metadataType,
          successCount: results.filter((r) => r.success).length,
        },
        'Metadata updated successfully'
      );

      return results;
    } catch (error) {
      logger.error({ error, orgId, metadataType }, 'Failed to update metadata');
      if (error instanceof MetadataError) throw error;
      throw new MetadataError(
        `Failed to update metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'updateMetadata',
        metadataType
      );
    }
  }

  async deleteMetadata(
    userId: string,
    orgId: string,
    metadataType: string,
    fullNames: string[]
  ): Promise<any[]> {
    try {
      const conn = await this.connectionManager.getConnection(userId, orgId);
      if (!conn) {
        throw new MetadataError('No connection available', 'deleteMetadata', metadataType);
      }

      logger.info(
        {
          orgId,
          metadataType,
          count: fullNames.length,
        },
        'Deleting metadata'
      );

      const result = await conn.metadata.delete(metadataType, fullNames);
      const results = Array.isArray(result) ? result : [result];

      // Check for errors
      const errors = results.filter((r) => !r.success);
      if (errors.length > 0) {
        const errorMessages = errors
          .map((e) => e.errors?.map((err: any) => err.message).join(', '))
          .join('; ');
        throw new MetadataError(
          `Failed to delete metadata: ${errorMessages}`,
          'deleteMetadata',
          metadataType
        );
      }

      logger.info(
        {
          orgId,
          metadataType,
          successCount: results.filter((r) => r.success).length,
        },
        'Metadata deleted successfully'
      );

      return results;
    } catch (error) {
      logger.error({ error, orgId, metadataType }, 'Failed to delete metadata');
      if (error instanceof MetadataError) throw error;
      throw new MetadataError(
        `Failed to delete metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'deleteMetadata',
        metadataType
      );
    }
  }

  async deployMetadata(
    userId: string,
    orgId: string,
    zipBuffer: Buffer,
    options?: any
  ): Promise<string> {
    try {
      const conn = await this.connectionManager.getConnection(userId, orgId);
      if (!conn) {
        throw new MetadataError('No connection available', 'deployMetadata');
      }

      logger.info({ orgId }, 'Starting metadata deployment');

      const deployOptions = {
        rollbackOnError: true,
        singlePackage: true,
        ...options,
      };

      const deployResult = await conn.metadata.deploy(zipBuffer, deployOptions);
      const deploymentId = deployResult.id;

      // Store deployment in database
      await this.prisma.deployment.create({
        data: {
          organizationId: orgId,
          deploymentId,
          status: 'InProgress',
          metadata: {
            options: deployOptions,
            startTime: new Date().toISOString(),
          },
        },
      });

      logger.info({ orgId, deploymentId }, 'Deployment initiated');
      return deploymentId;
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to deploy metadata');
      throw new MetadataError(
        `Failed to deploy metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'deployMetadata'
      );
    }
  }

  async retrieveMetadata(
    userId: string,
    orgId: string,
    metadataType: string,
    fullNames: string[]
  ): Promise<any[]> {
    try {
      const conn = await this.connectionManager.getConnection(userId, orgId);
      if (!conn) {
        throw new MetadataError('No connection available', 'retrieveMetadata', metadataType);
      }

      logger.info(
        {
          orgId,
          metadataType,
          count: fullNames.length,
        },
        'Retrieving metadata'
      );

      const result = await conn.metadata.read(metadataType, fullNames);
      const results = Array.isArray(result) ? result : [result];

      logger.info(
        {
          orgId,
          metadataType,
          retrievedCount: results.length,
        },
        'Metadata retrieved'
      );

      return results;
    } catch (error) {
      logger.error({ error, orgId, metadataType }, 'Failed to retrieve metadata');
      throw new MetadataError(
        `Failed to retrieve metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'retrieveMetadata',
        metadataType
      );
    }
  }
}
