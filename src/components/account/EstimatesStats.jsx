import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Target } from 'lucide-react';
import { getCurrentYear } from '@/contexts/YearSelectorContext';
import { getYearFromDateString } from '@/utils/dateFormatter';
import { isWonStatus } from '@/utils/reportCalculations';

// Helper to get current year (respects year selector) - REQUIRED, no fallback
// Per user requirement: Never fall back to current year, only ever go by selected year
function getCurrentYearForCalculation() {
  try {
    return getCurrentYear();
  } catch (error) {
    // Fallback if context not initialized yet
    if (typeof window !== 'undefined' && window.__getCurrentYear) {
      return window.__getCurrentYear();
    }
    // No fallback - selected year is required
    throw new Error('EstimatesStats.getCurrentYearForCalculation: YearSelectorContext not initialized. Selected year is required.');
  }
}

export default function EstimatesStats({ estimates = [] }) {
  const currentYear = getCurrentYearForCalculation();
  
  // Per spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
  const thisYearEstimates = estimates.filter(e => {
    let dateStr = null;
    // Priority 1: contract_end
    if (e.contract_end) {
      dateStr = e.contract_end;
    }
    // Priority 2: contract_start
    else if (e.contract_start) {
      dateStr = e.contract_start;
    }
    // Priority 3: estimate_date
    else if (e.estimate_date) {
      dateStr = e.estimate_date;
    }
    // Priority 4: created_date
    else if (e.created_date) {
      dateStr = e.created_date;
    }
    
    if (!dateStr) return false;
    const estimateYear = getYearFromDateString(dateStr) || (dateStr instanceof Date ? dateStr.getFullYear() : null);
    return estimateYear === currentYear;
  });

  // Per spec R1, R11: Calculate win percentage using isWonStatus to respect pipeline_status priority
  const winPercentage = useMemo(() => {
    if (estimates.length === 0) return 0;
    const won = estimates.filter(est => isWonStatus(est)).length;
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














