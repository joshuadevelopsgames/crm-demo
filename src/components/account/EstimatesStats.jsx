import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Target } from 'lucide-react';
import { getCurrentYear } from '@/contexts/YearSelectorContext';
import { isWonStatus } from '@/utils/reportCalculations';
import { getEstimateYearData } from '@/utils/revenueSegmentCalculator';

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

export default function EstimatesStats({ estimates = [], account = null, selectedYear: propSelectedYear = null }) {
  // Use propSelectedYear if provided (from account page), otherwise use context
  const currentYear = propSelectedYear !== null ? propSelectedYear : getCurrentYearForCalculation();
  
  // Per Estimates spec R20-R23: Use pre-calculated total_estimates_by_year
  // Fallback to on-the-fly calculation if stored value is missing or 0
  const thisYearEstimatesCount = useMemo(() => {
    // Try to use pre-calculated value first
    if (account && account.total_estimates_by_year && typeof account.total_estimates_by_year === 'object') {
      const yearCount = account.total_estimates_by_year[currentYear.toString()];
      const storedCount = typeof yearCount === 'number' ? yearCount : parseInt(yearCount) || 0;
      
      // If stored value exists and is > 0, use it
      if (storedCount > 0) {
        return storedCount;
      }
    }
    
    // Fallback: Calculate on-the-fly if stored value is missing or 0
    // Filter estimates that apply to current year (excluding archived)
    const yearEstimates = estimates.filter(est => {
      if (est.archived) return false;
      const yearData = getEstimateYearData(est, currentYear);
      return yearData && yearData.appliesToCurrentYear;
    });
    
    return yearEstimates.length;
  }, [account, currentYear, estimates]);

  // Per spec R1, R11: Calculate win percentage using isWonStatus to respect pipeline_status priority
  // Calculate win rate for selected year estimates only
  const winPercentage = useMemo(() => {
    const yearEstimates = estimates.filter(est => {
      const yearData = getEstimateYearData(est, currentYear);
      return yearData && yearData.appliesToCurrentYear;
    });
    if (yearEstimates.length === 0) return 0;
    const won = yearEstimates.filter(est => isWonStatus(est)).length;
    return (won / yearEstimates.length) * 100;
  }, [estimates, currentYear]);

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
            <p className="text-sm text-slate-600 dark:text-slate-400">{currentYear}</p>
            <p className="text-3xl font-bold text-slate-900 dark:text-[#ffffff] mt-1">
              {thisYearEstimatesCount}
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














