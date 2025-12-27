import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Building2, TrendingUp } from 'lucide-react';
import { calculateDepartmentStats, formatCurrency } from '@/utils/reportCalculations';

export default function DepartmentReport({ estimates }) {
  const deptStats = calculateDepartmentStats(estimates);
  
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
      
      {/* Department Statistics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Department Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-3 font-semibold text-slate-900">Department</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Total</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Won</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Lost</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Win Rate</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Total Value</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Won Value</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Lost Value</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Est. vs Won</th>
                </tr>
              </thead>
              <tbody>
                {deptStats.map((dept) => (
                  <tr key={dept.division} className="border-b border-slate-100 hover:bg-slate-50">
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
                  </tr>
                ))}
                {deptStats.length === 0 && (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-slate-500">
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

