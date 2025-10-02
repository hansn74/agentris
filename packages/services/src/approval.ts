import { 
  PrismaClient, 
  Approval, 
  ApprovalItem, 
  ApprovalStatus, 
  ApprovalItemStatus,
  Preview,
  PreviewItem,
  User
} from '@agentris/db';
import { ApprovalRepository, ApprovalItemRepository } from '@agentris/db';

export interface ApprovalWithDetails extends Approval {
  items: (ApprovalItem & {
    previewItem: PreviewItem;
  })[];
  preview: Preview & {
    items: PreviewItem[];
  };
  user: User;
}

export interface ApproveChangesInput {
  previewId: string;
  userId: string;
  itemIds: string[];
  comments?: string;
}

export interface RejectChangesInput {
  previewId: string;
  userId: string;
  itemIds: string[];
  reason: string;
}

// Schema for validated metadata modifications
export interface ValidatedMetadata {
  fullName?: string;
  label?: string;
  description?: string;
  type?: string;
  length?: number;
  precision?: number;
  scale?: number;
  required?: boolean;
  unique?: boolean;
  defaultValue?: string | number | boolean;
  formula?: string;
  active?: boolean;
  errorConditionFormula?: string;
  errorMessage?: string;
  permissions?: Record<string, boolean>;
  fieldPermissions?: Array<{
    field: string;
    readable: boolean;
    editable: boolean;
  }>;
  metadata?: Record<string, unknown>;
}

export interface ModifyAndApproveInput {
  previewId: string;
  userId: string;
  modifications: {
    itemId: string;
    modifiedData: ValidatedMetadata;
    reason?: string;
  }[];
  comments?: string;
}

export interface BulkApproveInput {
  previewId: string;
  userId: string;
  pattern?: {
    itemType?: string;
    impact?: string;
  };
  comments?: string;
}

export interface ApprovalHistoryFilters {
  userId?: string;
  previewId?: string;
  status?: ApprovalStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface ApprovalHistoryOptions {
  filters?: ApprovalHistoryFilters;
  pagination?: {
    page: number;
    pageSize: number;
  };
}

export class ApprovalService {
  private approvalRepository: ApprovalRepository;
  private approvalItemRepository: ApprovalItemRepository;

  constructor(private prisma: PrismaClient) {
    this.approvalRepository = new ApprovalRepository(prisma);
    this.approvalItemRepository = new ApprovalItemRepository(prisma);
  }

  async approveChanges(input: ApproveChangesInput): Promise<ApprovalWithDetails> {
    const { previewId, userId, itemIds, comments } = input;

    // Create approval record
    const approval = await this.approvalRepository.create({
      preview: { connect: { id: previewId } },
      user: { connect: { id: userId } },
      status: ApprovalStatus.APPROVED,
      comments,
    });

    // Create approval items for each selected preview item
    const approvalItems = itemIds.map(itemId => ({
      approvalId: approval.id,
      previewItemId: itemId,
      status: ApprovalItemStatus.APPROVED,
    }));

    await this.approvalItemRepository.createMany(approvalItems);

    // Fetch and return complete approval with details
    const approvalWithDetails = await this.approvalRepository.findById(approval.id);
    if (!approvalWithDetails) {
      throw new Error('Failed to retrieve approval details');
    }

    return approvalWithDetails as ApprovalWithDetails;
  }

  async rejectChanges(input: RejectChangesInput): Promise<ApprovalWithDetails> {
    const { previewId, userId, itemIds, reason } = input;

    // Create approval record
    const approval = await this.approvalRepository.create({
      preview: { connect: { id: previewId } },
      user: { connect: { id: userId } },
      status: ApprovalStatus.REJECTED,
      comments: reason,
    });

    // Create rejection items
    const approvalItems = itemIds.map(itemId => ({
      approvalId: approval.id,
      previewItemId: itemId,
      status: ApprovalItemStatus.REJECTED,
      reason,
    }));

    await this.approvalItemRepository.createMany(approvalItems);

    // Fetch and return complete approval with details
    const approvalWithDetails = await this.approvalRepository.findById(approval.id);
    if (!approvalWithDetails) {
      throw new Error('Failed to retrieve approval details');
    }

    return approvalWithDetails as ApprovalWithDetails;
  }

  async modifyAndApprove(input: ModifyAndApproveInput): Promise<ApprovalWithDetails> {
    const { previewId, userId, modifications, comments } = input;

    // Validate all modifications have required fields based on item type
    const previewItems = await this.prisma.previewItem.findMany({
      where: { 
        id: { in: modifications.map(m => m.itemId) },
        previewId,
      },
    });

    for (const mod of modifications) {
      const item = previewItems.find(i => i.id === mod.itemId);
      if (!item) {
        throw new Error(`Preview item ${mod.itemId} not found or doesn't belong to preview`);
      }

      // Validate required fields based on item type
      if (item.itemType === 'FIELD' && !mod.modifiedData.type) {
        throw new Error(`Field ${item.name} requires a type in modifications`);
      }
      
      if (item.itemType === 'VALIDATION_RULE' && !mod.modifiedData.errorConditionFormula) {
        throw new Error(`Validation rule ${item.name} requires an error condition formula`);
      }

      // Ensure modifiedData doesn't contain dangerous patterns
      const jsonStr = JSON.stringify(mod.modifiedData);
      if (jsonStr.includes('__proto__') || jsonStr.includes('constructor') || jsonStr.includes('prototype')) {
        throw new Error('Modified data contains potentially unsafe properties');
      }
    }

    // Create approval record
    const approval = await this.approvalRepository.create({
      preview: { connect: { id: previewId } },
      user: { connect: { id: userId } },
      status: ApprovalStatus.MODIFIED,
      comments,
    });

    // Create modified approval items with validated data
    const approvalItems = modifications.map(mod => ({
      approvalId: approval.id,
      previewItemId: mod.itemId,
      status: ApprovalItemStatus.MODIFIED,
      modifiedData: mod.modifiedData as any, // Type-safe after validation
      reason: mod.reason,
    }));

    await this.approvalItemRepository.createMany(approvalItems);

    // Fetch and return complete approval with details
    const approvalWithDetails = await this.approvalRepository.findById(approval.id);
    if (!approvalWithDetails) {
      throw new Error('Failed to retrieve approval details');
    }

    return approvalWithDetails as ApprovalWithDetails;
  }

  async bulkApprove(input: BulkApproveInput): Promise<ApprovalWithDetails> {
    const { previewId, userId, pattern, comments } = input;

    // Fetch preview with items
    const preview = await this.prisma.preview.findUnique({
      where: { id: previewId },
      include: { items: true },
    });

    if (!preview) {
      throw new Error('Preview not found');
    }

    // Filter items based on pattern
    let itemsToApprove = preview.items;
    if (pattern) {
      itemsToApprove = preview.items.filter(item => {
        if (pattern.itemType && item.itemType !== pattern.itemType) {
          return false;
        }
        if (pattern.impact && item.impact !== pattern.impact) {
          return false;
        }
        return true;
      });
    }

    if (itemsToApprove.length === 0) {
      throw new Error('No items match the specified pattern');
    }

    // Create approval record
    const approval = await this.approvalRepository.create({
      preview: { connect: { id: previewId } },
      user: { connect: { id: userId } },
      status: ApprovalStatus.APPROVED,
      comments: comments || `Bulk approved ${itemsToApprove.length} items`,
    });

    // Create approval items
    const approvalItems = itemsToApprove.map(item => ({
      approvalId: approval.id,
      previewItemId: item.id,
      status: ApprovalItemStatus.APPROVED,
    }));

    await this.approvalItemRepository.createMany(approvalItems);

    // Fetch and return complete approval with details
    const approvalWithDetails = await this.approvalRepository.findById(approval.id);
    if (!approvalWithDetails) {
      throw new Error('Failed to retrieve approval details');
    }

    return approvalWithDetails as ApprovalWithDetails;
  }

  async getApprovalHistory(options?: ApprovalHistoryOptions): Promise<{
    approvals: ApprovalWithDetails[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = options?.pagination?.page || 1;
    const pageSize = options?.pagination?.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const { approvals, total } = await this.approvalRepository.getApprovalHistory(
      options?.filters,
      { skip, take: pageSize }
    );

    const totalPages = Math.ceil(total / pageSize);

    return {
      approvals: approvals as ApprovalWithDetails[],
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getApprovalById(id: string): Promise<ApprovalWithDetails | null> {
    const approval = await this.approvalRepository.findById(id);
    return approval as ApprovalWithDetails | null;
  }

  async getApprovalsByPreview(previewId: string): Promise<ApprovalWithDetails[]> {
    const approvals = await this.approvalRepository.findByPreviewId(previewId);
    return approvals as ApprovalWithDetails[];
  }

  async getApprovalsByUser(userId: string): Promise<ApprovalWithDetails[]> {
    const approvals = await this.approvalRepository.findByUserId(userId);
    return approvals as ApprovalWithDetails[];
  }

  async getPendingApprovals(): Promise<ApprovalWithDetails[]> {
    const approvals = await this.approvalRepository.findPending();
    return approvals as ApprovalWithDetails[];
  }

  async updateApprovalStatus(
    id: string,
    status: ApprovalStatus,
    comments?: string
  ): Promise<ApprovalWithDetails> {
    const approval = await this.approvalRepository.updateStatus(id, status, comments);
    return approval as ApprovalWithDetails;
  }

  async getModifiedItems(approvalId?: string): Promise<ApprovalItem[]> {
    return this.approvalItemRepository.findModifiedItems(approvalId);
  }

  async applyModifiedItems(approvalId: string): Promise<void> {
    const modifiedItems = await this.approvalItemRepository.findModifiedItems(approvalId);

    // This would integrate with the actual deployment system
    // For now, we just update the preview items with the modified data
    for (const item of modifiedItems) {
      if (item.modifiedData) {
        await this.prisma.previewItem.update({
          where: { id: item.previewItemId },
          data: {
            proposedState: item.modifiedData as any,
          },
        });
      }
    }
  }
}