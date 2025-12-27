import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useUser } from '@/contexts/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Award,
  Edit,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TutorialTooltip from '../components/TutorialTooltip';
import { parseScorecardTemplateFromSheet } from '@/services/googleSheetsService';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

export default function Scoring() {
  const { isAdmin, isLoading: userLoading } = useUser();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const queryClient = useQueryClient();
  
  // Redirect non-admin users
  if (!userLoading && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['scorecard-templates'],
    queryFn: () => base44.entities.ScorecardTemplate.list()
  });

  // Get current ICP template
  const { data: icpTemplate, isLoading: icpLoading } = useQuery({
    queryKey: ['icp-template'],
    queryFn: () => base44.entities.ScorecardTemplate.getCurrentICP()
  });
  
  // Get version history for ICP template
  const { data: icpVersionHistory = [] } = useQuery({
    queryKey: ['icp-version-history', icpTemplate?.id],
    queryFn: async () => {
      if (!icpTemplate?.id) return [];
      return await base44.entities.ScorecardTemplate.getVersionHistory(icpTemplate.id);
    },
    enabled: !!icpTemplate?.id
  });

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    is_active: true,
    pass_threshold: 70, // Default pass threshold
    questions: [
      { question_text: '', weight: 5, answer_type: 'scale_1_5', category: '', section: '' }
    ]
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data) => {
      // Calculate total possible score
      const totalScore = data.questions.reduce((sum, q) => {
        const maxAnswer = q.answer_type === 'yes_no' ? 1 : 
                         q.answer_type === 'scale_1_5' ? 5 : 10;
        return sum + (q.weight * maxAnswer);
      }, 0);
      
      return base44.entities.ScorecardTemplate.create({
        ...data,
        total_possible_score: totalScore,
        is_default: true, // Always mark as ICP template
        version_number: 1,
        is_current_version: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecard-templates'] });
      queryClient.invalidateQueries({ queryKey: ['icp-template'] });
      queryClient.invalidateQueries({ queryKey: ['icp-version-history'] });
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const totalScore = data.questions.reduce((sum, q) => {
        const maxAnswer = q.answer_type === 'yes_no' ? 1 : 
                         q.answer_type === 'scale_1_5' ? 5 : 10;
        return sum + (q.weight * maxAnswer);
      }, 0);
      
      // Check if this is the ICP template - if so, use versioning
      const template = templates.find(t => t.id === id);
      if (template && template.is_default) {
        // Use versioning for ICP template updates
        return base44.entities.ScorecardTemplate.updateWithVersion(id, {
          ...data,
          total_possible_score: totalScore
        });
      } else {
        // Regular update for non-ICP templates
      return base44.entities.ScorecardTemplate.update(id, {
        ...data,
        total_possible_score: totalScore
      });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecard-templates'] });
      queryClient.invalidateQueries({ queryKey: ['icp-template'] });
      setIsDialogOpen(false);
      resetForm();
      alert('✅ Template updated successfully! A new version has been created.');
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => 
      base44.entities.ScorecardTemplate.update(id, { is_active: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecard-templates'] });
    }
  });

  const importTemplateMutation = useMutation({
    mutationFn: async () => {
      setIsImporting(true);
      const template = await parseScorecardTemplateFromSheet();
      if (!template) {
        throw new Error('Failed to parse template from Google Sheet');
      }
      
      // Remove 'sections' field as it's not in the database schema
      // Sections are derived from questions
      const { sections, ...templateData } = template;
      
      // Check if ICP template already exists
      const existing = icpTemplate;
      if (existing) {
        // Update existing ICP template with versioning
        return base44.entities.ScorecardTemplate.updateWithVersion(existing.id, {
          ...templateData,
          is_default: true // Ensure it stays as ICP
        });
      } else {
        // Create new ICP template
        return base44.entities.ScorecardTemplate.create({
          ...templateData,
          is_default: true,
          version_number: 1,
          is_current_version: true
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecard-templates'] });
      queryClient.invalidateQueries({ queryKey: ['icp-template'] });
      queryClient.invalidateQueries({ queryKey: ['icp-version-history'] });
      setIsImporting(false);
      alert('✅ ICP template imported successfully!');
    },
    onError: (error) => {
      setIsImporting(false);
      alert(`❌ Failed to import template: ${error.message}`);
      console.error('Import error:', error);
    }
  });


  const resetForm = () => {
    setNewTemplate({
      name: 'ICP Weighted Scorecard',
      description: 'Ideal Customer Profile scoring based on weighted questions',
      is_active: true,
      is_default: true,
      pass_threshold: 70,
      questions: [
        { question_text: '', weight: 5, answer_type: 'scale_1_5', category: '', section: '' }
      ]
    });
    setEditingTemplate(null);
  };

  const handleCreateOrUpdate = () => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        data: newTemplate
      });
    } else {
      createTemplateMutation.mutate(newTemplate);
    }
  };

  const openEditDialog = (template) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name || '',
      description: template.description || '',
      is_active: template.is_active !== false,
      pass_threshold: template.pass_threshold || 70,
      questions: template.questions || [{ question_text: '', weight: 5, answer_type: 'scale_1_5', category: '', section: '' }]
    });
    setIsDialogOpen(true);
  };

  const addQuestion = () => {
    setNewTemplate({
      ...newTemplate,
      questions: [
        ...newTemplate.questions,
        { question_text: '', weight: 5, answer_type: 'scale_1_5', category: '', section: '' }
      ]
    });
  };

  const removeQuestion = (index) => {
    setNewTemplate({
      ...newTemplate,
      questions: newTemplate.questions.filter((_, i) => i !== index)
    });
  };

  const updateQuestion = (index, field, value) => {
    const updatedQuestions = [...newTemplate.questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setNewTemplate({ ...newTemplate, questions: updatedQuestions });
  };

  // Auto-import ICP template on first load if it doesn't exist
  useEffect(() => {
    if (!icpLoading && !icpTemplate && !isImporting && importTemplateMutation) {
      // No ICP template exists, try to import from Google Sheet
      console.log('📥 No ICP template found, attempting to import from Google Sheet...');
      importTemplateMutation.mutate();
    }
  }, [icpLoading, icpTemplate, isImporting, importTemplateMutation]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <TutorialTooltip
        tip="This is your ICP Template management page. Edit the Ideal Customer Profile scorecard template that all accounts use. When you update the template, a new version is created to preserve history."
        step={4}
        position="bottom"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">ICP Template</h1>
            <p className="text-slate-600 mt-1">Manage the Ideal Customer Profile scorecard template</p>
          </div>
          <div className="flex gap-2">
            {!icpTemplate && (
              <Button 
                variant="outline" 
                onClick={() => importTemplateMutation.mutate()}
                disabled={isImporting}
              >
                <Download className="w-4 h-4 mr-2" />
                {isImporting ? 'Importing...' : 'Import ICP Template'}
              </Button>
            )}
            {icpTemplate && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
                  <Button 
                    className="bg-slate-900 hover:bg-slate-800" 
                    onClick={() => openEditDialog(icpTemplate)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Manage ICP Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit ICP Template' : 'Create ICP Template'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-4">
                <div>
                  <Label>Template Name *</Label>
                  <Input
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="Customer Health Score"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    placeholder="What does this scorecard measure?"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Pass Threshold (out of 100)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={newTemplate.pass_threshold}
                    onChange={(e) => setNewTemplate({ ...newTemplate, pass_threshold: parseInt(e.target.value) || 70 })}
                    placeholder="70"
                  />
                  <p className="text-xs text-slate-500 mt-1">Scores at or above this will be marked as PASS</p>
                </div>
                {!editingTemplate && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-800">
                      This will create the ICP template that all accounts will use for scoring.
                    </p>
                  </div>
                )}
                {editingTemplate && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                    <p className="text-sm text-amber-800">
                      ⚠️ Updating the ICP template will create a new version. Previous scorecards will retain their original template version.
                    </p>
                  </div>
                )}
              </div>

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Questions</h3>
                  <Button variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </Button>
                </div>
                <div className="space-y-4">
                  {newTemplate.questions.map((question, index) => (
                    <Card key={index} className="border-slate-200">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold flex-shrink-0 mt-1">
                              {index + 1}
                            </div>
                            <div className="flex-1 space-y-3">
                              <div>
                                <Label className="text-xs">Question *</Label>
                                <Input
                                  value={question.question_text}
                                  onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                                  placeholder="How engaged is this customer?"
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs">Weight (1-10) *</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={question.weight}
                                    onChange={(e) => updateQuestion(index, 'weight', parseInt(e.target.value) || 1)}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Answer Type *</Label>
                                  <Select
                                    value={question.answer_type}
                                    onValueChange={(value) => updateQuestion(index, 'answer_type', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="yes_no">Yes/No</SelectItem>
                                      <SelectItem value="scale_1_5">Scale 1-5</SelectItem>
                                      <SelectItem value="scale_1_10">Scale 1-10</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Category</Label>
                                  <Input
                                    value={question.category}
                                    onChange={(e) => updateQuestion(index, 'category', e.target.value)}
                                    placeholder="e.g., engagement"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs">Section/Group</Label>
                                <Input
                                  value={question.section}
                                  onChange={(e) => updateQuestion(index, 'section', e.target.value)}
                                  placeholder="e.g., Corporate Demographics, Non-Negotiables"
                                />
                                <p className="text-xs text-slate-400 mt-1">Group questions together (e.g., "Corporate Demographic Information")</p>
                              </div>
                            </div>
                            {newTemplate.questions.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeQuestion(index)}
                                className="flex-shrink-0 mt-6"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateOrUpdate}
                  disabled={!newTemplate.name || newTemplate.questions.some(q => !q.question_text)}
                >
                  {editingTemplate ? 'Update ICP Template' : 'Create ICP Template'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
            )}
          </div>
        </div>
      </TutorialTooltip>

      {/* ICP Template Display */}
      {icpLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-slate-600">Loading ICP template...</p>
          </CardContent>
        </Card>
      ) : !icpTemplate ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Award className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No ICP Template</h3>
            <p className="text-slate-600 mb-4">Import or create an ICP template to start scoring accounts</p>
            <Button 
              variant="outline" 
              onClick={() => importTemplateMutation.mutate()}
              disabled={isImporting}
            >
              <Download className="w-4 h-4 mr-2" />
              {isImporting ? 'Importing...' : 'Import ICP Template'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Current ICP Template */}
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Award className="w-5 h-5 text-emerald-600" />
                    {icpTemplate.name}
                  </CardTitle>
                  {icpTemplate.description && (
                    <p className="text-sm text-slate-600 mt-2">{icpTemplate.description}</p>
                  )}
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                  Version {icpTemplate.version_number || 1} (Current)
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <Badge variant="outline">
                  {icpTemplate.questions?.length || 0} questions
                </Badge>
                <span>•</span>
                <span>Max score: 100 (normalized)</span>
                <span>•</span>
                <span>Pass threshold: {icpTemplate.pass_threshold || 70}</span>
              </div>

              {/* Question Sections Summary */}
              {icpTemplate.questions && icpTemplate.questions.length > 0 && (
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-700 mb-2">Question Sections:</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(icpTemplate.questions.map(q => q.section).filter(Boolean))).map((section, i) => {
                      const sectionQuestions = icpTemplate.questions.filter(q => q.section === section);
                      return (
                      <Badge key={i} variant="outline" className="text-xs">
                          {section} ({sectionQuestions.length})
                      </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button 
                  onClick={() => openEditDialog(icpTemplate)}
                  className="w-full sm:w-auto"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Manage ICP Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Version History */}
          {icpVersionHistory.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Version History</CardTitle>
                <p className="text-sm text-slate-600 mt-1">Previous versions of the ICP template</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {icpVersionHistory.filter(v => !v.is_current_version).map((version) => (
                    <div key={version.id} className="p-4 border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">Version {version.version_number}</span>
                            <Badge variant="outline" className="text-xs">
                              {format(new Date(version.created_at), 'MMM d, yyyy')}
                            </Badge>
                          </div>
                          {version.description && (
                            <p className="text-sm text-slate-600 mt-1">{version.description}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {version.questions?.length || 0} questions • Max score: 100 (normalized)
                          </p>
                        </div>
                      </div>
                    </div>
        ))}
      </div>
              </CardContent>
        </Card>
          )}
        </div>
      )}

    </div>
  );
}

