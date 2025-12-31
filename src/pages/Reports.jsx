import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  Download,
  TrendingUp,
  BarChart3,
  PieChart,
  Building2
} from 'lucide-react';
import { filterEstimatesByYear, formatCurrency } from '@/utils/reportCalculations';
import { exportToXLSX, exportToPDF } from '@/utils/reportExports';
import WinLossReport from '@/components/reports/WinLossReport';
import DepartmentReport from '@/components/reports/DepartmentReport';
import AccountPerformanceReport from '@/components/reports/AccountPerformanceReport';

export default function Reports() {
  console.log('📊 Reports: Component mounted/rendered');
  
  const [searchParams] = useSearchParams();
  const currentYear = new Date().getFullYear();
  const yearFromUrl = searchParams.get('year');
  const [selectedYear, setSelectedYear] = useState(yearFromUrl ? parseInt(yearFromUrl) : currentYear);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  
  console.log('📊 Reports: Initial state', { currentYear, selectedYear, yearFromUrl });

  // Update selected year if URL parameter changes
  useEffect(() => {
    if (yearFromUrl) {
      setSelectedYear(parseInt(yearFromUrl));
    }
  }, [yearFromUrl]);

  // Generate year options (current year and 5 years back)
  const yearOptions = useMemo(() => {
    const years = [];
    for (let i = 0; i <= 5; i++) {
      years.push(currentYear - i);
    }
    return years;
  }, [currentYear]);

  // Fetch estimates
  const { data: estimates = [], isLoading: estimatesLoading, error: estimatesError } = useQuery({
    queryKey: ['estimates'],
    queryFn: async () => {
      try {
        const data = await base44.entities.Estimate.list();
        console.log('📊 Reports: Fetched estimates', {
          total: data.length,
          withEstimateDate: data.filter(e => e.estimate_date).length,
          sampleDates: data.filter(e => e.estimate_date).slice(0, 5).map(e => e.estimate_date),
          selectedYear
        });
        return data;
      } catch (error) {
        console.error('📊 Reports: Error fetching estimates', error);
        return [];
      }
    }
  });

  // Fetch accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list()
  });

  // Filter estimates by year, account, and department
  // Use estimate_date only (not estimate_close_date) to match LMN's counting logic
  // Also exclude estimates with exclude_stats=true and remove duplicates by lmn_estimate_id
  const filteredEstimates = useMemo(() => {
    console.log('📊 Reports: Starting filter', { totalEstimates: estimates.length, selectedYear });
    
    // First, remove duplicates by lmn_estimate_id (keep first occurrence)
    const uniqueEstimates = [];
    const seenLmnIds = new Set();
    estimates.forEach(est => {
      if (est.lmn_estimate_id) {
        if (!seenLmnIds.has(est.lmn_estimate_id)) {
          seenLmnIds.add(est.lmn_estimate_id);
          uniqueEstimates.push(est);
        }
      } else {
        // Estimates without lmn_estimate_id are included
        uniqueEstimates.push(est);
      }
    });
    
    console.log('📊 Reports: After deduplication', { uniqueCount: uniqueEstimates.length });

    const filtered = uniqueEstimates.filter(estimate => {
      // Filter by year (using estimate_date only to match LMN)
      // Use string extraction to avoid timezone issues (LMN dates are UTC)
      if (!estimate.estimate_date) {
        return false; // Skip estimates without estimate_date
      }
      // Extract year from date string to avoid timezone conversion issues
      // Use substring to extract first 4 characters (year) - more reliable than regex
      const dateStr = String(estimate.estimate_date);
      let estimateYear;
      if (dateStr.length >= 4) {
        estimateYear = parseInt(dateStr.substring(0, 4));
      } else {
        // Fallback to Date parsing if string is too short
        estimateYear = new Date(dateStr).getFullYear();
      }
      
      // Validate year is reasonable (between 2000 and 2100)
      if (isNaN(estimateYear) || estimateYear < 2000 || estimateYear > 2100) {
        return false;
      }
      
      if (estimateYear !== selectedYear) return false;

      // Exclude estimates marked for exclusion from stats
      if (estimate.exclude_stats) {
        return false;
      }

      // Filter by account
      if (selectedAccount !== 'all' && estimate.account_id !== selectedAccount) {
        return false;
      }

      // Filter by department
      if (selectedDepartment !== 'all' && estimate.division !== selectedDepartment) {
        return false;
      }

      return true;
    });
    
    console.log('📊 Reports: After filtering', {
      filteredCount: filtered.length,
      selectedYear,
      selectedAccount,
      selectedDepartment,
      sampleFiltered: filtered.slice(0, 3).map(e => ({
        id: e.id,
        estimate_date: e.estimate_date,
        status: e.status,
        exclude_stats: e.exclude_stats
      }))
    });
    
    return filtered;
  }, [estimates, selectedYear, selectedAccount, selectedDepartment]);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = new Set(estimates.map(e => e.division).filter(Boolean));
    return Array.from(depts).sort();
  }, [estimates]);

  // Calculate basic stats
  const stats = useMemo(() => {
    const total = filteredEstimates.length;
    const won = filteredEstimates.filter(e => e.status === 'won').length;
    const lost = filteredEstimates.filter(e => e.status !== 'won').length;
    const winRate = total > 0 ? ((won / total) * 100).toFixed(1) : 0;
    
    const totalValue = filteredEstimates.reduce((sum, e) => sum + (parseFloat(e.total_price_with_tax) || 0), 0);
    const wonValue = filteredEstimates
      .filter(e => e.status === 'won')
      .reduce((sum, e) => sum + (parseFloat(e.total_price_with_tax) || 0), 0);

    return {
      total,
      won,
      lost,
      winRate,
      totalValue,
      wonValue
    };
  }, [filteredEstimates]);

  // Get estimates for selected year (for reports)
  const yearEstimates = useMemo(() => {
    const filtered = filterEstimatesByYear(estimates, selectedYear);
    console.log('📊 Reports: yearEstimates from filterEstimatesByYear', {
      total: estimates.length,
      filtered: filtered.length,
      selectedYear,
      sample: filtered.slice(0, 3).map(e => ({
        id: e.id,
        estimate_date: e.estimate_date,
        status: e.status
      }))
    });
    return filtered;
  }, [estimates, selectedYear]);
  
  // Apply account and department filters to year estimates
  const filteredYearEstimates = useMemo(() => {
    return yearEstimates.filter(estimate => {
      // Filter by account
      if (selectedAccount !== 'all' && estimate.account_id !== selectedAccount) {
        return false;
      }

      // Filter by department
      if (selectedDepartment !== 'all' && estimate.division !== selectedDepartment) {
        return false;
      }

      return true;
    });
  }, [yearEstimates, selectedAccount, selectedDepartment]);

  const handleExportXLSX = () => {
    exportToXLSX({ estimates: filteredYearEstimates, accounts }, selectedYear);
  };

  const handleExportPDF = () => {
    exportToPDF({ estimates: filteredYearEstimates, accounts }, selectedYear);
  };

  // Debug: Log when component renders
  useEffect(() => {
    console.log('📊 Reports: Component rendered', {
      estimatesCount: estimates.length,
      estimatesLoading,
      estimatesError: estimatesError?.message,
      selectedYear,
      filteredEstimatesCount: filteredEstimates.length,
      yearEstimatesCount: yearEstimates.length,
      filteredYearEstimatesCount: filteredYearEstimates.length
    });
  }, [estimates.length, estimatesLoading, estimatesError, selectedYear, filteredEstimates.length, yearEstimates.length, filteredYearEstimates.length]);

  if (estimatesLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-slate-500">Loading estimates...</p>
        </div>
      </div>
    );
  }

  if (estimatesError) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-red-500">Error loading estimates: {estimatesError.message}</p>
        </div>
      </div>
    );
  }

  // Force log on every render
  console.log('📊 Reports: RENDER - About to return JSX', {
    estimatesCount: estimates.length,
    filteredCount: filteredEstimates.length,
    yearEstimatesCount: yearEstimates.length,
    stats: stats
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-slate-600 mt-1">End of year analysis and performance metrics</p>
          {/* Debug info - remove after fixing */}
          <p className="text-xs text-red-500 mt-1">
            DEBUG: Estimates: {estimates.length}, Filtered: {filteredEstimates.length}, Year: {selectedYear}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportXLSX}
            disabled={filteredEstimates.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export XLSX
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={filteredEstimates.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Total Estimates</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stats.total}</p>
              </div>
              <FileText className="w-10 h-10 text-blue-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Won</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">{stats.won}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-emerald-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Win Rate</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{stats.winRate}%</p>
              </div>
              <PieChart className="w-10 h-10 text-purple-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Total Value</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {formatCurrency(stats.totalValue)}
                </p>
              </div>
              <BarChart3 className="w-10 h-10 text-amber-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Tabs */}
      <Tabs defaultValue="winloss" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="winloss" className="flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Win/Loss Report
          </TabsTrigger>
          <TabsTrigger value="department" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Department Report
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Account Performance
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="winloss" className="space-y-4">
          <WinLossReport 
            estimates={filteredYearEstimates} 
            accounts={accounts}
            selectedYear={selectedYear}
          />
        </TabsContent>
        
        <TabsContent value="department" className="space-y-4">
          <DepartmentReport 
            estimates={filteredYearEstimates}
          />
        </TabsContent>
        
        <TabsContent value="account" className="space-y-4">
          <AccountPerformanceReport 
            estimates={filteredYearEstimates}
            accounts={accounts}
            selectedYear={selectedYear}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

