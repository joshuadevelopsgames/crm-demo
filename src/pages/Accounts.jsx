import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
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
  RefreshCw
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
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
import { calculateRevenueSegment, calculateTotalRevenue, autoAssignRevenueSegments } from '@/utils/revenueSegmentCalculator';
import toast from 'react-hot-toast';

export default function Accounts() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSegment, setFilterSegment] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'card'
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'archived'
  
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list()
  });

  // Fetch all estimates to calculate actual revenue from won estimates
  const { data: allEstimates = [] } = useQuery({
    queryKey: ['estimates'],
    queryFn: async () => {
      const response = await fetch('/api/data/estimates');
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    }
  });

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
    annual_revenue: '',
    industry: '',
    notes: ''
  });

  // Auto-calculate revenue segment when annual revenue changes
  useEffect(() => {
    if (newAccount.annual_revenue) {
      const revenue = parseFloat(newAccount.annual_revenue);
      if (!isNaN(revenue) && revenue > 0) {
        // Group estimates by account_id for revenue calculation
        const estimatesByAccountId = {};
        allEstimates.forEach(est => {
          if (est.account_id) {
            if (!estimatesByAccountId[est.account_id]) {
              estimatesByAccountId[est.account_id] = [];
            }
            estimatesByAccountId[est.account_id].push(est);
          }
        });
        
        const totalRevenue = calculateTotalRevenue(accounts, estimatesByAccountId);
        const adjustedTotal = totalRevenue + revenue; // Include new account's revenue
        
        // For new account, use the entered revenue value
        const tempAccount = { annual_revenue: revenue };
        const segment = calculateRevenueSegment(tempAccount, adjustedTotal);
        setNewAccount(prev => ({ ...prev, revenue_segment: segment }));
      }
    }
  }, [newAccount.annual_revenue, accounts, allEstimates]);

  const handleCreateAccount = () => {
    // Ensure account has a segment before creating (default to C if not set)
    const accountData = {
      ...newAccount,
      annual_revenue: newAccount.annual_revenue ? parseFloat(newAccount.annual_revenue) : null,
      revenue_segment: newAccount.revenue_segment || 'C'
    };
    createAccountMutation.mutate(accountData);
  };

  // Recalculate all revenue segments
  const recalculateSegmentsMutation = useMutation({
    mutationFn: async () => {
      // Group estimates by account_id for revenue calculation
      const estimatesByAccountId = {};
      allEstimates.forEach(est => {
        if (est.account_id) {
          if (!estimatesByAccountId[est.account_id]) {
            estimatesByAccountId[est.account_id] = [];
          }
          estimatesByAccountId[est.account_id].push(est);
        }
      });
      
      // Calculate segments for all accounts using actual revenue from estimates
      const updatedAccounts = autoAssignRevenueSegments(accounts, estimatesByAccountId);
      
      // Update ALL accounts to ensure every account has the correct segment
      // This ensures accounts without segments get assigned, and accounts with wrong segments get corrected
      const updates = updatedAccounts.map(account => 
        base44.entities.Account.update(account.id, { revenue_segment: account.revenue_segment })
      );
      
      await Promise.all(updates);
      
      return { updated: updates.length, total: accounts.length };
    },
    onSuccess: ({ updated, total }) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`Revenue segments recalculated: All ${total} accounts now have segments assigned`);
    },
    onError: (error) => {
      console.error('Error recalculating segments:', error);
      toast.error(error.message || 'Failed to recalculate segments');
    }
  });

  const handleRecalculateSegments = () => {
    if (window.confirm('Recalculate revenue segments for all accounts based on rolling 12-month average revenue percentages? This will update all accounts.')) {
      recalculateSegmentsMutation.mutate();
    }
  };

  // Filter by archived status first
  const accountsByStatus = accounts.filter(account => {
    const isArchived = account.status === 'archived' || account.archived === true;
    return activeTab === 'archived' ? isArchived : !isArchived;
  });

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

  let filteredAccounts = accountsByStatus.filter(account => {
    const matchesSearch = account.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = accountMatchesType(account, filterType);
    const matchesSegment = filterSegment === 'all' || account.revenue_segment === filterSegment;
    
    return matchesSearch && matchesType && matchesSegment;
  });

  filteredAccounts.sort((a, b) => {
    if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'score') return (b.organization_score || 0) - (a.organization_score || 0);
    if (sortBy === 'revenue') return (b.annual_revenue || 0) - (a.annual_revenue || 0);
    if (sortBy === 'last_interaction') {
      if (!a.last_interaction_date) return 1;
      if (!b.last_interaction_date) return -1;
      return new Date(b.last_interaction_date) - new Date(a.last_interaction_date);
    }
    return 0;
  });

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
          tip="This is your Accounts page. Here you can view all companies, search and filter them by type or segment, and click on any account to see detailed information."
          step={2}
          position="bottom"
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Accounts</h1>
            <p className="text-slate-600 mt-1">{filteredAccounts.length} total accounts</p>
          </div>
        </TutorialTooltip>
        <div className="flex items-center gap-3">
          <TutorialTooltip
            tip="Click this button to import leads from LMN (golmn.com) via CSV. Upload both files to create accounts and contacts with complete data."
            step={2}
            position="bottom"
          >
            <Button 
              onClick={() => setIsImportDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import from LMN
            </Button>
          </TutorialTooltip>
          <Button 
            onClick={handleRecalculateSegments}
            variant="outline"
            disabled={recalculateSegmentsMutation.isPending}
            className="border-slate-300"
            title="Recalculate revenue segments for all accounts based on rolling 12-month average revenue percentages"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${recalculateSegmentsMutation.isPending ? 'animate-spin' : ''}`} />
            Recalculate Segments
          </Button>
        </div>
      </div>

      {/* Import Leads Dialog */}
      <ImportLeadsDialog 
        open={isImportDialogOpen} 
        onClose={() => setIsImportDialogOpen(false)}
      />

      {/* Tabs: Active / Archived */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start bg-white border-b rounded-none h-auto p-0 space-x-0">
          <TabsTrigger 
            value="active" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent px-6 py-3"
          >
            Active ({accounts.filter(a => a.status !== 'archived' && a.archived !== true).length})
          </TabsTrigger>
          <TabsTrigger 
            value="archived"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent px-6 py-3"
          >
            <Archive className="w-4 h-4 mr-2" />
            Archived ({accounts.filter(a => a.status === 'archived' || a.archived === true).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0 space-y-4">
      {/* Filters & Search */}
      <TutorialTooltip
        tip="Use these filters to search accounts by name, filter by type or segment, sort by different criteria, and toggle between list and card views."
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
                <SelectItem value="A">Segment A (≥15%)</SelectItem>
                <SelectItem value="B">Segment B (5-15%)</SelectItem>
                <SelectItem value="C">Segment C (0-5%)</SelectItem>
                <SelectItem value="D">Segment D (Project Only)</SelectItem>
              </SelectContent>
            </Select>
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
                className={`h-8 px-3 ${viewMode === 'list' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('card')}
                className={`h-8 px-3 ${viewMode === 'card' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
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
          tip="This is the list view of all accounts. Click on any row to view the account details. You can see the account name, type, status, segment, organization score, last contact date, and revenue at a glance."
          step={2}
          position="bottom"
        >
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Account
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Segment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Last Contact
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredAccounts.map((account) => {
                    const neglectStatus = getNeglectStatus(account.last_interaction_date);
                    return (
                      <tr 
                        key={account.id} 
                        onClick={() => navigate(createPageUrl(`AccountDetail?id=${account.id}`))}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-5 h-5 text-slate-600" />
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{account.name}</div>
                              <div className="text-sm text-slate-500">{account.industry || 'No industry'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className={getAccountTypeColor(account.account_type)}>
                            {account.account_type}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={getStatusColor(account.status)}>
                            {account.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {account.revenue_segment || '-'}
                        </td>
                        <td className="px-6 py-4">
                          {account.organization_score !== null && account.organization_score !== undefined ? (
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                              <span className="font-semibold text-emerald-600">{account.organization_score}</span>
                              <span className="text-xs text-slate-500">/100</span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {neglectStatus.days !== null && neglectStatus.days > 30 && (
                              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            )}
                            <span className={`text-sm font-medium ${neglectStatus.color}`}>
                              {neglectStatus.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-slate-900 font-medium">
                          {account.annual_revenue ? `$${account.annual_revenue.toLocaleString()}` : '-'}
                        </td>
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
                const isArchived = account.status === 'archived' || account.archived === true;
            return (
              <Link key={account.id} to={createPageUrl(`AccountDetail?id=${account.id}`)}>
                  <Card className={`p-5 hover:shadow-lg transition-all border-slate-200 h-full ${isArchived ? 'bg-slate-50' : ''}`}>
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isArchived ? 'bg-slate-200' : 'bg-slate-100'}`}>
                            <Building2 className={`w-6 h-6 ${isArchived ? 'text-slate-500' : 'text-slate-600'}`} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>{account.name}</h3>
                              {isArchived && (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                                  <Archive className="w-3 h-3 mr-1" />
                                  Archived
                                </Badge>
                              )}
                            </div>
                            <p className={`text-sm ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>{account.industry || 'No industry'}</p>
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
                      {account.revenue_segment && (
                          <Badge variant="outline" className={`${isArchived ? 'text-slate-400 border-slate-300' : 'text-slate-600 border-slate-300'}`}>
                          {account.revenue_segment}
                        </Badge>
                      )}
                    </div>

                    {/* Score */}
                    {account.organization_score !== null && account.organization_score !== undefined && (
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
                      {account.annual_revenue && (
                        <div className="flex items-center justify-between text-sm mt-2">
                            <span className={isArchived ? 'text-slate-400' : 'text-slate-600'}>Annual value:</span>
                            <span className={`font-medium ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>
                            ${account.annual_revenue.toLocaleString()}
                          </span>
                        </div>
                      )}
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
        </TutorialTooltip>
      )}

      {filteredAccounts.length === 0 && (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No accounts found</h3>
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
                    <SelectItem value="A">Segment A</SelectItem>
                    <SelectItem value="B">Segment B</SelectItem>
                    <SelectItem value="C">Segment C</SelectItem>
                    <SelectItem value="D">Segment D</SelectItem>
                  </SelectContent>
                </Select>
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
                    className={`h-8 px-3 ${viewMode === 'list' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'card' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('card')}
                    className={`h-8 px-3 ${viewMode === 'card' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
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
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Segment
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Last Contact
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {filteredAccounts.map((account) => {
                      const neglectStatus = getNeglectStatus(account.last_interaction_date);
                      const isArchived = account.status === 'archived' || account.archived === true;
                      return (
                        <tr 
                          key={account.id} 
                          onClick={() => navigate(createPageUrl(`AccountDetail?id=${account.id}`))}
                          className={`hover:bg-slate-50 transition-colors cursor-pointer ${isArchived ? 'bg-slate-50' : ''}`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isArchived ? 'bg-slate-200' : 'bg-slate-100'}`}>
                                <Building2 className={`w-5 h-5 ${isArchived ? 'text-slate-500' : 'text-slate-600'}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>{account.name}</span>
                                  {isArchived && (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                                      <Archive className="w-3 h-3 mr-1" />
                                      Archived
                                    </Badge>
                                  )}
                                </div>
                                <div className={`text-sm ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>{account.industry || 'No industry'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={`${getAccountTypeColor(account.account_type)} ${isArchived ? 'opacity-60' : ''}`}>
                              {account.account_type}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <Badge className={`${getStatusColor(account.status)} ${isArchived ? 'opacity-60' : ''}`}>
                              {account.status}
                            </Badge>
                          </td>
                          <td className={`px-6 py-4 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                            {account.revenue_segment || '-'}
                          </td>
                          <td className="px-6 py-4">
                            {account.organization_score !== null && account.organization_score !== undefined ? (
                              <div className="flex items-center gap-2">
                                <TrendingUp className={`w-4 h-4 flex-shrink-0 ${isArchived ? 'text-slate-400' : 'text-emerald-600'}`} />
                                <span className={`font-semibold ${isArchived ? 'text-slate-500' : 'text-emerald-600'}`}>{account.organization_score}</span>
                                <span className={`text-xs ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>/100</span>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {neglectStatus.days !== null && neglectStatus.days > 30 && !isArchived && (
                                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              )}
                              <span className={`text-sm font-medium ${isArchived ? 'text-slate-400' : neglectStatus.color}`}>
                                {neglectStatus.label}
                              </span>
                            </div>
                          </td>
                          <td className={`px-6 py-4 text-right text-sm font-medium ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>
                            {account.annual_revenue ? `$${account.annual_revenue.toLocaleString()}` : '-'}
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
                const isArchived = account.status === 'archived' || account.archived === true;
                return (
                <Link key={account.id} to={createPageUrl(`AccountDetail?id=${account.id}`)}>
                  <Card className={`p-5 hover:shadow-lg transition-all border-slate-200 h-full ${isArchived ? 'bg-slate-50' : ''}`}>
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isArchived ? 'bg-slate-200' : 'bg-slate-100'}`}>
                            <Building2 className={`w-6 h-6 ${isArchived ? 'text-slate-500' : 'text-slate-600'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`font-semibold ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>{account.name}</h3>
                              {isArchived && (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                                  <Archive className="w-3 h-3 mr-1" />
                                  Archived
                                </Badge>
                              )}
                            </div>
                            <p className={`text-sm ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>{account.industry || 'No industry'}</p>
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
                        {account.revenue_segment && (
                          <Badge variant="outline" className={`${isArchived ? 'text-slate-400 border-slate-300' : 'text-slate-600 border-slate-300'}`}>
                            {account.revenue_segment}
                          </Badge>
                        )}
                      </div>

                      {/* Score */}
                      {account.organization_score !== null && account.organization_score !== undefined && (
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
                        {account.annual_revenue && (
                          <div className="flex items-center justify-between text-sm mt-2">
                            <span className={isArchived ? 'text-slate-400' : 'text-slate-600'}>Annual value:</span>
                            <span className={`font-medium ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>
                              ${account.annual_revenue.toLocaleString()}
                            </span>
                          </div>
                        )}
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
              <h3 className="text-lg font-medium text-slate-900 mb-1">No archived accounts found</h3>
              <p className="text-slate-600 mb-4">
                {searchTerm || filterType !== 'all' || filterSegment !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No archived accounts'}
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

