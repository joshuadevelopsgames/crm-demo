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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format } from 'date-fns';
import { exportAndDownloadScorecard } from '../utils/exportToCSV';

export default function TakeScorecard() {
  const urlParams = new URLSearchParams(window.location.search);
  const accountId = urlParams.get('accountId');

  const navigate = useNavigate();
  const [answers, setAnswers] = useState({});
  const [scorecardDate, setScorecardDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();

  // Always use the current ICP template
  const { data: activeTemplate, isLoading: templateLoading, error: templateError } = useQuery({
    queryKey: ['icp-template'],
    queryFn: async () => {
      const icpTemplate = await base44.entities.ScorecardTemplate.getCurrentICP();
      if (!icpTemplate) {
        throw new Error('ICP template not found. Please create an ICP template on the Scoring page.');
      }
      return icpTemplate;
    },
    enabled: !!accountId
  });

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
      const section = question.section || question.category || 'Other';
      // Filter out "Win Rate" section
      if (section === 'Win Rate') return;
      
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
      // Store template_version_id to track which version of the ICP was used
      const scorecardData = {
        account_id: accountId,
        template_id: activeTemplate?.id || null,
        template_name: activeTemplate?.name || 'ICP Scorecard',
        responses: data.responses || [],
        section_scores: data.section_scores || {},
        total_score: totalScore,
        normalized_score: normalizedScore,
        is_pass: data.is_pass || false,
        scorecard_date: scorecardDate,
        completed_by: user.email,
        completed_date: new Date().toISOString(),
        scorecard_type: 'manual'
      };
      
      // Only include template_version_id if we have a template ID (column may not exist in all databases)
      if (activeTemplate?.id) {
        scorecardData.template_version_id = activeTemplate.id;
      }
      
      const scorecardResponse = await base44.entities.ScorecardResponse.create(scorecardData);
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

  const handleMultiSelectChange = (questionIndex, optionValue, checked) => {
    const currentAnswer = answers[questionIndex] || [];
    const answerArray = Array.isArray(currentAnswer) ? currentAnswer : [];
    const newAnswer = checked
      ? [...answerArray, optionValue]
      : answerArray.filter(v => v !== optionValue);
    setAnswers({
      ...answers,
      [questionIndex]: newAnswer
    });
  };

  const handleSingleSelectChange = (questionIndex, value) => {
    setAnswers({
      ...answers,
      [questionIndex]: value
    });
  };

  const calculateScore = () => {
    if (!activeTemplate?.questions || activeTemplate.questions.length === 0) {
      return { total: 0, normalized: 0, responses: [], section_scores: {}, is_pass: false };
    }

    // Filter out "Win Rate" section questions
    const validQuestions = activeTemplate.questions.filter((q, index) => {
      const section = q.section || q.category || 'Other';
      return section !== 'Win Rate';
    });

    const responses = activeTemplate.questions
      .map((question, index) => {
        const section = question.section || question.category || 'Other';
        // Skip "Win Rate" section
        if (section === 'Win Rate') return null;
        
        let answer = answers[index];
        let weightedScore = 0;
        
        // Handle different answer types
        if (question.answer_type === 'multi_select') {
          // For multi-select, score is weight * number of selected options
          const selectedCount = Array.isArray(answer) ? answer.length : 0;
          answer = selectedCount; // Store count for response
          weightedScore = selectedCount * question.weight;
        } else if (question.answer_type === 'single_select') {
          // For single-select, score is weight if selected (1) or 0 if not
          answer = answer ? 1 : 0;
          weightedScore = answer * question.weight;
        } else {
          // Numeric answers (yes_no, scale_1_5, scale_1_10)
          answer = answer || 0;
          weightedScore = answer * question.weight;
        }
        
        return {
          question_text: question.question_text,
          answer: answer,
          weight: question.weight,
          weighted_score: weightedScore,
          section: section
        };
      })
      .filter(r => r !== null);

    // Calculate section sub-totals
    const sectionScores = {};
    Object.keys(questionsBySection).forEach(section => {
      const sectionQuestions = questionsBySection[section];
      sectionScores[section] = sectionQuestions.reduce((sum, q) => {
        const answer = answers[q.originalIndex] || 0;
        return sum + (answer * q.weight);
      }, 0);
    });

    // Total score should be the sum of all section scores (sub-totals)
    const totalScore = Object.values(sectionScores).reduce((sum, sectionScore) => {
      const score = Number(sectionScore) || 0;
      return sum + score;
    }, 0);
    
    // Calculate total possible score excluding "Win Rate" section
    // This ensures normalized score is calculated correctly
    const totalPossibleScore = activeTemplate.questions
      .filter((q) => {
        const section = q.section || q.category || 'Other';
        return section !== 'Win Rate';
      })
      .reduce((sum, q) => {
        const maxAnswer = q.answer_type === 'yes_no' ? 1 : 
                         q.answer_type === 'scale_1_5' ? 5 : 
                         q.answer_type === 'scale_1_10' ? 10 :
                         q.answer_type === 'single_select' ? 
                           (q.options?.reduce((max, opt) => {
                             const weight = typeof opt === 'string' ? 1 : (opt?.weight || 1);
                             return Math.max(max, weight);
                           }, 1) || 1) :
                         q.answer_type === 'multi_select' ? 
                           (q.options?.reduce((sum, opt) => {
                             const weight = typeof opt === 'string' ? 1 : (opt?.weight || 1);
                             return sum + weight;
                           }, 0) || 1) : 1;
        return sum + (q.weight * maxAnswer);
      }, 0);
    
    // Debug logging
    console.log('📊 Score Calculation:', {
      sectionScores,
      totalScore,
      totalPossibleScore,
      sectionCount: Object.keys(sectionScores).length,
      originalTotalPossible: activeTemplate.total_possible_score
    });
    
    const normalizedScore = totalPossibleScore > 0 
      ? Math.round((totalScore / totalPossibleScore) * 100)
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

  // Filter out "Win Rate" questions for counting
  const validQuestionsForCounting = activeTemplate?.questions?.filter((q, index) => {
    const section = q.section || q.category || 'Other';
    return section !== 'Win Rate';
  }) || [];
  
  const isComplete = validQuestionsForCounting.every((q, index) => {
    const originalIndex = activeTemplate.questions.indexOf(q);
    if (q.answer_type === 'multi_select') {
      return Array.isArray(answers[originalIndex]) && answers[originalIndex].length > 0;
    }
    return answers[originalIndex] !== undefined && answers[originalIndex] !== null && answers[originalIndex] !== '';
  });
  const answeredCount = validQuestionsForCounting.filter((q) => {
    const originalIndex = activeTemplate.questions.indexOf(q);
    if (q.answer_type === 'multi_select') {
      return Array.isArray(answers[originalIndex]) && answers[originalIndex].length > 0;
    }
    return answers[originalIndex] !== undefined && answers[originalIndex] !== null && answers[originalIndex] !== '';
  }).length;
  const totalQuestions = validQuestionsForCounting.length;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
  const scoreData = calculateScore();
  const passThreshold = activeTemplate?.pass_threshold || 70;

  // Show loading state while fetching
  if (templateLoading || accountLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-slate-100 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading scorecard...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (templateError) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">ICP Template Not Found</h3>
        <p className="text-slate-600 dark:text-slate-400 mb-4">{templateError.message || 'Please create an ICP template on the Scoring page.'}</p>
        <div className="flex gap-2 justify-center">
          <Link to={createPageUrl(`AccountDetail?id=${accountId}`)}>
            <Button variant="outline">Back to Account</Button>
          </Link>
        <Link to={createPageUrl('Scoring')}>
            <Button>Go to Scoring Page</Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (accountError || !account) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">Account not found</h3>
        <p className="text-slate-600 dark:text-slate-400 mb-4">Unable to load the account</p>
        <Link to={createPageUrl('Accounts')}>
          <Button>Back to Accounts</Button>
        </Link>
      </Card>
    );
  }

  if (!activeTemplate) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">ICP Template Not Found</h3>
        <p className="text-slate-600 dark:text-slate-400 mb-4">Please create an ICP template on the Scoring page.</p>
        <div className="flex gap-2 justify-center">
          <Link to={createPageUrl(`AccountDetail?id=${accountId}`)}>
            <Button variant="outline">Back to Account</Button>
          </Link>
          <Link to={createPageUrl('Scoring')}>
            <Button>Go to Scoring Page</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const getAnswerOptions = (answerType, questionOptions) => {
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
    } else if (answerType === 'single_select' || answerType === 'multi_select') {
      // Return options from question.options array, handling both string and object formats
      return (questionOptions || []).map((opt, idx) => {
        if (typeof opt === 'string') {
          // Legacy format: just text
          return { value: opt, label: opt, weight: 1 };
        } else {
          // New format: object with text and weight
          return { 
            value: opt.text || opt, 
            label: opt.text || opt, 
            weight: opt.weight || 1 
          };
        }
      });
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
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{activeTemplate?.name || 'Custom Scorecard'}</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">For: {account.name}</p>
            {activeTemplate?.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{activeTemplate.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-2">
              <Label className="text-sm">Date:</Label>
              <Input
                type="date"
                value={scorecardDate}
                readOnly
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
              <span className="text-slate-600 dark:text-slate-400">Progress</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Scorecard Form - Grouped by Section (Google Sheet style) */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Header Row - Table Style */}
          <div className="grid grid-cols-12 gap-2 p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-semibold text-sm text-slate-900 dark:text-slate-100">
            <div className="col-span-4">Scorecard</div>
            <div className="col-span-6">Data</div>
            <div className="col-span-2 text-right">Score</div>
          </div>

          {/* Date and Score Summary */}
          <div className="grid grid-cols-12 gap-2 p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            <div className="col-span-4 font-medium">Date:</div>
            <div className="col-span-6">
              {(() => {
                if (!scorecardDate) return '—';
                const date = new Date(scorecardDate);
                if (isNaN(date.getTime())) return '—';
                try {
                  return format(date, 'MMMM d, yyyy');
                } catch (error) {
                  console.error('Error formatting date:', error, 'scorecardDate:', scorecardDate);
                  return scorecardDate || '—';
                }
              })()}
            </div>
            <div className="col-span-2 text-right font-bold text-lg">
              {scoreData.normalized > 0 ? scoreData.normalized : '—'}
            </div>
          </div>

          {/* Questions grouped by section */}
          {Object.keys(questionsBySection).length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                No questions found in this ICP template. Please add questions on the Scoring page.
              </p>
              <div className="flex gap-2 justify-center">
                <Link to={createPageUrl(`AccountDetail?id=${accountId}`)}>
                  <Button variant="outline">Back to Account</Button>
                </Link>
                <Link to={createPageUrl('Scoring')}>
                  <Button>Go to Scoring Page</Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
          {Object.entries(questionsBySection).map(([section, questions]) => {
            const sectionScore = scoreData.section_scores[section] || 0;
            const sectionAnswered = questions.every(q => answers[q.originalIndex] !== undefined);
            
            return (
              <div key={section} className="border-b border-slate-200 dark:border-slate-700">
                {/* Section Header */}
                <div className="grid grid-cols-12 gap-2 p-4 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-slate-100">
                  <div className="col-span-10">{section}</div>
                  <div className="col-span-2 text-right">
                    {sectionAnswered ? (
                      <span className="font-bold">{sectionScore}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </div>
                </div>

                {/* Questions in this section */}
                {questions.map((question, qIndex) => {
                  const questionIndex = question.originalIndex;
                  const options = getAnswerOptions(question.answer_type, question.options);
                  const isAnswered = question.answer_type === 'multi_select' 
                    ? Array.isArray(answers[questionIndex]) && answers[questionIndex].length > 0
                    : answers[questionIndex] !== undefined && answers[questionIndex] !== null && answers[questionIndex] !== '';
                  const answer = answers[questionIndex];
                  // Calculate weighted score based on answer type
                  let weightedScore = 0;
                  if (question.answer_type === 'multi_select') {
                    // Sum the weights of selected options, then multiply by question weight
                    const selectedOptions = Array.isArray(answer) ? answer : [];
                    const selectedWeights = selectedOptions.reduce((sum, selectedValue) => {
                      const option = options.find(opt => opt.value === selectedValue);
                      return sum + (option?.weight || 1);
                    }, 0);
                    weightedScore = selectedWeights * question.weight;
                  } else if (question.answer_type === 'single_select') {
                    // Use the weight of the selected option, then multiply by question weight
                    const selectedOption = options.find(opt => opt.value === answer);
                    const optionWeight = selectedOption?.weight || 0;
                    weightedScore = optionWeight * question.weight;
                  } else {
                    weightedScore = isAnswered ? (answer || 0) * question.weight : 0;
                  }

                  return (
                    <div 
                      key={questionIndex} 
                      className={`grid grid-cols-12 gap-2 p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                        isAnswered ? 'bg-emerald-50/30 dark:bg-emerald-900/20' : ''
                      }`}
                    >
                      {/* Question Text */}
                      <div className="col-span-4 text-sm font-medium text-slate-900 dark:text-slate-100">
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
                        {question.answer_type === 'single_select' && (
                          <Select
                            value={answer || ''}
                            onValueChange={(value) => handleSingleSelectChange(questionIndex, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select an option..." />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {question.answer_type === 'multi_select' && (
                          <div className="space-y-2">
                            {options.map((option) => {
                              const isChecked = Array.isArray(answer) && answer.includes(option.value);
                              return (
                                <div key={option.value} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`q${questionIndex}-${option.value}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => 
                                      handleMultiSelectChange(questionIndex, option.value, checked)
                                    }
                                  />
                                  <Label
                                    htmlFor={`q${questionIndex}-${option.value}`}
                                    className="cursor-pointer text-sm font-normal"
                                  >
                                    {option.label}
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
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
                                    className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 peer-data-[state=checked]:border-emerald-600 dark:peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 dark:peer-data-[state=checked]:bg-emerald-900/30 cursor-pointer transition-all text-sm font-medium text-slate-900 dark:text-slate-100 ${
                                      isAnswered && answer === option.value ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : ''
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
                          <span className="font-medium text-slate-900 dark:text-slate-100">{weightedScore}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Section Sub-total */}
                <div className="grid grid-cols-12 gap-2 p-4 bg-slate-50 dark:bg-slate-800/50 font-semibold border-t-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                  <div className="col-span-10">Sub-total</div>
                  <div className="col-span-2 text-right">
                    {sectionAnswered ? (
                      <span className="font-bold text-lg">{sectionScore}</span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
            </>
          )}

          {/* Total Score and Pass/Fail */}
          <div className="grid grid-cols-12 gap-2 p-6 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border-t-4 border-slate-900 dark:border-slate-100">
            <div className="col-span-10">
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">Total Score</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Pass Threshold: {passThreshold} / 100
              </div>
            </div>
            <div className="col-span-2 text-right">
              <div className="text-3xl font-bold mb-2 text-slate-900 dark:text-slate-100">
                {scoreData.total > 0 ? scoreData.total : '—'}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                ({scoreData.normalized}% normalized)
              </div>
              {isComplete && (
                <Badge 
                  className={`text-sm px-3 py-1 ${
                    scoreData.is_pass 
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700' 
                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700'
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
      <Card className="sticky bottom-6 border-slate-300 dark:border-slate-700 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isComplete 
                  ? 'All questions answered! Ready to submit.' 
                  : `${totalQuestions - answeredCount} question${totalQuestions - answeredCount === 1 ? '' : 's'} remaining`}
              </p>
              {isComplete && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
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
                disabled={!isComplete || submitScorecardMutation.isPending}
                onClick={handleSubmit}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
              >
                {submitScorecardMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white dark:border-slate-900 mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Submit Scorecard
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
