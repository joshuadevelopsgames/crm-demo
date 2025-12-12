import React, { useState, useMemo } from 'react';
import { mockEstimates, mockAccounts } from '@/api/mockData';
import { parseCSV, processEstimateData } from '@/utils/csvParser';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Target,
  PieChart,
  Search,
  Filter,
  FileText,
  Upload,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

export default function WinLossTest() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [estimates, setEstimates] = useState(mockEstimates);
  const [dataSource, setDataSource] = useState('mock'); // 'mock' or 'csv'
  const [isLoading, setIsLoading] = useState(false);

  // Handle CSV file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rawData = parseCSV(text);
        const processedEstimates = processEstimateData(rawData);
        
        setEstimates(processedEstimates);
        setDataSource('csv');
        setIsLoading(false);
        
        console.log(`Loaded ${processedEstimates.length} estimates from CSV`);
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please check the format.');
        setIsLoading(false);
      }
    };
    
    reader.onerror = () => {
      alert('Error reading file');
      setIsLoading(false);
    };
    
    reader.readAsText(file);
  };

  // Reset to mock data
  const resetToMockData = () => {
    setEstimates(mockEstimates);
    setDataSource('mock');
  };

  // Calculate win/loss statistics per customer
  const customerStats = useMemo(() => {
    const stats = {};

    estimates.forEach(estimate => {
      // Use customer name as the key since CSV data doesn't have account_id
      const customerName = estimate.account_name;
      const customerId = customerName.toLowerCase().replace(/[^a-z0-9]/g, '-');

      if (!stats[customerId]) {
        stats[customerId] = {
          id: customerId,
          name: customerName,
          totalEstimates: 0,
          estimatesWon: 0,
          estimatesLost: 0,
          estimatesPending: 0,
          totalValue: 0,
          wonValue: 0,
          lostValue: 0,
          estimates: []
        };
      }

      stats[customerId].totalEstimates++;
      stats[customerId].totalValue += estimate.total_amount || 0;
      stats[customerId].estimates.push(estimate);

      if (estimate.status === 'won') {
        stats[customerId].estimatesWon++;
        stats[customerId].wonValue += estimate.total_amount || 0;
      } else if (estimate.status === 'lost') {
        stats[customerId].estimatesLost++;
        stats[customerId].lostValue += estimate.total_amount || 0;
      } else if (estimate.status === 'pending') {
        stats[customerId].estimatesPending++;
      }
    });

    // Calculate win rate for each customer
    Object.values(stats).forEach(customer => {
      const decidedEstimates = customer.estimatesWon + customer.estimatesLost;
      customer.winRate = decidedEstimates > 0 
        ? (customer.estimatesWon / decidedEstimates * 100).toFixed(1)
        : 0;
    });

    return Object.values(stats);
  }, [estimates]);

  // Overall statistics
  const overallStats = useMemo(() => {
    const total = estimates.length;
    const won = estimates.filter(e => e.status === 'won').length;
    const lost = estimates.filter(e => e.status === 'lost').length;
    const pending = estimates.filter(e => e.status === 'pending').length;
    const decidedEstimates = won + lost;
    const winRate = decidedEstimates > 0 ? (won / decidedEstimates * 100).toFixed(1) : 0;

    const totalValue = estimates.reduce((sum, e) => sum + (e.total_amount || 0), 0);
    const wonValue = estimates.filter(e => e.status === 'won')
      .reduce((sum, e) => sum + (e.total_amount || 0), 0);
    const lostValue = estimates.filter(e => e.status === 'lost')
      .reduce((sum, e) => sum + (e.total_amount || 0), 0);

    return {
      total,
      won,
      lost,
      pending,
      winRate,
      totalValue,
      wonValue,
      lostValue
    };
  }, [estimates]);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    let filtered = [...customerStats];

    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort by win rate (highest first)
    filtered.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));

    return filtered;
  }, [customerStats, searchTerm]);

  // Get all estimates with filters
  const filteredEstimates = useMemo(() => {
    let filtered = [...estimates];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(e => e.status === filterStatus);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.estimate_date) - new Date(a.estimate_date));

    return filtered;
  }, [filterStatus, estimates]);

  const getStatusColor = (status) => {
    const colors = {
      won: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      lost: 'bg-red-100 text-red-800 border-red-200',
      pending: 'bg-amber-100 text-amber-800 border-amber-200'
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  const getWinRateColor = (rate) => {
    if (rate >= 70) return 'text-emerald-600';
    if (rate >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Win/Loss Ratio Test Page</h1>
            <p className="text-slate-600 mt-2">
              Track estimates and win rates per customer
              {dataSource === 'csv' && (
                <Badge className="ml-3 bg-emerald-100 text-emerald-800">
                  Using Your CSV Data
                </Badge>
              )}
              {dataSource === 'mock' && (
                <Badge className="ml-3 bg-blue-100 text-blue-800">
                  Using Mock Data
                </Badge>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="csv-upload"
            />
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              disabled={isLoading}
            >
              <label htmlFor="csv-upload" className="cursor-pointer">
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload CSV
                  </>
                )}
              </label>
            </Button>
            {dataSource === 'csv' && (
              <Button
                variant="outline"
                onClick={resetToMockData}
                className="border-slate-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset to Mock Data
              </Button>
            )}
          </div>
        </div>

        {/* Overall Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6 border-l-4 border-l-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Total Estimates</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{overallStats.total}</p>
              </div>
              <FileText className="w-10 h-10 text-blue-500 opacity-80" />
            </div>
          </Card>

          <Card className="p-6 border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Estimates Won</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{overallStats.won}</p>
                <p className="text-xs text-slate-500 mt-1">
                  ${(overallStats.wonValue / 1000).toFixed(1)}K value
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-emerald-500 opacity-80" />
            </div>
          </Card>

          <Card className="p-6 border-l-4 border-l-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Estimates Lost</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{overallStats.lost}</p>
                <p className="text-xs text-slate-500 mt-1">
                  ${(overallStats.lostValue / 1000).toFixed(1)}K value
                </p>
              </div>
              <TrendingDown className="w-10 h-10 text-red-500 opacity-80" />
            </div>
          </Card>

          <Card className="p-6 border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Overall Win Rate</p>
                <p className={`text-3xl font-bold mt-2 ${getWinRateColor(overallStats.winRate)}`}>
                  {overallStats.winRate}%
                </p>
                <p className="text-xs text-slate-500 mt-1">{overallStats.pending} pending</p>
              </div>
              <Target className="w-10 h-10 text-purple-500 opacity-80" />
            </div>
          </Card>
        </div>

        {/* Customer Win/Loss Statistics */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Win/Loss by Customer</h2>
            <div className="flex gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredCustomers.map((customer) => (
              <Card key={customer.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-slate-900">{customer.name}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-medium">Total Estimates</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{customer.totalEstimates}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-medium">Won</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{customer.estimatesWon}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-medium">Lost</p>
                        <p className="text-2xl font-bold text-red-600 mt-1">{customer.estimatesLost}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase font-medium">Win Rate</p>
                        <p className={`text-2xl font-bold mt-1 ${getWinRateColor(customer.winRate)}`}>
                          {customer.winRate}%
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-500" />
                        <span className="text-sm text-slate-600">
                          Total Value: <span className="font-semibold">${customer.totalValue.toLocaleString()}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm text-slate-600">
                          Won: <span className="font-semibold text-emerald-600">${customer.wonValue.toLocaleString()}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        <span className="text-sm text-slate-600">
                          Lost: <span className="font-semibold text-red-600">${customer.lostValue.toLocaleString()}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        {/* All Estimates List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">All Estimates</h2>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Estimate #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredEstimates.map((estimate) => (
                  <tr key={estimate.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <span className="font-mono text-sm font-medium text-slate-900">
                        {estimate.estimate_number}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-medium text-slate-900">{estimate.account_name}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(estimate.estimate_date), 'MMM d, yyyy')}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-slate-700">{estimate.description}</span>
                      {estimate.notes && (
                        <p className="text-xs text-slate-500 mt-1">{estimate.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-semibold text-slate-900">
                        ${estimate.total_amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge variant="outline" className={getStatusColor(estimate.status)}>
                        {estimate.status.toUpperCase()}
                      </Badge>
                      {estimate.status === 'won' && estimate.won_date && (
                        <p className="text-xs text-slate-500 mt-1">
                          Won: {format(new Date(estimate.won_date), 'MMM d')}
                        </p>
                      )}
                      {estimate.status === 'lost' && estimate.lost_reason && (
                        <p className="text-xs text-red-600 mt-1">{estimate.lost_reason}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Instructions */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Test Page Information</h3>
          <p className="text-sm text-blue-800">
            This is a standalone test page for the Win/Loss Ratio system. It displays:
          </p>
          <ul className="list-disc list-inside text-sm text-blue-800 mt-2 space-y-1">
            <li>Overall statistics: total estimates, won/lost counts, win rate, and values</li>
            <li>Per-customer breakdown: total estimates, estimates won/lost, and win rate percentage</li>
            <li>Complete list of all estimates with filtering by status</li>
            <li>Dollar values for won and lost estimates</li>
          </ul>
          <div className="mt-4 p-3 bg-white rounded border border-blue-200">
            <p className="text-sm font-semibold text-blue-900 mb-2">📁 How to Use Your CSV Data:</p>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>Click the "Upload CSV" button above</li>
              <li>Select your "Estimate Test - Sheet1.csv" file from Downloads</li>
              <li>The system will automatically parse and display your real estimate data</li>
              <li>All {estimates.length} estimates from your CSV will be analyzed</li>
            </ol>
          </div>
          <p className="text-sm text-blue-800 mt-3">
            <strong>Note:</strong> This page is not integrated into the main LECRM navigation. Access it directly for testing purposes.
          </p>
        </Card>
      </div>
    </div>
  );
}












