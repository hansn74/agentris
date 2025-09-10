'use client';

import { TicketList } from '@/components/ticket/TicketList';
import ErrorBoundary from '@/components/error-boundary';

export default function TicketsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Tickets</h1>
      <ErrorBoundary>
        <TicketList />
      </ErrorBoundary>
    </div>
  );
}
