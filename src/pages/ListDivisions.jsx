import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ListDivisions() {
  const [copied, setCopied] = useState(false);

  const { data: result, isLoading, error } = useQuery({
    queryKey: ['all-divisions'],
    queryFn: async () => {
      const response = await fetch('/api/data/estimates');
      if (!response.ok) {
        throw new Error(`Failed to fetch estimates: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error('No estimates data found');
      }
      return result.data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading divisions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const estimates = result || [];
  
  // Get all unique division values with counts
  const divisionCounts = {};
  let emptyCount = 0;
  
  estimates.forEach(est => {
    const division = est.division ? est.division.trim() : '';
    
    if (!division || division === '') {
      emptyCount++;
    } else {
      divisionCounts[division] = (divisionCounts[division] || 0) + 1;
    }
  });
  
  // Sort by count (descending)
  const sortedDivisions = Object.entries(divisionCounts)
    .sort((a, b) => b[1] - a[1]);

  const copyToClipboard = () => {
    const text = sortedDivisions.map(([div]) => div).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Unique Division Values</CardTitle>
            <button
              onClick={copyToClipboard}
              className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1 border border-slate-300 rounded hover:bg-slate-50"
            >
              {copied ? '✓ Copied' : 'Copy List'}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-slate-600 mb-4">
              Total estimates: <strong>{estimates.length}</strong> | 
              Unique divisions: <strong>{sortedDivisions.length + (emptyCount > 0 ? 1 : 0)}</strong>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-semibold">Division</th>
                    <th className="text-right py-2 px-3 font-semibold">Count</th>
                    <th className="text-right py-2 px-3 font-semibold">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {emptyCount > 0 && (
                    <tr className="border-b border-slate-100">
                      <td className="py-2 px-3 text-slate-500 italic">(empty/null)</td>
                      <td className="text-right py-2 px-3">{emptyCount.toLocaleString()}</td>
                      <td className="text-right py-2 px-3">
                        {((emptyCount / estimates.length) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  )}
                  {sortedDivisions.map(([div, count]) => (
                    <tr key={div} className="border-b border-slate-100">
                      <td className="py-2 px-3 font-mono">{div}</td>
                      <td className="text-right py-2 px-3">{count.toLocaleString()}</td>
                      <td className="text-right py-2 px-3">
                        {((count / estimates.length) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

