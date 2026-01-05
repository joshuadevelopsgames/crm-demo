import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUser } from '@/contexts/UserContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '../utils';
import TutorialTooltip from '../components/TutorialTooltip';
import ImportLeadsDialog from '../components/ImportLeadsDialog';
import {
  Plus,
  Search,
  Building2,
  TrendingUp,
  Calendar,
  AlertCircle,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  List,
  Upload,
  Archive,
  RefreshCw,
  BellOff
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { isWonStatus } from '@/utils/reportCalculations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getRevenueForYear, getSegmentForYear } from '@/utils/revenueSegmentCalculator';
import { useYearSelector, getCurrentYear } from '@/contexts/YearSelectorContext';
import toast from 'react-hot-toast';
import { UserFilter } from '@/components/UserFilter';
import SnoozeDialog from '@/components/SnoozeDialog';
import { snoozeNotification } from '@/services/notificationService';

export default function Accounts() {
  // Use year selector to trigger re-render when year changes
  const { selectedYear, setYear, getCurrentYear, availableYears } = useYearSelector();
  const navigate = useNavigate();

  // Debug: Log year selection status
  useEffect(() => {
    const currentYear = getCurrentYear();
    console.log('[Accounts] Selected year:', selectedYear, 'Current year:', getCurrentYear());
  }, [selectedYear, getCurrentYear]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSegment, setFilterSegment] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [sortBy, setSortBy] = useState('revenue');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  // Default to card view on mobile, list view on desktop
  // Use lazy initializer to check device on initial render
  const [viewMode, setViewMode] = useState(() => {
    // Check if mobile on initial render (screen width or user agent)
    if (typeof window === 'undefined') return 'list';
    const isMobileDevice = window.innerWidth < 768 || /iPad|iPhone|iPod|Android/.test(navigator.userAgent);
    return isMobileDevice ? 'card' : 'list';
  }); // 'list' or 'card'
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'archived'
  const [statusFilter, setStatusFilter] = useState(null); // Filter by status (e.g., 'at_risk')
  const [snoozeAccount, setSnoozeAccount] = useState(null);
  
  const queryClient = useQueryClient();

  // Check URL parameters for status filter
  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setStatusFilter(statusParam);
      // If filtering by status, show active tab (not archived)
      if (statusParam !== 'archived') {
        setActiveTab('active');
      }
    }
  }, [searchParams]);

  const { user, isLoading: userLoading } = useUser();

  // Include selectedYear in query key so revenue/segment calculations update when year changes
  // Per Year Selection System spec R6, R8: All revenue calculations use selected year
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', selectedYear], // Include selectedYear so revenue/segments recalculate when year changes
    queryFn: () => base44.entities.Account.list(),
    enabled: !userLoading && !!user, // Wait for user to load before fetching
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on focus to prevent data disappearing
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });

  // Fetch contacts to check which accounts have contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list(),
    enabled: !userLoading && !!user, // Wait for user to load before fetching
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  // Create a map of account IDs that have contacts
  const accountsWithContacts = useMemo(() => {
    const accountIds = new Set();
    contacts.forEach(contact => {
      if (contact.account_id) {
        accountIds.add(contact.account_id);
      }
    });
    return accountIds;
  }, [contacts]);

  // Fetch all estimates to calculate actual revenue from won estimates
  // Include selectedYear in query key so it refetches when year selection changes
  // Per Year Selection System spec R6, R8: All data must filter by selected year
  const { data: allEstimates = [] } = useQuery({
    queryKey: ['estimates', selectedYear], // Include selectedYear so it refetches when year changes
    queryFn: async () => {
      const response = await fetch('/api/data/estimates');
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on focus to prevent data disappearing
    enabled: !userLoading && !!user, // Wait for user to load before fetching
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
  });

  // Fetch all scorecards to check which accounts have completed ICP scorecards
  const { data: allScorecards = [] } = useQuery({
    queryKey: ['scorecards'],
    queryFn: async () => {
      const response = await fetch('/api/data/scorecards');
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    },
    enabled: !userLoading && !!user, // Wait for user to load before fetching
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  // Create a map of account IDs that have completed scorecards
  const accountsWithScorecards = useMemo(() => {
    const accountIds = new Set();
    allScorecards.forEach(scorecard => {
      if (scorecard.account_id && scorecard.completed_date) {
        accountIds.add(scorecard.account_id);
      }
    });
    return accountIds;
  }, [allScorecards]);

  // Fetch at-risk accounts from notification_cache (per spec R31, R32)
  const { data: atRiskAccountsData = [] } = useQuery({
    queryKey: ['at-risk-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/notifications?type=at-risk-accounts');
      if (!response.ok) {
        console.error('❌ Failed to fetch at-risk accounts:', response.status, response.statusText);
        return [];
      }
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    },
    enabled: !userLoading && !!user && statusFilter === 'at_risk' // Only fetch when filtering for at-risk
  });

  // Fetch notification snoozes (needed for at-risk accounts)
  const { data: notificationSnoozes = [] } = useQuery({
    queryKey: ['notificationSnoozes'],
    queryFn: async () => {
      const response = await fetch('/api/data/notificationSnoozes');
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    },
    enabled: !userLoading && !!user && statusFilter === 'at_risk'
  });

  // Extract unique users from estimates with counts
  const usersWithCounts = useMemo(() => {
    const userMap = new Map();
    let estimatesWithUsers = 0;
    let estimatesWithoutUsers = 0;
    
    allEstimates.forEach(est => {
      // Count accounts per user (salesperson or estimator)
      const accountId = est.account_id;
      if (!accountId) return;
      
      const hasSalesperson = est.salesperson && est.salesperson.trim();
      const hasEstimator = est.estimator && est.estimator.trim();
      
      if (hasSalesperson || hasEstimator) {
        estimatesWithUsers++;
      } else {
        estimatesWithoutUsers++;
      }
      
      // Track salesperson
      if (hasSalesperson) {
        const name = est.salesperson.trim();
        if (!userMap.has(name)) {
          userMap.set(name, { name, accounts: new Set(), roles: new Set() });
        }
        userMap.get(name).accounts.add(accountId);
        userMap.get(name).roles.add('salesperson');
      }
      
      // Track estimator
      if (hasEstimator) {
        const name = est.estimator.trim();
        if (!userMap.has(name)) {
          userMap.set(name, { name, accounts: new Set(), roles: new Set() });
        }
        userMap.get(name).accounts.add(accountId);
        userMap.get(name).roles.add('estimator');
      }
    });
    
    // Debug logging
    if (userMap.size === 0 && allEstimates.length > 0) {
      console.warn('[Accounts] No users found in estimates:', {
        totalEstimates: allEstimates.length,
        estimatesWithUsers,
        estimatesWithoutUsers,
        sampleEstimates: allEstimates.slice(0, 5).map(e => ({
          id: e.id,
          salesperson: e.salesperson,
          estimator: e.estimator,
          account_id: e.account_id
        }))
      });
    }
    
    // Convert to array and sort by name
    return Array.from(userMap.values())
      .map(u => ({
        name: u.name,
        count: u.accounts.size,
        roles: Array.from(u.roles)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allEstimates]);

  // Map of account_id to user roles (for displaying role badges)
  const accountUserRoles = useMemo(() => {
    const roleMap = {};
    
    allEstimates.forEach(est => {
      if (!est.account_id) return;
      const accountId = est.account_id;
      
      if (!roleMap[accountId]) {
        roleMap[accountId] = {};
      }
      
      if (est.salesperson && est.salesperson.trim()) {
        const name = est.salesperson.trim();
        if (!roleMap[accountId][name]) {
          roleMap[accountId][name] = new Set();
        }
        roleMap[accountId][name].add('salesperson');
      }
      
      if (est.estimator && est.estimator.trim()) {
        const name = est.estimator.trim();
        if (!roleMap[accountId][name]) {
          roleMap[accountId][name] = new Set();
        }
        roleMap[accountId][name].add('estimator');
      }
    });
    
    // Convert Sets to arrays
    const result = {};
    Object.keys(roleMap).forEach(accountId => {
      result[accountId] = {};
      Object.keys(roleMap[accountId]).forEach(userName => {
        result[accountId][userName] = Array.from(roleMap[accountId][userName]);
      });
    });
    
    return result;
  }, [allEstimates]);

  // Group estimates by account_id for revenue calculation
  const estimatesByAccountId = useMemo(() => {
    const grouped = {};
    allEstimates.forEach(est => {
      if (est.account_id) {
        if (!grouped[est.account_id]) {
          grouped[est.account_id] = [];
        }
        grouped[est.account_id].push(est);
      }
    });
    
    // Single summary log for revenue calculation
    if (typeof window !== 'undefined' && window.__getCurrentYear) {
      const accountsWithEstimates = Object.keys(grouped).length;
      const totalEstimates = allEstimates.length;
      const wonEstimates = allEstimates.filter(e => isWonStatus(e)).length;
      const currentYear = typeof window !== 'undefined' && window.__getCurrentYear ? window.__getCurrentYear() : new Date().getFullYear();
      
      // Note: Revenue now comes from stored revenue_by_year field, not calculated on-the-fly
      console.log(`[Accounts] Summary for ${currentYear}:`, {
        accountsWithEstimates,
        totalEstimates,
        wonEstimates,
        note: 'Revenue is read from stored revenue_by_year field, not calculated from estimates'
      });
    }
    
    return grouped;
  }, [allEstimates]);

  const createAccountMutation = useMutation({
    mutationFn: (data) => base44.entities.Account.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsDialogOpen(false);
    }
  });

  const [newAccount, setNewAccount] = useState({
    name: '',
    account_type: 'prospect',
    revenue_segment: 'C',
    status: 'active',
    industry: '',
    notes: ''
  });

  const handleCreateAccount = () => {
    // Ensure account has a segment before creating (default to C if not set)
    // revenue_by_year will be calculated automatically from won estimates during import
    const accountData = {
      ...newAccount,
      revenue_segment: newAccount.revenue_segment || 'C'
    };
    createAccountMutation.mutate(accountData);
  };


  // Handle snooze for at-risk accounts
  const handleSnooze = async (account, notificationType, duration, unit) => {
    // Defensive checks
    if (!account) {
      console.error('❌ Snooze error: account is null or undefined');
      toast.error('Failed to snooze: account information is missing');
      return;
    }
    
    if (!account.id) {
      console.error('❌ Snooze error: account.id is missing', { account });
      toast.error('Failed to snooze: account ID is missing');
      return;
    }
    
    if (!notificationType) {
      console.error('❌ Snooze error: notificationType is missing');
      toast.error('Failed to snooze: notification type is missing');
      return;
    }
    
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
      case 'forever':
        // Set to 100 years in the future (effectively forever)
        snoozedUntil = new Date(now.getFullYear() + 100, now.getMonth(), now.getDate());
        break;
      default:
        console.error('Invalid snooze unit:', unit, 'duration:', duration);
        toast.error('Invalid snooze duration');
        return;
    }
    
    try {
      console.log('🔄 Snoozing account:', {
        accountId: account.id,
        accountName: account.name,
        notificationType,
        snoozedUntil: snoozedUntil.toISOString(),
        duration,
        unit
      });
      
      await snoozeNotification(notificationType, account.id, snoozedUntil);
      
      console.log('✅ Account snoozed successfully');
      queryClient.invalidateQueries({ queryKey: ['notificationSnoozes'] });
      queryClient.invalidateQueries({ queryKey: ['at-risk-accounts'] });
      setSnoozeAccount(null);
      toast.success('✓ Account snoozed');
    } catch (error) {
      console.error('❌ Error snoozing notification:', {
        error,
        message: error?.message,
        stack: error?.stack,
        accountId: account?.id,
        accountName: account?.name,
        notificationType
      });
      toast.error(`Failed to snooze account: ${error?.message || 'Unknown error'}`);
    }
  };

  // Filter by archived status first
  // When filtering for at-risk, use notification_cache instead of account.status (per spec R31, R32)
  const accountsByStatus = useMemo(() => {
    if (statusFilter === 'at_risk') {
      // Use notification_cache to determine at-risk accounts (per spec R31, R32)
      const atRiskAccountIds = new Set(atRiskAccountsData.map(record => record.account_id));
      
      // Filter out snoozed accounts
      const snoozedAccountIds = new Set(
        notificationSnoozes
          .filter(snooze => 
            snooze.notification_type === 'at-risk-account' &&
            new Date(snooze.snoozed_until) > new Date()
          )
          .map(snooze => snooze.related_account_id)
      );
      
      return accounts.filter(account => {
        // Per spec R1, R2: archived boolean takes precedence, but check both for compatibility
        const isArchived = account.archived === true || account.status === 'archived';
        if (isArchived) return false;
        
        const isAtRisk = atRiskAccountIds.has(account.id);
        const isSnoozed = snoozedAccountIds.has(account.id);
        
        return isAtRisk && !isSnoozed;
      });
    }
    
    return accounts.filter(account => {
      const isArchived = account.status === 'archived' || account.archived === true;
      
      // If statusFilter is set (from URL), filter by that status
      if (statusFilter) {
        if (statusFilter === 'archived') {
          return isArchived;
        } else {
          // Filter by specific status (e.g., other statuses)
          return !isArchived && account.status === statusFilter;
        }
      }
      
      // Otherwise use activeTab logic
      return activeTab === 'archived' ? isArchived : !isArchived;
    });
  }, [accounts, statusFilter, atRiskAccountsData, notificationSnoozes]);

  // Then apply other filters and sort
  // Map tags to account types for filtering:
  // - "client" tag matches "customer" filter
  // - "lead" tag matches "prospect" filter
  // - Other common mappings
  // Helper to check if account matches filter type (checks both account_type and tags)
  const accountMatchesType = (account, filterType) => {
    if (filterType === 'all') return true;
    
    // Normalize filter type to lowercase
    const normalizedFilter = filterType.toLowerCase();
    const accountType = account.account_type?.toLowerCase();
    
    // Map account_type values to filter types
    // account_type "client" should match "customer" filter
    // account_type "lead" should match "prospect" filter
    if (normalizedFilter === 'customer') {
      if (accountType === 'customer' || accountType === 'client') {
        return true;
      }
    }
    if (normalizedFilter === 'prospect') {
      if (accountType === 'prospect' || accountType === 'lead') {
        return true;
      }
    }
    // Direct match for other types
    if (accountType === normalizedFilter) {
      return true;
    }
    
    // Also check tags - could be array or string
    let tags = [];
    if (Array.isArray(account.tags)) {
      tags = account.tags.map(t => String(t).toLowerCase().trim());
    } else if (typeof account.tags === 'string' && account.tags) {
      tags = account.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    }
    
    // Map tags to filter types
    if (normalizedFilter === 'customer' && (tags.includes('client') || tags.includes('customer'))) {
      return true;
    }
    if (normalizedFilter === 'prospect' && (tags.includes('lead') || tags.includes('prospect'))) {
      return true;
    }
    if (normalizedFilter === 'partner' && tags.includes('partner')) {
      return true;
    }
    if (normalizedFilter === 'vendor' && tags.includes('vendor')) {
      return true;
    }
    if (normalizedFilter === 'competitor' && tags.includes('competitor')) {
      return true;
    }
    
    return false;
  };

  // Filter and sort accounts - MUST include selectedYear in dependencies so it updates when year changes
  // Per Year Selection System spec R6, R8: All revenue/segment calculations use selected year
  const filteredAccounts = useMemo(() => {
    const filtered = accountsByStatus.filter(account => {
      const matchesSearch = account.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = accountMatchesType(account, filterType);
      const accountSegment = getSegmentForYear(account, selectedYear);
      const matchesSegment = filterSegment === 'all' || accountSegment === filterSegment;
      
      // User filter: if users are selected, only show accounts that have estimates with those users
      let matchesUser = true;
      if (selectedUsers.length > 0) {
        const accountEstimates = estimatesByAccountId[account.id] || [];
        const hasMatchingUser = accountEstimates.some(est => {
          const salesperson = est.salesperson?.trim();
          const estimator = est.estimator?.trim();
          return selectedUsers.includes(salesperson) || selectedUsers.includes(estimator);
        });
        matchesUser = hasMatchingUser;
      }
      
      return matchesSearch && matchesType && matchesSegment && matchesUser;
    });

    // Sort the filtered accounts
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'score') {
        // Only sort by score if both accounts have completed scorecards
        const aHasScorecard = accountsWithScorecards.has(a.id);
        const bHasScorecard = accountsWithScorecards.has(b.id);
        if (!aHasScorecard && !bHasScorecard) return 0;
        if (!aHasScorecard) return 1; // Accounts without scorecards go to end
        if (!bHasScorecard) return -1; // Accounts without scorecards go to end
        return (b.organization_score || 0) - (a.organization_score || 0);
      }
      if (sortBy === 'revenue') {
        const aRevenue = getRevenueForYear(a, selectedYear);
        const bRevenue = getRevenueForYear(b, selectedYear);
        return bRevenue - aRevenue;
      }
      if (sortBy === 'last_interaction') {
        // When sorting by "last contact", prioritize accounts with contacts
        const aHasContacts = accountsWithContacts.has(a.id);
        const bHasContacts = accountsWithContacts.has(b.id);
        
        // Accounts without contacts go to the end
        if (!aHasContacts && !bHasContacts) {
          // Both have no contacts - sort by date if available, otherwise equal
          if (!a.last_interaction_date && !b.last_interaction_date) return 0;
          if (!a.last_interaction_date) return 1;
          if (!b.last_interaction_date) return -1;
          return new Date(b.last_interaction_date) - new Date(a.last_interaction_date);
        }
        if (!aHasContacts) return 1; // a has no contacts, goes to end
        if (!bHasContacts) return -1; // b has no contacts, goes to end
        
        // Both have contacts - sort by last_interaction_date
        if (!a.last_interaction_date && !b.last_interaction_date) return 0;
        if (!a.last_interaction_date) return 1; // a has no date, goes to end
        if (!b.last_interaction_date) return -1; // b has no date, goes to end
        return new Date(b.last_interaction_date) - new Date(a.last_interaction_date);
      }
      return 0;
    });
    
    return sorted;
  }, [accountsByStatus, searchTerm, filterType, filterSegment, selectedUsers, estimatesByAccountId, sortBy, selectedYear, accountsWithScorecards, accountsWithContacts]);

  // Debug logging for segment and status filtering
  useEffect(() => {
    if (accounts.length > 0) {
      const segmentCounts = {};
      const statusCounts = {};
      accounts.forEach(acc => {
        const segment = getSegmentForYear(acc, selectedYear) || 'null';
        const status = acc.status || 'null';
        segmentCounts[segment] = (segmentCounts[segment] || 0) + 1;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      console.log('📊 Accounts Data Debug:', {
        totalAccounts: accounts.length,
        activeAccounts: accountsByStatus.length,
        filteredAccounts: filteredAccounts.length,
        filterSegment,
        filterType,
        statusFilter,
        selectedYear,
        segmentCounts,
        statusCounts,
        accountsWithSegmentB: accounts.filter(a => getSegmentForYear(a, selectedYear) === 'B').length,
        accountsWithAtRiskStatus: accounts.filter(a => a.status === 'at_risk').length,
        sampleAccounts: accounts.slice(0, 5).map(a => ({
          name: a.name,
          revenue_segment: getSegmentForYear(a, selectedYear),
          status: a.status,
          archived: a.archived
        }))
      });
    }
  }, [accounts, accountsByStatus, filteredAccounts, filterSegment, filterType, statusFilter, selectedYear]);

  const getAccountTypeColor = (type) => {
    const colors = {
      prospect: 'bg-blue-100 text-blue-800 border-blue-200',
      customer: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      renewal: 'bg-amber-100 text-amber-800 border-amber-200',
      churned: 'bg-slate-100 text-slate-600 border-slate-200'
    };
    return colors[type] || colors.prospect;
  };

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

  const getNeglectStatus = (lastInteractionDate) => {
    if (!lastInteractionDate) return { label: 'No contact records', color: 'text-red-600', days: null };
    const days = differenceInDays(new Date(), new Date(lastInteractionDate));
    if (days > 60) return { label: `${days} days ago`, color: 'text-red-600', days };
    if (days > 30) return { label: `${days} days ago`, color: 'text-amber-600', days };
    return { label: `${days} days ago`, color: 'text-slate-600', days };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <TutorialTooltip
          tip="Your central hub for managing all companies. Search by name, filter by type (prospect, customer, partner) or revenue segment (A, B, C, D), and sort by score, name, or last interaction. Click any account to view full details including interactions, contacts, scorecards, and sales insights. Use this to track your sales pipeline and customer relationships."
          step={2}
          position="bottom"
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-foreground">Accounts</h1>
            <p className="text-slate-600 mt-1">{filteredAccounts.length} total accounts</p>
          </div>
        </TutorialTooltip>
        <div className="flex items-center gap-3">
          <TutorialTooltip
            tip="Select the year to view site-wide data. Revenue calculations, segments, and reports will use this year. Your selection persists across sessions."
            position="bottom"
          >
            <Select value={selectedYear.toString()} onValueChange={(value) => setYear(parseInt(value, 10))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue>{selectedYear}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TutorialTooltip>
          <TutorialTooltip
            tip="Import accounts and contacts from LMN (golmn.com) by uploading CSV files. This creates new accounts and contacts with all their data (names, emails, phone numbers, etc.). Use this when you have new leads or want to bulk import data from your LMN system. The import will match existing accounts or create new ones."
            step={2}
            position="bottom"
          >
            <Button 
              onClick={() => setIsImportDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-primary dark:hover:bg-primary-hover dark:active:bg-primary-active dark:text-primary-foreground"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import from LMN
            </Button>
          </TutorialTooltip>
        </div>
      </div>

      {/* Import Leads Dialog */}
      <ImportLeadsDialog 
        open={isImportDialogOpen} 
        onClose={() => setIsImportDialogOpen(false)}
      />

      {/* Tabs: Active / Archived */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start bg-white dark:bg-surface-1 border-b dark:border-border rounded-none h-auto p-0 space-x-0">
          <TabsTrigger 
            value="active" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3 text-foreground/70 data-[state=active]:text-foreground"
          >
            Active ({accounts.filter(a => a.status !== 'archived' && a.archived !== true).length})
          </TabsTrigger>
          <TabsTrigger 
            value="archived"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-3 text-foreground/70 data-[state=active]:text-foreground"
          >
            <Archive className="w-4 h-4 mr-2" />
            Archived ({accounts.filter(a => a.status === 'archived' || a.archived === true).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0 space-y-4">
      {/* Status Filter Banner */}
      {statusFilter && (
        <Card className={statusFilter === 'at_risk' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className={`w-5 h-5 ${statusFilter === 'at_risk' ? 'text-red-600' : 'text-amber-600'}`} />
                <span className={`font-medium ${statusFilter === 'at_risk' ? 'text-red-900' : 'text-amber-900'}`}>
                  Showing {statusFilter === 'at_risk' ? 'At Risk' : statusFilter} accounts
                </span>
                <Badge variant="secondary" className={statusFilter === 'at_risk' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>
                  {accountsByStatus.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter(null);
                  setSearchParams({});
                }}
                className={statusFilter === 'at_risk' ? 'text-red-700 hover:text-red-900' : 'text-amber-700 hover:text-amber-900'}
              >
                Clear Filter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Filters & Search */}
      <TutorialTooltip
        tip="Powerful filtering and search tools to find exactly what you need. Search by account name to quickly locate specific companies. Filter by account type (prospect, customer, etc.) or revenue segment to focus on specific account groups. Sort by organization score, name, or last interaction date to prioritize your work. Switch between list and card views to see more or less detail per account."
        step={2}
        position="bottom"
      >
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="renewal">Renewal</SelectItem>
                <SelectItem value="churned">Churned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSegment} onValueChange={setFilterSegment}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Segments</SelectItem>
                <SelectItem value="A">Segment A (&gt;15%)</SelectItem>
                <SelectItem value="B">Segment B (5-15%)</SelectItem>
                <SelectItem value="C">Segment C (&lt;5%)</SelectItem>
                <SelectItem value="D">Segment D (Project Only)</SelectItem>
              </SelectContent>
            </Select>
            <UserFilter
              users={usersWithCounts}
              selectedUsers={selectedUsers}
              onSelectionChange={setSelectedUsers}
              placeholder="User"
            />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort by Name</SelectItem>
                <SelectItem value="score">Sort by Score</SelectItem>
                <SelectItem value="revenue">Sort by Revenue</SelectItem>
                <SelectItem value="last_interaction">Sort by Last Contact</SelectItem>
              </SelectContent>
            </Select>
            {/* View Toggle */}
            <div className="flex items-center gap-1 border border-slate-300 rounded-lg p-1">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={`h-8 px-3 ${viewMode === 'list' ? 'bg-primary text-primary-foreground hover:bg-primary-hover' : 'text-foreground/70 hover:bg-surface-2'}`}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('card')}
                className={`h-8 px-3 ${viewMode === 'card' ? 'bg-primary text-primary-foreground hover:bg-primary-hover' : 'text-foreground/70 hover:bg-surface-2'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
      </TutorialTooltip>

      {/* Accounts List View */}
      {viewMode === 'list' ? (
        <TutorialTooltip
          tip="List view shows all accounts in a table format for quick scanning. Each row displays key information: account name, type, status, revenue segment, organization score, last contact date, and revenue. Click any row to open the full account detail page where you can view interactions, contacts, scorecards, and more. Use this view to quickly identify accounts that need attention based on score or last contact date."
          step={2}
          position="bottom"
        >
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                      Account
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                      Segment
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                      Last Contact
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                      Revenue
                    </th>
                    {statusFilter === 'at_risk' && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Renewal
                      </th>
                    )}
                    {statusFilter === 'at_risk' && (
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-surface-1 divide-y divide-slate-200 dark:divide-border">
                  {filteredAccounts.map((account) => {
                    const neglectStatus = getNeglectStatus(account.last_interaction_date);
                    // Get at-risk data for this account
                    const atRiskData = statusFilter === 'at_risk' 
                      ? atRiskAccountsData.find(record => record.account_id === account.id)
                      : null;
                    return (
                      <tr 
                        key={account.id} 
                        onClick={() => navigate(createPageUrl(`AccountDetail?id=${account.id}`))}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-5 h-5 text-slate-600" />
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-foreground">{account.name}</div>
                              {account.industry && (
                                <div className="text-sm text-slate-500">{account.industry}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <Badge variant="outline" className={getAccountTypeColor(account.account_type)}>
                            {account.account_type}
                          </Badge>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <Badge className={getStatusColor(account.status)}>
                            {account.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {getSegmentForYear(account, selectedYear) || '-'}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          {accountsWithScorecards.has(account.id) && account.organization_score !== null && account.organization_score !== undefined ? (
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              <span className="font-semibold text-emerald-600">{account.organization_score}</span>
                              <span className="text-xs text-slate-500">/100</span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {neglectStatus.days !== null && neglectStatus.days > 30 && (
                                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              )}
                              <span className={`text-sm font-medium ${neglectStatus.color}`}>
                                {neglectStatus.label}
                              </span>
                            </div>
                            {/* User role badges when filtered */}
                            {selectedUsers.length > 0 && accountUserRoles[account.id] && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedUsers.map(userName => {
                                  const roles = accountUserRoles[account.id]?.[userName];
                                  if (!roles || roles.length === 0) return null;
                                  return (
                                    <Badge
                                      key={userName}
                                      variant="outline"
                                      className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                                    >
                                      {userName}
                                      {roles.includes('salesperson') && roles.includes('estimator') && (
                                        <span className="ml-1">(S, E)</span>
                                      )}
                                      {roles.includes('salesperson') && !roles.includes('estimator') && (
                                        <span className="ml-1">(S)</span>
                                      )}
                                      {roles.includes('estimator') && !roles.includes('salesperson') && (
                                        <span className="ml-1">(E)</span>
                                      )}
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-slate-900 dark:text-white font-medium">
                          {(() => {
                            const revenue = getRevenueForYear(account, selectedYear);
                            
                            // Debug logging - log first 5 accounts
                            if (process.env.NODE_ENV === 'development') {
                              const accountIndex = filteredAccounts.findIndex(a => a.id === account.id);
                              if (accountIndex < 5) {
                                console.log(`[Accounts Table Row ${accountIndex}]`, {
                                  accountName: account.name,
                                  accountId: account.id,
                                  revenue,
                                  currentYear: getCurrentYear(),
                                  revenue_by_year: account.revenue_by_year
                                });
                              }
                            }
                            
                            return revenue > 0 ? `$${revenue.toLocaleString()}` : '-';
                          })()}
                        </td>
                        {statusFilter === 'at_risk' && (
                          <td className="px-4 py-4">
                            {atRiskData ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium text-red-700 dark:text-red-400">
                                  {atRiskData.renewal_date ? format(new Date(atRiskData.renewal_date), 'MMM d, yyyy') : '-'}
                                </span>
                                {atRiskData.days_until_renewal !== null && atRiskData.days_until_renewal !== undefined && (
                                  <span className="text-xs text-slate-500">
                                    {atRiskData.days_until_renewal} days
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </td>
                        )}
                        {statusFilter === 'at_risk' && (
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!account || !account.id) {
                                  console.error('❌ Cannot snooze: account or account.id is missing', { account });
                                  toast.error('Cannot snooze: account information is missing');
                                  return;
                                }
                                console.log('🔄 Opening snooze dialog for account:', { accountId: account.id, accountName: account.name });
                                setSnoozeAccount(account);
                              }}
                              className="text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/20"
                            >
                              <BellOff className="w-4 h-4 mr-1" />
                              Snooze
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TutorialTooltip>
      ) : (
        /* Accounts Card View */
        <TutorialTooltip
          tip="This is the card view of accounts. Click on any card to view account details. Cards show key information in a visual format."
          step={2}
          position="bottom"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => {
            const neglectStatus = getNeglectStatus(account.last_interaction_date);
            // Per spec R1, R2: archived boolean takes precedence, but check both for compatibility
        const isArchived = account.archived === true || account.status === 'archived';
            // Get at-risk data for this account
            const atRiskData = statusFilter === 'at_risk' 
              ? atRiskAccountsData.find(record => record.account_id === account.id)
              : null;
            return (
              <div key={account.id} className="relative">
              <Link to={createPageUrl(`AccountDetail?id=${account.id}`)}>
                  <Card className={`p-5 hover:shadow-lg transition-all border-slate-200 dark:border-slate-700 h-full ${isArchived ? 'bg-slate-50 dark:bg-slate-800' : ''} ${statusFilter === 'at_risk' ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20' : ''}`}>
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isArchived ? 'bg-slate-200' : 'bg-slate-100'}`}>
                            <Building2 className={`w-6 h-6 ${isArchived ? 'text-slate-500' : 'text-slate-600'}`} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold ${isArchived ? 'text-slate-500 dark:text-text-muted' : 'text-slate-900 dark:text-foreground'}`}>{account.name}</h3>
                              {isArchived && (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                                  <Archive className="w-3 h-3 mr-1" />
                                  Archived
                                </Badge>
                              )}
                            </div>
                            {account.industry && (
                              <p className={`text-sm ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>{account.industry}</p>
                            )}
                        </div>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={`${getAccountTypeColor(account.account_type)} ${isArchived ? 'opacity-60' : ''}`}>
                        {account.account_type}
                      </Badge>
                        <Badge className={`${getStatusColor(account.status)} ${isArchived ? 'opacity-60' : ''}`}>
                        {account.status}
                      </Badge>
                      {getSegmentForYear(account, selectedYear) && (
                          <Badge variant="outline" className={`${isArchived ? 'text-slate-400 border-slate-300' : 'text-slate-600 border-slate-300'}`}>
                          {getSegmentForYear(account, selectedYear)}
                        </Badge>
                      )}
                      {/* User role badges when filtered */}
                      {selectedUsers.length > 0 && accountUserRoles[account.id] && (
                        <>
                          {selectedUsers.map(userName => {
                            const roles = accountUserRoles[account.id]?.[userName];
                            if (!roles || roles.length === 0) return null;
                            return (
                              <Badge
                                key={userName}
                                variant="outline"
                                className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                              >
                                {userName}
                                {roles.includes('salesperson') && roles.includes('estimator') && (
                                  <span className="ml-1 text-xs">(Salesperson, Estimator)</span>
                                )}
                                {roles.includes('salesperson') && !roles.includes('estimator') && (
                                  <span className="ml-1 text-xs">(Salesperson)</span>
                                )}
                                {roles.includes('estimator') && !roles.includes('salesperson') && (
                                  <span className="ml-1 text-xs">(Estimator)</span>
                                )}
                              </Badge>
                            );
                          })}
                        </>
                      )}
                    </div>

                    {/* Score */}
                    {accountsWithScorecards.has(account.id) && account.organization_score !== null && account.organization_score !== undefined && (
                      <div className="flex items-center gap-2">
                          <TrendingUp className={`w-4 h-4 ${isArchived ? 'text-slate-400' : 'text-emerald-600'}`} />
                          <span className={`text-sm font-medium ${isArchived ? 'text-slate-400' : 'text-slate-700'}`}>Score:</span>
                          <span className={`text-lg font-bold ${isArchived ? 'text-slate-500' : 'text-emerald-600'}`}>{account.organization_score}</span>
                          <span className={`text-sm ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>/100</span>
                      </div>
                    )}

                    {/* Last Interaction */}
                      <div className={`pt-3 border-t ${isArchived ? 'border-slate-200' : 'border-slate-100'}`}>
                      <div className="flex items-center justify-between text-sm">
                          <span className={isArchived ? 'text-slate-400' : 'text-slate-600'}>Last contact:</span>
                          <span className={`font-medium ${isArchived ? 'text-slate-400' : neglectStatus.color}`}>
                          {neglectStatus.label}
                        </span>
                      </div>
                      {(() => {
                        const revenue = getRevenueForYear(account, selectedYear);
                        return revenue > 0 ? (
                          <div className="flex items-center justify-between text-sm mt-2">
                            <span className={isArchived ? 'text-slate-400' : 'text-slate-600'}>Annual value:</span>
                            <span className={`font-medium ${isArchived ? 'text-slate-500 dark:text-text-muted' : 'text-slate-900 dark:text-white'}`}>
                              ${revenue.toLocaleString()}
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {/* Renewal Date (for at-risk accounts) */}
                    {statusFilter === 'at_risk' && atRiskData && (
                      <div className={`pt-3 border-t ${isArchived ? 'border-slate-200' : 'border-slate-100'}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className={isArchived ? 'text-slate-400' : 'text-slate-600'}>Renewal date:</span>
                          <span className={`font-medium ${isArchived ? 'text-slate-400' : 'text-red-700 dark:text-red-400'}`}>
                            {atRiskData.renewal_date ? format(new Date(atRiskData.renewal_date), 'MMM d, yyyy') : '-'}
                          </span>
                        </div>
                        {atRiskData.days_until_renewal !== null && atRiskData.days_until_renewal !== undefined && (
                          <div className="flex items-center justify-between text-sm mt-1">
                            <span className={isArchived ? 'text-slate-400' : 'text-slate-600'}>Days until:</span>
                            <span className={`font-medium ${isArchived ? 'text-slate-400' : 'text-red-700 dark:text-red-400'}`}>
                              {atRiskData.days_until_renewal} days
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Warnings */}
                      {neglectStatus.days > 30 && !isArchived && (
                      <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span className="text-xs text-amber-800">Needs attention</span>
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
              {statusFilter === 'at_risk' && (
                <div className="absolute top-4 right-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!account || !account.id) {
                        console.error('❌ Cannot snooze: account or account.id is missing', { account });
                        toast.error('Cannot snooze: account information is missing');
                        return;
                      }
                      console.log('🔄 Opening snooze dialog for account:', { accountId: account.id, accountName: account.name });
                      setSnoozeAccount(account);
                    }}
                    className="text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/20"
                  >
                    <BellOff className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
            );
          })}
        </div>
        </TutorialTooltip>
      )}

      {filteredAccounts.length === 0 && (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No accounts found</h3>
          <p className="text-slate-600 mb-4">
            {searchTerm || filterType !== 'all' || filterSegment !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first account to get started'}
          </p>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="archived" className="mt-0 space-y-4">
          {/* Same filters for archived tab */}
          <Card className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search archived accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-3">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="renewal">Renewal</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterSegment} onValueChange={setFilterSegment}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Segment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Segments</SelectItem>
                    <SelectItem value="A">Segment A (&gt;15%)</SelectItem>
                    <SelectItem value="B">Segment B (5-15%)</SelectItem>
                    <SelectItem value="C">Segment C (&lt;5%)</SelectItem>
                    <SelectItem value="D">Segment D (Project Only)</SelectItem>
                  </SelectContent>
                </Select>
                <UserFilter
                  users={usersWithCounts}
                  selectedUsers={selectedUsers}
                  onSelectionChange={setSelectedUsers}
                  placeholder="Filter by User"
                />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Sort by Name</SelectItem>
                    <SelectItem value="score">Sort by Score</SelectItem>
                    <SelectItem value="revenue">Sort by Revenue</SelectItem>
                    <SelectItem value="last_interaction">Sort by Last Contact</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1 border border-slate-300 rounded-lg p-1">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className={`h-8 px-3 ${viewMode === 'list' ? 'bg-primary text-primary-foreground hover:bg-primary-hover' : 'text-foreground/70 hover:bg-surface-2'}`}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'card' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('card')}
                    className={`h-8 px-3 ${viewMode === 'card' ? 'bg-primary text-primary-foreground hover:bg-primary-hover' : 'text-foreground/70 hover:bg-surface-2'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Accounts List/Card View for Archived Tab */}
          {viewMode === 'list' ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Segment
                      </th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Last Contact
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-surface-1 divide-y divide-slate-200 dark:divide-border">
                    {filteredAccounts.map((account) => {
                      const neglectStatus = getNeglectStatus(account.last_interaction_date);
                      // Per spec R1, R2: archived boolean takes precedence, but check both for compatibility
        const isArchived = account.archived === true || account.status === 'archived';
                      return (
                        <tr 
                          key={account.id} 
                          onClick={() => navigate(createPageUrl(`AccountDetail?id=${account.id}`))}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${isArchived ? 'bg-slate-50 dark:bg-slate-800' : ''}`}
                        >
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isArchived ? 'bg-slate-200' : 'bg-slate-100'}`}>
                                <Building2 className={`w-5 h-5 ${isArchived ? 'text-slate-500' : 'text-slate-600'}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${isArchived ? 'text-slate-500 dark:text-text-muted' : 'text-slate-900 dark:text-foreground'}`}>{account.name}</span>
                                  {isArchived && (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                                      <Archive className="w-3 h-3 mr-1" />
                                      Archived
                                    </Badge>
                                  )}
                                </div>
                                {account.industry && (
                                  <div className={`text-sm ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>{account.industry}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <Badge variant="outline" className={`${getAccountTypeColor(account.account_type)} ${isArchived ? 'opacity-60' : ''}`}>
                              {account.account_type}
                            </Badge>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <Badge className={`${getStatusColor(account.status)} ${isArchived ? 'opacity-60' : ''}`}>
                              {account.status}
                            </Badge>
                          </td>
                          <td className={`px-6 py-4 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                            {getSegmentForYear(account, selectedYear) || '-'}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            {accountsWithScorecards.has(account.id) && account.organization_score !== null && account.organization_score !== undefined ? (
                              <div className="flex items-center gap-2">
                                <TrendingUp className={`w-4 h-4 flex-shrink-0 ${isArchived ? 'text-slate-400' : 'text-emerald-600'}`} />
                                <span className={`font-semibold ${isArchived ? 'text-slate-500' : 'text-emerald-600'}`}>{account.organization_score}</span>
                                <span className={`text-xs ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>/100</span>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2">
                              {neglectStatus.days !== null && neglectStatus.days > 30 && !isArchived && (
                                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              )}
                              <span className={`text-sm font-medium ${isArchived ? 'text-slate-400' : neglectStatus.color}`}>
                                {neglectStatus.label}
                              </span>
                            </div>
                          </td>
                          <td className={`px-6 py-4 text-right text-sm font-medium ${isArchived ? 'text-slate-500 dark:text-text-muted' : 'text-slate-900 dark:text-white'}`}>
                            {(() => {
                              const revenue = getRevenueForYear(account, selectedYear);
                              return revenue > 0 ? `$${revenue.toLocaleString()}` : '-';
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            /* Accounts Card View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAccounts.map((account) => {
                const neglectStatus = getNeglectStatus(account.last_interaction_date);
                // Per spec R1, R2: archived boolean takes precedence, but check both for compatibility
        const isArchived = account.archived === true || account.status === 'archived';
                return (
                <Link key={account.id} to={createPageUrl(`AccountDetail?id=${account.id}`)}>
                  <Card className={`p-5 hover:shadow-lg transition-all border-slate-200 dark:border-slate-700 h-full ${isArchived ? 'bg-slate-50 dark:bg-slate-800' : ''}`}>
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isArchived ? 'bg-slate-200' : 'bg-slate-100'}`}>
                            <Building2 className={`w-6 h-6 ${isArchived ? 'text-slate-500' : 'text-slate-600'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold ${isArchived ? 'text-slate-500 dark:text-text-muted' : 'text-slate-900 dark:text-foreground'}`}>{account.name}</h3>
                              {isArchived && (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                                  <Archive className="w-3 h-3 mr-1" />
                                  Archived
                                </Badge>
                              )}
                            </div>
                            {account.industry && (
                              <p className={`text-sm ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>{account.industry}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={`${getAccountTypeColor(account.account_type)} ${isArchived ? 'opacity-60' : ''}`}>
                          {account.account_type}
                        </Badge>
                        <Badge className={`${getStatusColor(account.status)} ${isArchived ? 'opacity-60' : ''}`}>
                          {account.status}
                        </Badge>
                        {getSegmentForYear(account, selectedYear) && (
                          <Badge variant="outline" className={`${isArchived ? 'text-slate-400 border-slate-300' : 'text-slate-600 border-slate-300'}`}>
                            {getSegmentForYear(account, selectedYear)}
                          </Badge>
                        )}
                      </div>

                      {/* Score */}
                      {accountsWithScorecards.has(account.id) && account.organization_score !== null && account.organization_score !== undefined && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className={`w-4 h-4 ${isArchived ? 'text-slate-400' : 'text-emerald-600'}`} />
                          <span className={`text-sm font-medium ${isArchived ? 'text-slate-400' : 'text-slate-700'}`}>Score:</span>
                          <span className={`text-lg font-bold ${isArchived ? 'text-slate-500' : 'text-emerald-600'}`}>{account.organization_score}</span>
                          <span className={`text-sm ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>/100</span>
                        </div>
                      )}

                      {/* Last Interaction */}
                      <div className={`pt-3 border-t ${isArchived ? 'border-slate-200' : 'border-slate-100'}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className={isArchived ? 'text-slate-400' : 'text-slate-600'}>Last contact:</span>
                          <span className={`font-medium ${isArchived ? 'text-slate-400' : neglectStatus.color}`}>
                            {neglectStatus.label}
                          </span>
                        </div>
                        {(() => {
                          const revenue = getRevenueForYear(account, selectedYear);
                          return revenue > 0 ? (
                          <div className="flex items-center justify-between text-sm mt-2">
                            <span className={isArchived ? 'text-slate-400' : 'text-slate-600'}>Annual value:</span>
                            <span className={`font-medium ${isArchived ? 'text-slate-500 dark:text-text-muted' : 'text-slate-900 dark:text-white'}`}>
                                ${revenue.toLocaleString()}
                            </span>
                          </div>
                          ) : null;
                        })()}
                      </div>

                      {/* Warnings */}
                      {neglectStatus.days > 30 && !isArchived && (
                        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span className="text-xs text-amber-800">Needs attention</span>
                        </div>
                      )}
                    </div>
                  </Card>
                </Link>
                );
              })}
            </div>
          )}

          {filteredAccounts.length === 0 && (
            <Card className="p-12 text-center">
              <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No archived accounts found</h3>
              <p className="text-slate-600 mb-4">
                {searchTerm || filterType !== 'all' || filterSegment !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No archived accounts'}
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Snooze Dialog for at-risk accounts */}
      {snoozeAccount && (
        <SnoozeDialog
          account={snoozeAccount}
          notificationType="at-risk-account"
          open={!!snoozeAccount}
          onOpenChange={(open) => {
            if (!open) {
              console.log('🔄 Closing snooze dialog');
              setSnoozeAccount(null);
            }
          }}
          onSnooze={handleSnooze}
        />
      )}
    </div>
  );
}

