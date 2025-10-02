'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search, 
  Filter, 
  X, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  ArrowUpDown
} from 'lucide-react';

interface BatchTicketManagerProps {
  batchId: string;
  tickets: Array<{
    id: string;
    jiraKey: string;
    title: string;
    status: string;
    excluded: boolean;
    excludeReason?: string;
  }>;
  onTicketExclude?: (ticketId: string) => void;
  onTicketInclude?: (ticketId: string) => void;
}

export function BatchTicketManager({ 
  batchId, 
  tickets: initialTickets,
  onTicketExclude,
  onTicketInclude 
}: BatchTicketManagerProps) {
  const [tickets, setTickets] = useState(initialTickets);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterExcluded, setFilterExcluded] = useState<boolean | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [excludeReason, setExcludeReason] = useState('');

  const excludeMutation = trpc.batch.excludeFromBatch.useMutation({
    onSuccess: (data) => {
      setTickets(prev => prev.map(t => 
        t.id === data.data.excludedTicketId 
          ? { ...t, excluded: true, excludeReason } 
          : t
      ));
      setSelectedTickets(new Set());
      setExcludeReason('');
      onTicketExclude?.(data.data.excludedTicketId);
    },
  });

  const includeMutation = trpc.batch.includeInBatch.useMutation({
    onSuccess: (data) => {
      setTickets(prev => prev.map(t => 
        t.id === data.data.includedTicketId 
          ? { ...t, excluded: false, excludeReason: undefined } 
          : t
      ));
      setSelectedTickets(new Set());
      onTicketInclude?.(data.data.includedTicketId);
    },
  });

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.jiraKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = 
      filterExcluded === null || 
      ticket.excluded === filterExcluded;

    return matchesSearch && matchesFilter;
  });

  const handleSelectAll = () => {
    if (selectedTickets.size === filteredTickets.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(filteredTickets.map(t => t.id)));
    }
  };

  const handleSelectTicket = (ticketId: string) => {
    const newSelected = new Set(selectedTickets);
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId);
    } else {
      newSelected.add(ticketId);
    }
    setSelectedTickets(newSelected);
  };

  const handleBulkExclude = () => {
    if (selectedTickets.size === 0 || !excludeReason) return;
    
    selectedTickets.forEach(ticketId => {
      excludeMutation.mutate({
        batchId,
        ticketId,
        reason: excludeReason,
      });
    });
  };

  const handleBulkInclude = () => {
    if (selectedTickets.size === 0) return;
    
    selectedTickets.forEach(ticketId => {
      includeMutation.mutate({
        batchId,
        ticketId,
      });
    });
  };

  const activeCount = tickets.filter(t => !t.excluded).length;
  const excludedCount = tickets.filter(t => t.excluded).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Batch Tickets</CardTitle>
            <CardDescription>
              Manage tickets included in this batch
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">
              <CheckCircle className="h-3 w-3 mr-1" />
              {activeCount} Active
            </Badge>
            <Badge variant="outline">
              <XCircle className="h-3 w-3 mr-1" />
              {excludedCount} Excluded
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-1">
            <Button
              variant={filterExcluded === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterExcluded(null)}
            >
              All
            </Button>
            <Button
              variant={filterExcluded === false ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterExcluded(false)}
            >
              Active
            </Button>
            <Button
              variant={filterExcluded === true ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterExcluded(true)}
            >
              Excluded
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedTickets.size > 0 && (
          <Alert>
            <AlertDescription className="flex items-center justify-between">
              <span>{selectedTickets.size} ticket(s) selected</span>
              <div className="flex gap-2">
                <Input
                  placeholder="Reason for exclusion..."
                  value={excludeReason}
                  onChange={(e) => setExcludeReason(e.target.value)}
                  className="w-64"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkExclude}
                  disabled={!excludeReason}
                >
                  Exclude Selected
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleBulkInclude}
                >
                  Include Selected
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Tickets Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    filteredTickets.length > 0 &&
                    selectedTickets.size === filteredTickets.length
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Jira Key</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Excluded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedTickets.has(ticket.id)}
                    onCheckedChange={() => handleSelectTicket(ticket.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{ticket.jiraKey}</TableCell>
                <TableCell>{ticket.title}</TableCell>
                <TableCell>
                  <Badge variant="outline">{ticket.status}</Badge>
                </TableCell>
                <TableCell>
                  {ticket.excluded ? (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-muted-foreground">
                        {ticket.excludeReason || 'Excluded'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Active</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {ticket.excluded ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => includeMutation.mutate({
                        batchId,
                        ticketId: ticket.id,
                      })}
                    >
                      Include
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const reason = prompt('Reason for exclusion:');
                        if (reason) {
                          excludeMutation.mutate({
                            batchId,
                            ticketId: ticket.id,
                            reason,
                          });
                        }
                      }}
                    >
                      Exclude
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredTickets.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-2" />
            <p>No tickets found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}