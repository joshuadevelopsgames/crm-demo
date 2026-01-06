import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, FileText } from 'lucide-react';
import { calculateOverallStats, calculateAccountStats, formatCurrency, enhanceAccountStatsWithMetadata } from '@/utils/reportCalculations';
import { Badge } from '@/components/ui/badge';

export default function WinLossReport({ estimates, accounts, selectedYear, interactionStatsMap, scorecardStatsMap }) {
  const overallStats = calculateOverallStats(estimates);
  const baseAccountStats = calculateAccountStats(estimates, accounts);
  
  // Enhance account stats with metadata (organization_score, revenue_segment, interactions, scorecards)
  const accountStats = enhanceAccountStatsWithMetadata(
    baseAccountStats,
    accounts,
    interactionStatsMap || new Map(),
    scorecardStatsMap || new Map(),
    selectedYear
  );
  
  // Data for pie chart
  const pieData = [
    { name: 'Won', value: overallStats.won, color: '#10b981' },
    { name: 'Lost', value: overallStats.lost, color: '#ef4444' }
  ];
  
  // Data for bar chart (top 10 accounts by value)
  const topAccountsData = accountStats
    .slice(0, 10)
    .map(acc => ({
      name: acc.accountName.length > 20 ? acc.accountName.substring(0, 20) + '...' : acc.accountName,
      fullName: acc.accountName,
      winRate: acc.winRate,
      totalValue: acc.totalValue / 1000, // Convert to thousands
      wonValue: acc.wonValue / 1000
    }));
  
  return (
    <div className="space-y-6">
      {/* Overall Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Win Rate</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{overallStats.winRate}%</p>
                <p className="text-xs text-slate-500 mt-1">
                  {overallStats.won} won / {overallStats.decidedCount} decided
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Total Estimates</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{overallStats.total}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {overallStats.won} won, {overallStats.lost} lost, {overallStats.pending} pending
                </p>
              </div>
              <FileText className="w-10 h-10 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Total Value</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {formatCurrency(overallStats.totalValue)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Won: {formatCurrency(overallStats.wonValue)}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-amber-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Est. vs Won</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {overallStats.estimatesVsWonRatio}%
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Revenue: {overallStats.revenueVsWonRatio}%
                </p>
              </div>
              <TrendingDown className="w-10 h-10 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Win/Loss Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Win/Loss Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Top Accounts Win Rate Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Accounts - Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topAccountsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis 
                  label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft' }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  formatter={(value) => `${value}%`}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Bar dataKey="winRate" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Per-Account Table */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Account Win/Loss Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-3 font-semibold text-slate-900 dark:text-white">Account</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Total</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Won</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Lost</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Win Rate</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Total Value</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Won Value</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Est. vs Won</th>
                  <th className="text-center p-3 font-semibold text-slate-900 dark:text-white">Segment</th>
                  <th className="text-center p-3 font-semibold text-slate-900 dark:text-white">Score</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Last Interaction</th>
                </tr>
              </thead>
              <tbody>
                {accountStats.map((account, index) => (
                  <tr key={account.accountId} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 text-slate-900 dark:text-white font-medium">{account.accountName}</td>
                    <td className="p-3 text-right text-slate-600">{account.total}</td>
                    <td className="p-3 text-right text-emerald-600 font-medium">{account.won}</td>
                    <td className="p-3 text-right text-red-600 font-medium">{account.lost}</td>
                    <td className="p-3 text-right">
                      <Badge 
                        variant="secondary" 
                        className={account.winRate >= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}
                      >
                        {account.winRate}%
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-slate-600">
                      {formatCurrency(account.totalValue)}
                    </td>
                    <td className="p-3 text-right text-emerald-600 font-medium">
                      {formatCurrency(account.wonValue)}
                    </td>
                    <td className="p-3 text-right text-slate-600">{account.estimatesVsWonRatio}%</td>
                    <td className="p-3 text-center">
                      {account.revenueSegment ? (
                        <Badge 
                          variant="outline"
                          className={
                            account.revenueSegment === 'A' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            account.revenueSegment === 'B' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            account.revenueSegment === 'C' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                          }
                        >
                          {account.revenueSegment}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {account.latestScore !== null && account.latestScore !== undefined ? (
                        <Badge 
                          variant="outline"
                          className={
                            account.latestScore >= 75 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' :
                            account.latestScore >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }
                        >
                          {Math.round(account.latestScore)}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right text-slate-600 text-sm">
                      {account.daysSinceLastInteraction !== null ? (
                        account.daysSinceLastInteraction === 0 ? (
                          <span className="text-emerald-600">Today</span>
                        ) : account.daysSinceLastInteraction === 1 ? (
                          <span className="text-emerald-600">1 day</span>
                        ) : account.daysSinceLastInteraction < 30 ? (
                          <span>{account.daysSinceLastInteraction} days</span>
                        ) : account.daysSinceLastInteraction < 90 ? (
                          <span className="text-amber-600">{account.daysSinceLastInteraction} days</span>
                        ) : (
                          <span className="text-red-600">{account.daysSinceLastInteraction} days</span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {accountStats.length === 0 && (
                  <tr>
                    <td colSpan="11" className="p-8 text-center text-slate-500">
                      No account data available for {selectedYear}
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

