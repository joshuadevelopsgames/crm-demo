import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, ChevronDown, ChevronUp, Info } from 'lucide-react';

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
  const [showBreakdown, setShowBreakdown] = useState(false);
  
  // Calculate breakdown for ESTIMATED
  const estimatedBreakdown = useMemo(() => {
    const included = [];
    const excluded = [];
    
    estimates.forEach(est => {
      const yearData = getEstimateYearData(est, currentYear);
      const totalPrice = parseFloat(est.total_price_with_tax) || parseFloat(est.total_price) || 0;
      
      let reason = '';
      let determinationMethod = '';
      
      if (totalPrice === 0) {
        reason = 'Total price is $0';
        excluded.push({ estimate: est, reason, determinationMethod });
        return;
      }
      
      const contractStart = est.contract_start ? new Date(est.contract_start) : null;
      const contractEnd = est.contract_end ? new Date(est.contract_end) : null;
      const estimateDate = est.estimate_date ? new Date(est.estimate_date) : null;
      
      if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
        const startYear = contractStart.getFullYear();
        const endYear = contractEnd.getFullYear();
        determinationMethod = `Contract: ${startYear}-${endYear} (${endYear - startYear + 1} years)`;
      } else if (contractStart && !isNaN(contractStart.getTime())) {
        determinationMethod = `Contract Start: ${contractStart.getFullYear()}`;
      } else if (estimateDate && !isNaN(estimateDate.getTime())) {
        determinationMethod = `Estimate Date: ${estimateDate.getFullYear()}`;
      } else {
        reason = 'No valid date found (no contract_start, contract_end, or estimate_date)';
        excluded.push({ estimate: est, reason, determinationMethod });
        return;
      }
      
      if (yearData && yearData.appliesToCurrentYear) {
        included.push({
          estimate: est,
          totalPrice,
          annualizedValue: yearData.annualizedValue,
          determinationMethod
        });
      } else {
        reason = `Does not apply to ${currentYear}`;
        excluded.push({ estimate: est, reason, determinationMethod, totalPrice });
      }
    });
    
    return { included, excluded };
  }, [estimates, currentYear]);
  
  // Calculate breakdown for SOLD
  const soldBreakdown = useMemo(() => {
    const included = [];
    const excluded = [];
    
    estimates
      .filter(est => est.status === 'won')
      .forEach(est => {
        const yearData = getEstimateYearData(est, currentYear);
        const totalPrice = parseFloat(est.total_price_with_tax) || parseFloat(est.total_price) || 0;
        
        let reason = '';
        let determinationMethod = '';
        
        if (totalPrice === 0) {
          reason = 'Total price is $0';
          excluded.push({ estimate: est, reason, determinationMethod });
          return;
        }
        
        const contractStart = est.contract_start ? new Date(est.contract_start) : null;
        const contractEnd = est.contract_end ? new Date(est.contract_end) : null;
        const estimateDate = est.estimate_date ? new Date(est.estimate_date) : null;
        
        if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
          const startYear = contractStart.getFullYear();
          const endYear = contractEnd.getFullYear();
          determinationMethod = `Contract: ${startYear}-${endYear} (${endYear - startYear + 1} years)`;
        } else if (contractStart && !isNaN(contractStart.getTime())) {
          determinationMethod = `Contract Start: ${contractStart.getFullYear()}`;
        } else if (estimateDate && !isNaN(estimateDate.getTime())) {
          determinationMethod = `Estimate Date: ${estimateDate.getFullYear()}`;
        } else {
          reason = 'No valid date found';
          excluded.push({ estimate: est, reason, determinationMethod });
          return;
        }
        
        if (yearData && yearData.appliesToCurrentYear) {
          included.push({
            estimate: est,
            totalPrice,
            annualizedValue: yearData.annualizedValue,
            determinationMethod
          });
        } else {
          reason = `Does not apply to ${currentYear}`;
          excluded.push({ estimate: est, reason, determinationMethod, totalPrice });
        }
      });
    
    return { included, excluded };
  }, [estimates, currentYear]);
  
  // Calculate totals
  const totalEstimated = useMemo(() => {
    return estimatedBreakdown.included.reduce((sum, item) => sum + item.annualizedValue, 0);
  }, [estimatedBreakdown]);
  
  const totalSold = useMemo(() => {
    return soldBreakdown.included.reduce((sum, item) => sum + item.annualizedValue, 0);
  }, [soldBreakdown]);
  
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
            <p className="text-xs text-slate-500 mt-1">
              {estimatedBreakdown.included.length} estimate{estimatedBreakdown.included.length !== 1 ? 's' : ''} included
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
            <p className="text-xs text-slate-500 mt-1">
              {soldBreakdown.included.length} won estimate{soldBreakdown.included.length !== 1 ? 's' : ''} included
            </p>
          </div>
          
          {/* Breakdown Section */}
          <div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="w-full justify-between text-xs text-slate-600 hover:text-slate-900"
            >
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3" />
                Show calculation breakdown
              </span>
              {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            {showBreakdown && (
              <div className="space-y-4 mt-3 pt-3 border-t border-slate-200">
              {/* ESTIMATED Breakdown */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">ESTIMATED Breakdown</h4>
                <div className="space-y-2">
                  {estimatedBreakdown.included.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-1">Included ({estimatedBreakdown.included.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {estimatedBreakdown.included.map((item, idx) => (
                          <div key={idx} className="text-xs bg-slate-50 p-2 rounded border border-slate-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">
                                  ID: {item.estimate.id || item.estimate.lmn_estimate_id || `Estimate ${idx + 1}`}
                                </p>
                                <p className="text-slate-600 mt-0.5">{item.determinationMethod}</p>
                                <p className="text-slate-500 mt-0.5">
                                  Total: ${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  {item.annualizedValue !== item.totalPrice && (
                                    <span> → Annualized: ${item.annualizedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No estimates included</p>
                  )}
                  
                  {estimatedBreakdown.excluded.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-1">Excluded ({estimatedBreakdown.excluded.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {estimatedBreakdown.excluded.map((item, idx) => (
                          <div key={idx} className="text-xs bg-amber-50 p-2 rounded border border-amber-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">
                                  ID: {item.estimate.id || item.estimate.lmn_estimate_id || `Estimate ${idx + 1}`}
                                </p>
                                {item.determinationMethod && (
                                  <p className="text-slate-600 mt-0.5">{item.determinationMethod}</p>
                                )}
                                {item.totalPrice > 0 && (
                                  <p className="text-slate-500 mt-0.5">
                                    Total: ${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                )}
                                <p className="text-amber-700 mt-0.5 font-medium">Reason: {item.reason}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* SOLD Breakdown */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">SOLD Breakdown (Won Estimates Only)</h4>
                <div className="space-y-2">
                  {soldBreakdown.included.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-1">Included ({soldBreakdown.included.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {soldBreakdown.included.map((item, idx) => (
                          <div key={idx} className="text-xs bg-emerald-50 p-2 rounded border border-emerald-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">
                                  ID: {item.estimate.id || item.estimate.lmn_estimate_id || `Estimate ${idx + 1}`}
                                </p>
                                <p className="text-slate-600 mt-0.5">{item.determinationMethod}</p>
                                <p className="text-slate-500 mt-0.5">
                                  Total: ${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  {item.annualizedValue !== item.totalPrice && (
                                    <span> → Annualized: ${item.annualizedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No won estimates included</p>
                  )}
                  
                  {soldBreakdown.excluded.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-1">Excluded ({soldBreakdown.excluded.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {soldBreakdown.excluded.map((item, idx) => (
                          <div key={idx} className="text-xs bg-amber-50 p-2 rounded border border-amber-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">
                                  ID: {item.estimate.id || item.estimate.lmn_estimate_id || `Estimate ${idx + 1}`}
                                </p>
                                {item.determinationMethod && (
                                  <p className="text-slate-600 mt-0.5">{item.determinationMethod}</p>
                                )}
                                {item.totalPrice > 0 && (
                                  <p className="text-slate-500 mt-0.5">
                                    Total: ${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                )}
                                <p className="text-amber-700 mt-0.5 font-medium">Reason: {item.reason}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}










