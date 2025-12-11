import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Plus, Calendar, DollarSign, Filter } from 'lucide-react';
import { format } from 'date-fns';

export default function EstimatesTab({ estimates = [], accountId }) {
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredEstimates = estimates.filter(est => {
    if (filterStatus === 'all') return true;
    return est.status === filterStatus;
  });

  const getStatusColor = (status) => {
    const colors = {
      won: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      lost: 'bg-red-100 text-red-800 border-red-200',
      pending: 'bg-amber-100 text-amber-800 border-amber-200'
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          Estimates ({filteredEstimates.length})
        </h3>
        <div className="flex gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            New Estimate
          </Button>
        </div>
      </div>

      {/* Estimates List */}
      {filteredEstimates.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                    Estimate #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEstimates.map((estimate) => (
                  <tr key={estimate.id} className="hover:bg-slate-50 cursor-pointer">
                    <td className="px-4 py-4">
                      <span className="font-mono text-sm font-medium text-slate-900">
                        {estimate.estimate_number || estimate.id}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="w-4 h-4" />
                        {estimate.estimate_date ? format(new Date(estimate.estimate_date), 'MMM d, yyyy') : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-slate-900">{estimate.description || '—'}</p>
                      {estimate.notes && (
                        <p className="text-xs text-slate-500 mt-1">{estimate.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="w-4 h-4 text-slate-500" />
                        <span className="font-semibold text-slate-900">
                          {estimate.total_amount ? estimate.total_amount.toLocaleString() : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge variant="outline" className={getStatusColor(estimate.status)}>
                        {estimate.status?.toUpperCase() || 'PENDING'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No estimates found</h3>
          <p className="text-slate-600 mb-4">
            {filterStatus !== 'all' 
              ? 'No estimates match the selected filter'
              : 'Create your first estimate for this account'}
          </p>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Estimate
          </Button>
        </Card>
      )}
    </div>
  );
}




