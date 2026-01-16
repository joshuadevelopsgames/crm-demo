import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Calendar, DollarSign, Filter, ChevronDown, ChevronRight, Target, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { formatDateString, getYearFromDateString, getDateStringTimestamp } from '@/utils/dateFormatter';
import { UserFilter } from '@/components/UserFilter';
import { isWonStatus } from '@/utils/reportCalculations';
import { getEstimateYearData } from '@/utils/revenueSegmentCalculator';
import { checkPriceFieldFallback } from '@/utils/priceFieldFallbackNotification';

// Exact division categories from Google Sheet
const DIVISION_CATEGORIES = [
  'LE Irrigation',
  'LE Landscapes',
  'LE Maintenance (Summer/Winter)',
  'LE Maintenance Enchancements',
  'LE Paving',
  'LE Tree Care',
  'Line Painting',
  'Parking Lot Sweeping',
  'Snow',
  'Warranty'
];

// Match division value to exact categories, or return "Uncategorized"
function normalizeDepartment(division) {
  if (!division) return 'Uncategorized';
  
  const trimmed = division.trim();
  
  // Handle empty/null-like values - map to Uncategorized
  if (trimmed === '' || 
      trimmed.toLowerCase() === '<unassigned>' || 
      trimmed.toLowerCase() === 'unassigned' ||
      trimmed.toLowerCase() === '[unassigned]' ||
      trimmed.toLowerCase() === 'null' ||
      trimmed.toLowerCase() === 'undefined' ||
      trimmed.toLowerCase() === 'n/a' ||
      trimmed.toLowerCase() === 'na') {
    return 'Uncategorized';
  }
  
  // Check if the trimmed value exactly matches one of the known categories (case-insensitive)
  const matchedCategory = DIVISION_CATEGORIES.find(
    category => category.toLowerCase() === trimmed.toLowerCase()
  );
  
  if (matchedCategory) {
    // Return the exact category from the list (preserves exact casing)
    return matchedCategory;
  }
  
  // If no match found, return "Uncategorized"
  return 'Uncategorized';
}

export default function EstimatesTab({ estimates = [], accountId, account = null, selectedYear: propSelectedYear = null }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  
  // Use propSelectedYear if provided (from account page), otherwise use internal filterYear
  // When propSelectedYear is provided, always filter by that year (no "all" option)
  // Check for both null and undefined to handle cases where prop might not be passed
  const hasYearProp = propSelectedYear !== null && propSelectedYear !== undefined;
  const effectiveFilterYear = hasYearProp ? propSelectedYear.toString() : filterYear;
  // Initialize with all divisions collapsed by default
  const [expandedDepartments, setExpandedDepartments] = useState(new Set());
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Extract unique users from estimates with counts
  const usersWithCounts = useMemo(() => {
    const userMap = new Map();
    
    estimates.forEach(est => {
      if (est.salesperson && est.salesperson.trim()) {
        const name = est.salesperson.trim();
        if (!userMap.has(name)) {
          userMap.set(name, { name, count: 0 });
        }
        userMap.get(name).count++;
      }
      
      if (est.estimator && est.estimator.trim()) {
        const name = est.estimator.trim();
        if (!userMap.has(name)) {
          userMap.set(name, { name, count: 0 });
        }
        userMap.get(name).count++;
      }
    });
    
    return Array.from(userMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [estimates]);

  // Get available years from estimates
  // Per Year Selection System spec R1, R2, R7: Use full date priority and exclude archived
  const availableYears = useMemo(() => {
    const years = new Set();
    estimates.forEach(est => {
      // Per spec R2: Exclude archived estimates
      if (est.archived) {
        return; // Skip archived estimates
      }
      
      // Per spec R1, R7: Year determination priority: contract_end → contract_start → estimate_date → created_date
      let dateToUse = null;
      if (est.contract_end) {
        dateToUse = est.contract_end;
      } else if (est.contract_start) {
        dateToUse = est.contract_start;
      } else if (est.estimate_date) {
        dateToUse = est.estimate_date;
      } else if (est.created_date) {
        dateToUse = est.created_date;
      }
      
      if (dateToUse) {
        const year = getYearFromDateString(dateToUse);
        if (year && year >= 2000 && year <= 2100) {
          years.add(year);
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Sort newest first
  }, [estimates]);

  // Filter by status, year, and user
  // Per Year Selection System spec R1, R2, R7: Use full date priority for year filtering
  const statusFilteredEstimates = useMemo(() => {
    const filtered = estimates.filter(est => {
      // Per spec R2: Exclude archived estimates
      if (est.archived) {
        return false;
      }
      
      // Per spec R1, R11: Use isWonStatus to respect pipeline_status priority
      const normalizedStatus = isWonStatus(est) ? 'won' : 'lost';
      
      if (filterStatus !== 'all' && normalizedStatus !== filterStatus) return false;
      
      // Per spec R1, R7: Year determination priority: contract_end → contract_start → estimate_date → created_date
      if (effectiveFilterYear !== 'all') {
        let dateToUse = null;
        if (est.contract_end) {
          dateToUse = est.contract_end;
        } else if (est.contract_start) {
          dateToUse = est.contract_start;
        } else if (est.estimate_date) {
          dateToUse = est.estimate_date;
        } else if (est.created_date) {
          dateToUse = est.created_date;
        }
        
        if (dateToUse) {
          const year = getYearFromDateString(dateToUse);
          if (year && year.toString() !== effectiveFilterYear) return false;
        } else {
          // No valid date field - exclude from year filtering
          return false;
        }
      }
      
      // User filter: if users are selected, only show estimates where those users are salesperson or estimator
      if (selectedUsers.length > 0) {
        const salesperson = est.salesperson?.trim();
        const estimator = est.estimator?.trim();
        const hasMatchingUser = selectedUsers.includes(salesperson) || selectedUsers.includes(estimator);
        if (!hasMatchingUser) return false;
      }
      
      return true;
    });
    
    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = getDateStringTimestamp(a.estimate_date);
      const dateB = getDateStringTimestamp(b.estimate_date);
      return dateB - dateA; // Newest first
    });
    
    return filtered;
  }, [estimates, filterStatus, effectiveFilterYear, selectedUsers]);

  // Group estimates by department - use same filtering as overall totals
  const estimatesByDepartment = useMemo(() => {
    const grouped = {};
    
    // Use yearFilteredEstimates instead of statusFilteredEstimates to match overall totals
    // But still apply status and user filters
    let estimatesToGroup = yearFilteredEstimates;
    
    // Apply status filter
    if (filterStatus !== 'all') {
      estimatesToGroup = estimatesToGroup.filter(est => {
        const normalizedStatus = isWonStatus(est) ? 'won' : 'lost';
        return normalizedStatus === filterStatus;
      });
    }
    
    // Apply user filter
    if (selectedUsers.length > 0) {
      estimatesToGroup = estimatesToGroup.filter(est => {
        const salesperson = est.salesperson?.trim();
        const estimator = est.estimator?.trim();
        return selectedUsers.includes(salesperson) || selectedUsers.includes(estimator);
      });
    }
    
    estimatesToGroup.forEach(est => {
      const department = normalizeDepartment(est.division);
      if (!grouped[department]) {
        grouped[department] = [];
      }
      grouped[department].push(est);
    });
    
    // Sort estimates within each department by date (newest first)
    Object.keys(grouped).forEach(dept => {
      grouped[dept].sort((a, b) => {
        const dateA = getDateStringTimestamp(a.estimate_date);
        const dateB = getDateStringTimestamp(b.estimate_date);
        return dateB - dateA; // Newest first
      });
    });
    
    // Sort departments: Uncategorized always first, then known divisions, then others alphabetically
    const sortedDepartments = Object.keys(grouped).sort((a, b) => {
      // Uncategorized always comes first
      if (a === 'Uncategorized') return -1;
      if (b === 'Uncategorized') return 1;
      
      const aIndex = DIVISION_CATEGORIES.indexOf(a);
      const bIndex = DIVISION_CATEGORIES.indexOf(b);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
    
    return { grouped, sortedDepartments };
  }, [yearFilteredEstimates, filterStatus, selectedUsers]);

  // Filter by department if selected
  const filteredDepartments = useMemo(() => {
    if (filterDepartment === 'all') {
      return estimatesByDepartment.sortedDepartments;
    }
    return estimatesByDepartment.sortedDepartments.filter(dept => dept === filterDepartment);
  }, [filterDepartment, estimatesByDepartment]);

  const toggleDepartment = (department) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(department)) {
      newExpanded.delete(department);
    } else {
      newExpanded.add(department);
    }
    setExpandedDepartments(newExpanded);
  };

  const getStatusColor = (status) => {
    const colors = {
      won: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      lost: 'bg-red-100 text-red-800 border-red-200'
    };
    // All non-won statuses (including pending) are treated as lost
    return colors[status] || colors.lost;
  };

  const calculateDepartmentTotal = (departmentName) => {
    // Use the same logic as totalWonValue to ensure consistency:
    // 1. Start with ALL estimates (not pre-filtered)
    // 2. Filter for won estimates first
    // 3. Check year applicability
    // 4. Filter by department
    // This ensures department totals match overall totals
    
    if (effectiveFilterYear === 'all') {
      // For "all years", sum full values of won estimates in this department
      const wonEstimates = estimates.filter(est => 
        !est.archived && 
        isWonStatus(est) && 
        normalizeDepartment(est.division) === departmentName
      );
      return wonEstimates.reduce((sum, est) => {
        // Check for fallback and show toast notification if needed (once per session)
        checkPriceFieldFallback(est);
        const amount = est.total_price || est.total_price_with_tax || 0;
        return sum + (typeof amount === 'number' ? amount : parseFloat(amount) || 0);
      }, 0);
    }
    
    // For specific year, use annualization to match overall totals
    // Must use same logic as totalWonValue: filter all estimates for won, then check year
    const selectedYear = parseInt(effectiveFilterYear);
    const wonEstimates = estimates.filter(est => 
      !est.archived && 
      isWonStatus(est) && 
      normalizeDepartment(est.division) === departmentName
    );
    
    return wonEstimates.reduce((sum, est) => {
      const yearData = getEstimateYearData(est, selectedYear);
      if (yearData && yearData.appliesToCurrentYear) {
        return sum + (yearData.value || 0);
      }
      return sum;
    }, 0);
  };

  // Calculate win percentage for a department
  const calculateDepartmentWinPercentage = (departmentEstimates) => {
    if (departmentEstimates.length === 0) return 0;
    const won = departmentEstimates.filter(est => isWonStatus(est)).length;
    return (won / departmentEstimates.length) * 100;
  };

  // Filter estimates by year using contract-year allocation logic (for Overall Win Rate card)
  // This matches the logic used in Total Work card to ensure consistency
  // Per Year Selection System spec R1, R2, R7-R9: Use contract-year allocation for multi-year contracts
  const yearFilteredEstimates = useMemo(() => {
    if (effectiveFilterYear === 'all') {
      // If "all years" selected, return all non-archived estimates
      return estimates.filter(est => !est.archived);
    }
    
    const selectedYear = parseInt(effectiveFilterYear);
    return estimates.filter(est => {
      // Per spec R2: Exclude archived estimates
      if (est.archived) {
        return false;
      }
      
      // Use getEstimateYearData to check if estimate applies to selected year
      // This handles multi-year contracts with annualization
      const yearData = getEstimateYearData(est, selectedYear);
      return yearData && yearData.appliesToCurrentYear;
    });
  }, [estimates, effectiveFilterYear]);

  // Filter estimates by year using contract_start date for COUNT-based won/loss ratio
  // Multi-year contracts are treated as single-year contracts using contract_start year
  // This is separate from yearFilteredEstimates which uses annualization for dollar values
  const countFilteredEstimates = useMemo(() => {
    if (effectiveFilterYear === 'all') {
      // If "all years" selected, return all non-archived estimates
      return estimates.filter(est => !est.archived);
    }
    
    return estimates.filter(est => {
      // Per spec R2: Exclude archived estimates
      if (est.archived) {
        return false;
      }
      
      // Per spec R1, R7: Year determination priority: contract_end → contract_start → estimate_date → created_date
      // For won/loss ratio COUNT, use simple date extraction (treat multi-year as single-year)
      let dateToUse = null;
      if (est.contract_end) {
        dateToUse = est.contract_end;
      } else if (est.contract_start) {
        dateToUse = est.contract_start;
      } else if (est.estimate_date) {
        dateToUse = est.estimate_date;
      } else if (est.created_date) {
        dateToUse = est.created_date;
      }
      
      if (dateToUse) {
        const year = getYearFromDateString(dateToUse);
        if (year && year.toString() !== effectiveFilterYear) return false;
      } else {
        // No valid date field - exclude from year filtering
        return false;
      }
      
      return true;
    });
  }, [estimates, effectiveFilterYear]);

  // Calculate total win percentage for count-filtered estimates (for Overall Win Rate card)
  // Uses countFilteredEstimates which treats multi-year contracts as single-year (contract_start year only)
  const totalWinPercentage = useMemo(() => {
    if (countFilteredEstimates.length === 0) return 0;
    const won = countFilteredEstimates.filter(est => isWonStatus(est)).length;
    return (won / countFilteredEstimates.length) * 100;
  }, [countFilteredEstimates]);

  // Calculate won value as sum of won estimates' dollar values for selected year
  // Uses annualization for multi-year contracts to match totalEstimatedValue
  const totalWonValue = useMemo(() => {
    if (effectiveFilterYear === 'all') {
      // For "all years", sum full values of won estimates
      const wonEstimates = estimates.filter(est => !est.archived && isWonStatus(est));
      return wonEstimates.reduce((sum, est) => {
        // Check for fallback and show toast notification if needed (once per session)
        checkPriceFieldFallback(est);
        const amount = est.total_price || est.total_price_with_tax || 0;
        return sum + (typeof amount === 'number' ? amount : parseFloat(amount) || 0);
      }, 0);
    }
    
    // For specific year, use annualization (must match totalEstimatedValue logic)
    const selectedYear = parseInt(effectiveFilterYear);
    const wonEstimates = estimates.filter(est => !est.archived && isWonStatus(est));
    
    return wonEstimates.reduce((sum, est) => {
      const yearData = getEstimateYearData(est, selectedYear);
      if (yearData && yearData.appliesToCurrentYear) {
        return sum + (yearData.value || 0);
      }
      return sum;
    }, 0);
  }, [estimates, effectiveFilterYear]);

  const totalEstimatedValue = useMemo(() => {
    if (effectiveFilterYear === 'all') {
      // For "all years", sum all estimates (full value, not annualized)
      // Includes ALL estimates: won + lost + pending
      return estimates.filter(est => !est.archived).reduce((sum, est) => {
        // Check for fallback and show toast notification if needed (once per session)
        checkPriceFieldFallback(est);
        const amount = est.total_price || est.total_price_with_tax || 0;
        return sum + (typeof amount === 'number' ? amount : parseFloat(amount) || 0);
      }, 0);
    }
    
    // For specific year, use annualization to match totalWonValue logic
    // Must include ALL estimates (won + lost + pending) that apply to the selected year
    const selectedYear = parseInt(effectiveFilterYear);
    return estimates.filter(est => !est.archived).reduce((sum, est) => {
      // Check for fallback and show toast notification if needed (once per session)
      checkPriceFieldFallback(est);
      
      // Use getEstimateYearData to check year applicability and get annualized value
      // This handles multi-year contracts with annualization
      // Note: getEstimateYearData returns null if price is 0 or no valid date
      // Estimates with $0 price contribute $0 to total (correct behavior)
      // Estimates without valid dates can't be assigned to a year (correctly excluded)
      const yearData = getEstimateYearData(est, selectedYear);
      if (yearData && yearData.appliesToCurrentYear) {
        // yearData.value already contains the annualized amount for this year
        return sum + (yearData.value || 0);
      }
      return sum;
    }, 0);
  }, [estimates, effectiveFilterYear]);

  const totalEstimates = statusFilteredEstimates.length;

  return (
    <div className="space-y-4">
      {/* Total Win Percentage Card */}
      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-700">Overall Win Rate</p>
                <p className="text-3xl font-bold text-emerald-900 mt-1">
                  {totalWinPercentage.toFixed(1)}%
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  {countFilteredEstimates.filter(est => isWonStatus(est)).length} won / {countFilteredEstimates.length} total
                </p>
                <p className="text-xs text-emerald-600 mt-1 font-medium">
                  ${totalWonValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} won / ${totalEstimatedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} estimated
                </p>
              </div>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-600 opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-[#ffffff]">
          Estimates ({totalEstimates})
        </h3>
        <div className="flex gap-3">
          {!hasYearProp && (
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-32">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {DIVISION_CATEGORIES.map(dept => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
              <SelectItem value="Uncategorized">Uncategorized</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <UserFilter
            users={usersWithCounts}
            selectedUsers={selectedUsers}
            onSelectionChange={setSelectedUsers}
            placeholder="Filter by User"
          />
        </div>
      </div>

      {/* Estimates by Department */}
      {filteredDepartments.length > 0 ? (
        <div className="space-y-4">
          {filteredDepartments.map((department) => {
            const departmentEstimates = estimatesByDepartment.grouped[department] || [];
            const isExpanded = expandedDepartments.has(department);
            const departmentTotal = calculateDepartmentTotal(department);
            
            if (departmentEstimates.length === 0) return null;

            return (
              <Card key={department} className="overflow-hidden">
                {/* Department Header */}
                <div 
                  className={`border-b px-4 py-3 cursor-pointer transition-colors ${
                    department === 'Uncategorized'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30' 
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  onClick={() => toggleDepartment(department)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className={`w-4 h-4 ${
                          department === 'Uncategorized'
                            ? 'text-amber-600 dark:text-amber-400' 
                            : 'text-slate-600 dark:text-slate-400'
                        }`} />
                      ) : (
                        <ChevronRight className={`w-4 h-4 ${
                          department === 'Uncategorized'
                            ? 'text-amber-600 dark:text-amber-400' 
                            : 'text-slate-600 dark:text-slate-400'
                        }`} />
                      )}
                      <h4 className={`font-semibold ${
                        department === 'Uncategorized'
                          ? 'text-amber-900 dark:text-amber-200' 
                          : 'text-slate-900 dark:text-[#ffffff]'
                      }`}>
                        {department}
                      </h4>
                      <Badge variant="outline" className="ml-2">
                        {departmentEstimates.length} {departmentEstimates.length === 1 ? 'estimate' : 'estimates'}
                      </Badge>
                      {department !== 'Uncategorized' && (
                        <Badge 
                          variant="outline" 
                          className={`ml-2 ${
                            calculateDepartmentWinPercentage(departmentEstimates) >= 50
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : calculateDepartmentWinPercentage(departmentEstimates) >= 30
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}
                        >
                          {calculateDepartmentWinPercentage(departmentEstimates).toFixed(1)}% win rate
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span className={`text-sm font-semibold ${
                          calculateDepartmentWinPercentage(departmentEstimates) >= 50
                            ? 'text-emerald-700'
                            : calculateDepartmentWinPercentage(departmentEstimates) >= 30
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}>
                          {calculateDepartmentWinPercentage(departmentEstimates).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span className="font-semibold text-slate-900 dark:text-[#ffffff]">
                          {departmentTotal.toLocaleString('en-US', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Department Estimates Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                            Estimate #
                          </th>
                          <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                            Date
                          </th>
                          <th className="px-2 sm:px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                            Description
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {departmentEstimates.map((estimate) => (
                          <tr key={estimate.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                            <td className="px-2 sm:px-4 py-3 sm:py-4">
                              <span className="font-mono text-sm font-medium text-slate-900 dark:text-[#ffffff]">
                                {estimate.estimate_number || estimate.id}
                              </span>
                            </td>
                            <td className="px-2 sm:px-4 py-3 sm:py-4">
                              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <Calendar className="w-4 h-4" />
                                {estimate.estimate_date ? formatDateString(estimate.estimate_date, 'MMM d, yyyy') : '—'}
                              </div>
                            </td>
                            <td className="px-2 sm:px-4 py-3 sm:py-4">
                              <div className="space-y-1">
                                <p className="text-sm text-slate-900 dark:text-[#ffffff]">{estimate.project_name || estimate.description || '—'}</p>
                                {estimate.notes && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{estimate.notes}</p>
                                )}
                                {/* User role badges when filtered */}
                                {selectedUsers.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {selectedUsers.map(userName => {
                                      const isSalesperson = estimate.salesperson?.trim() === userName;
                                      const isEstimator = estimate.estimator?.trim() === userName;
                                      if (!isSalesperson && !isEstimator) return null;
                                      
                                      const roles = [];
                                      if (isSalesperson) roles.push('salesperson');
                                      if (isEstimator) roles.push('estimator');
                                      
                                      return (
                                        <Badge
                                          key={userName}
                                          variant="outline"
                                          className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"
                                        >
                                          {userName}
                                          {roles.includes('salesperson') && roles.includes('estimator') && (
                                            <span className="ml-1">(Salesperson, Estimator)</span>
                                          )}
                                          {roles.includes('salesperson') && !roles.includes('estimator') && (
                                            <span className="ml-1">(Salesperson)</span>
                                          )}
                                          {roles.includes('estimator') && !roles.includes('salesperson') && (
                                            <span className="ml-1">(Estimator)</span>
                                          )}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <DollarSign className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                <span className="font-semibold text-slate-900 dark:text-[#ffffff]">
                                  {estimate.total_price || estimate.total_price_with_tax 
                                    ? (estimate.total_price || estimate.total_price_with_tax).toLocaleString('en-US', { 
                                        minimumFractionDigits: 2, 
                                        maximumFractionDigits: 2 
                                      })
                                    : '—'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <Badge variant="outline" className={getStatusColor(estimate.status)}>
                                {isWonStatus(estimate) ? 'WON' : 'LOST'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-[#ffffff] mb-1">No estimates found</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {filterStatus !== 'all' || filterDepartment !== 'all' || effectiveFilterYear !== 'all'
              ? 'No estimates match the selected filters'
              : 'No estimates found for this account'}
          </p>
        </Card>
      )}
    </div>
  );
}










