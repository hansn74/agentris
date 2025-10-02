'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Sparkles, 
  MessageSquare, 
  Send,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  BarChart
} from 'lucide-react';
import { QuestionEditor } from './QuestionEditor';
import { QuestionList } from './QuestionList';
import { trpc } from '@/lib/trpc';
import type { ClarificationQuestion } from '@agentris/ai-engine';

interface ClarificationPanelProps {
  ticketId: string;
  analysisId?: string;
  onQuestionsGenerated?: () => void;
}

export const ClarificationPanel: React.FC<ClarificationPanelProps> = ({
  ticketId,
  analysisId,
  onQuestionsGenerated
}) => {
  const [activeTab, setActiveTab] = useState('generate');
  const [generatedQuestions, setGeneratedQuestions] = useState<ClarificationQuestion[]>([]);
  const [answerDialogOpen, setAnswerDialogOpen] = useState(false);
  const [selectedClarificationId, setSelectedClarificationId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');

  const utils = trpc.useUtils();

  // Queries
  const { data: clarifications, isLoading: loadingClarifications } = 
    trpc.clarification.getClarifications.useQuery({
      ticketId,
      includeAnswered: true
    });

  const { data: stats } = trpc.clarification.getStats.useQuery({
    ticketId
  });

  // Mutations
  const generateMutation = trpc.clarification.generateClarifications.useMutation({
    onSuccess: (data) => {
      setGeneratedQuestions(data.questions);
      setActiveTab('review');
      onQuestionsGenerated?.();
      utils.clarification.getClarifications.invalidate({ ticketId });
      utils.clarification.getStats.invalidate({ ticketId });
    }
  });

  const postToJiraMutation = trpc.clarification.postToJira.useMutation({
    onSuccess: () => {
      setActiveTab('history');
      utils.clarification.getClarifications.invalidate({ ticketId });
    }
  });

  const trackAnswerMutation = trpc.clarification.trackAnswers.useMutation({
    onSuccess: () => {
      setAnswerDialogOpen(false);
      setAnswerText('');
      setSelectedClarificationId(null);
      utils.clarification.getClarifications.invalidate({ ticketId });
      utils.clarification.getStats.invalidate({ ticketId });
    }
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      ticketId,
      analysisId,
      minQuestions: 3,
      maxQuestions: 5,
      includeSalesforceTerminology: true
    });
  };

  const handlePostToJira = (questions: string[]) => {
    postToJiraMutation.mutate({
      ticketId,
      questions,
      includeTag: true
    });
  };

  const handleAnswerClick = (clarificationId: string) => {
    setSelectedClarificationId(clarificationId);
    setAnswerDialogOpen(true);
  };

  const handleSaveAnswer = () => {
    if (selectedClarificationId && answerText.trim()) {
      trackAnswerMutation.mutate({
        clarificationId: selectedClarificationId,
        answer: answerText
      });
    }
  };

  const unansweredCount = clarifications?.clarifications.filter(c => !c.answer).length || 0;
  const answeredCount = clarifications?.clarifications.filter(c => c.answer).length || 0;

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Clarifications
            </CardTitle>
            <div className="flex items-center gap-4">
              {stats?.stats && (
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>{answeredCount} answered</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                    <span>{unansweredCount} pending</span>
                  </div>
                  {stats.stats.sources && (
                    <div className="flex gap-1">
                      {stats.stats.sources.map(source => (
                        <Badge key={source.source} variant="outline" className="text-xs">
                          {source.source}: {source.count}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="generate" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Generate
              </TabsTrigger>
              <TabsTrigger value="review" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Review & Edit
                {generatedQuestions.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {generatedQuestions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <BarChart className="w-4 h-4" />
                History
                {clarifications?.clarifications.length ? (
                  <Badge variant="secondary" className="ml-1">
                    {clarifications.clarifications.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Generate AI-powered clarification questions based on detected ambiguities in the ticket.
                  The system will analyze the ticket and create 3-5 targeted questions to resolve unclear requirements.
                </AlertDescription>
              </Alert>
              
              {generateMutation.error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {generateMutation.error.message}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-center py-8">
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Generating Questions...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generate Clarification Questions
                    </>
                  )}
                </Button>
              </div>

              {generateMutation.isSuccess && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Successfully generated {generatedQuestions.length} clarification questions!
                    Switch to the "Review & Edit" tab to customize them before posting to Jira.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="review">
              {generatedQuestions.length > 0 ? (
                <QuestionEditor
                  questions={generatedQuestions}
                  ticketId={ticketId}
                  onSave={setGeneratedQuestions}
                  onPost={handlePostToJira}
                  isLoading={postToJiraMutation.isPending}
                />
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No questions generated yet.</p>
                  <Button
                    variant="link"
                    onClick={() => setActiveTab('generate')}
                    className="mt-2"
                  >
                    Generate questions first
                  </Button>
                </div>
              )}

              {postToJiraMutation.isSuccess && (
                <Alert className="mt-4">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Questions posted to Jira successfully with [AI-CLARIFIED] tag!
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="history">
              {loadingClarifications ? (
                <div className="py-8 text-center">
                  <RefreshCw className="w-8 h-8 mx-auto animate-spin text-gray-400" />
                  <p className="mt-2 text-gray-500">Loading clarifications...</p>
                </div>
              ) : (
                <QuestionList
                  clarifications={clarifications?.clarifications || []}
                  onAnswerClick={handleAnswerClick}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={answerDialogOpen} onOpenChange={setAnswerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Answer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Question:</p>
              <p className="text-sm text-gray-600">
                {clarifications?.clarifications.find(c => c.id === selectedClarificationId)?.question}
              </p>
            </div>
            <Textarea
              placeholder="Enter the answer..."
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              className="min-h-[150px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAnswerDialogOpen(false);
                setAnswerText('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAnswer}
              disabled={!answerText.trim() || trackAnswerMutation.isPending}
            >
              {trackAnswerMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Answer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};