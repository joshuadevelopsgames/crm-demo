import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Phone } from 'lucide-react';

export default function JobsitesTab({ jobsites = [], accountId }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          Jobsites ({jobsites.length})
        </h3>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          New Jobsite
        </Button>
      </div>

      {/* Jobsites List */}
      {jobsites.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {jobsites.map((jobsite) => (
            <Card key={jobsite.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{jobsite.name}</h4>
                      <p className="text-sm text-slate-600 mt-1">{jobsite.address}</p>
                    </div>
                  </div>
                  {jobsite.status && (
                    <Badge variant="outline" className="text-slate-600">
                      {jobsite.status}
                    </Badge>
                  )}
                </div>

                {jobsite.contact_name && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="w-4 h-4" />
                    <span>{jobsite.contact_name}</span>
                    {jobsite.contact_phone && (
                      <span className="ml-2">• {jobsite.contact_phone}</span>
                    )}
                  </div>
                )}

                {jobsite.notes && (
                  <p className="text-sm text-slate-600 italic">{jobsite.notes}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No jobsites found</h3>
          <p className="text-slate-600 mb-4">
            Add jobsite locations for this account to track work sites
          </p>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Jobsite
          </Button>
        </Card>
      )}
    </div>
  );
}




