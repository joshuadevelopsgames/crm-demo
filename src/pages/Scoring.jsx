import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
import { autoScoreAllAccounts } from '@/utils/autoScoreAllAccounts';
import { Download, RefreshCw } from 'lucide-react';

export default function Scoring() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isAutoScoring, setIsAutoScoring] = useState(false);
  const [autoScoreProgress, setAutoScoreProgress] = useState('');

  const queryClient = useQueryClient();

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['scorecard-templates'],
    queryFn: () => base44.entities.ScorecardTemplate.list()
  });

  // Find primary template
  const primaryTemplate = templates.find(t => t.is_default === true || t.is_primary === true) || 
                          templates.find(t => t.name === 'ICP Weighted Scorecard' && t.is_active);

  // Auto-import primary template on first load if it doesn't exist
  useEffect(() => {
    if (!templatesLoading && templates.length === 0 && !isImporting) {
      // No templates exist, try to import from Google Sheet
      console.log('📥 No templates found, attempting to import primary template from Google Sheet...');
      importTemplateMutation.mutate();
    } else if (!templatesLoading && templates.length > 0 && !primaryTemplate && !isImporting) {
      // Templates exist but no primary template, try to import
      console.log('📥 No primary template found, attempting to import from Google Sheet...');
      importTemplateMutation.mutate();
    }
  }, [templatesLoading, templates.length, primaryTemplate, isImporting]);

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
        total_possible_score: totalScore
      });
    },
    onSuccess: async (newTemplate) => {
      queryClient.invalidateQueries({ queryKey: ['scorecard-templates'] });
      setIsDialogOpen(false);
      resetForm();
      
      // If this is marked as primary/default, auto-score all accounts
      if (newTemplate.is_default || newTemplate.is_primary) {
        await triggerAutoScore(newTemplate);
      }
    }
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const totalScore = data.questions.reduce((sum, q) => {
        const maxAnswer = q.answer_type === 'yes_no' ? 1 : 
                         q.answer_type === 'scale_1_5' ? 5 : 10;
        return sum + (q.weight * maxAnswer);
      }, 0);
      
      return base44.entities.ScorecardTemplate.update(id, {
        ...data,
        total_possible_score: totalScore
      });
    },
    onSuccess: async (updatedTemplate) => {
      queryClient.invalidateQueries({ queryKey: ['scorecard-templates'] });
      setIsDialogOpen(false);
      resetForm();
      
      // If this is the primary template, auto-score all accounts
      if (updatedTemplate.is_default || updatedTemplate.is_primary) {
        await triggerAutoScore(updatedTemplate);
      }
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }) => 
      base44.entities.ScorecardTemplate.update(id, { is_active: !isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecard-templates'] });
    }
  });

  const resetForm = () => {
    setNewTemplate({
      name: '',
      description: '',
      is_active: true,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <TutorialTooltip
        tip="This is your Scoring Templates page. Create weighted questionnaires (scorecards) to evaluate accounts. Questions can be grouped by sections and each question has a weight that contributes to the overall score."
        step={4}
        position="bottom"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Scoring Templates</h1>
            <p className="text-slate-600 mt-1">Create weighted questionnaires to score accounts</p>
          </div>
          <div className="flex gap-2">
            {primaryTemplate && (
              <Button 
                variant="outline" 
                onClick={() => triggerAutoScore(primaryTemplate)}
                disabled={isAutoScoring}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isAutoScoring ? 'animate-spin' : ''}`} />
                {isAutoScoring ? 'Auto-Scoring...' : 'Re-score All Accounts'}
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => importTemplateMutation.mutate()}
              disabled={isImporting}
            >
              <Download className="w-4 h-4 mr-2" />
              {isImporting ? 'Importing...' : 'Import Primary Template'}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800" onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Scoring Template'}</DialogTitle>
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
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
          </div>
        </TutorialTooltip>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  {template.description && (
                    <p className="text-sm text-slate-600 mt-1">{template.description}</p>
                  )}
                </div>
                <Badge variant={template.is_active ? "default" : "secondary"}>
                  {template.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Badge variant="outline">
                  {template.questions?.length || 0} questions
                </Badge>
                <span>•</span>
                <span>Max score: {template.total_possible_score || 0}</span>
              </div>

              {/* Question Categories Summary */}
              {template.questions && template.questions.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2">Question breakdown:</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(new Set(template.questions.map(q => q.category).filter(Boolean))).map((category, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {category}
                      </Badge>
                    ))}
                    {template.questions.filter(q => !q.category).length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {template.questions.filter(q => !q.category).length} uncategorized
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => openEditDialog(template)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleActiveMutation.mutate({ id: template.id, isActive: template.is_active })}
                >
                  {template.is_active ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Activate
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Auto-scoring progress */}
      {autoScoreProgress && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-blue-600 ${isAutoScoring ? 'animate-spin' : ''}`} />
              <p className="text-sm text-blue-900">{autoScoreProgress}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {templates.length === 0 && (
        <Card className="p-12 text-center">
          <Award className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No scoring templates yet</h3>
          <p className="text-slate-600 mb-4">
            Create weighted questionnaires to generate organization scores
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Templates can have 25+ questions with different weights to calculate a comprehensive score from 0-100
          </p>
        </Card>
      )}
    </div>
  );
}

