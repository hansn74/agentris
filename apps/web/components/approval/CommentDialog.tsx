'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CommentDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
  title: string;
  description: string;
  placeholder?: string;
  required?: boolean;
}

export function CommentDialog({
  open,
  onClose,
  onSubmit,
  title,
  description,
  placeholder = 'Enter your comments...',
  required = false,
}: CommentDialogProps) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (required && !comment.trim()) {
      setError('This field is required');
      return;
    }
    onSubmit(comment);
    setComment('');
    setError('');
  };

  const handleClose = () => {
    setComment('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="comment">
              Comments {required && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setError('');
              }}
              placeholder={placeholder}
              className={error ? 'border-destructive' : ''}
              rows={4}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}