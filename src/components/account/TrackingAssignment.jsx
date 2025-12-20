import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit2, Save, X } from 'lucide-react';

export default function TrackingAssignment({ account, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    account_type: account.account_type || 'prospect',
    classification: account.classification || 'commercial',
    assigned_to: account.assigned_to || '',
    referral: account.referral || '',
    referral_note: account.referral_note || ''
  });

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(formData);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      account_type: account.account_type || 'prospect',
      classification: account.classification || 'commercial',
      assigned_to: account.assigned_to || '',
      referral: account.referral || '',
      referral_note: account.referral_note || ''
    });
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
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
            <Label className="text-slate-600">Type</Label>
            {isEditing ? (
              <Select
                value={formData.account_type}
                onValueChange={(value) => setFormData({ ...formData, account_type: value })}
              >
                <SelectTrigger className="mt-1">
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
            ) : (
              <p className="font-medium text-slate-900 mt-1 capitalize">
                {formData.account_type || '—'}
              </p>
            )}
          </div>

          <div>
            <Label className="text-slate-600">Classification</Label>
            {isEditing ? (
              <Select
                value={formData.classification}
                onValueChange={(value) => setFormData({ ...formData, classification: value })}
              >
                <SelectTrigger className="mt-1">
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
            ) : (
              <p className="font-medium text-slate-900 mt-1 capitalize">
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
              <p className="font-medium text-slate-900 mt-1">{formData.assigned_to || '—'}</p>
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
              <p className="font-medium text-slate-900 mt-1">{formData.referral || '—'}</p>
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
              <p className="font-medium text-slate-900 mt-1 whitespace-pre-wrap">
                {formData.referral_note || '—'}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}














