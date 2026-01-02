import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { calculateRevenueSegment, calculateTotalRevenue, getAccountRevenue } from '@/utils/revenueSegmentCalculator';

export default function EditAccountDialog({ open, onClose, account }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({});
  const [autoCalculateSegment, setAutoCalculateSegment] = useState(true);
  
  // Check if account was imported (has lmn_crm_id)
  const isImported = account?.lmn_crm_id ? true : false;
  
  // Get all accounts to calculate total revenue for segment assignment
  const { data: allAccounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list()
  });

  // Get estimates for this account and all accounts
  const { data: accountEstimates = [] } = useQuery({
    queryKey: ['estimates', account?.id],
    queryFn: async () => {
      if (!account?.id) return [];
      const response = await fetch(`/api/data/estimates?account_id=${encodeURIComponent(account.id)}`);
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    },
    enabled: !!account?.id
  });

  // Get all estimates to calculate total revenue across all accounts
  const { data: allEstimates = [] } = useQuery({
    queryKey: ['estimates'],
    queryFn: async () => {
      const response = await fetch('/api/data/estimates');
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    }
  });
  
  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        account_type: account.account_type || 'prospect',
        status: account.status || 'active',
        revenue_segment: account.revenue_segment || 'C',
        industry: account.industry || '',
        website: account.website || '',
        phone: account.phone || '',
        address: account.address || '',
        renewal_date: account.renewal_date || '',
        assigned_to: account.assigned_to || '',
        notes: account.notes || '',
        icp_required: account.icp_required !== undefined ? account.icp_required : true,
        icp_status: account.icp_status || 'required'
      });
      setAutoCalculateSegment(true); // Reset auto-calc when account changes
    }
  }, [account]);
  
  // Auto-calculate revenue segment based on won estimates
  useEffect(() => {
    if (autoCalculateSegment && account?.id && allAccounts.length > 0 && accountEstimates.length >= 0) {
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
      
      // Calculate total revenue using estimates for all accounts
      const totalRevenue = calculateTotalRevenue(allAccounts, estimatesByAccountId);
      
      if (totalRevenue > 0) {
        // Calculate segment based on actual revenue from won estimates
        const segment = calculateRevenueSegment(account, totalRevenue, accountEstimates);
        setFormData(prev => ({ ...prev, revenue_segment: segment }));
      }
    }
  }, [autoCalculateSegment, allAccounts, allEstimates, account, accountEstimates]);

  const updateAccountMutation = useMutation({
    mutationFn: (data) => base44.entities.Account.update(account.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', account.id] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onClose();
    }
  });

  const handleSubmit = () => {
    const updateData = {
      ...formData
      // annual_revenue is calculated automatically from won estimates, not manually entered
    };
    // If setting to N/A, also clear last_interaction_date
    if (updateData.icp_status === 'na') {
      updateData.last_interaction_date = null;
    }
    updateAccountMutation.mutate(updateData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Company Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import. Update the source data to change it.</p>
              )}
            </div>
            <div>
              <Label>Account Type</Label>
              <Select
                value={formData.account_type}
                onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                disabled={isImported}
              >
                <SelectTrigger className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={isImported}
              >
                <SelectTrigger className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="negotiating">Negotiating</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Revenue Segment</Label>
              <Select
                value={formData.revenue_segment}
                disabled={true}
              >
                <SelectTrigger className="bg-slate-50 cursor-not-allowed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Segment A (≥15%)</SelectItem>
                  <SelectItem value="B">Segment B (5-15%)</SelectItem>
                  <SelectItem value="C">Segment C (0-5%)</SelectItem>
                  <SelectItem value="D">Segment D (Project Only)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">This field is calculated automatically by the system.</p>
            </div>
            <div>
              <Label>Industry</Label>
              <Input
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Assigned To (email)</Label>
              <Input
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              />
            </div>
            <div>
              <Label>Website</Label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div>
              <Label>Renewal Date</Label>
              <Input
                type="date"
                value={formData.renewal_date}
                onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={isImported}
                className={isImported ? 'bg-slate-50 cursor-not-allowed' : ''}
              />
              {isImported && (
                <p className="text-xs text-slate-500 mt-1">This field is managed by import.</p>
              )}
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>ICP Status</Label>
              <Select
                value={formData.icp_status}
                onValueChange={(value) => {
                  const updateData = { 
                    ...formData, 
                    icp_status: value,
                    icp_required: value !== 'na'
                  };
                  // If setting to N/A, also clear last_interaction_date
                  if (value === 'na') {
                    updateData.last_interaction_date = null;
                  }
                  setFormData(updateData);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="not_required">Not Required</SelectItem>
                  <SelectItem value="na">N/A</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 mt-2">
                <Switch
                  id="icp-required-edit"
                  checked={formData.icp_required}
                  onCheckedChange={(checked) => {
                    const newStatus = checked ? 'required' : 'not_required';
                    setFormData({ 
                      ...formData, 
                      icp_required: checked,
                      icp_status: newStatus
                    });
                  }}
                />
                <Label htmlFor="icp-required-edit" className="text-xs text-slate-600">
                  ICP Required
                </Label>
              </div>
              {formData.icp_status === 'na' && (
                <p className="text-xs text-amber-600 mt-1">
                  N/A accounts are permanently excluded from neglected accounts.
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}





