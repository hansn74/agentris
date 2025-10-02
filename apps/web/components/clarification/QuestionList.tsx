'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, Circle, MessageSquare, Clock, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Clarification {
  id: string;
  question: string;
  answer?: string | null;
  source: string;
  askedBy?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface QuestionListProps {
  clarifications: Clarification[];
  showAnswers?: boolean;
  onAnswerClick?: (id: string) => void;
  className?: string;
}

export const QuestionList: React.FC<QuestionListProps> = ({
  clarifications,
  showAnswers = true,
  onAnswerClick,
  className = ''
}) => {
  const getSourceColor = (source: string) => {
    switch (source) {
      case 'AI':
        return 'bg-purple-100 text-purple-700';
      case 'MANUAL':
        return 'bg-blue-100 text-blue-700';
      case 'JIRA_WEBHOOK':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return formatDistanceToNow(d, { addSuffix: true });
  };

  if (clarifications.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No clarification questions yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className={`h-[600px] ${className}`}>
      <div className="space-y-3 p-4">
        {clarifications.map((clarification) => (
          <Card
            key={clarification.id}
            className={`transition-colors hover:shadow-md ${
              clarification.answer ? 'bg-gray-50' : 'bg-white'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {clarification.answer ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle
                      className="w-5 h-5 text-gray-400 cursor-pointer hover:text-blue-500"
                      onClick={() => onAnswerClick?.(clarification.id)}
                    />
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={getSourceColor(clarification.source)}
                      >
                        {clarification.source}
                      </Badge>
                      {clarification.askedBy && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <User className="w-3 h-3" />
                          {clarification.askedBy}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(clarification.createdAt)}
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {clarification.question}
                    </p>
                  </div>
                  
                  {showAnswers && clarification.answer && (
                    <div className="pl-4 border-l-2 border-green-200">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium text-green-600">Answer: </span>
                        {clarification.answer}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Answered {formatDate(clarification.updatedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};