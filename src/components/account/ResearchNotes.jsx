import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Building2, User, TrendingUp, Globe, Edit, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
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

export default function ResearchNotes({ accountId }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const queryClient = useQueryClient();

  const { data: notes = [] } = useQuery({
    queryKey: ['research-notes', accountId],
    queryFn: () => base44.entities.ResearchNote.filter({ account_id: accountId }, '-recorded_date')
  });

  const [newNote, setNewNote] = useState({
    note_type: 'company_info',
    title: '',
    content: '',
    source_url: ''
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      return base44.entities.ResearchNote.create({
        ...data,
        account_id: accountId,
        recorded_by: user.email,
        recorded_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-notes', accountId] });
      setShowDialog(false);
      resetForm();
    }
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ResearchNote.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-notes', accountId] });
      setShowDialog(false);
      resetForm();
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id) => base44.entities.ResearchNote.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research-notes', accountId] });
    }
  });

  const resetForm = () => {
    setNewNote({
      note_type: 'company_info',
      title: '',
      content: '',
      source_url: ''
    });
    setEditingNote(null);
  };

  const handleSubmit = () => {
    if (editingNote) {
      updateNoteMutation.mutate({ id: editingNote.id, data: newNote });
    } else {
      createNoteMutation.mutate(newNote);
    }
  };

  const openEditDialog = (note) => {
    setEditingNote(note);
    setNewNote({
      note_type: note.note_type,
      title: note.title,
      content: note.content,
      source_url: note.source_url || ''
    });
    setShowDialog(true);
  };

  const getNoteTypeIcon = (type) => {
    const icons = {
      company_info: Building2,
      market_research: TrendingUp,
      key_person: User,
      industry_trends: TrendingUp,
      other: FileText
    };
    return icons[type] || FileText;
  };

  const getNoteTypeColor = (type) => {
    const colors = {
      company_info: 'bg-blue-100 text-blue-800 border-blue-200',
      market_research: 'bg-purple-100 text-purple-800 border-purple-200',
      key_person: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      industry_trends: 'bg-amber-100 text-amber-800 border-amber-200',
      other: 'bg-slate-100 text-slate-800 border-slate-200'
    };
    return colors[type] || colors.other;
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-[#ffffff]">Research Notes ({notes.length})</h3>
        <Button onClick={() => { resetForm(); setShowDialog(true); }} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Note
        </Button>
      </div>

      {notes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-[#ffffff] mb-1">No research notes yet</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">Document your research findings and key information</p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Note
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => {
            const Icon = getNoteTypeIcon(note.note_type);
            return (
              <Card key={note.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        <h4 className="font-semibold text-slate-900 dark:text-[#ffffff]">{note.title}</h4>
                        <Badge variant="outline" className={getNoteTypeColor(note.note_type)}>
                          {note.note_type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mb-3 whitespace-pre-wrap">{note.content}</p>
                      {note.source_url && (
                        <div className="mb-3">
                          <a 
                            href={note.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Globe className="w-4 h-4" />
                            Source
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span>Recorded by {note.recorded_by}</span>
                        <span>•</span>
                        <span>{format(new Date(note.recorded_date), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(note)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this note?')) {
                            deleteNoteMutation.mutate(note.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Research Note' : 'Add Research Note'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Note Type *</Label>
              <Select
                value={newNote.note_type}
                onValueChange={(value) => setNewNote({ ...newNote, note_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company_info">Company Information</SelectItem>
                  <SelectItem value="market_research">Market Research</SelectItem>
                  <SelectItem value="key_person">Key Person</SelectItem>
                  <SelectItem value="industry_trends">Industry Trends</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title *</Label>
              <Input
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                placeholder="Brief title for this research note"
              />
            </div>
            <div>
              <Label>Content *</Label>
              <Textarea
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                placeholder="Detailed research findings, information, and notes..."
                rows={8}
              />
            </div>
            <div>
              <Label>Source URL (optional)</Label>
              <Input
                value={newNote.source_url}
                onChange={(e) => setNewNote({ ...newNote, source_url: e.target.value })}
                placeholder="https://example.com/article"
                type="url"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!newNote.title || !newNote.content}
              >
                {editingNote ? 'Update Note' : 'Add Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}





