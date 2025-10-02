'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowUp, 
  ArrowDown, 
  Edit2, 
  Trash2, 
  Plus, 
  Save,
  X,
  Sparkles,
  Send
} from 'lucide-react';
import type { ClarificationQuestion } from '@agentris/ai-engine';

interface QuestionEditorProps {
  questions: ClarificationQuestion[];
  ticketId: string;
  onSave?: (questions: ClarificationQuestion[]) => void;
  onPost?: (questions: string[]) => void;
  isLoading?: boolean;
  canEdit?: boolean;
}

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
  questions: initialQuestions,
  ticketId,
  onSave,
  onPost,
  isLoading = false,
  canEdit = true
}) => {
  const [questions, setQuestions] = useState<ClarificationQuestion[]>(initialQuestions);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedText, setEditedText] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set());
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');

  useEffect(() => {
    setQuestions(initialQuestions);
  }, [initialQuestions]);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditedText(questions[index].question);
  };

  const handleSaveEdit = (index: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      question: editedText
    };
    setQuestions(updatedQuestions);
    setEditingIndex(null);
    setEditedText('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditedText('');
  };

  const handleDelete = (index: number) => {
    const updatedQuestions = questions.filter((_, i) => i !== index);
    setQuestions(updatedQuestions);
    
    // Update selected indices
    const newSelected = new Set<number>();
    selectedQuestions.forEach(i => {
      if (i < index) newSelected.add(i);
      else if (i > index) newSelected.add(i - 1);
    });
    setSelectedQuestions(newSelected);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const updatedQuestions = [...questions];
    [updatedQuestions[index], updatedQuestions[newIndex]] = 
    [updatedQuestions[newIndex], updatedQuestions[index]];
    setQuestions(updatedQuestions);

    // Update selected indices if needed
    if (selectedQuestions.has(index)) {
      const newSelected = new Set(selectedQuestions);
      newSelected.delete(index);
      newSelected.add(newIndex);
      setSelectedQuestions(newSelected);
    }
  };

  const handleToggleSelect = (index: number) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedQuestions(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedQuestions.size === questions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(questions.map((_, i) => i)));
    }
  };

  const handleAddCustom = () => {
    if (!customQuestion.trim()) return;

    const newQuestion: ClarificationQuestion = {
      question: customQuestion,
      ambiguityArea: 'custom',
      importanceScore: 0.5,
      impactLevel: 'medium',
      requirementDependency: []
    };

    setQuestions([...questions, newQuestion]);
    setCustomQuestion('');
    setIsAddingCustom(false);
  };

  const handleSaveAll = () => {
    if (onSave) {
      onSave(questions);
    }
  };

  const handlePostSelected = () => {
    if (onPost) {
      const selectedTexts = Array.from(selectedQuestions)
        .sort((a, b) => a - b)
        .map(i => questions[i].question);
      onPost(selectedTexts);
    }
  };

  const getImpactColor = (level: string) => {
    switch (level) {
      case 'high': return 'destructive';
      case 'medium': return 'warning';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getImportanceWidth = (score: number) => {
    return `${Math.round(score * 100)}%`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Clarification Questions
            <Badge variant="secondary">{questions.length} questions</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSelectAll}
              disabled={!canEdit || questions.length === 0}
            >
              {selectedQuestions.size === questions.length ? 'Deselect All' : 'Select All'}
            </Button>
            {selectedQuestions.size > 0 && (
              <Button
                size="sm"
                onClick={handlePostSelected}
                disabled={isLoading}
              >
                <Send className="w-4 h-4 mr-2" />
                Post {selectedQuestions.size} to Jira
              </Button>
            )}
            <Button
              size="sm"
              variant="default"
              onClick={handleSaveAll}
              disabled={!canEdit || isLoading}
            >
              <Save className="w-4 h-4 mr-2" />
              Save All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((question, index) => (
          <div
            key={`${ticketId}-question-${index}`}
            className={`p-4 border rounded-lg transition-colors ${
              selectedQuestions.has(index) ? 'bg-blue-50 border-blue-300' : ''
            }`}
          >
            {editingIndex === index ? (
              <div className="space-y-3">
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="min-h-[100px]"
                  placeholder="Edit your question..."
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSaveEdit(index)}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancelEdit}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedQuestions.has(index)}
                    onChange={() => handleToggleSelect(index)}
                    className="mt-1"
                    disabled={!canEdit}
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium">{question.question}</p>
                      {canEdit && (
                        <div className="flex gap-1 ml-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMove(index, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMove(index, 'down')}
                            disabled={index === questions.length - 1}
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(index)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(index)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <Badge variant={getImpactColor(question.impactLevel) as any}>
                        {question.impactLevel} impact
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Importance:</span>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: getImportanceWidth(question.importanceScore) }}
                          />
                        </div>
                        <span className="text-gray-600">
                          {Math.round(question.importanceScore * 100)}%
                        </span>
                      </div>
                      {question.ambiguityArea && (
                        <span className="text-gray-500">
                          Area: {question.ambiguityArea}
                        </span>
                      )}
                    </div>
                    {question.salesforceContext && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {question.salesforceContext.objects.map(obj => (
                          <Badge key={obj} variant="outline" className="text-xs">
                            {obj}
                          </Badge>
                        ))}
                        {question.salesforceContext.features.map(feature => (
                          <Badge key={feature} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}

        {isAddingCustom ? (
          <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
            <Label>Add Custom Question</Label>
            <Textarea
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder="Enter your custom clarification question..."
              className="min-h-[100px]"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddCustom}
                disabled={!customQuestion.trim()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsAddingCustom(false);
                  setCustomQuestion('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          canEdit && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsAddingCustom(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Question
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
};