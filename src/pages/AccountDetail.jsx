import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Plus,
  Mail,
  Phone,
  Calendar,
  Edit,
  FileText,
  Lightbulb,
  BookOpen,
  BellOff
} from 'lucide-react';
import { format } from 'date-fns';
import InteractionTimeline from '../components/account/InteractionTimeline';
import ContactsList from '../components/account/ContactsList';
import AccountScore from '../components/account/AccountScore';
import SalesInsights from '../components/account/SalesInsights';
import ResearchNotes from '../components/account/ResearchNotes';
import KeyDates from '../components/account/KeyDates';
import EstimatesStats from '../components/account/EstimatesStats';
import TotalWork from '../components/account/TotalWork';
import GeneralInformation from '../components/account/GeneralInformation';
import TrackingAssignment from '../components/account/TrackingAssignment';
import AccountTags from '../components/account/AccountTags';
import AccountNotes from '../components/account/AccountNotes';
import EstimatesTab from '../components/account/EstimatesTab';
import JobsitesTab from '../components/account/JobsitesTab';
import AddInteractionDialog from '../components/account/AddInteractionDialog';
import EditAccountDialog from '../components/account/EditAccountDialog';
import TutorialTooltip from '../components/TutorialTooltip';
import GmailConnection from '../components/GmailConnection';
import SnoozeDialog from '../components/SnoozeDialog';

export default function AccountDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const accountId = urlParams.get('id');
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [showEditAccount, setShowEditAccount] = useState(false);
  const [showSnoozeDialog, setShowSnoozeDialog] = useState(false);

  const queryClient = useQueryClient();

  const { data: account, isLoading } = useQuery({
    queryKey: ['account', accountId],
    queryFn: async () => {
      const accounts = await base44.entities.Account.list();
      return accounts.find(a => a.id === accountId);
    },
    enabled: !!accountId
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', accountId],
    queryFn: () => base44.entities.Contact.filter({ account_id: accountId })
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ['interactions', accountId],
    queryFn: () => base44.entities.Interaction.filter({ account_id: accountId }, '-interaction_date')
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', accountId],
    queryFn: () => base44.entities.Task.filter({ related_account_id: accountId })
  });

  const { data: scorecards = [] } = useQuery({
    queryKey: ['scorecards', accountId],
    queryFn: () => base44.entities.ScorecardResponse.filter({ account_id: accountId }, '-completed_date')
  });

  // Check if account has any completed scorecards
  const hasCompletedScorecard = scorecards.some(sc => sc.completed_date);

  const { data: salesInsights = [] } = useQuery({
    queryKey: ['sales-insights', accountId],
    queryFn: () => base44.entities.SalesInsight.filter({ account_id: accountId }, '-recorded_date')
  });

  const { data: researchNotes = [] } = useQuery({
    queryKey: ['research-notes', accountId],
    queryFn: () => base44.entities.ResearchNote.filter({ account_id: accountId }, '-recorded_date')
  });

  // Fetch estimates for this account (server-side filtering for accuracy)
  const { data: estimates = [] } = useQuery({
    queryKey: ['estimates', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      // Use server-side filtering for accurate results
      const response = await fetch(`/api/data/estimates?account_id=${encodeURIComponent(accountId)}`);
      if (!response.ok) return [];
      const result = await response.json();
      if (result.success) {
        return result.data || [];
      }
      return [];
    },
    enabled: !!accountId && !!account
  });

  // Fetch jobsites for this account (server-side filtering for accuracy)
  const { data: jobsites = [] } = useQuery({
    queryKey: ['jobsites', accountId],
    queryFn: async () => {
      if (!accountId) return [];
      // Use server-side filtering for accurate results
      const response = await fetch(`/api/data/jobsites?account_id=${encodeURIComponent(accountId)}`);
      if (!response.ok) return [];
      const result = await response.json();
      if (result.success) {
        return result.data || [];
      }
      return [];
    },
    enabled: !!accountId && !!account
  });

  // Handle account updates
  const updateAccountMutation = useMutation({
    mutationFn: (data) => base44.entities.Account.update(accountId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', accountId] });
    }
  });

  if (isLoading || !account) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-white"></div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-emerald-100 text-emerald-800',
      at_risk: 'bg-red-100 text-red-800',
      negotiating: 'bg-blue-100 text-blue-800',
      onboarding: 'bg-purple-100 text-purple-800',
      churned: 'bg-slate-100 text-slate-600'
    };
    return colors[status] || colors.active;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <TutorialTooltip
        tip="Complete account information hub. View all interactions (calls, emails, meetings) with a timeline, manage contacts at this company, see organization scorecard breakdowns, review sales insights and revenue data, and add research notes. Use tabs to navigate sections. Log new interactions to track your relationship, update the scorecard to reflect changes, and add notes to remember important details. This is your single source of truth for each account."
        step={3}
        position="bottom"
      >
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-[#ffffff]">{account.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className={getStatusColor(account.status)}>
                {account.status}
              </Badge>
              <Badge variant="outline" className="text-slate-700 dark:text-slate-300">
                {account.account_type}
              </Badge>
              {account.revenue_segment && (
                <Badge variant="outline" className="text-slate-700 dark:text-slate-300">
                  {account.revenue_segment}
                </Badge>
              )}
              <Badge variant="outline" className="text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-mono text-xs">
                ID: {account.id}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          {account.snoozed_until && new Date(account.snoozed_until) > new Date() && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
              Snoozed until {format(new Date(account.snoozed_until), 'MMM d, yyyy')}
            </Badge>
          )}
          <Button 
            variant="outline" 
            onClick={() => setShowSnoozeDialog(true)}
            className="text-amber-700 hover:text-amber-900 hover:bg-amber-50"
          >
            <BellOff className="w-4 h-4 mr-2" />
            Snooze
          </Button>
          <Button variant="outline" onClick={() => setShowEditAccount(true)} className="border-slate-300">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button onClick={() => setShowAddInteraction(true)} variant="outline" className="border-slate-300">
            <Plus className="w-4 h-4 mr-2" />
            Log Interaction
          </Button>
        </div>
      </div>

      {/* Tabs - LMN Style */}
      <Tabs defaultValue="info" className="space-y-6">
        <TabsList className="w-full justify-start bg-white dark:bg-surface-1 border-b dark:border-border rounded-none h-auto p-0 space-x-0">
          <TabsTrigger 
            value="info" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-white data-[state=active]:bg-transparent px-6 py-3"
          >
            Info
          </TabsTrigger>
          <TabsTrigger 
            value="contacts"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-white data-[state=active]:bg-transparent px-6 py-3"
          >
            Contacts
          </TabsTrigger>
          <TabsTrigger 
            value="jobsites"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-white data-[state=active]:bg-transparent px-6 py-3"
          >
            Jobsites
          </TabsTrigger>
          <TabsTrigger 
            value="estimates"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-white data-[state=active]:bg-transparent px-6 py-3"
          >
            Estimates
          </TabsTrigger>
          <TabsTrigger 
            value="communications"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-white data-[state=active]:bg-transparent px-6 py-3"
          >
            Communication History
          </TabsTrigger>
          <TabsTrigger 
            value="todos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-white data-[state=active]:bg-transparent px-6 py-3"
          >
            To-Dos
          </TabsTrigger>
          <TabsTrigger 
            value="files"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 dark:data-[state=active]:border-white data-[state=active]:bg-transparent px-6 py-3"
          >
            Files
          </TabsTrigger>
        </TabsList>

        {/* Info Tab - LMN Style Overview */}
        <TabsContent value="info" className="space-y-6 mt-6">
          {/* Top Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <KeyDates account={account} />
            <EstimatesStats estimates={estimates} />
            <TotalWork estimates={estimates} />
          </div>

          {/* General Information and Tracking */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GeneralInformation 
              account={account} 
              onUpdate={(data) => updateAccountMutation.mutate(data)}
            />
            <div className="space-y-6">
              <TrackingAssignment 
                account={account}
                onUpdate={(data) => updateAccountMutation.mutate(data)}
              />
              <AccountTags 
                tags={account.tags || []}
                onUpdateTags={(tags) => updateAccountMutation.mutate({ tags })}
              />
            </div>
          </div>

          {/* Organization Score Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Organization Score</CardTitle>
                <Badge className="bg-emerald-100 text-emerald-800">
                  {hasCompletedScorecard && account.organization_score !== null && account.organization_score !== undefined 
                    ? account.organization_score 
                    : '—'} / 100
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <AccountScore 
                accountId={accountId}
                scorecards={scorecards}
                currentScore={hasCompletedScorecard ? account.organization_score : null}
                accountName={account.name}
                account={account}
                compact={true}
              />
            </CardContent>
          </Card>

          {/* Account Notes */}
          <AccountNotes account={account} />
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <ContactsList 
            contacts={contacts} 
            accountId={accountId}
            accountName={account.name}
          />
        </TabsContent>

        {/* Jobsites Tab */}
        <TabsContent value="jobsites">
          <JobsitesTab jobsites={jobsites} accountId={accountId} />
        </TabsContent>

        {/* Estimates Tab */}
        <TabsContent value="estimates">
          <EstimatesTab estimates={estimates} accountId={accountId} />
        </TabsContent>

        {/* Communication History Tab (formerly Interactions) */}
        <TabsContent value="communications" className="space-y-6">
          <GmailConnection 
            onSyncComplete={(result) => {
              queryClient.invalidateQueries({ queryKey: ['interactions', accountId] });
              queryClient.invalidateQueries({ queryKey: ['account', accountId] });
            }}
          />
          <InteractionTimeline 
            interactions={interactions} 
            accountId={accountId}
            contacts={contacts}
          />
        </TabsContent>

        {/* To-Dos Tab (formerly Tasks) */}
        <TabsContent value="todos" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-[#ffffff]">To-Dos ({tasks.length})</h3>
            <Button variant="outline" className="border-slate-300">
              <Plus className="w-4 h-4 mr-2" />
              New To-Do
            </Button>
          </div>
          
          {tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map(task => (
                <Card key={task.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-[#ffffff]">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{task.description}</p>
                      )}
                      {task.due_date && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                    <Badge className={
                      task.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                      task.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }>
                      {task.status}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">No to-dos for this account</p>
            </Card>
          )}
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files">
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-[#ffffff] mb-1">No files yet</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Upload documents, images, or other files related to this account
            </p>
            <Button variant="outline" className="border-slate-300">
              <Plus className="w-4 h-4 mr-2" />
              Upload File
            </Button>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Dialogs */}
      <AddInteractionDialog
        open={showAddInteraction}
        onClose={() => setShowAddInteraction(false)}
        accountId={accountId}
        contacts={contacts}
      />

      <EditAccountDialog
        open={showEditAccount}
        onClose={() => setShowEditAccount(false)}
        account={account}
      />

      {/* Snooze Dialog */}
      {showSnoozeDialog && (
        <SnoozeDialog
          account={account}
          open={showSnoozeDialog}
          onOpenChange={setShowSnoozeDialog}
          onSnooze={(account, duration, unit) => {
            const now = new Date();
            let snoozedUntil;
            
            switch (unit) {
              case 'days':
                snoozedUntil = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
                break;
              case 'weeks':
                snoozedUntil = new Date(now.getTime() + duration * 7 * 24 * 60 * 60 * 1000);
                break;
              case 'months':
                snoozedUntil = new Date(now.getFullYear(), now.getMonth() + duration, now.getDate());
                break;
              case 'years':
                snoozedUntil = new Date(now.getFullYear() + duration, now.getMonth(), now.getDate());
                break;
              default:
                return;
            }
            
            updateAccountMutation.mutate({
              id: account.id,
              snoozed_until: snoozedUntil.toISOString()
            });
            setShowSnoozeDialog(false);
          }}
        />
      )}
      </TutorialTooltip>
    </div>
  );
}

