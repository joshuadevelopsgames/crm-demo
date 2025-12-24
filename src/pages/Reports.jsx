import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  Calendar,
  Download,
  TrendingUp,
  BarChart3,
  PieChart
} from 'lucide-react';
import { format } from 'date-fns';

export default function Reports() {
  const [searchParams] = useSearchParams();
  const currentYear = new Date().getFullYear();
  const yearFromUrl = searchParams.get('year');
  const [selectedYear, setSelectedYear] = useState(yearFromUrl ? parseInt(yearFromUrl) : currentYear);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

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
  const { data: estimates = [], isLoading: estimatesLoading } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => base44.entities.Estimate.list()
  });

  // Fetch accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list()
  });

  // Filter estimates by year, account, and department
  const filteredEstimates = useMemo(() => {
    return estimates.filter(estimate => {
      // Filter by year (using estimate_date or estimate_close_date)
      const estimateDate = estimate.estimate_close_date || estimate.estimate_date;
      if (estimateDate) {
        const estimateYear = new Date(estimateDate).getFullYear();
        if (estimateYear !== selectedYear) return false;
      } else {
        return false; // Skip estimates without dates
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

  const handleExportXLSX = () => {
    // TODO: Implement XLSX export
    alert('XLSX export coming soon');
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    alert('PDF export coming soon');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-600 mt-1">End of year analysis and performance metrics</p>
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
                <p className="text-3xl font-bold text-slate-900 mt-2">{stats.total}</p>
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
                <p className="text-3xl font-bold text-slate-900 mt-2">{stats.winRate}%</p>
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
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  ${(stats.totalValue / 1000).toFixed(1)}K
                </p>
              </div>
              <BarChart3 className="w-10 h-10 text-amber-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for Reports */}
      <Card>
        <CardHeader>
          <CardTitle>End of Year Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Reports Coming Soon</h3>
            <p className="text-slate-600 mb-4">
              Comprehensive end of year reports with detailed analytics, graphs, and insights will be available here.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                <span>Win/Loss Analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                <span>Department Breakdown</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Revenue Trends</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

