import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit2, Save, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function TrackingAssignment({ account, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  // Check if account was imported (has lmn_crm_id)
  const isImported = account?.lmn_crm_id ? true : false;
  const [formData, setFormData] = useState({
    account_type: account.account_type || 'prospect',
    classification: account.classification || 'commercial',
    assigned_to: account.assigned_to || '',
    referral: account.referral || '',
    referral_note: account.referral_note || '',
    icp_required: account.icp_required !== undefined ? account.icp_required : true,
    icp_status: account.icp_status || 'required'
  });

  const handleSave = () => {
    if (onUpdate) {
      const updateData = { ...formData };
      // If setting to N/A, also clear last_interaction_date
      if (updateData.icp_status === 'na') {
        updateData.last_interaction_date = null;
      }
      onUpdate(updateData);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      account_type: account.account_type || 'prospect',
      classification: account.classification || 'commercial',
      assigned_to: account.assigned_to || '',
      referral: account.referral || '',
      referral_note: account.referral_note || '',
      icp_required: account.icp_required !== undefined ? account.icp_required : true,
      icp_status: account.icp_status || 'required'
    });
    setIsEditing(false);
  };

  const handleICPStatusChange = (newStatus) => {
    const updatedData = {
      ...formData,
      icp_status: newStatus,
      icp_required: newStatus !== 'na'
    };
    
    // If setting to N/A, also clear last_interaction_date in the update
    if (newStatus === 'na') {
      updatedData.last_interaction_date = null;
    }
    
    setFormData(updatedData);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
          Tracking + Assignment
        </CardTitle>
        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="w-3 h-3 mr-1" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label className="text-slate-600 dark:text-slate-400">Type</Label>
            {isEditing ? (
              <>
                <Select
                  value={formData.account_type}
                  onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                  disabled={isImported}
                >
                  <SelectTrigger className={`mt-1 ${isImported ? 'bg-slate-50 cursor-not-allowed' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="renewal">Renewal</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
                {isImported && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This field is managed by import.</p>
                )}
              </>
            ) : (
              <p className="font-medium text-slate-900 dark:text-white mt-1 capitalize">
                {formData.account_type || '—'}
              </p>
            )}
          </div>

          <div>
            <Label className="text-slate-600">Classification</Label>
            {isEditing ? (
              <>
                <Select
                  value={formData.classification}
                  onValueChange={(value) => setFormData({ ...formData, classification: value })}
                  disabled={isImported}
                >
                  <SelectTrigger className={`mt-1 ${isImported ? 'bg-slate-50 cursor-not-allowed' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="non_profit">Non-Profit</SelectItem>
                  </SelectContent>
                </Select>
                {isImported && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This field is managed by import.</p>
                )}
              </>
            ) : (
              <p className="font-medium text-slate-900 dark:text-white mt-1 capitalize">
                {formData.classification?.replace('_', ' ') || '—'}
              </p>
            )}
          </div>

          <div>
            <Label className="text-slate-600">Assigned To</Label>
            {isEditing ? (
              <Input
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="mt-1"
                placeholder="Sales rep email or name"
              />
            ) : (
              <p className="font-medium text-slate-900 dark:text-white mt-1">{formData.assigned_to || '—'}</p>
            )}
          </div>

          <div>
            <Label className="text-slate-600">Referral</Label>
            {isEditing ? (
              <Input
                value={formData.referral}
                onChange={(e) => setFormData({ ...formData, referral: e.target.value })}
                className="mt-1"
                placeholder="Referral source"
              />
            ) : (
              <p className="font-medium text-slate-900 dark:text-white mt-1">{formData.referral || '—'}</p>
            )}
          </div>

          <div>
            <Label className="text-slate-600">Ref. Note</Label>
            {isEditing ? (
              <Textarea
                value={formData.referral_note}
                onChange={(e) => setFormData({ ...formData, referral_note: e.target.value })}
                className="mt-1"
                placeholder="Referral notes..."
                rows={3}
              />
            ) : (
              <p className="font-medium text-slate-900 dark:text-white mt-1 whitespace-pre-wrap">
                {formData.referral_note || '—'}
              </p>
            )}
          </div>

          <div>
            <Label className="text-slate-600">ICP Status</Label>
            {isEditing ? (
              <div className="mt-1 space-y-2">
                <Select
                  value={formData.icp_status}
                  onValueChange={handleICPStatusChange}
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
                <div className="flex items-center gap-2">
                  <Switch
                    id="icp-required"
                    checked={formData.icp_required}
                    onCheckedChange={(checked) => {
                      const newStatus = checked ? 'required' : 'not_required';
                      handleICPStatusChange(newStatus);
                    }}
                  />
                  <Label htmlFor="icp-required" className="text-xs text-slate-600 dark:text-slate-400">
                    ICP Required
                  </Label>
                </div>
                {formData.icp_status === 'na' && (
                  <p className="text-xs text-amber-600 mt-1">
                    N/A accounts are permanently excluded from neglected accounts until status is changed.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-1">
                <Badge 
                  variant="outline" 
                  className={
                    formData.icp_status === 'na' 
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' 
                      : formData.icp_status === 'required'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }
                >
                  {formData.icp_status === 'na' ? 'N/A' : 
                   formData.icp_status === 'required' ? 'Required' : 
                   'Not Required'}
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
















