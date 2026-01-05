import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
  Building2,
  AlertCircle
} from 'lucide-react';
import { filterEstimatesByYear, formatCurrency, isWonStatus } from '@/utils/reportCalculations';
import { exportToXLSX, exportToPDF } from '@/utils/reportExports';
import WinLossReport from '@/components/reports/WinLossReport';
import DepartmentReport from '@/components/reports/DepartmentReport';
import AccountPerformanceReport from '@/components/reports/AccountPerformanceReport';
import SalesPipelineReport from '@/components/reports/SalesPipelineReport';

import { getCurrentYear, useYearSelector } from '@/contexts/YearSelectorContext';

// Helper to get current year (respects test mode)
function getCurrentYearForCalculation() {
  try {
    return getCurrentYear();
  } catch (error) {
    // Fallback if context not initialized yet
    if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
      return window.__testModeGetCurrentYear();
    }
    return new Date().getFullYear();
  }
}

export default function Reports() {
  const [searchParams] = useSearchParams();
  const currentYear = getCurrentYearForCalculation();
  const yearFromUrl = searchParams.get('year');
  const { availableYears: contextAvailableYears } = useYearSelector();
  const [selectedYear, setSelectedYear] = useState(yearFromUrl ? parseInt(yearFromUrl) : currentYear);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // Update selected year if URL parameter changes
  useEffect(() => {
    if (yearFromUrl) {
      setSelectedYear(parseInt(yearFromUrl));
    }
  }, [yearFromUrl]);

  // Use availableYears from YearSelectorContext (calculated from actual estimates)
  // Fallback to current year if context not available
  const availableYears = useMemo(() => {
    return contextAvailableYears && contextAvailableYears.length > 0 
      ? contextAvailableYears 
      : [currentYear];
  }, [contextAvailableYears, currentYear]);

  // Fetch estimates from database
  const { data: estimates = [], isLoading: estimatesLoading, error: estimatesError } = useQuery({
    queryKey: ['estimates'],
    queryFn: async () => {
      try {
        // Use API endpoint to get estimates with all fields (contract_end, contract_start, estimate_date, created_date, etc.)
        const response = await fetch('/api/data/estimates');
        if (!response.ok) {
          console.warn('⚠️ Estimates API failed');
          return [];
        }
        const result = await response.json();
        if (!result.success) {
          console.warn('⚠️ Estimates API returned error:', result.error);
          return [];
        }
        return result.data || [];
      } catch (error) {
        console.error('📊 Reports: ❌ Error fetching estimates', error);
        return [];
      }
    },
    enabled: true
  });

  // Fetch contacts from database (if needed for reports)
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const response = await fetch('/api/data/contacts');
      if (!response.ok) {
        console.warn('⚠️ Contacts API failed');
        return [];
      }
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    }
  });


  // Track if user has manually changed the year
  const [userHasChangedYear, setUserHasChangedYear] = useState(false);
  
  // Auto-select most recent year if current year has no data (only on initial load, before user makes any changes)
  useEffect(() => {
    if (!estimatesLoading && availableYears.length > 0 && !availableYears.includes(selectedYear) && !userHasChangedYear) {
      console.log('📊 Reports: Selected year has no data, switching to most recent year:', availableYears[0]);
      setSelectedYear(availableYears[0]);
    }
  }, [estimatesLoading, availableYears, selectedYear, userHasChangedYear]);
  
  // Handler for manual year changes
  const handleYearChange = (value) => {
    setUserHasChangedYear(true);
    setSelectedYear(parseInt(value));
    console.log('📊 Reports: User manually changed year to:', parseInt(value));
  };

  // Fetch accounts from database
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await fetch('/api/data/accounts');
      if (!response.ok) {
        console.warn('⚠️ Accounts API failed');
        return [];
      }
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    }
  });

  // Filter estimates by year, account, and department
  // Per Estimates spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
  // OLD CODE REMOVED: filteredEstimates useMemo is no longer used
  // We now use yearEstimates and yearWonEstimates with filterEstimatesByYear
  // This ensures we match LMN's "Estimates Sold" count exactly
  const _unused_filteredEstimates = useMemo(() => {
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
    
    // Debug: Check sample dates to see format and find 2025 dates
    const sampleDates = uniqueEstimates
      .filter(e => e.estimate_date)
      .slice(0, 10)
      .map(e => ({ id: e.id, estimate_date: e.estimate_date, type: typeof e.estimate_date }));
    console.log('📊 Reports: Sample estimate dates', sampleDates);
    
    // Check for 2025 dates specifically - check ALL date fields
    const dates2025 = uniqueEstimates.filter(e => {
      // Check estimate_date
      if (e.estimate_date) {
        const dateStr = String(e.estimate_date);
        if (dateStr.length >= 4) {
          const yearStr = dateStr.substring(0, 4);
          if (yearStr === '2025') return true;
        }
      }
      // Per Estimates spec R2: Check contract_end (Priority 1)
      if (e.contract_end) {
        const dateStr = String(e.contract_end);
        if (dateStr.length >= 4) {
          const yearStr = dateStr.substring(0, 4);
          if (yearStr === '2025') return true;
        }
      }
      // Check contract_start (Priority 2)
      if (e.contract_start) {
        const dateStr = String(e.contract_start);
        if (dateStr.length >= 4) {
          const yearStr = dateStr.substring(0, 4);
          if (yearStr === '2025') return true;
        }
      }
      // Check created_at
      if (e.created_at) {
        const dateStr = String(e.created_at);
        if (dateStr.length >= 4) {
          const yearStr = dateStr.substring(0, 4);
          if (yearStr === '2025') return true;
        }
      }
      return false;
    });
    console.log('📊 Reports: Estimates with 2025 dates (checking all date fields)', {
      count: dates2025.length,
      sample: dates2025.slice(0, 5).map(e => ({
        id: e.id,
        estimate_date: e.estimate_date,
        contract_end: e.contract_end,
        contract_start: e.contract_start,
        created_at: e.created_at,
        status: e.status,
      }))
    });
    
    // Per spec R10: exclude_stats field is ignored - never used in any system logic
    
    // Per Estimates spec R2: Check estimates with 2025 in contract_end (Priority 1)
    const dates2025ByContractEnd = uniqueEstimates.filter(e => {
      if (!e.contract_end) return false;
      const dateStr = String(e.contract_end);
      if (dateStr.length >= 4) {
        return dateStr.substring(0, 4) === '2025';
      }
      return false;
    });
    console.log('📊 Reports: Estimates with 2025 in contract_end (Priority 1, per Estimates spec R2)', {
      count: dates2025ByContractEnd.length,
      sample: dates2025ByContractEnd.slice(0, 5).map(e => ({
        id: e.id,
        estimate_date: e.estimate_date,
        contract_end: e.contract_end,
        contract_start: e.contract_start,
        status: e.status,
      }))
    });
    
    // Also check estimates without estimate_date but with other dates
    const estimatesWithoutEstimateDate = uniqueEstimates
      .filter(e => !e.estimate_date)
      .slice(0, 10);
    console.log('📊 Reports: Estimates WITHOUT estimate_date (sample)', {
      count: uniqueEstimates.filter(e => !e.estimate_date).length,
      sample: estimatesWithoutEstimateDate.map(e => ({
        id: e.id,
        estimate_date: e.estimate_date,
        contract_end: e.contract_end,
        contract_start: e.contract_start,
        created_at: e.created_at,
        status: e.status
      }))
    });
    
    // Per Estimates spec R2: Check for 2025 in contract_end (Priority 1) or created_date (Priority 4)
    const dates2025ContractEnd = uniqueEstimates.filter(e => {
      if (e.contract_end) {
        const dateStr = String(e.contract_end);
        if (dateStr.length >= 4 && dateStr.substring(0, 4) === '2025') return true;
      }
      return false;
    });
    const dates2025Created = uniqueEstimates.filter(e => {
      if (e.created_date) {
        const dateStr = String(e.created_date);
        if (dateStr.length >= 4 && dateStr.substring(0, 4) === '2025') return true;
      }
      return false;
    });
    console.log('📊 Reports: 2025 data in date fields (per Estimates spec R2)', {
      contract_end_2025: dates2025ContractEnd.length,
      created_date_2025: dates2025Created.length,
      sample_contract_end: dates2025ContractEnd.slice(0, 3).map(e => ({
        id: e.id,
        estimate_date: e.estimate_date,
        contract_end: e.contract_end,
        contract_start: e.contract_start,
        status: e.status,
      })),
      sample_created: dates2025Created.slice(0, 3).map(e => ({
        id: e.id,
        estimate_date: e.estimate_date,
        created_date: e.created_date,
        status: e.status
      }))
    });
    
    // Per Estimates spec R2: Check what years are available in the data (contract_end → contract_start → estimate_date → created_date)
    const yearsInData = new Set();
    uniqueEstimates.forEach(e => {
      // Per Estimates spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
      let dateToUse = null;
      if (e.contract_end) {
        dateToUse = e.contract_end;
      } else if (e.contract_start) {
        dateToUse = e.contract_start;
      } else if (e.estimate_date) {
        dateToUse = e.estimate_date;
      } else if (e.created_date) {
        dateToUse = e.created_date;
      }
      // If neither exists, skip (don't use created_at)
      if (dateToUse) {
        const dateStr = String(dateToUse);
        if (dateStr.length >= 4) {
          const yearStr = dateStr.substring(0, 4);
          const year = parseInt(yearStr);
          if (!isNaN(year) && year >= 2000 && year <= 2100) {
            yearsInData.add(year);
          }
        }
      }
    });
    const sortedYears = Array.from(yearsInData).sort((a, b) => b - a);
    console.log('📊 Reports: Available years in data', {
      years: sortedYears,
      yearsList: sortedYears.join(', '),
      count: sortedYears.length,
      selectedYear,
      hasSelectedYear: sortedYears.includes(selectedYear),
      message: sortedYears.includes(selectedYear) 
        ? `✅ Selected year ${selectedYear} is available` 
        : `❌ Selected year ${selectedYear} is NOT available. Available years: ${sortedYears.join(', ')}`
    });

    const filtered = uniqueEstimates.filter(estimate => {
      // Per Estimates spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
      // If no valid date exists, exclude from reports
      let dateToUse = null;
      
      // Priority 1: contract_end
      if (estimate.contract_end) {
        dateToUse = estimate.contract_end;
      }
      // Priority 2: contract_start
      else if (estimate.contract_start) {
        dateToUse = estimate.contract_start;
      }
      // Priority 3: estimate_date
      else if (estimate.estimate_date) {
        dateToUse = estimate.estimate_date;
      }
      // Priority 4: created_date
      else if (estimate.created_date) {
        dateToUse = estimate.created_date;
      }
      
      if (!dateToUse) {
        return false; // Skip estimates without any valid date
      }
      
      // Handle different date formats
      let estimateYear;
      const dateValue = dateToUse;
      
      // If it's already a Date object
      if (dateValue instanceof Date) {
        estimateYear = dateValue.getFullYear();
      } else {
        // It's a string - try multiple extraction methods
        const dateStr = String(dateValue);
        
        // Method 1: Extract year from ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
        if (dateStr.length >= 4) {
          const yearStr = dateStr.substring(0, 4);
          const parsedYear = parseInt(yearStr);
          
          // Check if it's a valid year
          if (!isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100) {
            estimateYear = parsedYear;
          } else {
            // Method 2: Try Date parsing
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) {
              estimateYear = dateObj.getFullYear();
            } else {
              // Method 3: Try to find year pattern in string (e.g., "2025" anywhere)
              const yearMatch = dateStr.match(/\b(20[0-9]{2})\b/);
              if (yearMatch) {
                estimateYear = parseInt(yearMatch[1]);
              } else {
                // All methods failed
                if (uniqueEstimates.indexOf(estimate) < 5) {
                  console.warn('📊 Reports: Could not extract year from date:', dateStr, 'for estimate:', estimate.id);
                }
                return false;
              }
            }
          }
        } else {
          // Date string is too short, try Date parsing
          const dateObj = new Date(dateStr);
          if (!isNaN(dateObj.getTime())) {
            estimateYear = dateObj.getFullYear();
          } else {
            if (uniqueEstimates.indexOf(estimate) < 5) {
              console.warn('📊 Reports: Date string too short:', dateStr, 'for estimate:', estimate.id);
            }
            return false;
          }
        }
      }
      
      // Debug: Log first few estimates to see date format
      if (uniqueEstimates.indexOf(estimate) < 3) {
        // Per Estimates spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
        const dateSource = estimate.contract_end 
          ? 'contract_end' 
          : (estimate.contract_start ? 'contract_start' : (estimate.estimate_date ? 'estimate_date' : 'created_date'));
        console.log('📊 Reports: Date parsing example', {
          estimate_id: estimate.id,
          status: estimate.status,
          estimate_date: estimate.estimate_date,
          contract_end: estimate.contract_end,
          contract_start: estimate.contract_start,
          created_at: estimate.created_at,
          dateUsed: dateToUse,
          dateSource,
          estimateYear,
          selectedYear,
          matches: estimateYear === selectedYear
        });
      }
      
      if (estimateYear !== selectedYear) return false;

      // Per spec R10: exclude_stats field is ignored - never used in any system logic

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
      }))
    });
    
    return filtered;
  }, [estimates, selectedYear, selectedAccount, selectedDepartment]);

  // Get unique departments (from estimates)
  const departments = useMemo(() => {
    const depts = new Set(estimates.map(e => e.division).filter(Boolean));
    return Array.from(depts).sort();
  }, [estimates]);

  // Get ALL estimates for selected year (from database) - includes won, lost, and pending
  // Per Estimates spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
  const yearEstimates = useMemo(() => {
    if (!Array.isArray(estimates)) return [];
    // Per Estimates spec R2: Uses standardized date priority (contract_end → contract_start → estimate_date → created_date)
    // soldOnly=false to include all estimates (won, lost, pending) for total count
    return filterEstimatesByYear(estimates, selectedYear, true, false);
  }, [estimates, selectedYear]);

  // Get WON estimates for selected year (matches LMN's "Estimates Sold" count)
  // This should match LMN's count exactly (validated: 1,057 for 2025)
  const yearWonEstimates = useMemo(() => {
    if (!Array.isArray(estimates)) return [];
    // Per Estimates spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
    // Per Estimates spec R10: exclude_stats field is ignored - never used in any system logic
    const won = filterEstimatesByYear(estimates, selectedYear, true, true);
    // Debug: Log the count and analyze missing estimates for 2025
    if (selectedYear === 2025) {
      console.log(`[Reports] Year 2025 Won Estimates (soldOnly=true): ${won.length} (expected: 1,057)`);
      
      // Find ALL estimates that pass year filter (including won, lost, pending)
      const all2025 = filterEstimatesByYear(estimates, selectedYear, true, false); // All estimates (won, lost, pending)
      console.log(`[Reports] Year 2025 Total Estimates (all statuses): ${all2025.length}`);
      
      // Debug: Check how many estimates have 2025 in date fields (per Estimates spec R2 priority)
      const estimatesWith2025Date = estimates.filter(e => {
        // Per Estimates spec R2: contract_end → contract_start → estimate_date → created_date
        const dateStr = String(e.contract_end || e.contract_start || e.estimate_date || e.created_date || '');
        if (!dateStr || dateStr === '') return false;
        if (dateStr.length >= 4) {
          return dateStr.substring(0, 4) === '2025';
        }
        return false;
      });
      console.log(`[Reports] Estimates with 2025 in date fields (per Estimates spec R2): ${estimatesWith2025Date.length}`);
      
      // Check how many are archived
      const archived2025 = estimatesWith2025Date.filter(e => e.archived);
      console.log(`[Reports] Archived estimates with 2025 dates: ${archived2025.length}`);
      
      // Check how many have "Lost" status
      const lost2025 = estimatesWith2025Date.filter(e => e.status?.toLowerCase().includes('lost'));
      console.log(`[Reports] Lost estimates with 2025 dates: ${lost2025.length}`);
      
      // Check how many are non-archived, non-lost
      const nonArchivedNonLost2025 = estimatesWith2025Date.filter(e => !e.archived && !e.status?.toLowerCase().includes('lost'));
      console.log(`[Reports] Non-archived, non-lost estimates with 2025 dates: ${nonArchivedNonLost2025.length} (this should match 1,057 if LMN counts all non-lost as sold)`);
      
      // Find estimates that pass year filter but are NOT recognized as won
      const notWon = all2025.filter(e => {
        const isLost = e.status?.toLowerCase().includes('lost');
        const isWon = isWonStatus(e);
        return !isLost && !isWon; // Not lost, but also not won
      });
      
      console.log(`[Reports] Year 2025 Estimates NOT recognized as won (and not lost): ${notWon.length}`);
      
      if (notWon.length > 0) {
        // Group by status/pipeline_status to see patterns
        const statusGroups = {};
        notWon.forEach(est => {
          const statusKey = est.status || 'null';
          const pipelineKey = est.pipeline_status || 'null';
          const key = `${statusKey}|${pipelineKey}`;
          if (!statusGroups[key]) {
            statusGroups[key] = { 
              status: statusKey, 
              pipeline_status: pipelineKey, 
              count: 0,
              sample_ids: []
            };
          }
          statusGroups[key].count++;
          if (statusGroups[key].sample_ids.length < 3) {
            statusGroups[key].sample_ids.push(est.lmn_estimate_id || est.id || 'unknown');
          }
        });
        
        const groupsArray = Object.values(statusGroups).sort((a, b) => b.count - a.count);
        console.log(`[Reports] Status patterns of ${notWon.length} estimates NOT recognized as won:`);
        console.table(groupsArray.map(g => ({
          status: g.status,
          pipeline_status: g.pipeline_status,
          count: g.count,
          sample_ids: g.sample_ids.join(', ')
        })));
      }
      
      // Also check: what if we count ALL non-lost estimates as won?
      const allNonLost = all2025.filter(e => !e.status?.toLowerCase().includes('lost'));
      console.log(`[Reports] Year 2025 Non-Lost Estimates: ${allNonLost.length} (if we count all non-lost as won)`);
    }
    return won;
  }, [estimates, selectedYear]);
  
  // Apply account and department filters to year estimates
  const filteredYearEstimates = useMemo(() => {
    return yearEstimates.filter(estimate => {
      // Filter by account (if estimate has account_id)
      if (selectedAccount !== 'all' && estimate.account_id && estimate.account_id !== selectedAccount) {
        return false;
      }

      // Filter by department/division
      if (selectedDepartment !== 'all' && estimate.division !== selectedDepartment) {
        return false;
      }

      return true;
    });
  }, [yearEstimates, selectedAccount, selectedDepartment]);

  // Apply account and department filters to year WON estimates (for "Estimates Sold" count)
  const filteredYearWonEstimates = useMemo(() => {
    const filtered = yearWonEstimates.filter(estimate => {
      // Filter by account (if estimate has account_id)
      if (selectedAccount !== 'all' && estimate.account_id && estimate.account_id !== selectedAccount) {
        return false;
      }

      // Filter by department/division
      if (selectedDepartment !== 'all' && estimate.division !== selectedDepartment) {
        return false;
      }

      return true;
    });
    // Debug: Log the filtered count
    if (selectedYear === 2025 && selectedAccount === 'all' && selectedDepartment === 'all') {
      console.log(`[Reports] Filtered Year 2025 Won Estimates (All Accounts/Departments): ${filtered.length} (expected: 1,057)`);
    }
    return filtered;
  }, [yearWonEstimates, selectedAccount, selectedDepartment, selectedYear]);

  // Calculate basic stats (use filteredYearEstimates - already filtered by year and account/department)
  const stats = useMemo(() => {
    const total = filteredYearEstimates.length;
    
    // Use yearWonEstimates (with soldOnly=true) for won count to match LMN's "Estimates Sold" count
    // But filter by account/department to match the current filters
    const won = filteredYearWonEstimates.length;
    const lost = filteredYearEstimates.filter(e => !isWonStatus(e) && e.status?.toLowerCase() === 'lost').length;
    
    const winRate = total > 0 ? ((won / total) * 100).toFixed(1) : 0;
    
    // Database uses total_price_with_tax (fallback to total_price)
    const totalValue = filteredYearEstimates.reduce((sum, e) => {
      return sum + (parseFloat(e.total_price_with_tax) || parseFloat(e.total_price) || 0);
    }, 0);
    
    // Use filteredYearWonEstimates for won value to match LMN's logic
    const wonValue = filteredYearWonEstimates.reduce((sum, e) => {
      return sum + (parseFloat(e.total_price_with_tax) || parseFloat(e.total_price) || 0);
    }, 0);

    return {
      total,
      won,
      lost,
      winRate,
      totalValue,
      wonValue
    };
  }, [filteredYearEstimates, filteredYearWonEstimates]);

  // Export handlers
  const handleExportXLSX = () => {
    exportToXLSX({ estimates: filteredYearEstimates, accounts }, selectedYear);
  };

  const handleExportPDF = () => {
    exportToPDF({ estimates: filteredYearEstimates, accounts }, selectedYear);
  };


  // Calculate estimates missing both dates (must be before early returns to maintain hook order)
  const estimatesMissingDates = useMemo(() => {
    return estimates.filter(est => {
      // Per Estimates spec R2: Check if estimate has no valid date fields (contract_end → contract_start → estimate_date → created_date)
      return !est.contract_end && !est.contract_start && !est.estimate_date && !est.created_date;
    });
  }, [estimates]);

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

  // Debug log removed - check browser console for data source status

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-slate-600 mt-1">End of year analysis and performance metrics</p>
          
          {/* Data Source Indicator */}
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              📊 <strong>Using Database Data</strong> - Reports from accounts, contacts, and estimates in database
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Source: Supabase database ({estimates.length} estimates, {accounts.length} accounts, {contacts.length} contacts)
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportXLSX}
            disabled={filteredYearEstimates.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export XLSX
          </Button>
          <Button
            variant="outline"
            onClick={handleExportPDF}
            disabled={filteredYearEstimates.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Data Quality Warning - Estimates Missing Dates */}
      {estimatesMissingDates.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                  Data Quality Issue: {estimatesMissingDates.length} estimate{estimatesMissingDates.length !== 1 ? 's' : ''} missing dates
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  These estimates are missing all date fields (<code className="text-xs bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">contract_end</code>, <code className="text-xs bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">contract_start</code>, <code className="text-xs bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">estimate_date</code>, <code className="text-xs bg-amber-100 dark:bg-amber-900/40 px-1 py-0.5 rounded">created_date</code>), 
                  so they are excluded from year-based reports. Please update these estimates with the correct dates to include them in reports.
                </p>
                {estimatesMissingDates.length <= 10 && (
                  <div className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                    <p className="font-medium mb-1">Affected estimates:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {estimatesMissingDates.slice(0, 10).map(est => (
                        <li key={est.id}>
                          {est.lmn_estimate_id || est.estimate_number || est.id} - {est.project_name || est.contact_name || 'Unnamed'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="winloss" className="flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            Win/Loss Report
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Sales Pipeline
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
        
        <TabsContent value="pipeline" className="space-y-4">
          <SalesPipelineReport 
            estimates={filteredYearEstimates}
          />
        </TabsContent>
        
        <TabsContent value="department" className="space-y-4">
          <DepartmentReport 
            estimates={filteredYearEstimates}
            accounts={accounts}
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

