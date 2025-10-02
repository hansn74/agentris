import { BatchDetails } from '@/components/batch/BatchDetails';

interface BatchDetailsPageProps {
  params: {
    id: string;
  };
}

export default function BatchDetailsPage({ params }: BatchDetailsPageProps) {
  return (
    <div className="container mx-auto py-6">
      <BatchDetails batchId={params.id} />
    </div>
  );
}