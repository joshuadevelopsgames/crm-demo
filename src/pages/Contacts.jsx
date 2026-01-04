import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
  Plus,
  Search,
  Users,
  Mail,
  Phone,
  Linkedin,
  Building2,
  LayoutGrid,
  List,
  Upload,
  Archive
} from 'lucide-react';
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
import TutorialTooltip from '../components/TutorialTooltip';
import ImportLeadsDialog from '../components/ImportLeadsDialog';
import { useYearSelector } from '@/contexts/YearSelectorContext';
import { UserFilter } from '@/components/UserFilter';
import { useUser } from '@/contexts/UserContext';

export default function Contacts() {
  const navigate = useNavigate();
  const { user, isLoading: userLoading } = useUser();
  const { selectedYear, setYear } = useYearSelector();
  
  // Generate year options (current year ± 5 years)
  const baseYear = new Date().getFullYear();
  const yearOptions = [];
  for (let i = -5; i <= 5; i++) {
    yearOptions.push(baseYear + i);
  }
  const [filterName, setFilterName] = useState('');
  const [filterAccount, setFilterAccount] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [sortBy, setSortBy] = useState('name'); // 'name' or 'account'
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

  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list(),
    enabled: !userLoading && !!user
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
    enabled: !userLoading && !!user
  });

  // Fetch estimates to extract users and filter contacts
  const { data: allEstimates = [] } = useQuery({
    queryKey: ['estimates'],
    queryFn: async () => {
      const response = await fetch('/api/data/estimates');
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    },
    enabled: !userLoading && !!user
  });

  // Extract unique users from estimates with counts (for contacts, count contacts whose accounts have estimates)
  const usersWithCounts = useMemo(() => {
    const userMap = new Map();
    const accountIdsWithUser = new Map(); // Map of userName -> Set of accountIds
    
    allEstimates.forEach(est => {
      const accountId = est.account_id;
      if (!accountId) return;
      
      if (est.salesperson && est.salesperson.trim()) {
        const name = est.salesperson.trim();
        if (!accountIdsWithUser.has(name)) {
          accountIdsWithUser.set(name, new Set());
        }
        accountIdsWithUser.get(name).add(accountId);
      }
      
      if (est.estimator && est.estimator.trim()) {
        const name = est.estimator.trim();
        if (!accountIdsWithUser.has(name)) {
          accountIdsWithUser.set(name, new Set());
        }
        accountIdsWithUser.get(name).add(accountId);
      }
    });
    
    // Count contacts per user (contacts whose accounts have estimates with that user)
    accountIdsWithUser.forEach((accountIds, userName) => {
      const contactCount = contacts.filter(c => 
        c.account_id && accountIds.has(c.account_id)
      ).length;
      
      if (contactCount > 0) {
        userMap.set(userName, {
          name: userName,
          count: contactCount
        });
      }
    });
    
    return Array.from(userMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allEstimates, contacts]);

  // Map of account_id to user roles (for displaying role badges on contacts)
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
    
    const result = {};
    Object.keys(roleMap).forEach(accountId => {
      result[accountId] = {};
      Object.keys(roleMap[accountId]).forEach(userName => {
        result[accountId][userName] = Array.from(roleMap[accountId][userName]);
      });
    });
    
    return result;
  }, [allEstimates]);

  const createContactMutation = useMutation({
    mutationFn: (data) => base44.entities.Contact.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsDialogOpen(false);
    }
  });

  const [newContact, setNewContact] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    title: '',
    account_id: '',
    account_name: '',
    preferences: '',
    linkedin_url: '',
    status: 'active'
  });

  const handleCreateContact = () => {
    const selectedAccount = accounts.find(a => a.id === newContact.account_id);
    createContactMutation.mutate({
      ...newContact,
      account_name: selectedAccount?.name || ''
    });
  };

  // Filter by archived status first
  const contactsByStatus = contacts.filter(contact => {
    const isArchived = contact.status === 'archived' || contact.archived === true;
    return activeTab === 'archived' ? isArchived : !isArchived;
  });

  // Then apply other filters
  const filteredContacts = contactsByStatus.filter(contact => {
    // Name filter (first name or last name)
    const matchesName = filterName === '' || 
      contact.first_name?.toLowerCase().includes(filterName.toLowerCase()) ||
      contact.last_name?.toLowerCase().includes(filterName.toLowerCase()) ||
      `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase().includes(filterName.toLowerCase());
    
    // Account filter
    const matchesAccount = filterAccount === 'all' || 
      contact.account_id === filterAccount;
    
    // User filter: if users are selected, only show contacts whose accounts have estimates with those users
    let matchesUser = true;
    if (selectedUsers.length > 0 && contact.account_id) {
      const accountEstimates = allEstimates.filter(est => est.account_id === contact.account_id);
      const hasMatchingUser = accountEstimates.some(est => {
        const salesperson = est.salesperson?.trim();
        const estimator = est.estimator?.trim();
        return selectedUsers.includes(salesperson) || selectedUsers.includes(estimator);
      });
      matchesUser = hasMatchingUser;
    }
    
    return matchesName && matchesAccount && matchesUser;
  });

  // Sort contacts
  filteredContacts.sort((a, b) => {
    if (sortBy === 'name') {
      const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
      const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    } else if (sortBy === 'account') {
      // Sort by account name, with contacts without accounts at the end
      const accountA = a.account_name || '';
      const accountB = b.account_name || '';
      if (!accountA && !accountB) return 0;
      if (!accountA) return 1; // No account goes to end
      if (!accountB) return -1; // No account goes to end
      return accountA.localeCompare(accountB);
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <TutorialTooltip
        tip="Your complete contact directory across all accounts. Search by name to quickly find anyone. Each contact shows their account, role, email, phone, and preferences. Click any contact to view full details including their interaction history, linked tasks, and notes. Use this to manage your network, find the right person at each company, and track who you know where."
        step={2}
        position="bottom"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-foreground">Contacts</h1>
            <p className="text-slate-600 mt-1">{filteredContacts.length} total contacts</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedYear.toString()} onValueChange={(value) => setYear(parseInt(value, 10))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue>{selectedYear}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => setIsImportDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-primary dark:hover:bg-primary-hover dark:active:bg-primary-active dark:text-primary-foreground"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import from LMN
            </Button>
          </div>
        </div>
      </TutorialTooltip>

      {/* Tabs: Active / Archived */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start bg-white dark:bg-surface-1 border-b dark:border-border rounded-none h-auto p-0 space-x-0">
          <TabsTrigger 
            value="active" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent px-6 py-3"
          >
            Active ({contacts.filter(c => c.status !== 'archived' && c.archived !== true).length})
          </TabsTrigger>
          <TabsTrigger 
            value="archived"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent px-6 py-3"
          >
            <Archive className="w-4 h-4 mr-2" />
            Archived ({contacts.filter(c => c.status === 'archived' || c.archived === true).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0 space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search by name..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger className="w-48">
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts
                    .filter(acc => acc.status !== 'archived' && acc.archived !== true)
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                    .map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <UserFilter
                users={usersWithCounts}
                selectedUsers={selectedUsers}
                onSelectionChange={setSelectedUsers}
                placeholder="Filter by User"
              />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="account">Account A-Z</SelectItem>
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
          </Card>

          {/* Contacts List/Card View for Active Tab */}
          {viewMode === 'list' ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-0.5 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-0.5 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Phone
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-surface-1 divide-y divide-slate-200 dark:divide-border">
                    {filteredContacts.map((contact) => {
                      const isArchived = contact.status === 'archived' || contact.archived === true;
                      return (
                      <tr 
                        key={contact.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${isArchived ? 'bg-slate-50 dark:bg-slate-800' : ''}`}
                        onClick={() => navigate(createPageUrl(`ContactDetail?id=${contact.id}`))}
                      >
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isArchived ? 'bg-slate-200' : 'bg-slate-100'}`}>
                              <Users className={`w-5 h-5 ${isArchived ? 'text-slate-500' : 'text-slate-600'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${isArchived ? 'text-slate-500 dark:text-text-muted' : 'text-slate-900 dark:text-foreground'}`}>
                                  {contact.first_name} {contact.last_name}
                                </span>
                                {isArchived && (
                                  <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                                    <Archive className="w-3 h-3 mr-1" />
                                    Archived
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={`px-2 sm:px-4 py-3 sm:py-4 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                          {contact.title || '-'}
                        </td>
                        <td className="px-4 py-4">
                          {contact.account_name ? (
                            <Link 
                              to={createPageUrl(`AccountDetail?id=${contact.account_id}`)}
                              onClick={(e) => e.stopPropagation()}
                              className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400 hover:text-slate-600' : 'text-blue-600 hover:text-blue-800'}`}
                            >
                              <Building2 className="w-4 h-4" />
                              {contact.account_name}
                            </Link>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-0.5 py-4">
                          <a 
                            href={`mailto:${contact.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-sm ${isArchived ? 'text-slate-400 hover:text-slate-600' : 'text-slate-600 hover:text-blue-600'}`}
                          >
                            {contact.email}
                          </a>
                        </td>
                        <td className="px-0.5 py-4">
                          {contact.phone ? (
                            <a 
                              href={`tel:${contact.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-sm ${isArchived ? 'text-slate-400 hover:text-slate-600' : 'text-slate-600 hover:text-blue-600'}`}
                            >
                              {contact.phone}
                            </a>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            /* Contacts Card View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map((contact) => {
                const isArchived = contact.status === 'archived' || contact.archived === true;
                const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();
                const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
                
                return (
                <Card 
                  key={contact.id} 
                  className={`hover:shadow-lg transition-all cursor-pointer ${isArchived ? 'bg-slate-50 dark:bg-surface-2 opacity-75' : 'bg-white dark:bg-surface-1'}`}
                  onClick={() => navigate(createPageUrl(`ContactDetail?id=${contact.id}`))}
                >
                  <CardContent className="p-5">
                    <div className="space-y-4">
                      {/* Header with Avatar */}
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-lg ${
                          isArchived ? 'bg-slate-400' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                        }`}>
                          {initials || <Users className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-semibold text-lg truncate ${isArchived ? 'text-slate-500 dark:text-text-muted' : 'text-slate-900 dark:text-foreground'}`}>
                                {fullName || 'Unnamed Contact'}
                              </h3>
                              {contact.title && (
                                <p className={`text-sm mt-0.5 truncate ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {contact.title}
                                </p>
                              )}
                            </div>
                            {isArchived && (
                              <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 flex-shrink-0">
                                <Archive className="w-3 h-3 mr-1" />
                                Archived
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Account Link */}
                      {contact.account_id && (
                        <div className="space-y-2">
                          <Link 
                            to={createPageUrl(`AccountDetail?id=${contact.account_id}`)}
                            className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400 hover:text-slate-600' : 'text-blue-600 hover:text-blue-800'} transition-colors`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Building2 className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{contact.account_name || 'View Account'}</span>
                          </Link>
                          {/* User role badges when filtered */}
                          {selectedUsers.length > 0 && accountUserRoles[contact.account_id] && (
                            <div className="flex flex-wrap gap-1">
                              {selectedUsers.map(userName => {
                                const roles = accountUserRoles[contact.account_id]?.[userName];
                                if (!roles || roles.length === 0) return null;
                                return (
                                  <Badge
                                    key={userName}
                                    variant="outline"
                                    className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                                  >
                                    {userName}
                                    {roles.includes('salesperson') && roles.includes('estimator') && (
                                      <span className="ml-1">(Salesperson, Estimator)</span>
                                    )}
                                    {roles.includes('salesperson') && !roles.includes('estimator') && (
                                      <span className="ml-1">(Salesperson)</span>
                                    )}
                                    {roles.includes('estimator') && !roles.includes('salesperson') && (
                                      <span className="ml-1">(Estimator)</span>
                                    )}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Contact Info */}
                      <div className={`space-y-2 pt-2 border-t ${isArchived ? 'border-slate-200' : 'border-slate-100'}`}>
                        <div className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <a 
                            href={`mailto:${contact.email}`} 
                            className={`truncate ${isArchived ? 'hover:text-slate-600' : 'hover:text-blue-600'} transition-colors`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {contact.email}
                          </a>
                        </div>
                        {contact.phone && (
                          <div className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                            <Phone className="w-4 h-4 flex-shrink-0" />
                            <a 
                              href={`tel:${contact.phone}`} 
                              className={`truncate ${isArchived ? 'hover:text-slate-600' : 'hover:text-blue-600'} transition-colors`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {contact.phone}
                            </a>
                          </div>
                        )}
                        {contact.linkedin_url && (
                          <div className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                            <Linkedin className="w-4 h-4 flex-shrink-0" />
                            <a 
                              href={contact.linkedin_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={`truncate ${isArchived ? 'hover:text-slate-600' : 'hover:text-blue-600'} transition-colors`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              LinkedIn
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Preferences */}
                      {contact.preferences && (
                        <div className={`pt-3 border-t ${isArchived ? 'border-slate-200' : 'border-slate-100'}`}>
                          <p className={`text-xs mb-1 font-medium ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>Notes:</p>
                          <p className={`text-sm line-clamp-2 ${isArchived ? 'text-slate-500' : 'text-slate-700'}`}>
                            {contact.preferences}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}

          {filteredContacts.length === 0 && (
            <Card className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No contacts found</h3>
              <p className="text-slate-600 mb-4">
                {(filterName || filterAccount !== 'all')
                  ? 'Try adjusting your filters'
                  : 'Create your first contact to get started'}
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
                  placeholder="Search by name..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger className="w-48">
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts
                    .filter(acc => acc.status !== 'archived' && acc.archived !== true)
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                    .map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <UserFilter
                users={usersWithCounts}
                selectedUsers={selectedUsers}
                onSelectionChange={setSelectedUsers}
                placeholder="Filter by User"
              />
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="account">Account A-Z</SelectItem>
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
          </Card>

          {/* Contacts List/Card View for Archived Tab */}
          {viewMode === 'list' ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-0.5 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-0.5 py-3 text-left text-xs font-semibold text-slate-700 dark:text-foreground uppercase tracking-wider">
                        Phone
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-surface-1 divide-y divide-slate-200 dark:divide-border">
                    {filteredContacts.map((contact) => {
                      const isArchived = contact.status === 'archived' || contact.archived === true;
                      return (
                      <tr 
                        key={contact.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${isArchived ? 'bg-slate-50 dark:bg-slate-800' : ''}`}
                        onClick={() => navigate(createPageUrl(`ContactDetail?id=${contact.id}`))}
                      >
                        <td className="px-3 sm:px-6 py-3 sm:py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isArchived ? 'bg-slate-200' : 'bg-slate-100'}`}>
                              <Users className={`w-5 h-5 ${isArchived ? 'text-slate-500' : 'text-slate-600'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${isArchived ? 'text-slate-500 dark:text-text-muted' : 'text-slate-900 dark:text-foreground'}`}>
                                  {contact.first_name} {contact.last_name}
                                </span>
                                {isArchived && (
                                  <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                                    <Archive className="w-3 h-3 mr-1" />
                                    Archived
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={`px-2 sm:px-4 py-3 sm:py-4 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                          {contact.title || '-'}
                        </td>
                        <td className="px-4 py-4">
                          {contact.account_name ? (
                            <Link 
                              to={createPageUrl(`AccountDetail?id=${contact.account_id}`)}
                              onClick={(e) => e.stopPropagation()}
                              className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400 hover:text-slate-600' : 'text-blue-600 hover:text-blue-800'}`}
                            >
                              <Building2 className="w-4 h-4" />
                              {contact.account_name}
                            </Link>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-0.5 py-4">
                          <a 
                            href={`mailto:${contact.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-sm ${isArchived ? 'text-slate-400 hover:text-slate-600' : 'text-slate-600 hover:text-blue-600'}`}
                          >
                            {contact.email}
                          </a>
                        </td>
                        <td className="px-0.5 py-4">
                          {contact.phone ? (
                            <a 
                              href={`tel:${contact.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className={`text-sm ${isArchived ? 'text-slate-400 hover:text-slate-600' : 'text-slate-600 hover:text-blue-600'}`}
                            >
                              {contact.phone}
                            </a>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            /* Contacts Card View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map((contact) => {
                const isArchived = contact.status === 'archived' || contact.archived === true;
                const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();
                const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
                
                return (
                <Card 
                  key={contact.id} 
                  className={`hover:shadow-lg transition-all cursor-pointer ${isArchived ? 'bg-slate-50 dark:bg-surface-2 opacity-75' : 'bg-white dark:bg-surface-1'}`}
                  onClick={() => navigate(createPageUrl(`ContactDetail?id=${contact.id}`))}
                >
                  <CardContent className="p-5">
                    <div className="space-y-4">
                      {/* Header with Avatar */}
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-lg ${
                          isArchived ? 'bg-slate-400' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                        }`}>
                          {initials || <Users className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-semibold text-lg truncate ${isArchived ? 'text-slate-500 dark:text-text-muted' : 'text-slate-900 dark:text-foreground'}`}>
                                {fullName || 'Unnamed Contact'}
                              </h3>
                              {contact.title && (
                                <p className={`text-sm mt-0.5 truncate ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {contact.title}
                                </p>
                              )}
                            </div>
                            {isArchived && (
                              <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 flex-shrink-0">
                                <Archive className="w-3 h-3 mr-1" />
                                Archived
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Account Link */}
                      {contact.account_id && (
                        <div className="space-y-2">
                          <Link 
                            to={createPageUrl(`AccountDetail?id=${contact.account_id}`)}
                            className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400 hover:text-slate-600' : 'text-blue-600 hover:text-blue-800'} transition-colors`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Building2 className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{contact.account_name || 'View Account'}</span>
                          </Link>
                          {/* User role badges when filtered */}
                          {selectedUsers.length > 0 && accountUserRoles[contact.account_id] && (
                            <div className="flex flex-wrap gap-1">
                              {selectedUsers.map(userName => {
                                const roles = accountUserRoles[contact.account_id]?.[userName];
                                if (!roles || roles.length === 0) return null;
                                return (
                                  <Badge
                                    key={userName}
                                    variant="outline"
                                    className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                                  >
                                    {userName}
                                    {roles.includes('salesperson') && roles.includes('estimator') && (
                                      <span className="ml-1">(Salesperson, Estimator)</span>
                                    )}
                                    {roles.includes('salesperson') && !roles.includes('estimator') && (
                                      <span className="ml-1">(Salesperson)</span>
                                    )}
                                    {roles.includes('estimator') && !roles.includes('salesperson') && (
                                      <span className="ml-1">(Estimator)</span>
                                    )}
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Contact Info */}
                      <div className={`space-y-2 pt-2 border-t ${isArchived ? 'border-slate-200' : 'border-slate-100'}`}>
                        <div className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <a 
                            href={`mailto:${contact.email}`} 
                            className={`truncate ${isArchived ? 'hover:text-slate-600' : 'hover:text-blue-600'} transition-colors`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {contact.email}
                          </a>
                        </div>
                        {contact.phone && (
                          <div className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                            <Phone className="w-4 h-4 flex-shrink-0" />
                            <a 
                              href={`tel:${contact.phone}`} 
                              className={`truncate ${isArchived ? 'hover:text-slate-600' : 'hover:text-blue-600'} transition-colors`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {contact.phone}
                            </a>
                          </div>
                        )}
                        {contact.linkedin_url && (
                          <div className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
                            <Linkedin className="w-4 h-4 flex-shrink-0" />
                            <a 
                              href={contact.linkedin_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className={`truncate ${isArchived ? 'hover:text-slate-600' : 'hover:text-blue-600'} transition-colors`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              LinkedIn
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Preferences */}
                      {contact.preferences && (
                        <div className={`pt-3 border-t ${isArchived ? 'border-slate-200' : 'border-slate-100'}`}>
                          <p className={`text-xs mb-1 font-medium ${isArchived ? 'text-slate-400' : 'text-slate-500'}`}>Notes:</p>
                          <p className={`text-sm line-clamp-2 ${isArchived ? 'text-slate-500' : 'text-slate-700'}`}>
                            {contact.preferences}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}

          {filteredContacts.length === 0 && (
            <Card className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No archived contacts found</h3>
              <p className="text-slate-600 mb-4">
                {(filterName || filterAccount !== 'all')
                  ? 'Try adjusting your filters'
                  : 'No archived contacts'}
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Import Leads Dialog */}
      <ImportLeadsDialog 
        open={isImportDialogOpen} 
        onClose={() => setIsImportDialogOpen(false)}
      />
    </div>
  );
}

