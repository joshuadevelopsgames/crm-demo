import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import toast from 'react-hot-toast';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AddInteractionDialog({ open, onClose, accountId, contactId, contacts = [], editingInteraction = null }) {
  const queryClient = useQueryClient();
  const { permissions } = useUserPermissions();
  const canManageInteractions = permissions['manage_interactions'] === true;
  const isEditing = !!editingInteraction;
  const fileInputRef = useRef(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const [interaction, setInteraction] = useState({
    type: 'email_sent',
    contact_id: contactId || '',
    subject: '',
    content: '',
    direction: 'outbound',
    sentiment: 'neutral',
    interaction_date: new Date().toISOString().slice(0, 16),
    tags: []
  });

  // Load interaction data when editing
  useEffect(() => {
    if (editingInteraction) {
      const existing = editingInteraction.metadata?.attachments || [];
      setExistingAttachments(Array.isArray(existing) ? existing : []);
      setPendingFiles([]);
      setInteraction({
        type: editingInteraction.type || 'email_sent',
        contact_id: editingInteraction.contact_id || contactId || '',
        subject: editingInteraction.subject || '',
        content: editingInteraction.content || '',
        direction: editingInteraction.direction || 'outbound',
        sentiment: editingInteraction.sentiment || 'neutral',
        interaction_date: editingInteraction.interaction_date 
          ? new Date(editingInteraction.interaction_date).toISOString().slice(0, 16)
          : new Date().toISOString().slice(0, 16),
        tags: editingInteraction.tags || []
      });
    } else {
      setExistingAttachments([]);
      setPendingFiles([]);
      // Reset form for new interaction
      setInteraction({
        type: 'email_sent',
        contact_id: contactId || '',
        subject: '',
        content: '',
        direction: 'outbound',
        sentiment: 'neutral',
        interaction_date: new Date().toISOString().slice(0, 16),
        tags: []
      });
    }
  }, [editingInteraction, contactId]);

  // Reset form when contactId changes (only for new interactions)
  useEffect(() => {
    if (contactId && !isEditing) {
      setInteraction(prev => ({ ...prev, contact_id: contactId }));
    }
  }, [contactId, isEditing]);

  useEffect(() => {
    if (!open) {
      setPendingFiles([]);
    }
  }, [open]);

  const createInteractionMutation = useMutation({
    mutationFn: async (data) => {
      const newInteraction = await base44.entities.Interaction.create(data);
      // Update account's last interaction date if accountId exists
      if (data.account_id) {
        await base44.entities.Account.update(data.account_id, {
          last_interaction_date: new Date().toISOString().split('T')[0]
        });
      }
      return newInteraction;
    },
    onSuccess: (_, variables) => {
      // Invalidate queries for both account and contact
      if (variables.account_id) {
        queryClient.invalidateQueries({ queryKey: ['interactions', variables.account_id] });
        queryClient.invalidateQueries({ queryKey: ['account', variables.account_id] });
      }
      if (variables.contact_id) {
        queryClient.invalidateQueries({ queryKey: ['interactions', variables.contact_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Interaction logged successfully');
      onClose();
      setPendingFiles([]);
      setExistingAttachments([]);
      setInteraction({
        type: 'email_sent',
        contact_id: contactId || '',
        subject: '',
        content: '',
        direction: 'outbound',
        sentiment: 'neutral',
        interaction_date: new Date().toISOString().slice(0, 16),
        tags: []
      });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to log interaction');
    }
  });

  const updateInteractionMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const updatedInteraction = await base44.entities.Interaction.update(id, data);
      return updatedInteraction;
    },
    onSuccess: (_, variables) => {
      // Invalidate queries for both account and contact
      if (variables.data.account_id) {
        queryClient.invalidateQueries({ queryKey: ['interactions', variables.data.account_id] });
        queryClient.invalidateQueries({ queryKey: ['account', variables.data.account_id] });
      }
      if (variables.data.contact_id) {
        queryClient.invalidateQueries({ queryKey: ['interactions', variables.data.contact_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Interaction updated successfully');
      onClose();
      setPendingFiles([]);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update interaction');
    }
  });

  const handleSubmit = async () => {
    // Check permission before allowing create/edit
    if (!canManageInteractions) {
      toast.error('You do not have permission to manage interactions');
      return;
    }

    const user = await base44.auth.me();
    let uploadedAttachments = [];
    let mergedAttachments = existingAttachments;

    if (pendingFiles.length > 0) {
      if (!accountId) {
        toast.error('Account is required to upload files');
        return;
      }

      try {
        setIsUploading(true);
        uploadedAttachments = await Promise.all(
          pendingFiles.map((file) =>
            base44.entities.AccountAttachment.upload(
              file,
              file.name,
              accountId,
              user.id,
              user.email,
              file.type
            )
          )
        );
        mergedAttachments = [...existingAttachments, ...uploadedAttachments];
      } catch (error) {
        console.error('Error uploading files:', error);
        toast.error(error.message || 'Failed to upload files');
        return;
      } finally {
        setIsUploading(false);
      }
    }

    const interactionData = {
      ...interaction,
      logged_by: user.email
    };
    
    // Include account_id if provided
    if (accountId) {
      interactionData.account_id = accountId;
    }
    
    // Include contact_id if provided or selected
    if (interaction.contact_id) {
      interactionData.contact_id = interaction.contact_id;
    }

    if (mergedAttachments.length > 0) {
      const existingMetadata = editingInteraction?.metadata || {};
      interactionData.metadata = {
        ...existingMetadata,
        attachments: mergedAttachments
      };
    }
    
    if (isEditing && editingInteraction) {
      updateInteractionMutation.mutate({
        id: editingInteraction.id,
        data: interactionData
      });
    } else {
      createInteractionMutation.mutate(interactionData);
    }
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const validFiles = [];
    files.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 10MB limit`);
        return;
      }
      validFiles.push(file);
    });

    if (validFiles.length > 0) {
      setPendingFiles((prev) => [...prev, ...validFiles]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemovePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Interaction' : 'Log Interaction'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Interaction Type *</Label>
              <Select
                value={interaction.type}
                onValueChange={(value) => setInteraction({ ...interaction, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email_sent">Email Sent</SelectItem>
                  <SelectItem value="email_received">Email Received</SelectItem>
                  <SelectItem value="call">Phone Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="linkedin_message">LinkedIn Message</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contact</Label>
              <Select
                value={interaction.contact_id}
                onValueChange={(value) => setInteraction({ ...interaction, contact_id: value })}
                disabled={!!contactId} // Disable if contactId is provided (from contact page)
              >
                <SelectTrigger>
                  <SelectValue placeholder={contactId ? "Current contact" : "Select contact (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  {contacts.length > 0 ? (
                    contacts.map(contact => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>
                      No contacts available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {contactId && (
                <p className="text-xs text-slate-500 mt-1">Contact is set from current page</p>
              )}
            </div>
            <div>
              <Label>Direction</Label>
              <Select
                value={interaction.direction}
                onValueChange={(value) => setInteraction({ ...interaction, direction: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sentiment</Label>
              <Select
                value={interaction.sentiment}
                onValueChange={(value) => setInteraction({ ...interaction, sentiment: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Date & Time *</Label>
              <Input
                type="datetime-local"
                value={interaction.interaction_date}
                onChange={(e) => setInteraction({ ...interaction, interaction_date: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Subject / Title</Label>
              <Input
                value={interaction.subject}
                onChange={(e) => setInteraction({ ...interaction, subject: e.target.value })}
                placeholder="Brief description of the interaction"
              />
            </div>
            <div className="col-span-2">
              <Label>Details / Notes *</Label>
              <Textarea
                value={interaction.content}
                onChange={(e) => setInteraction({ ...interaction, content: e.target.value })}
                placeholder="What was discussed? Key takeaways? Next steps?"
                rows={6}
              />
            </div>
            <div className="col-span-2">
              <Label>Tags (comma-separated)</Label>
              <Input
                placeholder="e.g., sales_insight, customer_preference, meeting_summary"
                value={Array.isArray(interaction.tags) ? interaction.tags.join(', ') : ''}
                onChange={(e) => setInteraction({ 
                  ...interaction, 
                  tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                })}
              />
            </div>
            <div className="col-span-2">
              <Label>Attachments</Label>
              <Input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                disabled={!accountId}
              />
              {existingAttachments.length > 0 && (
                <div className="mt-2 text-sm text-slate-600">
                  <p className="font-medium text-slate-700">Existing files:</p>
                  <ul className="list-disc pl-5">
                    {existingAttachments.map((file, index) => (
                      <li key={`${file.id || file.file_name}-${index}`}>
                        {file.file_url ? (
                          <a
                            href={file.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            {file.file_name || 'Attachment'}
                          </a>
                        ) : (
                          <span>{file.file_name || 'Attachment'}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {pendingFiles.length > 0 && (
                <div className="mt-2 text-sm text-slate-600">
                  <p className="font-medium text-slate-700">Files to upload:</p>
                  <ul className="list-disc pl-5">
                    {pendingFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="flex items-center gap-2">
                        <span>{file.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePendingFile(index)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!accountId && (
                <p className="text-xs text-slate-500 mt-1">
                  Files can only be uploaded when an account is linked.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!interaction.content || !interaction.interaction_date || createInteractionMutation.isPending || updateInteractionMutation.isPending || isUploading}
            >
              {isEditing 
                ? (updateInteractionMutation.isPending ? 'Updating...' : (isUploading ? 'Uploading...' : 'Update Interaction'))
                : (createInteractionMutation.isPending ? 'Logging...' : (isUploading ? 'Uploading...' : 'Log Interaction'))
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}





