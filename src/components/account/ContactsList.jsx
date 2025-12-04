import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Mail, Phone, Linkedin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export default function ContactsList({ contacts, accountId, accountName }) {
  const [showDialog, setShowDialog] = useState(false);
  const queryClient = useQueryClient();

  const [newContact, setNewContact] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    title: '',
    role: 'user',
    preferences: '',
    linkedin_url: ''
  });

  const createContactMutation = useMutation({
    mutationFn: (data) => base44.entities.Contact.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', accountId] });
      setShowDialog(false);
      setNewContact({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        title: '',
        role: 'user',
        preferences: '',
        linkedin_url: ''
      });
    }
  });

  const handleCreate = () => {
    createContactMutation.mutate({
      ...newContact,
      account_id: accountId,
      account_name: accountName
    });
  };

  const getRoleColor = (role) => {
    const colors = {
      decision_maker: 'bg-purple-100 text-purple-800 border-purple-200',
      influencer: 'bg-blue-100 text-blue-800 border-blue-200',
      champion: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      user: 'bg-slate-100 text-slate-800 border-slate-200'
    };
    return colors[role] || colors.user;
  };

  if (contacts.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No contacts yet</h3>
            <p className="text-slate-600 mb-4">Add contacts to start building relationships</p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Contact
            </Button>
          </CardContent>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name *</Label>
                  <Input
                    value={newContact.first_name}
                    onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input
                    value={newContact.last_name}
                    onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Job Title</Label>
                  <Input
                    value={newContact.title}
                    onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    value={newContact.role}
                    onValueChange={(value) => setNewContact({ ...newContact, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="decision_maker">Decision Maker</SelectItem>
                      <SelectItem value="influencer">Influencer</SelectItem>
                      <SelectItem value="champion">Champion</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>LinkedIn URL</Label>
                  <Input
                    value={newContact.linkedin_url}
                    onChange={(e) => setNewContact({ ...newContact, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div className="col-span-2">
                  <Label>Preferences & Notes</Label>
                  <Textarea
                    value={newContact.preferences}
                    onChange={(e) => setNewContact({ ...newContact, preferences: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreate}
                  disabled={!newContact.first_name || !newContact.last_name || !newContact.email}
                >
                  Add Contact
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{contacts.length} Contacts</h3>
        <Button onClick={() => setShowDialog(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Contact
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map((contact) => (
          <Card key={contact.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-slate-900">
                    {contact.first_name} {contact.last_name}
                  </h4>
                  {contact.title && (
                    <p className="text-sm text-slate-600">{contact.title}</p>
                  )}
                </div>

                <Badge variant="outline" className={getRoleColor(contact.role)}>
                  {contact.role ? contact.role.replace('_', ' ') : 'user'}
                </Badge>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                      {contact.email}
                    </a>
                  </div>
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                        {contact.phone}
                      </a>
                    </div>
                  )}
                  {contact.linkedin_url && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Linkedin className="w-4 h-4" />
                      <a 
                        href={contact.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-blue-600"
                      >
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                </div>

                {contact.preferences && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">Preferences:</p>
                    <p className="text-sm text-slate-700">{contact.preferences}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>First Name *</Label>
                <Input
                  value={newContact.first_name}
                  onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input
                  value={newContact.last_name}
                  onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Job Title</Label>
                <Input
                  value={newContact.title}
                  onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select
                  value={newContact.role}
                  onValueChange={(value) => setNewContact({ ...newContact, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="decision_maker">Decision Maker</SelectItem>
                    <SelectItem value="influencer">Influencer</SelectItem>
                    <SelectItem value="champion">Champion</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>LinkedIn URL</Label>
                <Input
                  value={newContact.linkedin_url}
                  onChange={(e) => setNewContact({ ...newContact, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div className="col-span-2">
                <Label>Preferences & Notes</Label>
                <Textarea
                  value={newContact.preferences}
                  onChange={(e) => setNewContact({ ...newContact, preferences: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreate}
                disabled={!newContact.first_name || !newContact.last_name || !newContact.email}
              >
                Add Contact
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}





