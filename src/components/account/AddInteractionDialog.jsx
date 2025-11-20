import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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

export default function AddInteractionDialog({ open, onClose, accountId, contacts }) {
  const queryClient = useQueryClient();
  const [interaction, setInteraction] = useState({
    type: 'email_sent',
    contact_id: '',
    subject: '',
    content: '',
    direction: 'outbound',
    sentiment: 'neutral',
    interaction_date: new Date().toISOString().slice(0, 16),
    tags: []
  });

  const createInteractionMutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.Interaction.create(data);
      // Update account's last interaction date
      await base44.entities.Account.update(accountId, {
        last_interaction_date: new Date().toISOString().split('T')[0]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions', accountId] });
      queryClient.invalidateQueries({ queryKey: ['account', accountId] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onClose();
      setInteraction({
        type: 'email_sent',
        contact_id: '',
        subject: '',
        content: '',
        direction: 'outbound',
        sentiment: 'neutral',
        interaction_date: new Date().toISOString().slice(0, 16),
        tags: []
      });
    }
  });

  const handleSubmit = async () => {
    const user = await base44.auth.me();
    createInteractionMutation.mutate({
      ...interaction,
      account_id: accountId,
      logged_by: user.email
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Interaction</DialogTitle>
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
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select contact (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map(contact => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                onChange={(e) => setInteraction({ 
                  ...interaction, 
                  tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!interaction.content || !interaction.interaction_date}
            >
              Log Interaction
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



