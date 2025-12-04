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
  Upload
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'card'

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
    role: 'user',
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

  // Filter contacts
  let filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.account_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || contact.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleColor = (role) => {
    const colors = {
      decision_maker: 'bg-purple-100 text-purple-800 border-purple-200',
      influencer: 'bg-blue-100 text-blue-800 border-blue-200',
      champion: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      user: 'bg-slate-100 text-slate-800 border-slate-200'
    };
    return colors[role] || colors.user;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <TutorialTooltip
        tip="This is your Contacts page. View all contacts across all accounts, search by name, and filter by role. Each contact belongs to an account and includes contact information and preferences."
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

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="decision_maker">Decision Maker</SelectItem>
              <SelectItem value="influencer">Influencer</SelectItem>
              <SelectItem value="champion">Champion</SelectItem>
              <SelectItem value="user">User</SelectItem>
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

      {/* Contacts List View */}
      {viewMode === 'list' ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-200">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Phone
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredContacts.map((contact) => (
                  <tr 
                    key={contact.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => navigate(createPageUrl(`AccountDetail?id=${contact.account_id}`))}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">
                            {contact.first_name} {contact.last_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {contact.title || '-'}
                    </td>
                    <td className="px-4 py-4">
                      {contact.account_name ? (
                        <Link 
                          to={createPageUrl(`AccountDetail?id=${contact.account_id}`)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <Building2 className="w-4 h-4" />
                          {contact.account_name}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant="outline" className={getRoleColor(contact.role)}>
                        {contact.role ? contact.role.replace('_', ' ') : 'user'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <a 
                        href={`mailto:${contact.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-slate-600 hover:text-blue-600"
                      >
                        {contact.email}
                      </a>
                    </td>
                    <td className="px-4 py-4">
                      {contact.phone ? (
                        <a 
                          href={`tel:${contact.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-slate-600 hover:text-blue-600"
                        >
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Contacts Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.map((contact) => (
          <Card key={contact.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="space-y-4">
                {/* Header */}
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg">
                    {contact.first_name} {contact.last_name}
                  </h3>
                  {contact.title && (
                    <p className="text-sm text-slate-600 mt-1">{contact.title}</p>
                  )}
                </div>

                {/* Account Link */}
                {contact.account_id && (
                  <Link 
                    to={createPageUrl(`AccountDetail?id=${contact.account_id}`)}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Building2 className="w-4 h-4" />
                    {contact.account_name || 'View Account'}
                  </Link>
                )}

                {/* Role Badge */}
                <Badge variant="outline" className={getRoleColor(contact.role)}>
                  {contact.role.replace('_', ' ')}
                </Badge>

                {/* Contact Info */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <a href={`mailto:${contact.email}`} className="hover:text-blue-600 truncate">
                      {contact.email}
                    </a>
                  </div>
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <a href={`tel:${contact.phone}`} className="hover:text-blue-600">
                        {contact.phone}
                      </a>
                    </div>
                  )}
                  {contact.linkedin_url && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Linkedin className="w-4 h-4 flex-shrink-0" />
                      <a 
                        href={contact.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 truncate"
                      >
                        LinkedIn
                      </a>
                    </div>
                  )}
                </div>

                {/* Preferences */}
                {contact.preferences && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 mb-1">Notes:</p>
                    <p className="text-sm text-slate-700 line-clamp-2">{contact.preferences}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      )}

      {filteredContacts.length === 0 && (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No contacts found</h3>
          <p className="text-slate-600 mb-4">
            {searchTerm || filterRole !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first contact to get started'}
          </p>
        </Card>
      )}

      {/* Import Leads Dialog */}
      <ImportLeadsDialog 
        open={isImportDialogOpen} 
        onClose={() => setIsImportDialogOpen(false)}
      />
    </div>
  );
}

