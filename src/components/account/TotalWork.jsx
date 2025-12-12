import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function TotalWork({ estimates = [] }) {
  // Calculate total estimated value
  const totalEstimated = estimates.reduce((sum, est) => sum + (est.total_amount || 0), 0);
  
  // Calculate total sold value (won estimates)
  const totalSold = estimates
    .filter(est => est.status === 'won')
    .reduce((sum, est) => sum + (est.total_amount || 0), 0);
  
  // Calculate sold percentage
  const soldPercentage = totalEstimated > 0 
    ? Math.round((totalSold / totalEstimated) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Total Work
          </CardTitle>
          <TrendingUp className="w-5 h-5 text-slate-400" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-slate-600">ESTIMATED</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              ${totalEstimated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">SOLD</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">
              ${totalSold.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {totalEstimated > 0 && (
                <span className="text-base ml-2">({soldPercentage}%)</span>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}










