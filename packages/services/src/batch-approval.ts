import {
  BatchRepository,
  prisma,
  TicketBatch,
  BatchApproval,
  BatchStatus,
  ApprovalStatus
} from '@agentris/db';

export interface BatchApprovalOptions {
  requireAllTickets?: boolean;
  autoProcessAfterApproval?: boolean;
  notifyOnApproval?: boolean;
}

export interface ApproveBatchResult {
  batchId: string;
  approvalId: string;
  status: ApprovalStatus;
  approvedTickets: number;
  totalTickets: number;
}

export class BatchApprovalService {
  private repository: BatchRepository;
  private options: BatchApprovalOptions;

  constructor(
    repository?: BatchRepository,
    options: BatchApprovalOptions = {}
  ) {
    this.repository = repository || new BatchRepository(prisma);
    this.options = {
      requireAllTickets: true,
      autoProcessAfterApproval: false,
      notifyOnApproval: true,
      ...options
    };
  }

  /**
   * Submit a batch for approval
   */
  async submitBatchForApproval(
    batchId: string,
    userId: string,
    comments?: string
  ): Promise<BatchApproval> {
    // Validate batch exists and is in correct status
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.status !== BatchStatus.PENDING) {
      throw new Error(`Batch ${batchId} is not in PENDING status`);
    }

    // Check if approval already exists
    if (batch.approval) {
      throw new Error(`Batch ${batchId} already has an approval`);
    }

    // Create approval record
    const approval = await this.repository.createBatchApproval({
      batchId,
      userId,
      status: ApprovalStatus.PENDING,
      comments,
      approvalData: {
        submittedAt: new Date(),
        ticketCount: batch.tickets?.filter(t => !t.excluded).length || 0
      }
    });

    return approval;
  }

  /**
   * Approve a batch
   */
  async approveBatch(
    batchId: string,
    userId: string,
    comments?: string
  ): Promise<ApproveBatchResult> {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Validate batch has pending approval
    if (!batch.approval || batch.approval.status !== ApprovalStatus.PENDING) {
      throw new Error(`Batch ${batchId} does not have a pending approval`);
    }

    // Count active tickets
    const activeTickets = batch.tickets?.filter(t => !t.excluded) || [];
    
    if (this.options.requireAllTickets && activeTickets.length === 0) {
      throw new Error(`Cannot approve batch ${batchId} with no active tickets`);
    }

    // Update approval status
    await this.repository.updateBatchApproval(batchId, {
      status: ApprovalStatus.APPROVED,
      comments,
      approvalData: {
        ...batch.approval.approvalData as any,
        approvedAt: new Date(),
        approvedBy: userId,
        approvedTickets: activeTickets.length
      }
    });

    // Update batch status
    await this.repository.updateBatchStatus(
      batchId,
      BatchStatus.APPROVED,
      userId
    );

    // Auto-process if configured
    if (this.options.autoProcessAfterApproval) {
      await this.repository.updateBatchStatus(
        batchId,
        BatchStatus.PROCESSING
      );
    }

    return {
      batchId,
      approvalId: batch.approval.id,
      status: ApprovalStatus.APPROVED,
      approvedTickets: activeTickets.length,
      totalTickets: batch.tickets?.length || 0
    };
  }

  /**
   * Reject a batch
   */
  async rejectBatch(
    batchId: string,
    userId: string,
    reason: string
  ): Promise<ApproveBatchResult> {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Validate batch has pending approval
    if (!batch.approval || batch.approval.status !== ApprovalStatus.PENDING) {
      throw new Error(`Batch ${batchId} does not have a pending approval`);
    }

    // Update approval status
    await this.repository.updateBatchApproval(batchId, {
      status: ApprovalStatus.REJECTED,
      comments: reason,
      approvalData: {
        ...batch.approval.approvalData as any,
        rejectedAt: new Date(),
        rejectedBy: userId
      }
    });

    // Reset batch status to PENDING
    await this.repository.updateBatchStatus(
      batchId,
      BatchStatus.PENDING
    );

    const activeTickets = batch.tickets?.filter(t => !t.excluded) || [];

    return {
      batchId,
      approvalId: batch.approval.id,
      status: ApprovalStatus.REJECTED,
      approvedTickets: 0,
      totalTickets: activeTickets.length
    };
  }

  /**
   * Modify tickets in a batch and re-approve
   */
  async modifyAndApprove(
    batchId: string,
    userId: string,
    modifications: {
      excludeTickets?: string[];
      includeTickets?: string[];
    },
    comments?: string
  ): Promise<ApproveBatchResult> {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Apply modifications
    if (modifications.excludeTickets) {
      for (const ticketId of modifications.excludeTickets) {
        await this.repository.excludeTicketFromBatch(batchId, ticketId);
      }
    }

    if (modifications.includeTickets) {
      for (const ticketId of modifications.includeTickets) {
        await this.repository.includeTicketInBatch(batchId, ticketId);
      }
    }

    // Update approval with modifications
    if (batch.approval) {
      await this.repository.updateBatchApproval(batchId, {
        status: ApprovalStatus.MODIFIED,
        comments: comments || 'Modified and approved',
        approvalData: {
          ...batch.approval.approvalData as any,
          modifiedAt: new Date(),
          modifiedBy: userId,
          modifications
        }
      });
    }

    // Approve the modified batch
    return this.approveBatch(batchId, userId, comments);
  }

  /**
   * Get approval history for a batch
   */
  async getApprovalHistory(batchId: string): Promise<any> {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    return {
      batchId,
      currentStatus: batch.status,
      approval: batch.approval,
      approvalHistory: batch.approval?.approvalData
    };
  }

  /**
   * Check if user can approve a batch
   */
  async canUserApproveBatch(
    batchId: string,
    userId: string
  ): Promise<boolean> {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      return false;
    }

    // Cannot approve own batch
    if (batch.createdById === userId) {
      return false;
    }

    // Must have pending approval
    if (!batch.approval || batch.approval.status !== ApprovalStatus.PENDING) {
      return false;
    }

    // Additional role-based checks could go here
    
    return true;
  }

  /**
   * Get all pending approvals
   */
  async getPendingApprovals(userId?: string): Promise<BatchApproval[]> {
    const batches = await this.repository.getBatches({
      status: BatchStatus.PENDING
    });

    const pendingApprovals = batches
      .filter(batch => {
        // Has approval record
        if (!batch.approval) return false;
        
        // Is pending
        if (batch.approval.status !== ApprovalStatus.PENDING) return false;
        
        // If userId specified, exclude own batches
        if (userId && batch.createdById === userId) return false;
        
        return true;
      })
      .map(batch => batch.approval!);

    return pendingApprovals;
  }

  /**
   * Cancel a pending approval
   */
  async cancelApproval(
    batchId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    const batch = await this.repository.getBatchById(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Only creator can cancel
    if (batch.createdById !== userId) {
      throw new Error('Only the batch creator can cancel approval');
    }

    // Must have pending approval
    if (!batch.approval || batch.approval.status !== ApprovalStatus.PENDING) {
      throw new Error(`Batch ${batchId} does not have a pending approval`);
    }

    // Update approval status
    await this.repository.updateBatchApproval(batchId, {
      status: ApprovalStatus.REJECTED,
      comments: reason || 'Cancelled by creator',
      approvalData: {
        ...batch.approval.approvalData as any,
        cancelledAt: new Date(),
        cancelledBy: userId
      }
    });

    // Reset batch status
    await this.repository.updateBatchStatus(
      batchId,
      BatchStatus.PENDING
    );
  }
}