import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Change Preview - Agentris',
  description: 'Preview metadata changes before applying to Salesforce',
};

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}