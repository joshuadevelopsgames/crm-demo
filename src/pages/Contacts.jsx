import React, { useState } from 'react';
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

export default function Contacts() {
  const navigate = useNavigate();
  const [filterName, setFilterName] = useState('');
  const [filterAccount, setFilterAccount] = useState('all');
  const [sortBy, setSortBy] = useState('name'); // 'name' or 'account'
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'card'
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'archived'

  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list()
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list()
  });

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
  let filteredContacts = contactsByStatus.filter(contact => {
    // Name filter (first name or last name)
    const matchesName = filterName === '' || 
      contact.first_name?.toLowerCase().includes(filterName.toLowerCase()) ||
      contact.last_name?.toLowerCase().includes(filterName.toLowerCase()) ||
      `${contact.first_name || ''} ${contact.last_name || ''}`.toLowerCase().includes(filterName.toLowerCase());
    
    // Account filter
    const matchesAccount = filterAccount === 'all' || 
      contact.account_id === filterAccount;
    
    return matchesName && matchesAccount;
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
        tip="This is your Contacts page. View all contacts across all accounts and search by name. Each contact belongs to an account and includes contact information and preferences."
        step={2}
        position="bottom"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Contacts</h1>
            <p className="text-slate-600 mt-1">{filteredContacts.length} total contacts</p>
          </div>
          <Button 
            onClick={() => setIsImportDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import from LMN
          </Button>
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
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-0.5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-0.5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
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
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isArchived ? 'bg-slate-200' : 'bg-slate-100'}`}>
                              <Users className={`w-5 h-5 ${isArchived ? 'text-slate-500' : 'text-slate-600'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>
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
                        <td className={`px-4 py-4 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
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
                              <h3 className={`font-semibold text-lg truncate ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>
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
                        <Link 
                          to={createPageUrl(`AccountDetail?id=${contact.account_id}`)}
                          className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400 hover:text-slate-600' : 'text-blue-600 hover:text-blue-800'} transition-colors`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Building2 className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{contact.account_name || 'View Account'}</span>
                        </Link>
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
              <h3 className="text-lg font-medium text-slate-900 mb-1">No contacts found</h3>
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
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Account
                      </th>
                      <th className="px-0.5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-0.5 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
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
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isArchived ? 'bg-slate-200' : 'bg-slate-100'}`}>
                              <Users className={`w-5 h-5 ${isArchived ? 'text-slate-500' : 'text-slate-600'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>
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
                        <td className={`px-4 py-4 text-sm ${isArchived ? 'text-slate-400' : 'text-slate-600'}`}>
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
                              <h3 className={`font-semibold text-lg truncate ${isArchived ? 'text-slate-500' : 'text-slate-900'}`}>
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
                        <Link 
                          to={createPageUrl(`AccountDetail?id=${contact.account_id}`)}
                          className={`flex items-center gap-2 text-sm ${isArchived ? 'text-slate-400 hover:text-slate-600' : 'text-blue-600 hover:text-blue-800'} transition-colors`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Building2 className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{contact.account_name || 'View Account'}</span>
                        </Link>
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
              <h3 className="text-lg font-medium text-slate-900 mb-1">No archived contacts found</h3>
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

