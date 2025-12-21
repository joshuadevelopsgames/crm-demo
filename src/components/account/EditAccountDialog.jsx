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
import { calculateRevenueSegment, calculateTotalRevenue, getAccountRevenue } from '@/utils/revenueSegmentCalculator';

export default function EditAccountDialog({ open, onClose, account }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({});
  const [autoCalculateSegment, setAutoCalculateSegment] = useState(true);
  
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
        annual_revenue: account.annual_revenue || '',
        industry: account.industry || '',
        website: account.website || '',
        phone: account.phone || '',
        address: account.address || '',
        renewal_date: account.renewal_date || '',
        assigned_to: account.assigned_to || '',
        notes: account.notes || ''
      });
      setAutoCalculateSegment(true); // Reset auto-calc when account changes
    }
  }, [account]);
  
  // Auto-calculate revenue segment when annual revenue changes
  useEffect(() => {
    if (autoCalculateSegment && formData.annual_revenue && allAccounts.length > 0) {
      const enteredRevenue = parseFloat(formData.annual_revenue);
      if (!isNaN(enteredRevenue) && enteredRevenue > 0) {
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
        
        // For the account being edited, use entered revenue value
        // For all other accounts, use actual revenue from won estimates
        const currentAccountRevenue = account?.id 
          ? getAccountRevenue(account, estimatesByAccountId[account.id] || accountEstimates)
          : 0;
        
        // Calculate total revenue using estimates for all accounts
        const totalRevenue = calculateTotalRevenue(allAccounts, estimatesByAccountId);
        // Adjust: subtract current account's actual revenue, add entered revenue
        const adjustedTotal = totalRevenue - currentAccountRevenue + enteredRevenue;
        
        if (adjustedTotal > 0) {
          // Use entered revenue for this account's segment calculation
          const tempAccount = { annual_revenue: enteredRevenue };
          const segment = calculateRevenueSegment(tempAccount, adjustedTotal);
          setFormData(prev => ({ ...prev, revenue_segment: segment }));
        }
      }
    }
  }, [formData.annual_revenue, autoCalculateSegment, allAccounts, allEstimates, account, accountEstimates]);

  const updateAccountMutation = useMutation({
    mutationFn: (data) => base44.entities.Account.update(account.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', account.id] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      onClose();
    }
  });

  const handleSubmit = () => {
    updateAccountMutation.mutate({
      ...formData,
      annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : null
    });
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
              />
            </div>
            <div>
              <Label>Account Type</Label>
              <Select
                value={formData.account_type}
                onValueChange={(value) => setFormData({ ...formData, account_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
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
            </div>
            <div>
              <Label>Annual Revenue</Label>
              <Input
                type="number"
                value={formData.annual_revenue}
                onChange={(e) => setFormData({ ...formData, annual_revenue: e.target.value })}
                placeholder="Enter annual revenue"
              />
              <p className="text-xs text-slate-500 mt-1">
                Segment will auto-calculate based on rolling 12-month average: A (≥15%), B (5-15%), C (0-5%), D (Project Only)
              </p>
            </div>
            <div>
              <Label>Revenue Segment</Label>
              <Select
                value={formData.revenue_segment}
                onValueChange={(value) => {
                  setFormData({ ...formData, revenue_segment: value });
                  setAutoCalculateSegment(false); // Disable auto-calc if manually changed
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Segment A (≥15%)</SelectItem>
                  <SelectItem value="B">Segment B (5-15%)</SelectItem>
                  <SelectItem value="C">Segment C (0-5%)</SelectItem>
                  <SelectItem value="D">Segment D (Project Only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Industry</Label>
              <Input
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              />
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
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
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
              />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
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





