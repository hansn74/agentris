import Link from 'next/link';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Link2, Settings2, User } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/dashboard/settings/integrations">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Link2 className="h-8 w-8 text-primary" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Connect your Jira account and manage external integrations
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <User className="h-8 w-8 text-primary" />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Manage your account information and preferences</CardDescription>
          </CardHeader>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Settings2 className="h-8 w-8 text-primary" />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Configure application behavior and notifications</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
