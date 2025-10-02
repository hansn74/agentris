'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TicketForBatching {
  id: string;
  jiraKey: string;
  title: string;
  description?: string;
  selected: boolean;
}

export function BatchCreator() {
  const router = useRouter();
  const [batchName, setBatchName] = useState('');
  const [groupingStrategy, setGroupingStrategy] = useState('SIMILAR_CHANGES');
  const [tickets, setTickets] = useState<TicketForBatching[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [similarityResults, setSimilarityResults] = useState<any>(null);

  const createBatchMutation = trpc.batch.createBatch.useMutation({
    onSuccess: (data) => {
      router.push(`/batch/${data.data.batchId}`);
    },
  });

  const analyzeSimilarityMutation = trpc.batch.analyzeSimilarity.useMutation({
    onSuccess: (data) => {
      setSimilarityResults(data.data);
      setAnalyzing(false);
    },
    onError: () => {
      setAnalyzing(false);
    },
  });

  const handleAnalyzeTickets = () => {
    const selectedTickets = tickets.filter(t => t.selected);
    if (selectedTickets.length < 2) {
      alert('Please select at least 2 tickets for batch processing');
      return;
    }

    setAnalyzing(true);
    analyzeSimilarityMutation.mutate({
      ticketIds: selectedTickets.map(t => t.id),
      threshold: 0.7,
    });
  };

  const handleCreateBatch = () => {
    const selectedTickets = tickets.filter(t => t.selected);
    if (!batchName || selectedTickets.length === 0) {
      alert('Please provide a batch name and select tickets');
      return;
    }

    createBatchMutation.mutate({
      name: batchName,
      ticketIds: selectedTickets.map(t => t.id),
      groupingStrategy: groupingStrategy as any,
    });
  };

  const toggleTicketSelection = (ticketId: string) => {
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, selected: !t.selected } : t
    ));
  };

  const selectAllTickets = () => {
    setTickets(prev => prev.map(t => ({ ...t, selected: true })));
  };

  const deselectAllTickets = () => {
    setTickets(prev => prev.map(t => ({ ...t, selected: false })));
  };

  // Mock data for demonstration - in production, this would fetch from API
  const loadAvailableTickets = () => {
    setTickets([
      { id: '1', jiraKey: 'TEST-101', title: 'Update Account field validation', selected: false },
      { id: '2', jiraKey: 'TEST-102', title: 'Update Account status field', selected: false },
      { id: '3', jiraKey: 'TEST-103', title: 'Add new Contact fields', selected: false },
      { id: '4', jiraKey: 'TEST-104', title: 'Update Contact validation rules', selected: false },
      { id: '5', jiraKey: 'TEST-105', title: 'Modify Opportunity stages', selected: false },
    ]);
  };

  useState(() => {
    loadAvailableTickets();
  });

  const selectedCount = tickets.filter(t => t.selected).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Batch</CardTitle>
          <CardDescription>
            Group similar tickets together for efficient batch processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="batchName">Batch Name</Label>
            <Input
              id="batchName"
              placeholder="e.g., Account Field Updates Q4"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="strategy">Grouping Strategy</Label>
            <Select value={groupingStrategy} onValueChange={setGroupingStrategy}>
              <SelectTrigger id="strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SIMILAR_CHANGES">Similar Changes</SelectItem>
                <SelectItem value="SAME_OBJECT">Same Object</SelectItem>
                <SelectItem value="CUSTOM">Custom Grouping</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Select Tickets ({selectedCount} selected)</Label>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={selectAllTickets}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllTickets}>
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="border rounded-lg max-h-96 overflow-y-auto">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center space-x-3 p-3 hover:bg-gray-50 border-b last:border-b-0"
                >
                  <Checkbox
                    checked={ticket.selected}
                    onCheckedChange={() => toggleTicketSelection(ticket.id)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{ticket.jiraKey}</div>
                    <div className="text-sm text-gray-600">{ticket.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedCount >= 2 && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleAnalyzeTickets}
                disabled={analyzing}
              >
                {analyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Similarity...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Analyze Similarity
                  </>
                )}
              </Button>
            </div>
          )}

          {similarityResults && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Analysis Complete</p>
                  <p>{similarityResults.groupCount} groups identified with {similarityResults.totalTickets} tickets</p>
                  {similarityResults.recommendations?.map((rec: string, idx: number) => (
                    <p key={idx} className="text-sm">• {rec}</p>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBatch}
              disabled={!batchName || selectedCount === 0 || createBatchMutation.isPending}
            >
              {createBatchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Batch...
                </>
              ) : (
                'Create Batch'
              )}
            </Button>
          </div>

          {createBatchMutation.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to create batch: {createBatchMutation.error.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}