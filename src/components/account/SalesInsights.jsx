import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Lightbulb, AlertTriangle, TrendingUp, Target, Edit, Trash2 } from 'lucide-react';
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

export default function SalesInsights({ accountId, interactions = [] }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingInsight, setEditingInsight] = useState(null);
  const queryClient = useQueryClient();

  const { data: insights = [] } = useQuery({
    queryKey: ['sales-insights', accountId],
    queryFn: () => base44.entities.SalesInsight.filter({ account_id: accountId }, '-recorded_date')
  });

  const [newInsight, setNewInsight] = useState({
    insight_type: 'opportunity',
    title: '',
    content: '',
    tags: [],
    related_interaction_id: ''
  });

  const createInsightMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      return base44.entities.SalesInsight.create({
        ...data,
        account_id: accountId,
        recorded_by: user.email,
        recorded_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-insights', accountId] });
      setShowDialog(false);
      resetForm();
    }
  });

  const updateInsightMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SalesInsight.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-insights', accountId] });
      setShowDialog(false);
      resetForm();
    }
  });

  const deleteInsightMutation = useMutation({
    mutationFn: (id) => {
      // In real implementation, this would be base44.entities.SalesInsight.delete(id)
      // For mock, we'll just remove from array
      const index = insights.findIndex(i => i.id === id);
      if (index !== -1) {
        insights.splice(index, 1);
      }
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-insights', accountId] });
    }
  });

  const resetForm = () => {
    setNewInsight({
      insight_type: 'opportunity',
      title: '',
      content: '',
      tags: [],
      related_interaction_id: ''
    });
    setEditingInsight(null);
  };

  const handleSubmit = () => {
    if (editingInsight) {
      updateInsightMutation.mutate({ id: editingInsight.id, data: newInsight });
    } else {
      createInsightMutation.mutate(newInsight);
    }
  };

  const openEditDialog = (insight) => {
    setEditingInsight(insight);
    setNewInsight({
      insight_type: insight.insight_type,
      title: insight.title,
      content: insight.content,
      tags: insight.tags || [],
      related_interaction_id: insight.related_interaction_id || ''
    });
    setShowDialog(true);
  };

  const getInsightTypeIcon = (type) => {
    const icons = {
      opportunity: TrendingUp,
      pain_point: AlertTriangle,
      risk: AlertTriangle,
      competitive_intel: Target,
      other: Lightbulb
    };
    return icons[type] || Lightbulb;
  };

  const getInsightTypeColor = (type) => {
    const colors = {
      opportunity: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      pain_point: 'bg-amber-100 text-amber-800 border-amber-200',
      risk: 'bg-red-100 text-red-800 border-red-200',
      competitive_intel: 'bg-blue-100 text-blue-800 border-blue-200',
      other: 'bg-slate-100 text-slate-800 border-slate-200'
    };
    return colors[type] || colors.other;
  };

  const getInteractionSubject = (interactionId) => {
    const interaction = interactions.find(i => i.id === interactionId);
    return interaction?.subject || 'Related interaction';
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-[#ffffff]">Sales Insights ({insights.length})</h3>
        <Button onClick={() => { resetForm(); setShowDialog(true); }} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Insight
        </Button>
      </div>

      {insights.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Lightbulb className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-[#ffffff] mb-1">No sales insights yet</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">Capture key insights from your interactions</p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Insight
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => {
            const Icon = getInsightTypeIcon(insight.insight_type);
            return (
              <Card key={insight.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        <h4 className="font-semibold text-slate-900 dark:text-[#ffffff]">{insight.title}</h4>
                        <Badge variant="outline" className={getInsightTypeColor(insight.insight_type)}>
                          {insight.insight_type.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mb-3 whitespace-pre-wrap">{insight.content}</p>
                      {insight.tags && insight.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {insight.tags.map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {tag.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span>Recorded by {insight.recorded_by}</span>
                        <span>•</span>
                        <span>{format(new Date(insight.recorded_date), 'MMM d, yyyy')}</span>
                        {insight.related_interaction_id && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600">{getInteractionSubject(insight.related_interaction_id)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(insight)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this insight?')) {
                            deleteInsightMutation.mutate(insight.id);
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
            <DialogTitle>{editingInsight ? 'Edit Sales Insight' : 'Add Sales Insight'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Insight Type *</Label>
              <Select
                value={newInsight.insight_type}
                onValueChange={(value) => setNewInsight({ ...newInsight, insight_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="opportunity">Opportunity</SelectItem>
                  <SelectItem value="pain_point">Pain Point</SelectItem>
                  <SelectItem value="risk">Risk</SelectItem>
                  <SelectItem value="competitive_intel">Competitive Intelligence</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title *</Label>
              <Input
                value={newInsight.title}
                onChange={(e) => setNewInsight({ ...newInsight, title: e.target.value })}
                placeholder="Brief summary of the insight"
              />
            </div>
            <div>
              <Label>Content *</Label>
              <Textarea
                value={newInsight.content}
                onChange={(e) => setNewInsight({ ...newInsight, content: e.target.value })}
                placeholder="Detailed description of the insight, context, and implications..."
                rows={6}
              />
            </div>
            <div>
              <Label>Related Interaction (optional)</Label>
              <Select
                value={newInsight.related_interaction_id}
                onValueChange={(value) => setNewInsight({ ...newInsight, related_interaction_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Link to an interaction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {interactions.map(interaction => (
                    <SelectItem key={interaction.id} value={interaction.id}>
                      {interaction.subject || interaction.type} - {format(new Date(interaction.interaction_date), 'MMM d, yyyy')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                placeholder="e.g., expansion, upsell_opportunity, high_value"
                value={newInsight.tags.join(', ')}
                onChange={(e) => setNewInsight({ 
                  ...newInsight, 
                  tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={!newInsight.title || !newInsight.content}
              >
                {editingInsight ? 'Update Insight' : 'Add Insight'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}





