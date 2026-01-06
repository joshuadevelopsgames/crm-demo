import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Building2, TrendingUp, ChevronRight, ChevronDown, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { calculateDepartmentStats, calculateDepartmentAccountStats, formatCurrency, isWonStatus, enhanceDepartmentStatsWithMetadata } from '@/utils/reportCalculations';

export default function DepartmentReport({ estimates, accounts = [], selectedYear, interactionStatsMap }) {
  const navigate = useNavigate();
  const baseDeptStats = calculateDepartmentStats(estimates);
  
  // Enhance department stats with metadata (avg organization_score, segment distribution, etc.)
  const deptStats = enhanceDepartmentStatsWithMetadata(
    baseDeptStats,
    estimates,
    accounts,
    interactionStatsMap || new Map(),
    selectedYear || new Date().getFullYear()
  );
  const [expandedDepartments, setExpandedDepartments] = useState(new Set());
  
  const toggleDepartment = (division) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(division)) {
      newExpanded.delete(division);
    } else {
      newExpanded.add(division);
    }
    setExpandedDepartments(newExpanded);
  };
  
  const getDepartmentAccountStats = (division) => {
    return calculateDepartmentAccountStats(estimates, accounts, division);
  };
  
  const getStatusBadge = (status) => {
    if (isWonStatus(status)) {
      return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Won</Badge>;
    } else if (status === 'lost' || (status && status.toLowerCase().includes('lost'))) {
      return <Badge variant="secondary" className="bg-red-100 text-red-800">Lost</Badge>;
    } else {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Pending</Badge>;
    }
  };
  
  // Data for bar chart
  const barChartData = deptStats.map(dept => ({
    name: dept.division,
    won: dept.won,
    lost: dept.lost,
    winRate: dept.winRate,
    totalValue: dept.totalValue / 1000, // Convert to thousands
    wonValue: dept.wonValue / 1000,
    lostValue: dept.lostValue / 1000
  }));
  
  // Data for pie chart (by revenue)
  const pieData = deptStats.map((dept, index) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    return {
      name: dept.division,
      value: dept.totalValue,
      color: colors[index % colors.length]
    };
  });
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {deptStats.slice(0, 3).map((dept) => (
          <Card key={dept.division}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 font-medium">{dept.division}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{dept.winRate}%</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {dept.won} won / {dept.decidedCount} decided
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatCurrency(dept.totalValue)} total
                  </p>
                </div>
                <Building2 className="w-10 h-10 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Win/Loss by Department Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Win/Loss by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="won" fill="#10b981" name="Won" />
                <Bar dataKey="lost" fill="#ef4444" name="Lost" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Revenue Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Distribution by Department</CardTitle>
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
                <Tooltip formatter={(value) => formatCurrency(value * 1000)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Win Rate by Department Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Win Rate by Department</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData}>
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
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="winRate" fill="#3b82f6" name="Win Rate" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      {/* Department Statistics Table with Account Drill-Down */}
      <Card>
        <CardHeader>
          <CardTitle>Department Breakdown by Client</CardTitle>
          <p className="text-sm text-slate-600 mt-1">Click a department row to see client breakdown</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-3 font-semibold text-slate-900 dark:text-white w-8"></th>
                  <th className="text-left p-3 font-semibold text-slate-900 dark:text-white">Department</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Total</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Won</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Lost</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Win Rate</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Total Value</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Won Value</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Lost Value</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Est. vs Won</th>
                </tr>
              </thead>
              <tbody>
                {deptStats.map((dept) => {
                  const isExpanded = expandedDepartments.has(dept.division);
                  const accountStats = getDepartmentAccountStats(dept.division);
                  
                  return (
                    <React.Fragment key={dept.division}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="p-3">
                          {accountStats.length > 0 && (
                            <button
                              onClick={() => toggleDepartment(dept.division)}
                              className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="p-3 text-slate-900 dark:text-white font-medium">{dept.division}</td>
                        <td className="p-3 text-right text-slate-600">{dept.total}</td>
                        <td className="p-3 text-right text-emerald-600 font-medium">{dept.won}</td>
                        <td className="p-3 text-right text-red-600 font-medium">{dept.lost}</td>
                        <td className="p-3 text-right">
                          <Badge 
                            variant="secondary" 
                            className={dept.winRate >= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}
                          >
                            {dept.winRate}%
                          </Badge>
                        </td>
                        <td className="p-3 text-right text-slate-600">
                          {formatCurrency(dept.totalValue)}
                        </td>
                        <td className="p-3 text-right text-emerald-600 font-medium">
                          {formatCurrency(dept.wonValue)}
                        </td>
                        <td className="p-3 text-right text-red-600 font-medium">
                          {formatCurrency(dept.lostValue)}
                        </td>
                        <td className="p-3 text-right text-slate-600">{dept.estimatesVsWonRatio}%</td>
                        <td className="p-3 text-center">
                          {dept.avgOrganizationScore !== null ? (
                            <Badge 
                              variant="outline"
                              className={
                                dept.avgOrganizationScore >= 75 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' :
                                dept.avgOrganizationScore >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }
                            >
                              {Math.round(dept.avgOrganizationScore)}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center text-xs">
                          {dept.segmentDistribution ? (
                            <div className="flex gap-1 justify-center">
                              {['A', 'B', 'C', 'D'].map(seg => (
                                dept.segmentDistribution[seg] > 0 && (
                                  <Badge key={seg} variant="outline" className="text-xs">
                                    {seg}: {dept.segmentDistribution[seg]}
                                  </Badge>
                                )
                              ))}
                              {Object.values(dept.segmentDistribution).every(v => v === 0) && (
                                <span className="text-slate-400">—</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right text-slate-600 text-sm">
                          {dept.avgDaysSinceInteraction !== null ? (
                            dept.avgDaysSinceInteraction === 0 ? (
                              <span className="text-emerald-600">Today</span>
                            ) : dept.avgDaysSinceInteraction < 30 ? (
                              <span>{dept.avgDaysSinceInteraction} days</span>
                            ) : dept.avgDaysSinceInteraction < 90 ? (
                              <span className="text-amber-600">{dept.avgDaysSinceInteraction} days</span>
                            ) : (
                              <span className="text-red-600">{dept.avgDaysSinceInteraction} days</span>
                            )
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                      
                      {/* Expanded Account Breakdown */}
                      {isExpanded && accountStats.length > 0 && (
                        <tr>
                          <td colSpan="13" className="p-0 bg-slate-50 dark:bg-slate-900">
                            <div className="p-4">
                              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                Clients in {dept.division}
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200">
                                      <th className="text-left p-2 font-semibold text-slate-700 dark:text-slate-300">Client</th>
                                      <th className="text-right p-2 font-semibold text-slate-700 dark:text-slate-300">Total</th>
                                      <th className="text-right p-2 font-semibold text-slate-700 dark:text-slate-300">Won</th>
                                      <th className="text-right p-2 font-semibold text-slate-700 dark:text-slate-300">Lost</th>
                                      <th className="text-right p-2 font-semibold text-slate-700 dark:text-slate-300">Win Rate</th>
                                      <th className="text-right p-2 font-semibold text-slate-700 dark:text-slate-300">Total Value</th>
                                      <th className="text-right p-2 font-semibold text-slate-700 dark:text-slate-300">Won Value</th>
                                      <th className="text-center p-2 font-semibold text-slate-700 dark:text-slate-300">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {accountStats.map((account) => (
                                      <tr key={account.accountId} className="border-b border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800">
                                        <td className="p-2 text-slate-600 dark:text-slate-300 font-medium">{account.accountName}</td>
                                        <td className="p-2 text-right text-slate-600 dark:text-slate-300">{account.total}</td>
                                        <td className="p-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">{account.won}</td>
                                        <td className="p-2 text-right text-red-600 dark:text-red-400 font-medium">{account.lost}</td>
                                        <td className="p-2 text-right">
                                          <Badge 
                                            variant="secondary" 
                                            className={account.winRate >= 50 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}
                                          >
                                            {account.winRate}%
                                          </Badge>
                                        </td>
                                        <td className="p-2 text-right text-slate-600 dark:text-slate-300">
                                          {formatCurrency(account.totalValue)}
                                        </td>
                                        <td className="p-2 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                                          {formatCurrency(account.wonValue)}
                                        </td>
                                        <td className="p-2 text-center">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => navigate(createPageUrl(`AccountDetail?id=${account.accountId}`))}
                                            className="h-6 px-2"
                                          >
                                            <ExternalLink className="w-3 h-3" />
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {deptStats.length === 0 && (
                  <tr>
                    <td colSpan="13" className="p-8 text-center text-slate-500">
                      No department data available
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

