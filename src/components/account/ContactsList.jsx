import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Mail, Phone, Linkedin, Archive, LayoutGrid, List } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
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
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list' - default to card view
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

  // Filter contacts by archived status
  const filteredContacts = contacts.filter(contact => {
    const isArchived = contact.status === 'archived' || contact.archived === true;
    return showArchived ? isArchived : !isArchived;
  });

  if (contacts.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No contacts yet</h3>
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

  if (filteredContacts.length === 0 && !showArchived) {
    return (
      <>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-slate-900">{contacts.length} Contacts</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <label htmlFor="show-archived" className="text-sm text-slate-600 cursor-pointer">
                Show Archived
              </label>
            </div>
            <Button onClick={() => setShowDialog(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No contacts yet</h3>
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
                  <Label>Title</Label>
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
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="decision_maker">Decision Maker</SelectItem>
                      <SelectItem value="influencer">Influencer</SelectItem>
                      <SelectItem value="champion">Champion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>LinkedIn URL</Label>
                <Input
                  value={newContact.linkedin_url}
                  onChange={(e) => setNewContact({ ...newContact, linkedin_url: e.target.value })}
                />
              </div>
              <div>
                <Label>Preferences/Notes</Label>
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
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          {filteredContacts.length} {showArchived ? 'Archived' : 'Active'} Contact{filteredContacts.length !== 1 ? 's' : ''}
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <label htmlFor="show-archived" className="text-sm text-slate-600 cursor-pointer">
              Show Archived
            </label>
          </div>
          <div className="flex items-center gap-1 border border-slate-300 rounded-lg p-1">
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className={`h-8 px-3 ${viewMode === 'card' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={`h-8 px-3 ${viewMode === 'list' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={() => setShowDialog(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.map((contact) => {
          const isArchived = contact.status === 'archived' || contact.archived === true;
          const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();
          const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
          
          return (
          <Card key={contact.id} className={`hover:shadow-lg transition-all cursor-pointer ${isArchived ? 'bg-slate-50 dark:bg-slate-800 opacity-75' : 'bg-white dark:bg-slate-900'}`}>
            <CardContent className="p-5">
              <div className="space-y-4">
                {/* Header with Avatar */}
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-lg ${
                    isArchived ? 'bg-slate-400' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                  }`}>
                    {initials || <Users className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-semibold text-lg truncate ${isArchived ? 'text-slate-500 dark:text-text-muted' : 'text-slate-900 dark:text-white'}`}>
                          {fullName || 'Unnamed Contact'}
                    </h4>
                        {contact.title && (
                          <p className={`text-sm mt-0.5 truncate ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                            {contact.title}
                          </p>
                        )}
                      </div>
                    {isArchived && (
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 flex-shrink-0">
                        <Archive className="w-3 h-3 mr-1" />
                        Archived
                      </Badge>
                    )}
                  </div>
                  </div>
                </div>

                {/* Role Badge */}
                <Badge variant="outline" className={`${getRoleColor(contact.role)} ${isArchived ? 'opacity-60' : ''} w-fit`}>
                  {contact.role ? contact.role.replace('_', ' ') : 'user'}
                </Badge>

                {/* Contact Info */}
                <div className={`space-y-2 pt-2 border-t ${isArchived ? 'border-slate-200' : 'border-slate-100'}`}>
                  <div className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <a 
                      href={`mailto:${contact.email}`} 
                      className={`truncate ${isArchived ? 'hover:text-slate-600' : 'hover:text-blue-600 transition-colors'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contact.email}
                    </a>
                  </div>
                  {contact.phone && (
                    <div className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <a 
                        href={`tel:${contact.phone}`} 
                        className={`truncate ${isArchived ? 'hover:text-slate-600' : 'hover:text-blue-600 transition-colors'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contact.phone}
                      </a>
                    </div>
                  )}
                  {contact.linkedin_url && (
                    <div className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                      <Linkedin className="w-4 h-4 flex-shrink-0" />
                      <a 
                        href={contact.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`truncate ${isArchived ? 'hover:text-slate-600' : 'hover:text-blue-600 transition-colors'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                </div>

                {/* Preferences/Notes */}
                {contact.preferences && (
                  <div className={`pt-3 border-t ${isArchived ? 'border-slate-200' : 'border-slate-100'}`}>
                    <p className={`text-xs mb-1 font-medium ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>Notes:</p>
                    <p className={`text-sm line-clamp-2 ${isArchived ? 'text-slate-500' : 'text-slate-700'}`}>
                      {contact.preferences}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          );
        })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Phone
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                {filteredContacts.map((contact) => {
                  const isArchived = contact.status === 'archived' || contact.archived === true;
                  const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
                  
                  return (
                    <tr 
                      key={contact.id}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isArchived ? 'bg-slate-50 dark:bg-slate-800' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isArchived ? 'bg-slate-200' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                          }`}>
                            {`${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase() ? (
                              <span className="text-white font-semibold text-sm">
                                {`${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase()}
                              </span>
                            ) : (
                              <Users className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${isArchived ? 'text-slate-500 dark:text-text-muted' : 'text-slate-900 dark:text-white'}`}>
                                {fullName || 'Unnamed Contact'}
                              </span>
                              {isArchived && (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                                  <Archive className="w-3 h-3 mr-1" />
                                  Archived
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-4 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                        {contact.title || '-'}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className={`${getRoleColor(contact.role)} ${isArchived ? 'opacity-60' : ''}`}>
                          {contact.role ? contact.role.replace('_', ' ') : 'user'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <a 
                          href={`mailto:${contact.email}`}
                          className={`text-sm ${isArchived ? 'text-slate-400 hover:text-slate-600' : 'text-slate-600 hover:text-blue-600'}`}
                        >
                          {contact.email}
                        </a>
                      </td>
                      <td className="px-4 py-4">
                        {contact.phone ? (
                          <a 
                            href={`tel:${contact.phone}`}
                            className={`text-sm ${isArchived ? 'text-slate-400 hover:text-slate-600' : 'text-slate-600 hover:text-blue-600'}`}
                          >
                            {contact.phone}
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

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





