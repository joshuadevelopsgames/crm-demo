import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Building2,
  Mail,
  Phone,
  Calendar,
  Edit,
  ArrowLeft,
  MessageSquare,
  CheckSquare,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';
import InteractionTimeline from '../components/account/InteractionTimeline';

export default function ContactDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const contactId = urlParams.get('id');
  const navigate = useNavigate();
  // const [showEditContact, setShowEditContact] = useState(false);

  const queryClient = useQueryClient();

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      const contacts = await base44.entities.Contact.list();
      return contacts.find(c => c.id === contactId);
    },
    enabled: !!contactId
  });

  const { data: account } = useQuery({
    queryKey: ['account', contact?.account_id],
    queryFn: async () => {
      if (!contact?.account_id) return null;
      const accounts = await base44.entities.Account.list();
      return accounts.find(a => a.id === contact.account_id);
    },
    enabled: !!contact?.account_id
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['interactions', contactId],
    queryFn: () => base44.entities.Interaction.filter({ contact_id: contactId }, '-interaction_date'),
    enabled: !!contactId
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', contactId],
    queryFn: () => base44.entities.Task.filter({ related_contact_id: contactId }),
    enabled: !!contactId
  });

  const getRoleColor = (role) => {
    const colors = {
      'decision_maker': 'bg-purple-100 text-purple-800 border-purple-200',
      'influencer': 'bg-blue-100 text-blue-800 border-blue-200',
      'user': 'bg-slate-100 text-slate-800 border-slate-200',
      'gatekeeper': 'bg-amber-100 text-amber-800 border-amber-200'
    };
    return colors[role] || 'bg-slate-100 text-slate-800 border-slate-200';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-600">Loading contact...</p>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Users className="w-12 h-12 text-slate-400" />
        <h2 className="text-xl font-semibold text-slate-900">Contact not found</h2>
        <p className="text-slate-600">The contact you're looking for doesn't exist.</p>
        <Button onClick={() => navigate(createPageUrl('Contacts'))} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Contacts
        </Button>
      </div>
    );
  }

  const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed Contact';
  const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();
  const isArchived = contact.status === 'archived' || contact.archived === true;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Contacts'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-2xl ${
              isArchived ? 'bg-slate-400' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
            }`}>
              {initials || <Users className="w-8 h-8" />}
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>
                {fullName}
              </h1>
              {contact.title && (
                <p className="text-slate-600 mt-1">{contact.title}</p>
              )}
              {isArchived && (
                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 mt-2">
                  Archived
                </Badge>
              )}
            </div>
          </div>
        </div>
        {/* TODO: Add Edit Contact functionality */}
        {/* <Button onClick={() => setShowEditContact(true)} variant="outline">
          <Edit className="w-4 h-4 mr-2" />
          Edit Contact
        </Button> */}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="interactions">
            Interactions ({interactions.length})
          </TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks ({tasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contact.email || contact.email_1 ? (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-slate-500" />
                    <div className="flex-1">
                      <p className="text-sm text-slate-500">Email</p>
                      <a 
                        href={`mailto:${contact.email || contact.email_1}`}
                        className="text-slate-900 hover:text-blue-600"
                      >
                        {contact.email || contact.email_1}
                      </a>
                      {contact.email_2 && (
                        <a 
                          href={`mailto:${contact.email_2}`}
                          className="block text-slate-600 hover:text-blue-600 text-sm mt-1"
                        >
                          {contact.email_2}
                        </a>
                      )}
                    </div>
                  </div>
                ) : null}

                {contact.phone || contact.phone_1 ? (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-slate-500" />
                    <div className="flex-1">
                      <p className="text-sm text-slate-500">Phone</p>
                      <a 
                        href={`tel:${contact.phone || contact.phone_1}`}
                        className="text-slate-900 hover:text-blue-600"
                      >
                        {contact.phone || contact.phone_1}
                      </a>
                      {contact.phone_2 && (
                        <a 
                          href={`tel:${contact.phone_2}`}
                          className="block text-slate-600 hover:text-blue-600 text-sm mt-1"
                        >
                          {contact.phone_2}
                        </a>
                      )}
                    </div>
                  </div>
                ) : null}

                {contact.position && (
                  <div>
                    <p className="text-sm text-slate-500">Position</p>
                    <p className="text-slate-900">{contact.position}</p>
                  </div>
                )}

                {contact.role && (
                  <div>
                    <p className="text-sm text-slate-500">Role</p>
                    <Badge variant="outline" className={getRoleColor(contact.role)}>
                      {contact.role.replace('_', ' ')}
                    </Badge>
                  </div>
                )}

                {contact.primary_contact && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                    Primary Contact
                  </Badge>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {contact.do_not_email && (
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                      Do Not Email
                    </Badge>
                  )}
                  {contact.do_not_mail && (
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                      Do Not Mail
                    </Badge>
                  )}
                  {contact.do_not_call && (
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                      Do Not Call
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Account Information */}
            {account && (
              <Card>
                <CardHeader>
                  <CardTitle>Account</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-slate-500" />
                    <div className="flex-1">
                      <Button
                        variant="link"
                        className="p-0 h-auto text-slate-900 hover:text-blue-600"
                        onClick={() => navigate(createPageUrl(`AccountDetail?id=${account.id}`))}
                      >
                        {account.name || contact.account_name || 'Unnamed Account'}
                      </Button>
                      {account.status && (
                        <Badge variant="outline" className="ml-2">
                          {account.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {contact.notes && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 whitespace-pre-wrap">{contact.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="interactions" className="space-y-4">
          <InteractionTimeline interactions={interactions} contacts={[contact]} />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          {tasks.length > 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 p-3 border border-slate-200 rounded-lg">
                      <CheckSquare className="w-5 h-5 text-slate-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{task.title || 'Untitled Task'}</p>
                        {task.description && (
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        )}
                        {task.due_date && (
                          <p className="text-xs text-slate-500 mt-1">
                            Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      {task.status && (
                        <Badge variant="outline">
                          {task.status}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckSquare className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">No tasks found</h3>
                <p className="text-slate-600">No tasks are associated with this contact.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Contact Dialog - TODO: Implement EditContactDialog component */}
    </div>
  );
}

