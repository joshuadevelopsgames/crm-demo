import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

/**
 * Get the year(s) an estimate applies to and its annualized value for the current year
 * @param {Object} estimate - Estimate object
 * @param {number} currentYear - Current year (e.g., 2024)
 * @returns {Object|null} - { appliesToCurrentYear: boolean, annualizedValue: number } or null if no valid date
 */
function getEstimateYearData(estimate, currentYear) {
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  
  const totalPrice = parseFloat(estimate.total_price_with_tax) || parseFloat(estimate.total_price) || 0;
  if (totalPrice === 0) return null;
  
  // Case 1: Both contract_start and contract_end exist
  if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
    const startYear = contractStart.getFullYear();
    const endYear = contractEnd.getFullYear();
    const numberOfYears = endYear - startYear + 1;
    
    if (numberOfYears <= 0) return null;
    
    const annualizedValue = totalPrice / numberOfYears;
    const appliesToCurrentYear = currentYear >= startYear && currentYear <= endYear;
    
    return {
      appliesToCurrentYear,
      annualizedValue
    };
  }
  
  // Case 2: Only contract_start exists
  if (contractStart && !isNaN(contractStart.getTime())) {
    const startYear = contractStart.getFullYear();
    const appliesToCurrentYear = currentYear === startYear;
    
    return {
      appliesToCurrentYear,
      annualizedValue: totalPrice
    };
  }
  
  // Case 3: No contract dates, use estimate_date
  if (estimateDate && !isNaN(estimateDate.getTime())) {
    const estimateYear = estimateDate.getFullYear();
    const appliesToCurrentYear = currentYear === estimateYear;
    
    return {
      appliesToCurrentYear,
      annualizedValue: totalPrice
    };
  }
  
  // No valid date found
  return null;
}

export default function TotalWork({ estimates = [] }) {
  const currentYear = new Date().getFullYear();
  
  // Calculate total estimated value for current year
  const totalEstimated = useMemo(() => {
    return estimates.reduce((sum, est) => {
      const yearData = getEstimateYearData(est, currentYear);
      if (!yearData || !yearData.appliesToCurrentYear) {
        return sum;
      }
      return sum + yearData.annualizedValue;
    }, 0);
  }, [estimates, currentYear]);
  
  // Calculate total sold value (won estimates) for current year
  const totalSold = useMemo(() => {
    return estimates
      .filter(est => est.status === 'won')
      .reduce((sum, est) => {
        const yearData = getEstimateYearData(est, currentYear);
        if (!yearData || !yearData.appliesToCurrentYear) {
          return sum;
        }
        return sum + yearData.annualizedValue;
      }, 0);
  }, [estimates, currentYear]);
  
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










