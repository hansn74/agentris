'use client';

import React from 'react';
import { TableData } from '@agentris/shared';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle } from 'lucide-react';

interface TableViewProps {
  data: TableData;
  className?: string;
}

export function TableView({ data, className }: TableViewProps) {
  const renderCell = (value: any) => {
    if (typeof value === 'boolean') {
      return value ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600" />
      );
    }
    
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">-</span>;
    }
    
    return String(value);
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuration Table</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            {data.metadata?.caption && (
              <TableCaption>{data.metadata.caption}</TableCaption>
            )}
            <TableHeader>
              <TableRow>
                {data.headers.map((header, index) => (
                  <TableHead key={index}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex}>
                      {renderCell(cell)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}