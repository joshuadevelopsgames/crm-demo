import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator } from 'lucide-react';

export default function EstimatesStats({ estimates = [] }) {
  const currentYear = new Date().getFullYear();
  
  const thisYearEstimates = estimates.filter(e => {
    const estimateYear = new Date(e.estimate_date || e.created_date).getFullYear();
    return estimateYear === currentYear;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Total Estimates
          </CardTitle>
          <Calculator className="w-5 h-5 text-slate-400" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-slate-600">THIS YEAR</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {thisYearEstimates.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">ALL TIME</p>
            <p className="text-2xl font-semibold text-slate-700 mt-1">
              {estimates.length}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}












