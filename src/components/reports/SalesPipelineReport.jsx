import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/utils/reportCalculations';
import { TrendingUp } from 'lucide-react';

export default function SalesPipelineReport({ estimates }) {
  // Group estimates by pipeline_status and calculate stats
  const pipelineStats = useMemo(() => {
    const grouped = {};
    let totalEstimates = 0;
    let totalPrice = 0;
    
    estimates.forEach(est => {
      // Use pipeline_status if available, otherwise fall back to status
      const pipelineStatus = est.pipeline_status || est.status || 'Unknown';
      const normalizedStatus = pipelineStatus.trim() || 'Unknown';
      
      if (!grouped[normalizedStatus]) {
        grouped[normalizedStatus] = {
          status: normalizedStatus,
          count: 0,
          price: 0
        };
      }
      
      grouped[normalizedStatus].count++;
      totalEstimates++;
      
      const price = parseFloat(est.total_price || est.total_price_with_tax || 0);
      grouped[normalizedStatus].price += price;
      totalPrice += price;
    });
    
    // Convert to array and sort by count (descending)
    const stats = Object.values(grouped).sort((a, b) => b.count - a.count);
    
    return {
      stats,
      total: {
        count: totalEstimates,
        price: totalPrice
      }
    };
  }, [estimates]);
  
  // Common pipeline statuses in LMN (normalize to match LMN format)
  const normalizeStatus = (status) => {
    if (!status) return 'Unknown';
    const normalized = status.trim();
    // Map common variations to LMN format
    if (normalized.toLowerCase() === 'won' || normalized.toLowerCase() === 'sold') return 'Sold';
    if (normalized.toLowerCase() === 'lost') return 'Lost';
    if (normalized.toLowerCase() === 'pending' || normalized.toLowerCase() === 'open') return 'Pending';
    return normalized; // Keep original if not a common variation
  };
  
  // Re-group with normalized statuses
  const normalizedStats = useMemo(() => {
    const grouped = {};
    let totalEstimates = 0;
    let totalPrice = 0;
    
    estimates.forEach(est => {
      const pipelineStatus = est.pipeline_status || est.status || 'Unknown';
      const normalized = normalizeStatus(pipelineStatus);
      
      if (!grouped[normalized]) {
        grouped[normalized] = {
          status: normalized,
          count: 0,
          price: 0
        };
      }
      
      grouped[normalized].count++;
      totalEstimates++;
      
      const price = parseFloat(est.total_price || est.total_price_with_tax || 0);
      grouped[normalized].price += price;
      totalPrice += price;
    });
    
    // Sort: Sold, Pending, Lost, then others
    const order = ['Sold', 'Pending', 'Lost'];
    const stats = Object.values(grouped).sort((a, b) => {
      const aIndex = order.indexOf(a.status);
      const bIndex = order.indexOf(b.status);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return b.count - a.count; // Others sorted by count
    });
    
    return {
      stats,
      total: {
        count: totalEstimates,
        price: totalPrice
      }
    };
  }, [estimates]);
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Sales Pipeline Detail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-semibold text-slate-900 dark:text-white">Sales Pipeline Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-900 dark:text-white"># of Estimates</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-900 dark:text-white">Price</th>
                </tr>
              </thead>
              <tbody>
                {normalizedStats.stats.map((stat) => (
                  <tr key={stat.status} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{stat.status}</td>
                    <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{stat.count.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{formatCurrency(stat.price)}</td>
                  </tr>
                ))}
                {normalizedStats.stats.length > 0 && (
                  <tr className="font-semibold bg-slate-50 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600">
                    <td className="py-3 px-4 text-slate-900 dark:text-white">Sum</td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-white">{normalizedStats.total.count.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-white">{formatCurrency(normalizedStats.total.price)}</td>
                  </tr>
                )}
                {normalizedStats.stats.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-slate-500 py-8">
                      No estimates found for selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

