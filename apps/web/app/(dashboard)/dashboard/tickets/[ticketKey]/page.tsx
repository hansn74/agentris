'use client';

import { useParams } from 'next/navigation';
import { TicketDetail } from '@/components/ticket/TicketDetail';
import ErrorBoundary from '@/components/error-boundary';

export default function TicketDetailPage() {
  const params = useParams();
  const ticketKey = params.ticketKey as string;

  return (
    <ErrorBoundary>
      <TicketDetail ticketKey={ticketKey} />
    </ErrorBoundary>
  );
}
