import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Target } from 'lucide-react';

export default function EstimatesStats({ estimates = [] }) {
  const currentYear = new Date().getFullYear();
  
  const thisYearEstimates = estimates.filter(e => {
    const estimateYear = new Date(e.estimate_date || e.created_date).getFullYear();
    return estimateYear === currentYear;
  });

  // Calculate win percentage for all estimates
  const winPercentage = useMemo(() => {
    if (estimates.length === 0) return 0;
    const won = estimates.filter(est => est.status === 'won').length;
    return (won / estimates.length) * 100;
  }, [estimates]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Total Estimates
          </CardTitle>
          <Calculator className="w-5 h-5 text-slate-400 dark:text-slate-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">THIS YEAR</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-[#ffffff] mt-1">
              {thisYearEstimates.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">ALL TIME</p>
            <p className="text-2xl font-semibold text-slate-700 dark:text-slate-300 mt-1">
              {estimates.length}
            </p>
          </div>
          {estimates.length > 0 && (
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">WIN RATE</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    winPercentage >= 50
                      ? 'text-emerald-600'
                      : winPercentage >= 30
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}>
                    {winPercentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}














