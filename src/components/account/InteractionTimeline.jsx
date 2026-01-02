import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Mail, Phone, MessageSquare, Calendar, FileText, Linkedin, ExternalLink, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

import AddInteractionDialog from './AddInteractionDialog';
import { useUserPermissions } from '@/hooks/useUserPermissions';

export default function InteractionTimeline({ interactions, contacts, accountId, contactId }) {
  const queryClient = useQueryClient();
  const { permissions } = useUserPermissions();
  const canManageInteractions = permissions['manage_interactions'] === true;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [interactionToDelete, setInteractionToDelete] = useState(null);
  const [editingInteraction, setEditingInteraction] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const deleteInteractionMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.Interaction.delete(id);
    },
    onSuccess: () => {
      // Invalidate queries for both account and contact
      if (accountId) {
        queryClient.invalidateQueries({ queryKey: ['interactions', accountId] });
        queryClient.invalidateQueries({ queryKey: ['account', accountId] });
      }
      if (contactId) {
        queryClient.invalidateQueries({ queryKey: ['interactions', contactId] });
      }
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Interaction deleted successfully');
      setDeleteDialogOpen(false);
      setInteractionToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete interaction');
    }
  });

  const handleDeleteClick = (interaction) => {
    setInteractionToDelete(interaction);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (interactionToDelete) {
      deleteInteractionMutation.mutate(interactionToDelete.id);
    }
  };

  const handleEditClick = (interaction) => {
    setEditingInteraction(interaction);
    setEditDialogOpen(true);
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setEditingInteraction(null);
  };
  const getInteractionIcon = (type) => {
    const icons = {
      email_sent: Mail,
      email_received: Mail,
      call: Phone,
      meeting: Calendar,
      note: FileText,
      linkedin_message: Linkedin
    };
    return icons[type] || MessageSquare;
  };

  const getTypeColor = (type) => {
    const colors = {
      email_sent: 'bg-blue-100 text-blue-800 border-blue-200',
      email_received: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      call: 'bg-purple-100 text-purple-800 border-purple-200',
      meeting: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      note: 'bg-slate-100 text-slate-800 border-slate-200',
      linkedin_message: 'bg-sky-100 text-sky-800 border-sky-200'
    };
    return colors[type] || 'bg-slate-100 text-slate-800';
  };

  const getSentimentColor = (sentiment) => {
    const colors = {
      positive: 'bg-emerald-100 text-emerald-800',
      neutral: 'bg-slate-100 text-slate-600',
      negative: 'bg-red-100 text-red-800'
    };
    return colors[sentiment] || colors.neutral;
  };

  const getContactName = (contactId) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact ? `${contact.first_name} ${contact.last_name}` : null;
  };

  if (interactions.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <MessageSquare className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-[#ffffff] mb-1">No interactions yet</h3>
          <p className="text-slate-600 dark:text-slate-400">Log your first interaction to start tracking engagement</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {interactions.map((interaction, index) => {
        const Icon = getInteractionIcon(interaction.type);
        const contactName = getContactName(interaction.contact_id);
        
        return (
          <Card key={interaction.id} className="relative">
            {index < interactions.length - 1 && (
              <div className="absolute left-8 top-20 bottom-0 w-0.5 bg-slate-200 -mb-4" />
            )}
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  interaction.type.includes('email') ? 'bg-blue-50' :
                  interaction.type === 'call' ? 'bg-purple-50' :
                  interaction.type === 'meeting' ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-slate-50 dark:bg-slate-800'
                }`}>
                  <Icon className={`w-6 h-6 ${
                    interaction.type.includes('email') ? 'text-blue-600' :
                    interaction.type === 'call' ? 'text-purple-600' :
                    interaction.type === 'meeting' ? 'text-indigo-600' : 'text-slate-600 dark:text-slate-400'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={getTypeColor(interaction.type)}>
                          {interaction.type.replace(/_/g, ' ')}
                        </Badge>
                        {interaction.direction && (
                          <Badge variant="outline" className="text-slate-600 dark:text-slate-400">
                            {interaction.direction}
                          </Badge>
                        )}
                        {interaction.sentiment && (
                          <Badge className={getSentimentColor(interaction.sentiment)}>
                            {interaction.sentiment}
                          </Badge>
                        )}
                      </div>
                      {interaction.subject && (
                        <h3 className="font-semibold text-slate-900 dark:text-[#ffffff]">{interaction.subject}</h3>
                      )}
                      <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 mt-1">
                        <span>{format(new Date(interaction.interaction_date), 'MMM d, yyyy • h:mm a')}</span>
                        {contactName && (
                          <>
                            <span>•</span>
                            <span>{contactName}</span>
                          </>
                        )}
                        {interaction.logged_by && (
                          <>
                            <span>•</span>
                            <span>Logged by {interaction.logged_by}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {canManageInteractions && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(interaction)}
                          className="text-slate-600 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Edit interaction"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(interaction)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete interaction"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {interaction.content && (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mt-3">
                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{interaction.content}</p>
                    </div>
                  )}
                  {interaction.gmail_link && (
                    <div className="mt-3">
                      <a
                        href={interaction.gmail_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View in Gmail
                      </a>
                    </div>
                  )}
                  {interaction.tags && interaction.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {interaction.tags.map((tag, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {tag.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Edit Interaction Dialog */}
      <AddInteractionDialog
        open={editDialogOpen}
        onClose={handleEditClose}
        accountId={accountId}
        contactId={contactId}
        contacts={contacts}
        editingInteraction={editingInteraction}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Interaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this interaction? This action cannot be undone.
              {interactionToDelete?.subject && (
                <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm">
                  <strong className="text-slate-900 dark:text-[#ffffff]">Subject:</strong> <span className="text-slate-900 dark:text-[#ffffff]">{interactionToDelete.subject}</span>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setInteractionToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteInteractionMutation.isPending}
            >
              {deleteInteractionMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


