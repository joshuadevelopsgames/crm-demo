import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function BuildScorecard() {
  const urlParams = new URLSearchParams(window.location.search);
  const accountId = urlParams.get('accountId');
  const templateId = urlParams.get('templateId');
  const isCustom = urlParams.get('custom') === 'true';
  const customName = urlParams.get('name') || '';
  const customDescription = urlParams.get('description') || '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ['scorecard-template', templateId],
    queryFn: async () => {
      const templates = await base44.entities.ScorecardTemplate.list();
      const found = templates.find(t => String(t.id) === String(templateId));
      return found;
    },
    enabled: !!templateId && !isCustom
  });

  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ['account', accountId],
    queryFn: async () => {
      const accounts = await base44.entities.Account.list();
      const found = accounts.find(a => String(a.id) === String(accountId));
      return found;
    },
    enabled: !!accountId
  });

  // Initialize scorecard state
  const [scorecardName, setScorecardName] = useState(isCustom && customName ? customName : 'Custom Scorecard');
  const [scorecardDescription, setScorecardDescription] = useState(isCustom && customDescription ? customDescription : '');
  const [questions, setQuestions] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Update state when template loads
  useEffect(() => {
    if (template && !isInitialized) {
      setScorecardName(`${template.name} (Custom)`);
      setScorecardDescription(template.description || '');
      setQuestions(
        template.questions?.map((q, index) => ({
          ...q,
          id: `q-${index}`,
          question_text: q.question_text || '',
          weight: q.weight || 5,
          answer_type: q.answer_type || 'yes_no',
          section: q.section || 'Other',
          category: q.category || 'Other'
        })) || []
      );
      setIsInitialized(true);
    } else if (isCustom && !isInitialized) {
      // For custom scorecards without template, just mark as initialized
      setIsInitialized(true);
    }
  }, [template, isCustom, isInitialized]);

  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    weight: 5,
    answer_type: 'yes_no',
    section: 'Other',
    category: 'Other'
  });

  // Get unique sections from questions
  const sections = useMemo(() => {
    const sectionSet = new Set(questions.map(q => q.section || 'Other'));
    return Array.from(sectionSet);
  }, [questions]);

  const addQuestion = () => {
    if (!newQuestion.question_text.trim()) {
      alert('Please enter a question');
      return;
    }
    setQuestions([...questions, {
      ...newQuestion,
      id: `q-${Date.now()}`
    }]);
    setNewQuestion({
      question_text: '',
      weight: 5,
      answer_type: 'yes_no',
      section: 'Other',
      category: 'Other'
    });
  };

  const removeQuestion = (questionId) => {
    setQuestions(questions.filter(q => q.id !== questionId));
  };

  const updateQuestion = (questionId, field, value) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, [field]: value } : q
    ));
  };

  const saveAndContinueMutation = useMutation({
    mutationFn: async () => {
      // Calculate total possible score
      const totalPossibleScore = questions.reduce((sum, q) => {
        const maxAnswer = q.answer_type === 'yes_no' ? 1 : 
                         q.answer_type === 'scale_1_5' ? 5 : 10;
        return sum + (q.weight * maxAnswer);
      }, 0);

      // Create a temporary template for this custom scorecard
      const customTemplate = {
        id: `custom-${Date.now()}`,
        name: scorecardName,
        description: scorecardDescription,
        questions: questions,
        total_possible_score: totalPossibleScore,
        pass_threshold: 70,
        is_active: true
      };

      // Navigate to TakeScorecard with the custom template data
      // We'll pass it via URL params or use a different approach
      const templateData = encodeURIComponent(JSON.stringify(customTemplate));
      navigate(createPageUrl(`TakeScorecard?accountId=${accountId}&customTemplate=${templateData}`));
    }
  });

  if ((templateLoading && !isCustom) || accountLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-medium text-slate-900 mb-1">Account not found</h3>
        <p className="text-slate-600 mb-4">The account could not be found</p>
        <Link to={createPageUrl(`AccountDetail?id=${accountId}`)}>
          <Button>Back to Account</Button>
        </Link>
      </Card>
    );
  }

  // For template-based, require template. For custom, template is optional
  if (!isCustom && !template) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-medium text-slate-900 mb-1">Template not found</h3>
        <p className="text-slate-600 mb-4">The template could not be found</p>
        <Link to={createPageUrl(`AccountDetail?id=${accountId}`)}>
          <Button>Back to Account</Button>
        </Link>
      </Card>
    );
  }

  // Group questions by section
  const questionsBySection = useMemo(() => {
    const grouped = {};
    questions.forEach((question) => {
      const section = question.section || 'Other';
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push(question);
    });
    return grouped;
  }, [questions]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl(`AccountDetail?id=${accountId}`)}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Build Scorecard</h1>
            <p className="text-slate-600 mt-1">For: {account.name}</p>
          </div>
        </div>
        <Button 
          onClick={() => saveAndContinueMutation.mutate()}
          disabled={questions.length === 0 || saveAndContinueMutation.isLoading}
          size="lg"
        >
          <Save className="w-4 h-4 mr-2" />
          Save & Continue to Complete
        </Button>
      </div>

      {/* Scorecard Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Scorecard Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Scorecard Name</Label>
            <Input
              value={scorecardName}
              onChange={(e) => setScorecardName(e.target.value)}
              placeholder="e.g., Q1 2025 Review"
            />
          </div>
          <div>
            <Label>Description (Optional)</Label>
            <Textarea
              value={scorecardDescription}
              onChange={(e) => setScorecardDescription(e.target.value)}
              placeholder="Describe the purpose of this scorecard..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Questions by Section */}
      <div className="space-y-6">
        {Object.entries(questionsBySection).map(([section, sectionQuestions]) => (
          <Card key={section}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{section}</span>
                <Badge variant="outline">
                  {sectionQuestions.length} question{sectionQuestions.length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sectionQuestions.map((question) => (
                  <div key={question.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div>
                          <Label>Question</Label>
                          <Input
                            value={question.question_text}
                            onChange={(e) => updateQuestion(question.id, 'question_text', e.target.value)}
                            placeholder="Enter question text..."
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Weight</Label>
                            <Input
                              type="number"
                              value={question.weight}
                              onChange={(e) => updateQuestion(question.id, 'weight', parseInt(e.target.value) || 0)}
                              min="1"
                            />
                          </div>
                          <div>
                            <Label>Answer Type</Label>
                            <Select
                              value={question.answer_type}
                              onValueChange={(value) => updateQuestion(question.id, 'answer_type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="yes_no">Yes/No</SelectItem>
                                <SelectItem value="scale_1_5">Scale 1-5</SelectItem>
                                <SelectItem value="scale_1_10">Scale 1-10</SelectItem>
                                <SelectItem value="numeric">Numeric</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Section</Label>
                            <Input
                              value={question.section}
                              onChange={(e) => updateQuestion(question.id, 'section', e.target.value)}
                              placeholder="Section name"
                            />
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeQuestion(question.id)}
                        className="mt-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add New Question */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Add New Question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Question Text</Label>
            <Input
              value={newQuestion.question_text}
              onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
              placeholder="Enter question text..."
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Weight</Label>
              <Input
                type="number"
                value={newQuestion.weight}
                onChange={(e) => setNewQuestion({ ...newQuestion, weight: parseInt(e.target.value) || 5 })}
                min="1"
              />
            </div>
            <div>
              <Label>Answer Type</Label>
              <Select
                value={newQuestion.answer_type}
                onValueChange={(value) => setNewQuestion({ ...newQuestion, answer_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes_no">Yes/No</SelectItem>
                  <SelectItem value="scale_1_5">Scale 1-5</SelectItem>
                  <SelectItem value="scale_1_10">Scale 1-10</SelectItem>
                  <SelectItem value="numeric">Numeric</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Section</Label>
              <Input
                value={newQuestion.section}
                onChange={(e) => setNewQuestion({ ...newQuestion, section: e.target.value })}
                placeholder="Section name"
              />
            </div>
          </div>
          <Button onClick={addQuestion} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Question
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

