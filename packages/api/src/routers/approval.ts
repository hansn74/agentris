import { z } from 'zod';
import { router, requireConsultant } from '../trpc';
import { 
  ApprovalService,
  type ApprovalWithDetails,
  type ApprovalHistoryOptions 
} from '@agentris/services';
import { 
  prisma,
  ApprovalStatus,
  ApprovalItemStatus,
  type Preview,
  type PreviewItem,
  type Ticket
} from '@agentris/db';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';
import { checkRateLimit } from '../middleware/rateLimit';

// Validation schema for Salesforce metadata modifications
const salesforceMetadataSchema = z.object({
  // Common metadata fields
  fullName: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  
  // Field-specific properties
  type: z.string().optional(),
  length: z.number().optional(),
  precision: z.number().optional(),
  scale: z.number().optional(),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  formula: z.string().optional(),
  
  // Validation rule properties
  active: z.boolean().optional(),
  errorConditionFormula: z.string().optional(),
  errorMessage: z.string().optional(),
  
  // Permission set properties
  permissions: z.record(z.boolean()).optional(),
  fieldPermissions: z.array(z.object({
    field: z.string(),
    readable: z.boolean(),
    editable: z.boolean(),
  })).optional(),
  
  // Generic metadata properties
  metadata: z.record(z.unknown()).optional(),
}).strict(); // Strict mode prevents unknown fields

// Event emitter for real-time updates
const approvalEvents = new EventEmitter();

interface ApprovalQueueItem {
  previews: (Preview & {
    ticket: Ticket | null;
  })[];
  items: PreviewItem[];
  totalPending: number;
}

interface ApprovalUpdateEvent {
  type: 'APPROVED' | 'REJECTED' | 'MODIFIED';
  approvalId: string;
  previewId: string;
  userId: string;
  itemCount: number;
}

export const approvalRouter = router({
  // Get approval queue with pending items
  getApprovalQueue: requireConsultant
    .input(z.object({
      status: z.string().optional(),
      ticketId: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const service = new ApprovalService(prisma);
      
      // Get all previews with pending items
      const previews = await prisma.preview.findMany({
        where: {
          status: 'READY',
          expiresAt: {
            gt: new Date(),
          },
          ...(input?.ticketId && {
            ticket: {
              id: input.ticketId,
            },
          }),
        },
        include: {
          ticket: true,
          items: true,
          approvals: {
            include: {
              items: true,
            },
          },
        },
        orderBy: {
          generatedAt: 'desc',
        },
      });

      // Filter out already approved items
      const pendingPreviews = previews.filter(preview => {
        const approvedItemIds = new Set(
          preview.approvals.flatMap(a => 
            a.items.map(i => i.previewItemId)
          )
        );
        const pendingItems = preview.items.filter(
          item => !approvedItemIds.has(item.id)
        );
        return pendingItems.length > 0;
      });

      // Collect all pending items
      const allPendingItems = pendingPreviews.flatMap(preview => {
        const approvedItemIds = new Set(
          preview.approvals.flatMap(a => 
            a.items.map(i => i.previewItemId)
          )
        );
        return preview.items.filter(
          item => !approvedItemIds.has(item.id)
        );
      });

      const result: ApprovalQueueItem = {
        previews: pendingPreviews,
        items: allPendingItems,
        totalPending: allPendingItems.length,
      };

      return result;
    }),

  // Approve selected items
  approveItems: requireConsultant
    .input(z.object({
      previewId: z.string(),
      itemIds: z.array(z.string()).min(1).max(100), // Limit bulk operations
      comments: z.string().min(1).max(1000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Apply rate limiting for standard approval operations
      checkRateLimit(ctx.session.user.id, 'approvalStandard');

      // Check resource-level authorization
      const preview = await prisma.preview.findUnique({
        where: { id: input.previewId },
        include: {
          ticket: {
            select: {
              id: true,
              projectId: true,
              assigneeId: true,
            }
          }
        }
      });

      if (!preview) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Preview not found',
        });
      }

      const userRole = ctx.session.user.role;
      const canApprove = 
        userRole === 'ADMIN' || 
        userRole === 'CONSULTANT' ||
        preview.ticket?.assigneeId === ctx.session.user.id;
      
      if (!canApprove) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to approve this preview',
        });
      }

      const service = new ApprovalService(prisma);
      
      const approval = await service.approveChanges({
        previewId: input.previewId,
        userId: ctx.session.user.id,
        itemIds: input.itemIds,
        comments: input.comments,
      });

      // Emit real-time update
      approvalEvents.emit('approval-update', {
        type: 'APPROVED',
        approvalId: approval.id,
        previewId: input.previewId,
        userId: ctx.session.user.id,
        itemCount: input.itemIds.length,
      } as ApprovalUpdateEvent);

      return approval;
    }),

  // Reject selected items
  rejectItems: requireConsultant
    .input(z.object({
      previewId: z.string(),
      itemIds: z.array(z.string()).min(1).max(100), // Limit bulk operations
      reason: z.string().min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      // Apply rate limiting for standard approval operations
      checkRateLimit(ctx.session.user.id, 'approvalStandard');

      // Check resource-level authorization
      const preview = await prisma.preview.findUnique({
        where: { id: input.previewId },
        include: {
          ticket: {
            select: {
              id: true,
              projectId: true,
              assigneeId: true,
            }
          }
        }
      });

      if (!preview) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Preview not found',
        });
      }

      const userRole = ctx.session.user.role;
      const canApprove = 
        userRole === 'ADMIN' || 
        userRole === 'CONSULTANT' ||
        preview.ticket?.assigneeId === ctx.session.user.id;
      
      if (!canApprove) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to reject items in this preview',
        });
      }

      const service = new ApprovalService(prisma);
      
      const approval = await service.rejectChanges({
        previewId: input.previewId,
        userId: ctx.session.user.id,
        itemIds: input.itemIds,
        reason: input.reason,
      });

      // Emit real-time update
      approvalEvents.emit('approval-update', {
        type: 'REJECTED',
        approvalId: approval.id,
        previewId: input.previewId,
        userId: ctx.session.user.id,
        itemCount: input.itemIds.length,
      } as ApprovalUpdateEvent);

      return approval;
    }),

  // Modify a single item
  modifyItem: requireConsultant
    .input(z.object({
      itemId: z.string(),
      modifiedData: salesforceMetadataSchema,
      reason: z.string().min(1).max(500).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Apply rate limiting for modification operations
      checkRateLimit(ctx.session.user.id, 'approvalModify');

      // Batch fetch preview item with authorization check
      const previewItem = await prisma.previewItem.findUnique({
        where: { id: input.itemId },
        include: { 
          preview: {
            include: {
              ticket: {
                select: {
                  id: true,
                  projectId: true,
                  assigneeId: true,
                }
              }
            }
          }
        },
      });

      if (!previewItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Preview item not found',
        });
      }

      // Resource-level authorization: check if user can approve this preview
      const userRole = ctx.session.user.role;
      const ticket = previewItem.preview.ticket;
      
      // Only allow if user is ADMIN, CONSULTANT, or assigned to the ticket
      const canApprove = 
        userRole === 'ADMIN' || 
        userRole === 'CONSULTANT' ||
        ticket?.assigneeId === ctx.session.user.id;
      
      if (!canApprove) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to modify this preview',
        });
      }

      // Validate that modifiedData is compatible with the item type
      if (previewItem.itemType === 'FIELD' && !input.modifiedData.type) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Field modifications must include a type',
        });
      }

      const service = new ApprovalService(prisma);
      
      const approval = await service.modifyAndApprove({
        previewId: previewItem.previewId,
        userId: ctx.session.user.id,
        modifications: [{
          itemId: input.itemId,
          modifiedData: input.modifiedData,
          reason: input.reason,
        }],
        comments: `Modified ${previewItem.name}`,
      });

      // Emit real-time update
      approvalEvents.emit('approval-update', {
        type: 'MODIFIED',
        approvalId: approval.id,
        previewId: previewItem.previewId,
        userId: ctx.session.user.id,
        itemCount: 1,
      } as ApprovalUpdateEvent);

      return approval;
    }),

  // Bulk approve by pattern
  bulkApprove: requireConsultant
    .input(z.object({
      previewId: z.string(),
      pattern: z.object({
        itemType: z.string().optional(),
        impact: z.string().optional(),
      }),
      comments: z.string().min(1).max(1000).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Apply rate limiting for bulk operations
      checkRateLimit(ctx.session.user.id, 'approvalBulk');

      // Check resource-level authorization
      const preview = await prisma.preview.findUnique({
        where: { id: input.previewId },
        include: {
          ticket: {
            select: {
              id: true,
              projectId: true,
              assigneeId: true,
            }
          },
          items: true,
        }
      });

      if (!preview) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Preview not found',
        });
      }

      const userRole = ctx.session.user.role;
      const canApprove = 
        userRole === 'ADMIN' || 
        userRole === 'CONSULTANT' ||
        preview.ticket?.assigneeId === ctx.session.user.id;
      
      if (!canApprove) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to approve this preview',
        });
      }

      // Limit bulk operations to prevent abuse
      const matchingItems = preview.items.filter(item => {
        if (input.pattern.itemType && item.itemType !== input.pattern.itemType) {
          return false;
        }
        if (input.pattern.impact && item.impact !== input.pattern.impact) {
          return false;
        }
        return true;
      });

      if (matchingItems.length > 100) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Bulk operation would affect too many items (max: 100). Please use more specific filters.',
        });
      }

      const service = new ApprovalService(prisma);
      
      const approval = await service.bulkApprove({
        previewId: input.previewId,
        userId: ctx.session.user.id,
        pattern: input.pattern,
        comments: input.comments,
      });

      // Emit real-time update
      approvalEvents.emit('approval-update', {
        type: 'APPROVED',
        approvalId: approval.id,
        previewId: input.previewId,
        userId: ctx.session.user.id,
        itemCount: approval.items.length,
      } as ApprovalUpdateEvent);

      return {
        ...approval,
        itemCount: approval.items.length,
      };
    }),

  // Get approval history
  getApprovalHistory: requireConsultant
    .input(z.object({
      userId: z.string().optional(),
      previewId: z.string().optional(),
      status: z.nativeEnum(ApprovalStatus).optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(10),
    }).optional())
    .query(async ({ input, ctx }) => {
      const service = new ApprovalService(prisma);
      
      const options: ApprovalHistoryOptions = {
        filters: {
          userId: input?.userId || ctx.session.user.id,
          previewId: input?.previewId,
          status: input?.status,
          startDate: input?.startDate,
          endDate: input?.endDate,
        },
        pagination: {
          page: input?.page || 1,
          pageSize: input?.pageSize || 10,
        },
      };

      return service.getApprovalHistory(options);
    }),

  // Get single approval details
  getApproval: requireConsultant
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ input }) => {
      const service = new ApprovalService(prisma);
      
      const approval = await service.getApprovalById(input.id);
      
      if (!approval) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Approval not found',
        });
      }

      return approval;
    }),

  // Get approvals for a specific preview
  getPreviewApprovals: requireConsultant
    .input(z.object({
      previewId: z.string(),
    }))
    .query(async ({ input }) => {
      const service = new ApprovalService(prisma);
      return service.getApprovalsByPreview(input.previewId);
    }),

  // Get pending approvals
  getPendingApprovals: requireConsultant
    .query(async () => {
      const service = new ApprovalService(prisma);
      return service.getPendingApprovals();
    }),

  // Apply modified items (integrate with deployment)
  applyModifiedItems: requireConsultant
    .input(z.object({
      approvalId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const service = new ApprovalService(prisma);
      
      // Check if user has permission to apply changes
      const approval = await service.getApprovalById(input.approvalId);
      
      if (!approval) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Approval not found',
        });
      }

      if (approval.status !== ApprovalStatus.MODIFIED) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only modified approvals can be applied',
        });
      }

      await service.applyModifiedItems(input.approvalId);

      return { success: true };
    }),

  // Real-time subscription for approval updates
  onApprovalUpdate: requireConsultant
    .input(z.object({
      previewId: z.string().optional(),
    }).optional())
    .subscription(({ input, ctx }) => {
      return observable<ApprovalUpdateEvent>((emit) => {
        const handler = (event: ApprovalUpdateEvent) => {
          // Filter by preview ID if provided
          if (!input?.previewId || event.previewId === input.previewId) {
            emit.next(event);
          }
        };

        approvalEvents.on('approval-update', handler);

        return () => {
          approvalEvents.off('approval-update', handler);
        };
      });
    }),
});