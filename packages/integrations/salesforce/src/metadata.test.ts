import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { MetadataService } from './metadata';
import { ConnectionManager } from './connection';
import { MetadataError } from './types/metadata';

vi.mock('./connection');
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('MetadataService', () => {
  let metadataService: MetadataService;
  let mockPrisma: any;
  let mockConnection: any;
  let mockConnectionManager: any;

  beforeEach(() => {
    // Mock Prisma
    mockPrisma = {
      deployment: {
        create: vi.fn(),
      },
    };

    // Mock JSForce connection
    mockConnection = {
      describeGlobal: vi.fn(),
      sobject: vi.fn(),
      metadata: {
        list: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deploy: vi.fn(),
        read: vi.fn(),
        checkDeployStatus: vi.fn(),
      },
    };

    // Mock ConnectionManager
    mockConnectionManager = {
      getConnection: vi.fn().mockResolvedValue(mockConnection),
    };

    vi.mocked(ConnectionManager).mockImplementation(() => mockConnectionManager);

    metadataService = new MetadataService(mockPrisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('describeGlobal', () => {
    it('should successfully retrieve global describe', async () => {
      const mockResult = {
        encoding: 'UTF-8',
        maxBatchSize: 200,
        sobjects: [
          {
            name: 'Account',
            label: 'Account',
            labelPlural: 'Accounts',
            custom: false,
            createable: true,
            deletable: true,
            queryable: true,
            searchable: true,
            updateable: true,
            urls: {
              sobject: '/services/data/v59.0/sobjects/Account',
              describe: '/services/data/v59.0/sobjects/Account/describe',
              rowTemplate: '/services/data/v59.0/sobjects/Account/{ID}',
            },
          },
        ],
      };

      mockConnection.describeGlobal.mockResolvedValue(mockResult);

      const result = await metadataService.describeGlobal('userId', 'orgId');

      expect(result).toEqual(mockResult);
      expect(mockConnectionManager.getConnection).toHaveBeenCalledWith('userId', 'orgId');
      expect(mockConnection.describeGlobal).toHaveBeenCalled();
    });

    it('should throw MetadataError when connection is not available', async () => {
      mockConnectionManager.getConnection.mockResolvedValue(null);

      await expect(metadataService.describeGlobal('userId', 'orgId')).rejects.toThrow(
        MetadataError
      );
    });

    it('should throw MetadataError when describeGlobal fails', async () => {
      mockConnection.describeGlobal.mockRejectedValue(new Error('API Error'));

      await expect(metadataService.describeGlobal('userId', 'orgId')).rejects.toThrow(
        MetadataError
      );
    });
  });

  describe('describeObject', () => {
    it('should successfully describe an object', async () => {
      const mockResult = {
        name: 'Account',
        label: 'Account',
        labelPlural: 'Accounts',
        custom: false,
        keyPrefix: '001',
        fields: [
          {
            name: 'Id',
            label: 'Account ID',
            type: 'id',
            custom: false,
            nillable: false,
            calculated: false,
            createable: false,
            updateable: false,
            unique: false,
          },
          {
            name: 'Name',
            label: 'Account Name',
            type: 'string',
            length: 255,
            custom: false,
            nillable: false,
            calculated: false,
            createable: true,
            updateable: true,
            unique: false,
          },
        ],
      };

      const mockSObject = {
        describe: vi.fn().mockResolvedValue(mockResult),
      };
      mockConnection.sobject.mockReturnValue(mockSObject);

      const result = await metadataService.describeObject('userId', 'orgId', 'Account');

      expect(result).toEqual(mockResult);
      expect(mockConnection.sobject).toHaveBeenCalledWith('Account');
      expect(mockSObject.describe).toHaveBeenCalled();
    });

    it('should throw MetadataError when connection is not available', async () => {
      mockConnectionManager.getConnection.mockResolvedValue(null);

      await expect(metadataService.describeObject('userId', 'orgId', 'Account')).rejects.toThrow(
        MetadataError
      );
    });
  });

  describe('listFields', () => {
    it('should successfully list fields for an object', async () => {
      const mockFields = [
        {
          name: 'Id',
          label: 'Account ID',
          type: 'id',
          custom: false,
          nillable: false,
          calculated: false,
          createable: false,
          updateable: false,
          unique: false,
        },
        {
          name: 'Name',
          label: 'Account Name',
          type: 'string',
          length: 255,
          custom: false,
          nillable: false,
          calculated: false,
          createable: true,
          updateable: true,
          unique: false,
        },
      ];

      const mockSObject = {
        describe: vi.fn().mockResolvedValue({
          name: 'Account',
          fields: mockFields,
        }),
      };
      mockConnection.sobject.mockReturnValue(mockSObject);

      const result = await metadataService.listFields('userId', 'orgId', 'Account');

      expect(result).toEqual(mockFields);
      expect(mockConnection.sobject).toHaveBeenCalledWith('Account');
    });
  });

  describe('listLayouts', () => {
    it('should successfully list layouts for an object', async () => {
      const mockLayouts = [
        {
          createdById: '0051234567890ABC',
          createdByName: 'Admin User',
          createdDate: new Date(),
          fileName: 'layouts/Account-Account Layout.layout',
          fullName: 'Account-Account Layout',
          id: 'layout123',
          lastModifiedById: '0051234567890ABC',
          lastModifiedByName: 'Admin User',
          lastModifiedDate: new Date(),
          type: 'Layout',
        },
      ];

      mockConnection.metadata.list.mockResolvedValue(mockLayouts);

      const result = await metadataService.listLayouts('userId', 'orgId', 'Account');

      expect(result).toEqual(mockLayouts);
      expect(mockConnection.metadata.list).toHaveBeenCalledWith(
        [{ type: 'Layout', folder: null }],
        '59.0'
      );
    });

    it('should filter layouts for specific object', async () => {
      const mockLayouts = [
        {
          fullName: 'Account-Account Layout',
          type: 'Layout',
        },
        {
          fullName: 'Contact-Contact Layout',
          type: 'Layout',
        },
      ];

      mockConnection.metadata.list.mockResolvedValue(mockLayouts);

      const result = await metadataService.listLayouts('userId', 'orgId', 'Account');

      expect(result).toHaveLength(1);
      expect(result[0].fullName).toBe('Account-Account Layout');
    });
  });

  describe('createMetadata', () => {
    it('should successfully create metadata', async () => {
      const mockMetadata = [
        {
          fullName: 'Account.TestField__c',
          type: 'CustomField',
          label: 'Test Field',
          fieldType: 'Text',
          length: 50,
        },
      ];

      const mockResult = [
        {
          fullName: 'Account.TestField__c',
          success: true,
          created: true,
        },
      ];

      mockConnection.metadata.create.mockResolvedValue(mockResult);

      const result = await metadataService.createMetadata(
        'userId',
        'orgId',
        'CustomField',
        mockMetadata
      );

      expect(result).toEqual(mockResult);
      expect(mockConnection.metadata.create).toHaveBeenCalledWith('CustomField', mockMetadata);
    });

    it('should throw MetadataError when creation fails', async () => {
      const mockMetadata = [
        {
          fullName: 'Account.TestField__c',
          type: 'CustomField',
        },
      ];

      const mockResult = [
        {
          fullName: 'Account.TestField__c',
          success: false,
          errors: [{ message: 'Field already exists' }],
        },
      ];

      mockConnection.metadata.create.mockResolvedValue(mockResult);

      await expect(
        metadataService.createMetadata('userId', 'orgId', 'CustomField', mockMetadata)
      ).rejects.toThrow(MetadataError);
    });
  });

  describe('updateMetadata', () => {
    it('should successfully update metadata', async () => {
      const mockMetadata = [
        {
          fullName: 'Account.TestField__c',
          type: 'CustomField',
          label: 'Updated Test Field',
        },
      ];

      const mockResult = [
        {
          fullName: 'Account.TestField__c',
          success: true,
        },
      ];

      mockConnection.metadata.update.mockResolvedValue(mockResult);

      const result = await metadataService.updateMetadata(
        'userId',
        'orgId',
        'CustomField',
        mockMetadata
      );

      expect(result).toEqual(mockResult);
      expect(mockConnection.metadata.update).toHaveBeenCalledWith('CustomField', mockMetadata);
    });
  });

  describe('deleteMetadata', () => {
    it('should successfully delete metadata', async () => {
      const fullNames = ['Account.TestField__c'];
      const mockResult = [
        {
          fullName: 'Account.TestField__c',
          success: true,
          deleted: true,
        },
      ];

      mockConnection.metadata.delete.mockResolvedValue(mockResult);

      const result = await metadataService.deleteMetadata(
        'userId',
        'orgId',
        'CustomField',
        fullNames
      );

      expect(result).toEqual(mockResult);
      expect(mockConnection.metadata.delete).toHaveBeenCalledWith('CustomField', fullNames);
    });
  });

  describe('deployMetadata', () => {
    it('should successfully initiate deployment', async () => {
      const mockZipBuffer = Buffer.from('test');
      const mockDeploymentId = 'deploy123';

      mockConnection.metadata.deploy.mockResolvedValue({ id: mockDeploymentId });
      mockPrisma.deployment.create.mockResolvedValue({
        id: 'db123',
        deploymentId: mockDeploymentId,
      });

      const result = await metadataService.deployMetadata('userId', 'orgId', mockZipBuffer);

      expect(result).toBe(mockDeploymentId);
      expect(mockConnection.metadata.deploy).toHaveBeenCalledWith(
        mockZipBuffer,
        expect.objectContaining({
          rollbackOnError: true,
          singlePackage: true,
        })
      );
      expect(mockPrisma.deployment.create).toHaveBeenCalled();
    });
  });

  describe('retrieveMetadata', () => {
    it('should successfully retrieve metadata', async () => {
      const fullNames = ['Account.TestField__c'];
      const mockResult = [
        {
          fullName: 'Account.TestField__c',
          label: 'Test Field',
          type: 'Text',
          length: 50,
        },
      ];

      mockConnection.metadata.read.mockResolvedValue(mockResult);

      const result = await metadataService.retrieveMetadata(
        'userId',
        'orgId',
        'CustomField',
        fullNames
      );

      expect(result).toEqual(mockResult);
      expect(mockConnection.metadata.read).toHaveBeenCalledWith('CustomField', fullNames);
    });
  });
});
