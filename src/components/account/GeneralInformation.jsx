import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Lock, Edit2, Save, X } from 'lucide-react';

export default function GeneralInformation({ account, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: account.name || '',
    address_1: account.address_1 || '',
    address_2: account.address_2 || '',
    city: account.city || '',
    state: account.state || '',
    postal_code: account.postal_code || '',
    country: account.country || 'CA',
    archived: account.archived || false
  });

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(formData);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      name: account.name || '',
      address_1: account.address_1 || '',
      address_2: account.address_2 || '',
      city: account.city || '',
      state: account.state || '',
      postal_code: account.postal_code || '',
      country: account.country || 'CA',
      archived: account.archived || false
    });
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            General Information
          </CardTitle>
          <Lock className="w-4 h-4 text-slate-400" />
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label className="text-slate-600">Name</Label>
            {isEditing ? (
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="font-medium text-slate-900 mt-1">{formData.name || '—'}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label className="text-slate-600">Address 1</Label>
            {isEditing ? (
              <Input
                value={formData.address_1}
                onChange={(e) => setFormData({ ...formData, address_1: e.target.value })}
                className="mt-1"
                placeholder="Street address, P.O. box"
              />
            ) : (
              <p className="font-medium text-slate-900 mt-1">{formData.address_1 || '—'}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label className="text-slate-600">Address 2</Label>
            {isEditing ? (
              <Input
                value={formData.address_2}
                onChange={(e) => setFormData({ ...formData, address_2: e.target.value })}
                className="mt-1"
                placeholder="Apartment, suite, unit, building, floor, etc."
              />
            ) : (
              <p className="font-medium text-slate-900 mt-1">{formData.address_2 || '—'}</p>
            )}
          </div>

          <div>
            <Label className="text-slate-600">City</Label>
            {isEditing ? (
              <Input
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="font-medium text-slate-900 mt-1">{formData.city || '—'}</p>
            )}
          </div>

          <div>
            <Label className="text-slate-600">State/Prov</Label>
            {isEditing ? (
              <Input
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="mt-1"
                placeholder="AB"
              />
            ) : (
              <p className="font-medium text-slate-900 mt-1">{formData.state || '—'}</p>
            )}
          </div>

          <div>
            <Label className="text-slate-600">Postal/Zip</Label>
            {isEditing ? (
              <Input
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                className="mt-1"
                placeholder="T2P 1A1"
              />
            ) : (
              <p className="font-medium text-slate-900 mt-1">{formData.postal_code || '—'}</p>
            )}
          </div>

          <div>
            <Label className="text-slate-600">Country</Label>
            {isEditing ? (
              <Input
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="mt-1"
                placeholder="CA"
                maxLength={2}
              />
            ) : (
              <p className="font-medium text-slate-900 mt-1">{formData.country || '—'}</p>
            )}
          </div>

          <div>
            <Label className="text-slate-600">Archived</Label>
            <p className="font-medium text-slate-900 mt-1">
              {formData.archived ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}




