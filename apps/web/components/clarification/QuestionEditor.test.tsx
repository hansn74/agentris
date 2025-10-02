import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuestionEditor } from './QuestionEditor';
import type { ClarificationQuestion } from '@agentris/ai-engine';

describe('QuestionEditor', () => {
  const mockQuestions: ClarificationQuestion[] = [
    {
      question: 'What is the expected timeline?',
      ambiguityArea: 'Timeline',
      importanceScore: 0.9,
      impactLevel: 'high',
      requirementDependency: []
    },
    {
      question: 'Which users will have access?',
      ambiguityArea: 'Security',
      importanceScore: 0.7,
      impactLevel: 'medium',
      requirementDependency: ['authentication']
    }
  ];

  it('should render all questions', () => {
    render(
      <QuestionEditor
        questions={mockQuestions}
        ticketId="JIRA-123"
      />
    );

    expect(screen.getByText('What is the expected timeline?')).toBeInTheDocument();
    expect(screen.getByText('Which users will have access?')).toBeInTheDocument();
    expect(screen.getByText('2 questions')).toBeInTheDocument();
  });

  it('should allow editing a question', async () => {
    render(
      <QuestionEditor
        questions={mockQuestions}
        ticketId="JIRA-123"
        canEdit={true}
      />
    );

    // Click edit button for first question
    const editButtons = screen.getAllByRole('button');
    const firstEditButton = editButtons.find(btn => btn.querySelector('svg'));
    fireEvent.click(firstEditButton!);

    // Should show textarea with current question
    const textarea = screen.getByPlaceholderText('Edit your question...');
    expect(textarea).toHaveValue('What is the expected timeline?');

    // Edit the question
    fireEvent.change(textarea, { target: { value: 'What is the specific deadline?' } });

    // Save the edit
    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    // Should show updated question
    await waitFor(() => {
      expect(screen.getByText('What is the specific deadline?')).toBeInTheDocument();
    });
  });

  it('should allow deleting a question', () => {
    const onSave = vi.fn();
    render(
      <QuestionEditor
        questions={mockQuestions}
        ticketId="JIRA-123"
        onSave={onSave}
        canEdit={true}
      />
    );

    // Find and click delete button for first question
    const deleteButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg.text-red-500')
    );
    fireEvent.click(deleteButtons[0]);

    // First question should be removed
    expect(screen.queryByText('What is the expected timeline?')).not.toBeInTheDocument();
    expect(screen.getByText('Which users will have access?')).toBeInTheDocument();
    expect(screen.getByText('1 questions')).toBeInTheDocument();
  });

  it('should allow reordering questions', () => {
    render(
      <QuestionEditor
        questions={mockQuestions}
        ticketId="JIRA-123"
        canEdit={true}
      />
    );

    // Get all question texts before reordering
    const questionElements = screen.getAllByText(/What is the|Which users/);
    expect(questionElements[0]).toHaveTextContent('What is the expected timeline?');
    expect(questionElements[1]).toHaveTextContent('Which users will have access?');

    // Find and click down arrow for first question
    const downButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg')?.classList.contains('lucide-arrow-down')
    );
    fireEvent.click(downButtons[0]);

    // Questions should be swapped
    const reorderedQuestions = screen.getAllByText(/What is the|Which users/);
    expect(reorderedQuestions[0]).toHaveTextContent('Which users will have access?');
    expect(reorderedQuestions[1]).toHaveTextContent('What is the expected timeline?');
  });

  it('should allow selecting questions', () => {
    render(
      <QuestionEditor
        questions={mockQuestions}
        ticketId="JIRA-123"
        canEdit={true}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);

    // Select first question
    fireEvent.click(checkboxes[0]);
    
    // Should show post button with count
    expect(screen.getByText('Post 1 to Jira')).toBeInTheDocument();

    // Select second question too
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText('Post 2 to Jira')).toBeInTheDocument();
  });

  it('should call onPost with selected questions', () => {
    const onPost = vi.fn();
    render(
      <QuestionEditor
        questions={mockQuestions}
        ticketId="JIRA-123"
        onPost={onPost}
        canEdit={true}
      />
    );

    // Select first question
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Click post button
    const postButton = screen.getByText('Post 1 to Jira');
    fireEvent.click(postButton);

    expect(onPost).toHaveBeenCalledWith(['What is the expected timeline?']);
  });

  it('should allow adding custom questions', async () => {
    render(
      <QuestionEditor
        questions={mockQuestions}
        ticketId="JIRA-123"
        canEdit={true}
      />
    );

    // Click add custom question button
    const addButton = screen.getByText('Add Custom Question');
    fireEvent.click(addButton);

    // Enter custom question
    const textarea = screen.getByPlaceholderText('Enter your custom clarification question...');
    fireEvent.change(textarea, { target: { value: 'What about error handling?' } });

    // Add the question
    const addQuestionButton = screen.getByText('Add Question');
    fireEvent.click(addQuestionButton);

    // Should show the new question
    await waitFor(() => {
      expect(screen.getByText('What about error handling?')).toBeInTheDocument();
      expect(screen.getByText('3 questions')).toBeInTheDocument();
    });
  });

  it('should display importance scores and impact levels', () => {
    render(
      <QuestionEditor
        questions={mockQuestions}
        ticketId="JIRA-123"
      />
    );

    expect(screen.getByText('high impact')).toBeInTheDocument();
    expect(screen.getByText('medium impact')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument(); // 0.9 importance
    expect(screen.getByText('70%')).toBeInTheDocument(); // 0.7 importance
  });

  it('should display Salesforce context if present', () => {
    const questionsWithContext: ClarificationQuestion[] = [
      {
        ...mockQuestions[0],
        salesforceContext: {
          objects: ['Account', 'Contact'],
          fields: [],
          features: ['Validation Rule']
        }
      }
    ];

    render(
      <QuestionEditor
        questions={questionsWithContext}
        ticketId="JIRA-123"
      />
    );

    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Validation Rule')).toBeInTheDocument();
  });

  it('should disable editing when canEdit is false', () => {
    render(
      <QuestionEditor
        questions={mockQuestions}
        ticketId="JIRA-123"
        canEdit={false}
      />
    );

    // Should not show edit/delete/move buttons
    const editButtons = screen.queryAllByRole('button').filter(btn => 
      btn.querySelector('svg.lucide-edit-2')
    );
    expect(editButtons).toHaveLength(0);

    // Checkboxes should be disabled
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(checkbox => {
      expect(checkbox).toBeDisabled();
    });

    // Add custom question button should not be visible
    expect(screen.queryByText('Add Custom Question')).not.toBeInTheDocument();
  });
});