import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Check, X, Download } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format } from 'date-fns';
import { exportAndDownloadScorecard } from '../utils/exportToCSV';

export default function TakeScorecard() {
  const urlParams = new URLSearchParams(window.location.search);
  const accountId = urlParams.get('accountId');
  const templateId = urlParams.get('templateId');
  const isCustom = urlParams.get('custom') === 'true';
  const customName = urlParams.get('name') || '';
  const customDescription = urlParams.get('description') || '';
  const customTemplateParam = urlParams.get('customTemplate'); // For templates built in BuildScorecard

  const navigate = useNavigate();
  const [answers, setAnswers] = useState({});
  const [scorecardDate, setScorecardDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();

  // Parse custom template from URL if provided (from BuildScorecard)
  const parsedCustomTemplate = useMemo(() => {
    if (customTemplateParam) {
      try {
        return JSON.parse(decodeURIComponent(customTemplateParam));
      } catch (e) {
        console.error('Failed to parse custom template:', e);
        return null;
      }
    }
    return null;
  }, [customTemplateParam]);

  // For custom scorecards, create a simple template structure
  const customTemplate = parsedCustomTemplate || (isCustom ? {
    id: 'custom',
    name: customName || 'Custom Scorecard',
    description: customDescription,
    questions: [], // Will be empty for now - can add question editor later
    total_possible_score: 0,
    pass_threshold: 70
  } : null);

  // If customTemplate is provided, we should use it (even if templateId is also provided)
  // This handles the case where BuildScorecard modified a template
  const shouldUseCustomTemplate = !!parsedCustomTemplate;

  const { data: template, isLoading: templateLoading, error: templateError } = useQuery({
    queryKey: ['scorecard-template', templateId],
    queryFn: async () => {
      const templates = await base44.entities.ScorecardTemplate.list();
      console.log('🔍 Looking for template with ID:', templateId);
      console.log('📋 Available templates:', templates.map(t => ({ id: t.id, name: t.name, idType: typeof t.id })));
      const found = templates.find(t => String(t.id) === String(templateId));
      if (!found) {
        console.warn(`⚠️ Template with ID "${templateId}" not found. Available template IDs:`, templates.map(t => t.id));
      } else {
        console.log('✅ Found template:', found.name);
      }
      return found;
    },
    enabled: !!templateId && !isCustom && !shouldUseCustomTemplate
  });

  // Use custom template if provided (from BuildScorecard), otherwise use fetched template or custom
  const activeTemplate = shouldUseCustomTemplate ? parsedCustomTemplate : (isCustom ? customTemplate : template);

  const { data: account, isLoading: accountLoading, error: accountError } = useQuery({
    queryKey: ['account', accountId],
    queryFn: async () => {
      const accounts = await base44.entities.Account.list();
      console.log('🔍 Looking for account with ID:', accountId);
      console.log('📋 Available accounts:', accounts.map(a => ({ id: a.id, name: a.name, idType: typeof a.id })));
      const found = accounts.find(a => String(a.id) === String(accountId));
      if (!found) {
        console.warn(`⚠️ Account with ID "${accountId}" not found. Available account IDs:`, accounts.map(a => a.id));
      } else {
        console.log('✅ Found account:', found.name);
      }
      return found;
    },
    enabled: !!accountId
  });

  // Group questions by section
  const questionsBySection = useMemo(() => {
    if (!activeTemplate?.questions) return {};
    
    const grouped = {};
    activeTemplate.questions.forEach((question, index) => {
      const section = question.section || 'Other';
      if (!grouped[section]) {
        grouped[section] = [];
      }
      grouped[section].push({ ...question, originalIndex: index });
    });
    
    return grouped;
  }, [activeTemplate]);

  const submitScorecardMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      
      // Map calculateScore output to expected format
      const normalizedScore = data.normalized || data.normalized_score || 0;
      const totalScore = data.total || data.total_score || 0;
      
      console.log('📊 Submitting scorecard:', {
        accountId,
        normalizedScore,
        totalScore,
        responses: data.responses?.length || 0,
        section_scores: data.section_scores
      });
      
      // Create scorecard response with section breakdown
      const scorecardResponse = await base44.entities.ScorecardResponse.create({
        account_id: accountId,
        template_id: isCustom ? null : templateId,
        template_name: isCustom ? (customName || 'Custom Scorecard') : activeTemplate?.name || 'Scorecard',
        responses: data.responses || [],
        section_scores: data.section_scores || {},
        total_score: totalScore,
        normalized_score: normalizedScore,
        is_pass: data.is_pass || false,
        scorecard_date: scorecardDate,
        completed_by: user.email,
        completed_date: new Date().toISOString(),
        scorecard_type: 'manual' // All scorecards are per-client (manual)
      });
      console.log('✅ Scorecard response created:', scorecardResponse);

      // Update account with the score from this scorecard
      console.log('🔄 Updating account score:', accountId, 'to', normalizedScore);
      try {
        const updatedAccount = await base44.entities.Account.update(accountId, {
          organization_score: normalizedScore
        });
        console.log('✅ Account score updated successfully:', updatedAccount);
        
        // Verify the update worked
        if (updatedAccount && updatedAccount.organization_score !== normalizedScore) {
          console.warn('⚠️ Account update returned different score:', updatedAccount.organization_score, 'expected:', normalizedScore);
        }
        
        return { scorecardResponse, updatedAccount };
      } catch (updateError) {
        console.error('❌ Error updating account score:', updateError);
        // Don't throw - scorecard was created successfully, just log the error
        throw new Error(`Scorecard created but failed to update account score: ${updateError.message}`);
      }
    },
    onSuccess: async (result) => {
      console.log('✅ Scorecard submitted successfully:', result);
      
      // Invalidate and refetch queries to refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['account', accountId] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['scorecards', accountId] })
      ]);
      
      // Force refetch the account data to ensure we have the latest score
      await queryClient.refetchQueries({ queryKey: ['account', accountId] });
      await queryClient.refetchQueries({ queryKey: ['accounts'] });
      
      // Use navigate instead of window.location for better state management
      // This ensures React Query cache is properly cleared
      try {
        if (navigate && typeof navigate === 'function') {
          navigate(createPageUrl(`AccountDetail?id=${accountId}`), { replace: true });
        } else {
          // Fallback to window.location if navigate is not available
          window.location.href = createPageUrl(`AccountDetail?id=${accountId}`);
        }
      } catch (navError) {
        console.error('Navigation error:', navError);
        // Fallback to window.location
        window.location.href = createPageUrl(`AccountDetail?id=${accountId}`);
      }
    },
    onError: (error) => {
      console.error('❌ Error submitting scorecard:', error);
      alert(`Failed to submit scorecard: ${error.message || 'Unknown error'}`);
    }
  });

  const handleAnswerChange = (questionIndex, value) => {
    setAnswers({
      ...answers,
      [questionIndex]: parseInt(value)
    });
  };

  const calculateScore = () => {
    if (!activeTemplate?.questions || activeTemplate.questions.length === 0) {
      return { total: 0, normalized: 0, responses: [], section_scores: {}, is_pass: false };
    }

    const responses = activeTemplate.questions.map((question, index) => {
      const answer = answers[index] || 0;
      const weightedScore = answer * question.weight;
      
      return {
        question_text: question.question_text,
        answer: answer,
        weight: question.weight,
        weighted_score: weightedScore,
        section: question.section || 'Other'
      };
    });

    // Calculate section sub-totals
    const sectionScores = {};
    Object.keys(questionsBySection).forEach(section => {
      const sectionQuestions = questionsBySection[section];
      sectionScores[section] = sectionQuestions.reduce((sum, q) => {
        const answer = answers[q.originalIndex] || 0;
        return sum + (answer * q.weight);
      }, 0);
    });

    const totalScore = responses.reduce((sum, r) => sum + r.weighted_score, 0);
    const normalizedScore = activeTemplate.total_possible_score > 0 
      ? Math.round((totalScore / activeTemplate.total_possible_score) * 100)
      : 0;
    const passThreshold = activeTemplate.pass_threshold || 70;
    const isPass = normalizedScore >= passThreshold;

    return {
      total: totalScore,
      normalized: normalizedScore,
      responses: responses,
      section_scores: sectionScores,
      is_pass: isPass
    };
  };

  const handleSubmit = () => {
    const scoreData = calculateScore();
    submitScorecardMutation.mutate(scoreData);
  };

  const handleExportToCSV = () => {
    const scoreData = calculateScore();
    const scorecardData = {
      ...scoreData,
      scorecard_date: scorecardDate,
      completed_date: new Date().toISOString(),
      completed_by: 'Current User' // Will be set on submit
    };
    exportAndDownloadScorecard(scorecardData, activeTemplate, account);
  };

  const isComplete = activeTemplate?.questions?.every((_, index) => answers[index] !== undefined);
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = activeTemplate?.questions?.length || 0;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
  const scoreData = calculateScore();
  const passThreshold = activeTemplate?.pass_threshold || 70;

  // Show loading state while fetching
  // Only show loading if we're actually fetching a template (not using customTemplate)
  if ((templateLoading && !isCustom && !shouldUseCustomTemplate) || accountLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading scorecard...</p>
        </div>
      </div>
    );
  }

  // Check if account exists
  if (!account) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-medium text-slate-900 mb-1">Account not found</h3>
        <p className="text-slate-600 mb-4">The account could not be found</p>
        <Link to={createPageUrl('Accounts')}>
          <Button>Back to Accounts</Button>
        </Link>
      </Card>
    );
  }

  // Check if template exists (only if not custom and templateId is provided)
  if (!isCustom && templateId && !template) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-medium text-slate-900 mb-1">Scorecard template not found</h3>
        <p className="text-slate-600 mb-4">
          The template with ID "{templateId}" could not be found. It may have been deleted or the ID is incorrect.
        </p>
        <div className="flex gap-2 justify-center">
          <Link to={createPageUrl(`AccountDetail?id=${accountId}`)}>
            <Button variant="outline">Back to Account</Button>
          </Link>
          <Link to={createPageUrl('Scoring')}>
            <Button>View Templates</Button>
          </Link>
        </div>
      </Card>
    );
  }

  // For custom scorecards, activeTemplate should exist (it's created inline)
  // For template-based, we need activeTemplate to exist
  if (!activeTemplate) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-medium text-slate-900 mb-1">Scorecard not found</h3>
        <p className="text-slate-600 mb-4">Unable to load the scorecard template</p>
        <Link to={createPageUrl(`AccountDetail?id=${accountId}`)}>
          <Button>Back to Account</Button>
        </Link>
      </Card>
    );
  }

  const getAnswerOptions = (answerType) => {
    if (answerType === 'yes_no') {
      return [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes' }
      ];
    } else if (answerType === 'scale_1_5') {
      return [
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 3, label: '3' },
        { value: 4, label: '4' },
        { value: 5, label: '5' }
      ];
    } else if (answerType === 'scale_1_10') {
      return Array.from({ length: 10 }, (_, i) => ({
        value: i + 1,
        label: `${i + 1}`
      }));
    }
    return [];
  };

  const getAnswerLabel = (answerType, value) => {
    if (value === undefined || value === null) return '';
    if (answerType === 'yes_no') return value === 1 ? 'Yes' : 'No';
    return value.toString();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link to={createPageUrl(`AccountDetail?id=${accountId}`)}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Account
          </Button>
        </Link>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{activeTemplate?.name || 'Custom Scorecard'}</h1>
            <p className="text-slate-600 mt-1">For: {account.name}</p>
            {activeTemplate?.description && (
              <p className="text-sm text-slate-600 mt-2">{activeTemplate.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-2">
              <Label className="text-sm">Date:</Label>
              <Input
                type="date"
                value={scorecardDate}
                onChange={(e) => setScorecardDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {answeredCount} / {totalQuestions}
            </Badge>
          </div>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Progress</span>
              <span className="font-medium text-slate-900">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Scorecard Form - Grouped by Section (Google Sheet style) */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Header Row - Table Style */}
          <div className="grid grid-cols-12 gap-2 p-4 bg-slate-50 border-b border-slate-200 font-semibold text-sm">
            <div className="col-span-4">Scorecard</div>
            <div className="col-span-6">Data</div>
            <div className="col-span-2 text-right">Score</div>
          </div>

          {/* Date and Score Summary */}
          <div className="grid grid-cols-12 gap-2 p-4 border-b border-slate-200 bg-white">
            <div className="col-span-4 font-medium">Date:</div>
            <div className="col-span-6">{format(new Date(scorecardDate), 'MMMM d, yyyy')}</div>
            <div className="col-span-2 text-right font-bold text-lg">
              {scoreData.normalized > 0 ? scoreData.normalized : '—'}
            </div>
          </div>

          {/* Questions grouped by section */}
          {Object.keys(questionsBySection).length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-600 mb-4">
                {isCustom 
                  ? "Custom scorecards with editable questions are coming soon. For now, please use a template-based scorecard."
                  : "No questions found in this scorecard template."
                }
              </p>
              <Link to={createPageUrl(`AccountDetail?id=${accountId}`)}>
                <Button variant="outline">Back to Account</Button>
              </Link>
            </div>
          ) : (
            <>
              {Object.entries(questionsBySection).map(([section, questions]) => {
            const sectionScore = scoreData.section_scores[section] || 0;
            const sectionAnswered = questions.every(q => answers[q.originalIndex] !== undefined);
            
            return (
              <div key={section} className="border-b border-slate-200">
                {/* Section Header */}
                <div className="grid grid-cols-12 gap-2 p-4 bg-slate-100 font-semibold text-slate-900">
                  <div className="col-span-10">{section}</div>
                  <div className="col-span-2 text-right">
                    {sectionAnswered ? (
                      <span className="font-bold">{sectionScore}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </div>

                {/* Questions in this section */}
                {questions.map((question, qIndex) => {
                  const questionIndex = question.originalIndex;
                  const options = getAnswerOptions(question.answer_type);
                  const isAnswered = answers[questionIndex] !== undefined;
                  const answer = answers[questionIndex];
                  const weightedScore = isAnswered ? answer * question.weight : 0;

                  return (
                    <div 
                      key={questionIndex} 
                      className={`grid grid-cols-12 gap-2 p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                        isAnswered ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      {/* Question Text */}
                      <div className="col-span-4 text-sm font-medium text-slate-900">
                        {question.question_text}
                      </div>

                      {/* Answer Input */}
                      <div className="col-span-6">
                        {question.answer_type === 'yes_no' && (
                          <RadioGroup
                            value={answer?.toString()}
                            onValueChange={(value) => handleAnswerChange(questionIndex, value)}
                          >
                            <div className="flex gap-4">
                              {options.map((option) => (
                                <div key={option.value} className="flex items-center gap-2">
                                  <RadioGroupItem
                                    value={option.value.toString()}
                                    id={`q${questionIndex}-${option.value}`}
                                  />
                                  <Label
                                    htmlFor={`q${questionIndex}-${option.value}`}
                                    className="cursor-pointer text-sm"
                                  >
                                    {option.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </RadioGroup>
                        )}
                        {(question.answer_type === 'scale_1_5' || question.answer_type === 'scale_1_10') && (
                          <RadioGroup
                            value={answer?.toString()}
                            onValueChange={(value) => handleAnswerChange(questionIndex, value)}
                          >
                            <div className="flex flex-wrap gap-2">
                              {options.map((option) => (
                                <div key={option.value} className="flex items-center">
                                  <RadioGroupItem
                                    value={option.value.toString()}
                                    id={`q${questionIndex}-${option.value}`}
                                    className="peer sr-only"
                                  />
                                  <Label
                                    htmlFor={`q${questionIndex}-${option.value}`}
                                    className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 border-slate-200 bg-white hover:bg-slate-50 peer-data-[state=checked]:border-emerald-600 peer-data-[state=checked]:bg-emerald-50 cursor-pointer transition-all text-sm font-medium ${
                                      isAnswered && answer === option.value ? 'border-emerald-600 bg-emerald-50' : ''
                                    }`}
                                  >
                                    {option.label}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </RadioGroup>
                        )}
                      </div>

                      {/* Score Display */}
                      <div className="col-span-2 text-right">
                        {isAnswered ? (
                          <span className="font-medium text-slate-900">{weightedScore}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Section Sub-total */}
                <div className="grid grid-cols-12 gap-2 p-4 bg-slate-50 font-semibold border-t-2 border-slate-300">
                  <div className="col-span-10">Sub-total</div>
                  <div className="col-span-2 text-right">
                    {sectionAnswered ? (
                      <span className="font-bold text-lg">{sectionScore}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
            </>
          )}

          {/* Total Score and Pass/Fail */}
          <div className="grid grid-cols-12 gap-2 p-6 bg-gradient-to-r from-slate-50 to-white border-t-4 border-slate-900">
            <div className="col-span-10">
              <div className="text-lg font-bold text-slate-900">Total Score</div>
              <div className="text-sm text-slate-600 mt-1">
                Pass Threshold: {passThreshold} / 100
              </div>
            </div>
            <div className="col-span-2 text-right">
              <div className="text-3xl font-bold mb-2">
                {scoreData.normalized > 0 ? scoreData.normalized : '—'}
              </div>
              {isComplete && (
                <Badge 
                  className={`text-sm px-3 py-1 ${
                    scoreData.is_pass 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                      : 'bg-red-100 text-red-800 border-red-200'
                  }`}
                >
                  {scoreData.is_pass ? (
                    <>
                      <Check className="w-3 h-3 mr-1 inline" />
                      PASS
                    </>
                  ) : (
                    <>
                      <X className="w-3 h-3 mr-1 inline" />
                      FAIL
                    </>
                  )}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Card className="sticky bottom-6 border-slate-300 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">
                {isComplete 
                  ? 'All questions answered! Ready to submit.' 
                  : `${totalQuestions - answeredCount} question${totalQuestions - answeredCount === 1 ? '' : 's'} remaining`}
              </p>
              {isComplete && (
                <p className="text-xs text-slate-500 mt-1">
                  Score: {scoreData.normalized}/100 • {scoreData.is_pass ? 'PASS' : 'FAIL'} (threshold: {passThreshold})
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                disabled={!isComplete}
                onClick={handleExportToCSV}
              >
                <Download className="w-5 h-5 mr-2" />
                Export to CSV
              </Button>
              <Button
                size="lg"
                disabled={!isComplete}
                onClick={handleSubmit}
                className="bg-slate-900 hover:bg-slate-800"
              >
                <Check className="w-5 h-5 mr-2" />
                Submit Scorecard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
