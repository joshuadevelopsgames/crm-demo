import React, { useState, useEffect } from 'react';
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

export default function EditContactDialog({ open, onClose, contact }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({});
  
  // Check if contact was imported (has lmn_contact_id)
  const isImported = contact?.lmn_contact_id ? true : false;
  
  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || contact.email_1 || '',
        email_1: contact.email_1 || contact.email || '',
        email_2: contact.email_2 || '',
        phone: contact.phone || contact.phone_1 || '',
        phone_1: contact.phone_1 || contact.phone || '',
        phone_2: contact.phone_2 || '',
        title: contact.title || contact.position || '',
        position: contact.position || contact.title || '',
        role: contact.role || 'user',
        do_not_email: contact.do_not_email || false,
        do_not_mail: contact.do_not_mail || false,
        do_not_call: contact.do_not_call || false,
        send_sms: contact.send_sms || 'do_not_sms',
        notes: contact.notes || '',
        linkedin_url: contact.linkedin_url || '',
        preferences: contact.preferences || ''
      });
    }
  }, [contact]);

  const updateContactMutation = useMutation({
    mutationFn: (data) => base44.entities.Contact.update(contact.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contact.id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onClose();
    }
  });

  const handleSubmit = () => {
    updateContactMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name *</Label>
              <Input
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Last Name *</Label>
              <Input
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value, email_1: e.target.value })}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Email 2</Label>
              <Input
                type="email"
                value={formData.email_2}
                onChange={(e) => setFormData({ ...formData, email_2: e.target.value })}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value, phone_1: e.target.value })}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Phone 2</Label>
              <Input
                value={formData.phone_2}
                onChange={(e) => setFormData({ ...formData, phone_2: e.target.value })}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Job Title / Position</Label>
              <Input
                value={formData.title || formData.position}
                onChange={(e) => setFormData({ ...formData, title: e.target.value, position: e.target.value })}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="decision_maker">Decision Maker</SelectItem>
                  <SelectItem value="influencer">Influencer</SelectItem>
                  <SelectItem value="champion">Champion</SelectItem>
                  <SelectItem value="gatekeeper">Gatekeeper</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Do Not Email</Label>
              <Select
                value={formData.do_not_email ? 'yes' : 'no'}
                onValueChange={(value) => setFormData({ ...formData, do_not_email: value === 'yes' })}
                disabled={isImported}
              >
                <SelectTrigger className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Do Not Mail</Label>
              <Select
                value={formData.do_not_mail ? 'yes' : 'no'}
                onValueChange={(value) => setFormData({ ...formData, do_not_mail: value === 'yes' })}
                disabled={isImported}
              >
                <SelectTrigger className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Do Not Call</Label>
              <Select
                value={formData.do_not_call ? 'yes' : 'no'}
                onValueChange={(value) => setFormData({ ...formData, do_not_call: value === 'yes' })}
                disabled={isImported}
              >
                <SelectTrigger className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Send SMS</Label>
              <Select
                value={formData.send_sms || 'do_not_sms'}
                onValueChange={(value) => setFormData({ ...formData, send_sms: value })}
                disabled={isImported}
              >
                <SelectTrigger className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="do_not_sms">Do Not SMS</SelectItem>
                  <SelectItem value="phone_1">Phone 1</SelectItem>
                  <SelectItem value="phone_2">Phone 2</SelectItem>
                </SelectContent>
              </Select>
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div className="col-span-2">
              <Label>LinkedIn URL</Label>
              <Input
                value={formData.linkedin_url}
                onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div className="col-span-2">
              <Label>Preferences</Label>
              <Textarea
                value={formData.preferences}
                onChange={(e) => setFormData({ ...formData, preferences: e.target.value })}
                rows={3}
                placeholder="Contact preferences and additional notes..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.first_name || !formData.last_name || !formData.email}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

