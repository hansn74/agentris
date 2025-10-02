'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Check, X } from 'lucide-react';
import type { PreviewItem } from '@agentris/db';

interface ChangeEditorProps {
  item: PreviewItem | null;
  open: boolean;
  onClose: () => void;
  onSave: (itemId: string, modifiedData: any) => void;
}

export function ChangeEditor({ item, open, onClose, onSave }: ChangeEditorProps) {
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonValue, setJsonValue] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    if (item?.proposedState) {
      setJsonValue(JSON.stringify(item.proposedState, null, 2));
      setFieldValues(item.proposedState as Record<string, any>);
      setPreview(item.proposedState);
    }
  }, [item]);

  const validateJson = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      setValidationError(null);
      setPreview(parsed);
      return parsed;
    } catch (error) {
      setValidationError(`Invalid JSON: ${error.message}`);
      return null;
    }
  };

  const handleJsonChange = (value: string) => {
    setJsonValue(value);
    const parsed = validateJson(value);
    if (parsed) {
      setFieldValues(parsed);
    }
  };

  const handleFieldChange = (key: string, value: any) => {
    const updated = { ...fieldValues, [key]: value };
    setFieldValues(updated);
    setJsonValue(JSON.stringify(updated, null, 2));
    setPreview(updated);
    setValidationError(null);
  };

  const handleSave = () => {
    if (validationError) return;
    if (item) {
      onSave(item.id, preview);
    }
    handleClose();
  };

  const handleClose = () => {
    setJsonValue('');
    setFieldValues({});
    setValidationError(null);
    setPreview(null);
    onClose();
  };

  if (!item) return null;

  const fieldEntries = Object.entries(fieldValues);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Change: {item.name}</DialogTitle>
          <DialogDescription>
            Modify the proposed changes before approval
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{item.itemType}</Badge>
              <Badge 
                variant="secondary"
                className={
                  item.impact === 'HIGH' 
                    ? 'bg-red-100 text-red-800' 
                    : item.impact === 'MEDIUM'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }
              >
                {item.impact}
              </Badge>
            </div>
          </div>

          <Tabs value={jsonMode ? 'json' : 'fields'} onValueChange={(v) => setJsonMode(v === 'json')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="fields">Field Editor</TabsTrigger>
              <TabsTrigger value="json">JSON Editor</TabsTrigger>
            </TabsList>

            <TabsContent value="fields" className="space-y-4">
              {fieldEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No fields to edit</p>
              ) : (
                fieldEntries.map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{key}</Label>
                    {typeof value === 'boolean' ? (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant={value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleFieldChange(key, true)}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          True
                        </Button>
                        <Button
                          variant={!value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleFieldChange(key, false)}
                        >
                          <X className="w-4 h-4 mr-1" />
                          False
                        </Button>
                      </div>
                    ) : typeof value === 'object' ? (
                      <Textarea
                        id={key}
                        value={JSON.stringify(value, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            handleFieldChange(key, parsed);
                          } catch {
                            // Invalid JSON, don't update
                          }
                        }}
                        className="font-mono text-sm"
                        rows={4}
                      />
                    ) : (
                      <Input
                        id={key}
                        type={typeof value === 'number' ? 'number' : 'text'}
                        value={value}
                        onChange={(e) => handleFieldChange(
                          key,
                          typeof value === 'number' 
                            ? parseFloat(e.target.value) || 0
                            : e.target.value
                        )}
                      />
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="json" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="json-editor">JSON Data</Label>
                <Textarea
                  id="json-editor"
                  value={jsonValue}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="font-mono text-sm"
                  rows={12}
                  placeholder="Enter valid JSON..."
                />
                {validationError && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    {validationError}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {preview && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Live Preview</CardTitle>
                <CardDescription>How the change will look after modification</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {item.currentState && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Current State</CardTitle>
                <CardDescription>Existing configuration for reference</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                  {JSON.stringify(item.currentState, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!!validationError}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}