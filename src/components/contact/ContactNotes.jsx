import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Edit2, Save, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ContactNotes({ contact }) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(contact?.notes || '');
  const queryClient = useQueryClient();

  // Update notes when contact changes
  useEffect(() => {
    setNotes(contact?.notes || '');
    setIsEditing(false); // Reset editing state when contact changes
  }, [contact?.id, contact?.notes]);

  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes) => {
      return await base44.entities.Contact.update(contact.id, { notes: newNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contact.id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsEditing(false);
      toast.success('✓ Notes saved');
    },
    onError: (error) => {
      console.error('Error updating notes:', error);
      toast.error('Failed to save notes');
    }
  });

  const handleSave = () => {
    updateNotesMutation.mutate(notes);
  };

  const handleCancel = () => {
    setNotes(contact?.notes || '');
    setIsEditing(false);
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Contact Notes
          </CardTitle>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="border-slate-300"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              {contact?.notes ? 'Edit' : 'Add Notes'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Don't be creepy reminder */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Don't be creepy!</strong> Keep notes professional and relevant to business relationships. 
            Only record information that helps you provide better service and maintain professional connections.
          </p>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this contact (e.g., communication preferences, important details, relationship history)..."
              rows={8}
              className="min-h-[200px]"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={updateNotesMutation.isPending}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateNotesMutation.isPending}
                className="bg-slate-900 hover:bg-slate-800"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Notes
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {contact?.notes ? (
              <p className="text-slate-700 dark:text-white whitespace-pre-wrap min-h-[100px]">
                {contact.notes}
              </p>
            ) : (
              <p className="text-slate-400 dark:text-slate-500 italic min-h-[100px] flex items-center">
                No notes yet. Click "Add Notes" to add information about this contact.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

