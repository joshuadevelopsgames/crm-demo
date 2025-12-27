import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronRight, 
  ChevronLeft, 
  Home, 
  Users, 
  CheckCircle2, 
  Building2,
  MessageSquare,
  TrendingUp,
  Lightbulb,
  BookOpen,
  ListTodo,
  PlayCircle,
  X,
  Bell,
  FileText,
  BarChart3,
  Settings,
  Repeat,
  Paperclip,
  MessageCircle,
  Lock,
  GitBranch,
  Calendar,
  Tag
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTutorial } from '../contexts/TutorialContext';

const tutorialSteps = [
  {
    id: 'welcome',
    title: 'Welcome to Your CRM!',
    description: 'Let\'s take a quick tour of the system',
    content: (
      <div className="space-y-4">
        <p className="text-lg">This CRM helps you manage customer relationships, track interactions, and score potential accounts.</p>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Card>
            <CardContent className="p-4 text-center">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="font-semibold">Accounts</p>
              <p className="text-sm text-slate-500">Track companies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="font-semibold">Contacts</p>
              <p className="text-sm text-slate-500">Manage people</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <p className="font-semibold">Scoring</p>
              <p className="text-sm text-slate-500">Rate accounts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <p className="font-semibold">Interactions</p>
              <p className="text-sm text-slate-500">Track touchpoints</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  },
  {
    id: 'dashboard',
    title: 'Dashboard - Your Command Center',
    description: 'Start here every day to see what needs attention',
    content: (
      <div className="space-y-4">
        <p>The Dashboard gives you an overview of your CRM health:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li><strong>Stats Cards</strong> - Active accounts, contacts, tasks, at-risk accounts</li>
          <li><strong>Alerts</strong> - Neglected accounts, upcoming renewals, overdue tasks</li>
          <li><strong>Active Sequences</strong> - Automated outreach in progress</li>
        </ul>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <p className="text-sm"><strong>💡 Tip:</strong> Click on alerts to jump directly to accounts or tasks that need attention.</p>
        </div>
      </div>
    ),
    action: {
      label: 'Go to Dashboard',
      route: '/dashboard'
    }
  },
  {
    id: 'accounts',
    title: 'Accounts - The Heart of Your CRM',
    description: 'Everything revolves around accounts (companies)',
    content: (
      <div className="space-y-4">
        <p>Accounts represent companies you're doing business with or pursuing.</p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Search & Filter</p>
              <p className="text-sm text-slate-600">Find accounts by name, type, status, or revenue segment</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Organization Score</p>
              <p className="text-sm text-slate-600">0-100 score helps prioritize accounts</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Click to View Details</p>
              <p className="text-sm text-slate-600">See full account information, interactions, contacts, and more</p>
            </div>
          </div>
        </div>
      </div>
    ),
    action: {
      label: 'View Accounts',
      route: '/accounts'
    }
  },
  {
    id: 'account-detail',
    title: 'Account Detail - Deep Dive',
    description: 'Everything about a specific account in one place',
    content: (
      <div className="space-y-4">
        <p>When you click an account, you'll see tabs for different information:</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Card>
            <CardContent className="p-3">
              <MessageSquare className="w-5 h-5 mb-2 text-blue-500" />
              <p className="font-semibold text-sm">Interactions</p>
              <p className="text-xs text-slate-500">Timeline of all touchpoints</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <Users className="w-5 h-5 mb-2 text-green-500" />
              <p className="font-semibold text-sm">Contacts</p>
              <p className="text-xs text-slate-500">People at this account</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <TrendingUp className="w-5 h-5 mb-2 text-purple-500" />
              <p className="font-semibold text-sm">Scoring</p>
              <p className="text-xs text-slate-500">Scorecards and history</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <Lightbulb className="w-5 h-5 mb-2 text-yellow-500" />
              <p className="font-semibold text-sm">Sales Insights</p>
              <p className="text-xs text-slate-500">Pain points & opportunities</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <BookOpen className="w-5 h-5 mb-2 text-indigo-500" />
              <p className="font-semibold text-sm">Research Notes</p>
              <p className="text-xs text-slate-500">Findings and sources</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  },
  {
    id: 'scoring',
    title: 'Scoring System - Rate Your Accounts',
    description: 'Use scorecards to evaluate prospects and track customer health',
    content: (
      <div className="space-y-4">
        <p>Scorecards help you objectively evaluate accounts at any stage:</p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold mb-2">For Prospects:</p>
          <p className="text-sm">Score potential clients before they become customers to prioritize your outreach (revenue not required yet).</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold mb-2">For Customers:</p>
          <p className="text-sm">Track ongoing account health with scorecards that include revenue data.</p>
        </div>
        <div className="space-y-3">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="font-semibold mb-2">How It Works:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Complete a scorecard with weighted questions</li>
              <li>Get a score (0-100) based on your answers</li>
              <li>See Pass/Fail status based on threshold</li>
              <li>Track score history over time</li>
            </ol>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">Sections</Badge>
            <p className="text-sm">Questions grouped by category (e.g., "Corporate Demographics")</p>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">Sub-totals</Badge>
            <p className="text-sm">See scores for each section</p>
          </div>
          <div className="flex items-start gap-3">
            <Badge variant="outline" className="mt-1">Export CSV</Badge>
            <p className="text-sm">Download to match your Google Sheet format</p>
          </div>
        </div>
      </div>
    ),
    action: {
      label: 'View Scoring',
      route: '/scoring'
    }
  },
  {
    id: 'interactions',
    title: 'Interactions - Track Every Touchpoint',
    description: 'Log all your communications with accounts',
    content: (
      <div className="space-y-4">
        <p>Keep a complete record of all interactions:</p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge>Email</Badge>
            <Badge>Call</Badge>
            <Badge>Meeting</Badge>
            <Badge>Note</Badge>
            <Badge>LinkedIn</Badge>
          </div>
          <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
            <li>Log interactions with date, type, and notes</li>
            <li>Track sentiment (positive, neutral, negative)</li>
            <li>Link to contacts involved</li>
            <li>View chronological timeline</li>
          </ul>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <p className="text-sm"><strong>💡 Tip:</strong> Regular interaction logging helps identify neglected accounts on the Dashboard.</p>
        </div>
      </div>
    )
  },
  {
    id: 'tasks',
    title: 'Tasks - Stay Organized',
    description: 'Powerful task management with attachments, comments, recurring tasks, and more',
    content: (
      <div className="space-y-4">
        <p>Tasks help you stay on top of follow-ups and actions with advanced features:</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="font-semibold mb-2">Status:</p>
            <div className="space-y-1">
              <Badge variant="outline">To Do</Badge>
              <Badge variant="outline" className="ml-2">In Progress</Badge>
              <Badge variant="outline" className="ml-2">Blocked</Badge>
              <Badge variant="outline" className="ml-2">Completed</Badge>
            </div>
          </div>
          <div>
            <p className="font-semibold mb-2">Priority:</p>
            <div className="space-y-1">
              <Badge variant="outline">Trivial</Badge>
              <Badge variant="outline" className="ml-2">Minor</Badge>
              <Badge variant="outline" className="ml-2">Normal</Badge>
              <Badge variant="outline" className="ml-2">Major</Badge>
              <Badge variant="outline" className="ml-2">Critical</Badge>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Paperclip className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-semibold">Attachments</p>
              <p className="text-sm text-slate-600">Upload files, images, and documents to tasks</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Comments</p>
              <p className="text-sm text-slate-600">Add comments and collaborate on tasks</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Repeat className="w-5 h-5 text-purple-500 mt-0.5" />
            <div>
              <p className="font-semibold">Recurring Tasks</p>
              <p className="text-sm text-slate-600">Set tasks to repeat daily, weekly, monthly, or yearly</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-orange-500 mt-0.5" />
            <div>
              <p className="font-semibold">Task Blocking</p>
              <p className="text-sm text-slate-600">Tasks from sequences are automatically blocked until previous tasks complete</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Tag className="w-5 h-5 text-pink-500 mt-0.5" />
            <div>
              <p className="font-semibold">Labels & Categories</p>
              <p className="text-sm text-slate-600">Organize tasks with custom labels and categories</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-indigo-500 mt-0.5" />
            <div>
              <p className="font-semibold">Due Dates & Times</p>
              <p className="text-sm text-slate-600">Set specific due dates and times for precise scheduling</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <p className="text-sm"><strong>💡 Tip:</strong> Tasks can be linked to accounts and contacts for better context. Use drag-and-drop to reorder tasks!</p>
        </div>
      </div>
    ),
    action: {
      label: 'View Tasks',
      route: '/tasks'
    }
  },
  {
    id: 'sequences',
    title: 'Sequences - Automate Outreach & Create Tasks',
    description: 'Create template sequences that automatically generate ordered, blocked tasks',
    content: (
      <div className="space-y-4">
        <p>Sequences automate your outreach and create task lists automatically:</p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <p className="font-semibold mb-2">Example Sequence:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Day 0: Initial email</li>
            <li>Day 3: Follow-up call</li>
            <li>Day 7: LinkedIn connection</li>
            <li>Day 14: Meeting request</li>
          </ol>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <GitBranch className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-semibold">Create Template Sequences</p>
              <p className="text-sm text-slate-600">Build reusable sequence templates with multiple steps</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ListTodo className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Automatic Task Creation</p>
              <p className="text-sm text-slate-600">When you enroll an account, tasks are created automatically from sequence steps</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-orange-500 mt-0.5" />
            <div>
              <p className="font-semibold">Ordered & Blocked</p>
              <p className="text-sm text-slate-600">Tasks are ordered and blocked - next task unlocks when previous completes</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-purple-500 mt-0.5" />
            <div>
              <p className="font-semibold">Smart Scheduling</p>
              <p className="text-sm text-slate-600">Due dates calculated from step delays (e.g., "3 days after previous")</p>
            </div>
          </div>
        </div>
        <div className="space-y-2 mt-4">
          <p className="font-semibold">Sequence Types:</p>
          <div className="flex flex-wrap gap-2">
            <Badge>Prospect</Badge>
            <Badge>High-Value</Badge>
            <Badge>Renewal</Badge>
            <Badge>At Risk</Badge>
            <Badge>General</Badge>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <p className="text-sm"><strong>💡 Tip:</strong> Create a template sequence, then enroll accounts. Tasks will appear on your Tasks page in the correct order!</p>
        </div>
      </div>
    ),
    action: {
      label: 'View Sequences',
      route: '/sequences'
    }
  },
  {
    id: 'contacts',
    title: 'Contacts - Manage People',
    description: 'Track all contacts linked to your accounts',
    content: (
      <div className="space-y-4">
        <p>Contacts are people within your accounts:</p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Linked to Accounts</p>
              <p className="text-sm text-slate-600">Every contact belongs to an account</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Contact Information</p>
              <p className="text-sm text-slate-600">Email, phone, LinkedIn, title, and role</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Roles & Preferences</p>
              <p className="text-sm text-slate-600">Track decision makers, influencers, and contact preferences</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">View All Contacts</p>
              <p className="text-sm text-slate-600">See all contacts across all accounts in one place</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <p className="text-sm"><strong>💡 Tip:</strong> Contacts can be linked to interactions and tasks for better tracking.</p>
        </div>
      </div>
    ),
    action: {
      label: 'View Contacts',
      route: '/contacts'
    }
  },
  {
    id: 'notifications',
    title: 'Notifications - Stay Informed',
    description: 'Get alerts for important events and reminders',
    content: (
      <div className="space-y-4">
        <p>The notification bell keeps you informed about important events:</p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-semibold">Task Reminders</p>
              <p className="text-sm text-slate-600">Notifications for upcoming and overdue tasks</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-orange-500 mt-0.5" />
            <div>
              <p className="font-semibold">Renewal Reminders</p>
              <p className="text-sm text-slate-600">Alerts for accounts with renewals coming up (6 months ahead)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-semibold">Neglected Accounts</p>
              <p className="text-sm text-slate-600">Warnings for accounts with no interaction in 90+ days</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Snooze Notifications</p>
              <p className="text-sm text-slate-600">Temporarily hide notifications you're not ready to act on</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <p className="text-sm"><strong>💡 Tip:</strong> Click the bell icon in the top navigation to see all your notifications. Mark as read or snooze as needed.</p>
        </div>
      </div>
    )
  },
  {
    id: 'reports',
    title: 'Reports - Analyze Performance',
    description: 'End of year analysis and performance metrics',
    content: (
      <div className="space-y-4">
        <p>Reports help you analyze your sales performance and make data-driven decisions:</p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-semibold">Win/Loss Report</p>
              <p className="text-sm text-slate-600">Track win rates, total value, and performance by year</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Department Report</p>
              <p className="text-sm text-slate-600">Analyze performance by department or division</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-purple-500 mt-0.5" />
            <div>
              <p className="font-semibold">Account Performance</p>
              <p className="text-sm text-slate-600">See which accounts are performing best</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-orange-500 mt-0.5" />
            <div>
              <p className="font-semibold">Export Options</p>
              <p className="text-sm text-slate-600">Export to XLSX or PDF for sharing and analysis</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
          <p className="text-sm"><strong>💡 Tip:</strong> Filter reports by year, account, or department to get specific insights.</p>
        </div>
      </div>
    ),
    action: {
      label: 'View Reports',
      route: '/reports'
    }
  },
  {
    id: 'settings',
    title: 'Settings - Customize Your Experience',
    description: 'Configure preferences and manage your account',
    content: (
      <div className="space-y-4">
        <p>Settings let you customize your CRM experience:</p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="font-semibold">Notification Preferences</p>
              <p className="text-sm text-slate-600">Control email notifications, task reminders, and system announcements</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Settings className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Display Preferences</p>
              <p className="text-sm text-slate-600">Customize how information is displayed</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-purple-500 mt-0.5" />
            <div>
              <p className="font-semibold">End of Year Reports</p>
              <p className="text-sm text-slate-600">Access and manage annual reports</p>
            </div>
          </div>
        </div>
      </div>
    ),
    action: {
      label: 'View Settings',
      route: '/settings'
    }
  },
  {
    id: 'google-sheets',
    title: 'Google Sheets Integration',
    description: 'Your data syncs automatically from Google Sheets',
    content: (
      <div className="space-y-4">
        <p>This CRM reads data directly from your Google Sheet:</p>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Automatic Sync</p>
              <p className="text-sm text-slate-600">Data loads when you open the CRM</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">Scorecard Export</p>
              <p className="text-sm text-slate-600">CSV exports match your Google Sheet format</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-semibold">All Tabs Supported</p>
              <p className="text-sm text-slate-600">Scorecard, Contacts, Insights, Notes, Cadence, Lookup Legend</p>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
          <p className="text-sm"><strong>📝 Note:</strong> Make sure your Google Sheet is set to "Anyone with the link can view" for the CRM to access it.</p>
        </div>
      </div>
    )
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Ready to start using your CRM',
    content: (
      <div className="space-y-4 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <div>
          <p className="text-lg font-semibold mb-2">Congratulations!</p>
          <p className="text-slate-600">You now know the basics of your CRM system.</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <p className="font-semibold mb-2">Next Steps:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-left">
            <li>Explore the Dashboard to see your data and alerts</li>
            <li>Click on an account to see the detail view with all tabs</li>
            <li>Complete your first scorecard to rate an account</li>
            <li>Log an interaction to track touchpoints</li>
            <li>Create a task or enroll an account in a sequence</li>
            <li>Check notifications for important reminders</li>
            <li>Review Reports to analyze performance</li>
          </ol>
        </div>
        <div className="mt-6">
          <p className="text-sm text-slate-500">Need help? Check the User Guide or explore the system on your own!</p>
        </div>
      </div>
    )
  }
];

export default function Tutorial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { startTutorial, currentStep, setCurrentStep, exitTutorial } = useTutorial();
  
  // Ensure currentStep is valid
  const safeStep = currentStep >= 0 && currentStep < tutorialSteps.length ? currentStep : 0;
  const step = tutorialSteps[safeStep] || tutorialSteps[0];
  const progress = ((safeStep + 1) / tutorialSteps.length) * 100;

  // Initialize tutorial mode and step from URL or default
  useEffect(() => {
    const stepParam = searchParams.get('step');
    if (stepParam !== null) {
      const step = parseInt(stepParam) || 0;
      if (step !== currentStep) {
        setCurrentStep(step);
      }
      startTutorial(step);
    } else {
      // No step param, use current step or default to 0
      if (currentStep === undefined || currentStep === null) {
        setCurrentStep(0);
        startTutorial(0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleNext = () => {
    if (safeStep < tutorialSteps.length - 1) {
      const nextStep = safeStep + 1;
      navigate(`/tutorial?step=${nextStep}`, { replace: true });
      // setCurrentStep will be updated by useEffect when URL changes
    }
  };

  const handlePrevious = () => {
    if (safeStep > 0) {
      const prevStep = safeStep - 1;
      navigate(`/tutorial?step=${prevStep}`, { replace: true });
      // setCurrentStep will be updated by useEffect when URL changes
    }
  };

  const handleAction = (route) => {
    // Navigate with tutorial mode enabled
    navigate(`${route}?tutorial=${safeStep}`);
  };

  const handleSkip = () => {
    exitTutorial();
    navigate('/dashboard');
  };

  if (!step) {
    return (
      <div className="min-h-screen bg-white p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-slate-600">Loading tutorial...</p>
        </div>
      </div>
    );
  }

  // Force white background on mount and clean up on unmount
  useEffect(() => {
    // Store original styles
    const originalBodyBg = document.body.style.backgroundColor;
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    const root = document.getElementById('root');
    const originalRootBg = root ? root.style.backgroundColor : '';
    
    // Apply tutorial page styles
    document.body.style.backgroundColor = '#ffffff';
    document.documentElement.style.backgroundColor = '#ffffff';
    if (root) {
      root.style.backgroundColor = '#ffffff';
    }
    
    // Clean up on unmount - restore original styles
    return () => {
      document.body.style.backgroundColor = originalBodyBg;
      document.documentElement.style.backgroundColor = originalHtmlBg;
      if (root) {
        root.style.backgroundColor = originalRootBg;
      }
      // Remove any style tags we added
      const styleTag = document.getElementById('tutorial-page-styles');
      if (styleTag) {
        styleTag.remove();
      }
    };
  }, []);

  // Inject styles only when this component is mounted
  useEffect(() => {
    // Create or update style tag with unique ID
    let styleTag = document.getElementById('tutorial-page-styles');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'tutorial-page-styles';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = `
      body { background-color: #ffffff !important; background-image: none !important; }
      html { background-color: #ffffff !important; background-image: none !important; }
      #root { background-color: #ffffff !important; background-image: none !important; }
      #root > div { background-color: #ffffff !important; background-image: none !important; }
      .bg-gradient-to-r { display: none !important; }
    `;
    
    // Clean up on unmount
    return () => {
      const tag = document.getElementById('tutorial-page-styles');
      if (tag) {
        tag.remove();
      }
    };
  }, []);

  return (
    <>
      <div 
        className="min-h-screen p-4" 
        style={{ 
          backgroundColor: '#ffffff',
          minHeight: '100vh',
          width: '100%',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: 'auto',
          zIndex: 1
        }}
      >
        <div className="max-w-4xl mx-auto" style={{ backgroundColor: '#ffffff' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Interactive Tutorial</h1>
            <p className="text-slate-600 mt-1">Learn how to use your CRM system</p>
          </div>
          <Button variant="ghost" onClick={handleSkip}>
            <X className="w-4 h-4 mr-2" />
            Skip Tutorial
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">
              Step {safeStep + 1} of {tutorialSteps.length}
            </span>
            <span className="text-sm text-slate-500">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{step.title}</CardTitle>
                <CardDescription className="mt-2 text-base">{step.description}</CardDescription>
              </div>
              <Badge variant="outline" className="ml-4">
                {step.id}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {step.content}
            
            {step.action && (
              <div className="pt-4 border-t">
                <Button 
                  onClick={() => handleAction(step.action.route)}
                  className="w-full"
                  variant="outline"
                >
                  <PlayCircle className="w-4 h-4 mr-2" />
                  {step.action.label}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={safeStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-2">
            {tutorialSteps.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  const validIndex = index >= 0 && index < tutorialSteps.length ? index : 0;
                  setCurrentStep(validIndex);
                  navigate(`/tutorial?step=${validIndex}`, { replace: true });
                }}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === safeStep
                    ? 'bg-blue-600'
                    : index < safeStep
                    ? 'bg-green-500'
                    : 'bg-slate-300'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          <Button
            onClick={handleNext}
            disabled={safeStep === tutorialSteps.length - 1}
          >
            {safeStep === tutorialSteps.length - 1 ? (
              <>
                <Home className="w-4 h-4 mr-2" />
                Finish
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Quick Links */}
        {safeStep === tutorialSteps.length - 1 && (
          <div className="mt-8 flex gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              <Home className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate('/accounts')}>
              <Building2 className="w-4 h-4 mr-2" />
              View Accounts
            </Button>
          </div>
        )}
        </div>
      </div>
    </>
  );
}

