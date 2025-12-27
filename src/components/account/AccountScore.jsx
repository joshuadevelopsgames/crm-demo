import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Award, Plus, Check, X, Download, Sparkles, FileText, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { exportAndDownloadScorecard } from '../../utils/exportToCSV';
import { useUser } from '../../contexts/UserContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import toast from 'react-hot-toast';

export default function AccountScore({ accountId, scorecards, currentScore, accountName, account }) {
  const [expandedScorecards, setExpandedScorecards] = useState({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scorecardToDelete, setScorecardToDelete] = useState(null);
  const { canManageICP, isAdmin } = useUser();
  const queryClient = useQueryClient();
  
  // Check if account has ICP status = 'na' (should hide ICP section)
  const isICPNA = account && account.icp_status === 'na';
  
  // Get current ICP template
  const { data: icpTemplate, isLoading: icpLoading } = useQuery({
    queryKey: ['icp-template'],
    queryFn: () => base44.entities.ScorecardTemplate.getCurrentICP()
  });
  
  // Get all templates for export (including versions)
  const { data: allTemplates = [] } = useQuery({
    queryKey: ['scorecard-templates'],
    queryFn: () => base44.entities.ScorecardTemplate.list(true) // Include versions
  });

  // Delete scorecard mutation
  const deleteScorecardMutation = useMutation({
    mutationFn: (id) => base44.entities.ScorecardResponse.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecards'] });
      queryClient.invalidateQueries({ queryKey: ['scorecard', accountId] });
      setDeleteDialogOpen(false);
      setScorecardToDelete(null);
      toast.success('✓ Scorecard deleted');
    },
    onError: (error) => {
      console.error('Error deleting scorecard:', error);
      toast.error(error.message || 'Failed to delete scorecard');
    }
  });

  const handleDeleteClick = (scorecard) => {
    setScorecardToDelete(scorecard);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (scorecardToDelete) {
      deleteScorecardMutation.mutate(scorecardToDelete.id);
    }
  };

  // All scorecards are now per-client (manual)
  // Show the most recent scorecard as the current score
  const mostRecentScorecard = scorecards.length > 0 
    ? scorecards.sort((a, b) => {
        const dateA = new Date(a.completed_date || a.scorecard_date || 0);
        const dateB = new Date(b.completed_date || b.scorecard_date || 0);
        return dateB - dateA;
      })[0]
    : null;

  return (
    <div className="space-y-6">
      {/* Current Score (from most recent scorecard) */}
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Current Organization Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-6xl font-bold text-emerald-600">
              {mostRecentScorecard?.normalized_score !== null && mostRecentScorecard?.normalized_score !== undefined 
                ? mostRecentScorecard.normalized_score 
                : '—'}
            </div>
            <div className="text-slate-600 dark:text-slate-400">
              <p className="text-sm">Out of 100</p>
              <p className="text-xs mt-1">
                {mostRecentScorecard
                  ? `Last updated ${format(new Date(mostRecentScorecard.completed_date || mostRecentScorecard.scorecard_date), 'MMM d, yyyy')}`
                  : 'No scorecards completed yet'}
              </p>
              {mostRecentScorecard && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Based on: {mostRecentScorecard.template_name || 'Custom Scorecard'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Complete ICP Scorecard - Hide if N/A */}
      {!isICPNA && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">ICP Scorecard</h3>
            {canManageICP && (
              <Link to={createPageUrl('Scoring')}>
                <Button variant="outline" size="sm">
                  Manage ICP Template
                </Button>
              </Link>
            )}
          </div>
          
          {icpLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">Loading ICP template...</p>
            </CardContent>
          </Card>
        ) : !icpTemplate ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Award className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No ICP Template</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                {canManageICP 
                  ? 'Create an ICP template on the Scoring page to start scoring accounts'
                  : 'Contact your administrator to set up an ICP template'}
              </p>
              {canManageICP && (
                <Link to={createPageUrl('Scoring')}>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create ICP Template
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
                <CardContent className="p-5">
              <div className="flex items-center justify-between">
                    <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">{icpTemplate.name}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{icpTemplate.description || 'Ideal Customer Profile scoring'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Version {icpTemplate.version_number || 1} • {icpTemplate.questions?.length || 0} questions
                  </p>
                    </div>
                <Link to={createPageUrl(`TakeScorecard?accountId=${accountId}`)}>
                  <Button>
                    <FileText className="w-4 h-4 mr-2" />
                    Complete ICP Scorecard
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
          )}
        </div>
      )}
      
      {/* Show message if ICP is N/A */}
      {isICPNA && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                ICP Status: N/A
              </Badge>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                This account is marked as N/A and is excluded from ICP scoring requirements.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scorecard History */}
      {scorecards.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Scorecard History</h3>
          <div className="space-y-3">
            {scorecards.sort((a, b) => {
              const dateA = new Date(a.completed_date || a.scorecard_date || 0);
              const dateB = new Date(b.completed_date || b.scorecard_date || 0);
              return dateB - dateA;
            }).map(scorecard => {
              const isPass = scorecard.is_pass || (scorecard.normalized_score >= 70); // Default threshold
              const scorecardDate = scorecard.scorecard_date 
                ? format(new Date(scorecard.scorecard_date), 'MMM d, yyyy')
                : format(new Date(scorecard.completed_date), 'MMM d, yyyy');
              
              const handleExport = () => {
                // Find the template by version ID or name
                const template = scorecard.template_version_id 
                  ? allTemplates.find(t => t.id === scorecard.template_version_id)
                  : allTemplates.find(t => t.name === scorecard.template_name && t.is_current_version);
                if (template) {
                  exportAndDownloadScorecard(scorecard, template, { name: accountName || 'Account' });
                }
              };
              
              const isExpanded = expandedScorecards[scorecard.id];
              const toggleExpand = () => {
                setExpandedScorecards(prev => ({
                  ...prev,
                  [scorecard.id]: !prev[scorecard.id]
                }));
              };
              
              // Find the template version used for this scorecard
              const templateVersion = scorecard.template_version_id 
                ? allTemplates.find(t => t.id === scorecard.template_version_id)
                : null;
              
              return (
                <Card key={scorecard.id} className={isPass ? 'border-emerald-200' : 'border-red-200'}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-slate-900 dark:text-white">{scorecard.template_name || 'Custom Scorecard'}</h4>
                          <Badge 
                            className={isPass 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                              : 'bg-red-100 text-red-800 border-red-200'
                            }
                          >
                            {isPass ? (
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
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Date: {scorecardDate} • Completed by {scorecard.completed_by}
                        </p>
                        {templateVersion && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            ICP Template Version {templateVersion.version_number || 1}
                          </p>
                        )}
                        {scorecard.section_scores && Object.keys(scorecard.section_scores).length > 0 && (
                          <>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(scorecard.section_scores).map(([section, score]) => (
                              <Badge key={section} variant="outline" className="text-xs">
                                {section}: {score}
                              </Badge>
                            ))}
                          </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={toggleExpand}
                              className="mt-2 text-xs"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3 h-3 mr-1" />
                                  Hide Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3 mr-1" />
                                  Show Details
                                </>
                              )}
                            </Button>
                            {isExpanded && (
                              <div className="mt-3 space-y-3">
                                {/* Template Version Details */}
                                {templateVersion && (
                                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Template Version Details:</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">
                                      Version {templateVersion.version_number} • Created {format(new Date(templateVersion.created_at), 'MMM d, yyyy')}
                                    </p>
                                    {templateVersion.description && (
                                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{templateVersion.description}</p>
                                    )}
                                  </div>
                                )}
                                
                                {/* Questions and Answers */}
                                {scorecard.responses && scorecard.responses.length > 0 && (
                                  <div className="space-y-3">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Questions & Answers:</p>
                                    
                                    {/* Group responses by section */}
                                    {(() => {
                                      const responsesBySection = {};
                                      scorecard.responses.forEach(response => {
                                        const section = response.section || 'Other';
                                        if (!responsesBySection[section]) {
                                          responsesBySection[section] = [];
                                        }
                                        responsesBySection[section].push(response);
                                      });
                                      
                                      return Object.entries(responsesBySection).map(([section, responses]) => (
                                        <div key={section} className="border border-slate-200 rounded-lg overflow-hidden">
                                          {/* Section Header */}
                                          <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                                            <div className="flex items-center justify-between">
                                              <span className="text-sm font-semibold text-slate-900 dark:text-white">{section}</span>
                                              {scorecard.section_scores && scorecard.section_scores[section] !== undefined && (
                                                <Badge variant="outline" className="text-xs">
                                                  Section Score: {scorecard.section_scores[section]}
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                          
                                          {/* Questions in this section */}
                                          <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                            {responses.map((response, idx) => {
                                              // Get answer text - prefer answer_text if available, otherwise map numeric answer
                                              let answerText;
                                              if (response.answer_text) {
                                                answerText = response.answer_text;
                                              } else if (response.answer === 0) {
                                                answerText = 'No';
                                              } else if (response.answer === 1) {
                                                // Could be "Yes" for yes_no or "1" for scale
                                                answerText = 'Yes / 1';
                                              } else {
                                                // For scale answers, just show the number
                                                answerText = response.answer?.toString() || '—';
                                              }
                                              
                                              // Determine badge color based on answer value
                                              const getBadgeColor = () => {
                                                if (response.answer_text) {
                                                  // For text answers, use neutral color
                                                  return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                                                }
                                                const numAnswer = response.answer || 0;
                                                if (numAnswer >= 4) return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
                                                if (numAnswer >= 3) return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
                                                if (numAnswer >= 2) return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
                                                if (numAnswer === 1) return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                                                return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'; // 0 or No
                                              };
                                              
                                              return (
                                                <div key={idx} className="px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                                                  <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-sm text-slate-900 dark:text-white font-medium mb-1">
                                                        {response.question_text}
                                                      </p>
                                                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                        <div className="flex items-center gap-1.5">
                                                          <span className="text-xs text-slate-600 dark:text-slate-400">Answer:</span>
                                                          <Badge 
                                                            variant="outline" 
                                                            className={`text-xs ${getBadgeColor()}`}
                                                          >
                                                            {answerText}
                                                          </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                          <span className="text-xs text-slate-600 dark:text-slate-400">Weight:</span>
                                                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{response.weight || 1}</span>
                                                        </div>
                                                      </div>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                                        {response.weighted_score || 0}
                                                      </div>
                                                      <div className="text-xs text-slate-500 dark:text-slate-400">points</div>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                )}
                                
                                {/* Fallback if no responses */}
                                {(!scorecard.responses || scorecard.responses.length === 0) && (
                                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-600 dark:text-slate-400">No question details available for this scorecard.</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`text-3xl font-bold ${isPass ? 'text-emerald-600' : 'text-red-600'}`}>
                            {scorecard.normalized_score}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">out of 100</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            title="Export to CSV"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(scorecard)}
                              title="Delete scorecard"
                              className="hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scorecard</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this scorecard submission? This action cannot be undone.
              {scorecardToDelete && (
                <div className="mt-2 text-sm">
                  <p className="font-medium">Scorecard Details:</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Date: {scorecardToDelete.scorecard_date 
                      ? format(new Date(scorecardToDelete.scorecard_date), 'MMM d, yyyy')
                      : format(new Date(scorecardToDelete.completed_date), 'MMM d, yyyy')}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Score: {scorecardToDelete.normalized_score} / 100
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setScorecardToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

