import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plus, Phone, LayoutGrid, List } from 'lucide-react';

export default function JobsitesTab({ jobsites = [], accountId }) {
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list' - default to card view

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Jobsites ({jobsites.length})
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 border border-slate-300 rounded-lg p-1">
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className={`h-8 px-3 ${viewMode === 'card' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={`h-8 px-3 ${viewMode === 'list' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            New Jobsite
          </Button>
        </div>
      </div>

      {/* Jobsites List */}
      {jobsites.length > 0 ? (
        viewMode === 'card' ? (
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
                      <h4 className="font-semibold text-slate-900 dark:text-white">{jobsite.name || 'Unnamed Jobsite'}</h4>
                      <p className="text-sm text-slate-600 mt-1">
                        {[
                          jobsite.address_1,
                          jobsite.address_2,
                          jobsite.city,
                          jobsite.state,
                          jobsite.postal_code
                        ].filter(Boolean).join(', ') || 'No address'}
                      </p>
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
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Jobsite
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {jobsites.map((jobsite) => (
                    <tr 
                      key={jobsite.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {jobsite.name || 'Unnamed Jobsite'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {[
                          jobsite.address_1,
                          jobsite.address_2,
                          jobsite.city,
                          jobsite.state,
                          jobsite.postal_code
                        ].filter(Boolean).join(', ') || 'No address'}
                      </td>
                      <td className="px-4 py-4">
                        {jobsite.contact_name ? (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="w-4 h-4" />
                            <span>{jobsite.contact_name}</span>
                            {jobsite.contact_phone && (
                              <span className="ml-2">• {jobsite.contact_phone}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {jobsite.status ? (
                          <Badge variant="outline" className="text-slate-600">
                            {jobsite.status}
                          </Badge>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {jobsite.notes ? (
                          <p className="text-sm text-slate-600 italic line-clamp-2">{jobsite.notes}</p>
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
        )
      ) : (
        <Card className="p-12 text-center">
          <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No jobsites found</h3>
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










