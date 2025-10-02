import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Approvals | Agentris',
  description: 'Review and approve proposed changes',
};

export default function ApprovalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}