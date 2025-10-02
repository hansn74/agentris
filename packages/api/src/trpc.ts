import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { type Session } from 'next-auth';
import { prisma } from '@agentris/db';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';

interface CreateContextOptions {
  session: Session | null;
}

// Create a global event emitter for subscriptions
export const ee = new EventEmitter();

export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    prisma,
    ee,
  };
};

export const createTRPCContext = async (opts: { req?: any; session?: Session | null }) => {
  const session = opts.session ?? null;
  return createInnerTRPCContext({
    session,
  });
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

const requireRole = (role: 'CONSULTANT' | 'MANAGER' | 'ADMIN') => {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session || !ctx.session.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const userRole = (ctx.session.user as any).role;

    // Admin can access everything
    if (userRole === 'ADMIN') {
      return next({ ctx });
    }

    // Manager can access Manager and Consultant routes
    if (userRole === 'MANAGER' && (role === 'MANAGER' || role === 'CONSULTANT')) {
      return next({ ctx });
    }

    // Consultant can only access Consultant routes
    if (userRole === 'CONSULTANT' && role === 'CONSULTANT') {
      return next({ ctx });
    }

    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Insufficient permissions. Required role: ${role}`,
    });
  });
};

export const requireConsultant = t.procedure
  .use(enforceUserIsAuthed)
  .use(requireRole('CONSULTANT'));
export const requireManager = t.procedure.use(enforceUserIsAuthed).use(requireRole('MANAGER'));
export const requireAdmin = t.procedure.use(enforceUserIsAuthed).use(requireRole('ADMIN'));

// Aliases for consistency
export const adminProcedure = requireAdmin;
