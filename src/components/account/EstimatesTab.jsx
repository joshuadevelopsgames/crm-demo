import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Plus, Calendar, DollarSign, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

// Department names to normalize division values
const DEPARTMENT_NAMES = [
  'Snow and Ice Maintenance',
  'Landscape Maintenance',
  'Paving and concrete',
  'Landscape Construction',
  'Tree Care',
  'Irrigation'
];

// Normalize division value to match department names
function normalizeDepartment(division) {
  if (!division) return 'Uncategorized';
  
  const divisionLower = division.toLowerCase().trim();
  
  // Try to match against known department names
  for (const dept of DEPARTMENT_NAMES) {
    if (divisionLower === dept.toLowerCase() || 
        divisionLower.includes(dept.toLowerCase()) ||
        dept.toLowerCase().includes(divisionLower)) {
      return dept;
    }
  }
  
  // Return original if no match found
  return division || 'Uncategorized';
}

export default function EstimatesTab({ estimates = [], accountId }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [expandedDepartments, setExpandedDepartments] = useState(new Set(DEPARTMENT_NAMES));
  const [filterDepartment, setFilterDepartment] = useState('all');

  // Get available years from estimates
  const availableYears = useMemo(() => {
    const years = new Set();
    estimates.forEach(est => {
      if (est.estimate_date) {
        const year = new Date(est.estimate_date).getFullYear();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Sort newest first
  }, [estimates]);

  // Filter by status and year
  const statusFilteredEstimates = useMemo(() => {
    let filtered = estimates.filter(est => {
      // Normalize status: treat pending and any non-won as lost
      const normalizedStatus = est.status === 'won' ? 'won' : 'lost';
      
      if (filterStatus !== 'all' && normalizedStatus !== filterStatus) return false;
      
      if (filterYear !== 'all' && est.estimate_date) {
        const year = new Date(est.estimate_date).getFullYear();
        if (year.toString() !== filterYear) return false;
      }
      
      return true;
    });
    
    // Sort by date (newest first)
    filtered.sort((a, b) => {
      const dateA = a.estimate_date ? new Date(a.estimate_date).getTime() : 0;
      const dateB = b.estimate_date ? new Date(b.estimate_date).getTime() : 0;
      return dateB - dateA; // Newest first
    });
    
    return filtered;
  }, [estimates, filterStatus, filterYear]);

  // Group estimates by department
  const estimatesByDepartment = useMemo(() => {
    const grouped = {};
    
    statusFilteredEstimates.forEach(est => {
      const department = normalizeDepartment(est.division);
      if (!grouped[department]) {
        grouped[department] = [];
      }
      grouped[department].push(est);
    });
    
    // Sort estimates within each department by date (newest first)
    Object.keys(grouped).forEach(dept => {
      grouped[dept].sort((a, b) => {
        const dateA = a.estimate_date ? new Date(a.estimate_date).getTime() : 0;
        const dateB = b.estimate_date ? new Date(b.estimate_date).getTime() : 0;
        return dateB - dateA; // Newest first
      });
    });
    
    // Sort departments: known departments first, then others alphabetically
    const sortedDepartments = Object.keys(grouped).sort((a, b) => {
      const aIndex = DEPARTMENT_NAMES.indexOf(a);
      const bIndex = DEPARTMENT_NAMES.indexOf(b);
      
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
    
    return { grouped, sortedDepartments };
  }, [statusFilteredEstimates]);

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

  const calculateDepartmentTotal = (departmentEstimates) => {
    return departmentEstimates.reduce((sum, est) => {
      const amount = est.total_price_with_tax || est.total_price || 0;
      return sum + (typeof amount === 'number' ? amount : parseFloat(amount) || 0);
    }, 0);
  };

  const totalEstimates = statusFilteredEstimates.length;

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-slate-900">
          Estimates ({totalEstimates})
        </h3>
        <div className="flex gap-3">
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
          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {DEPARTMENT_NAMES.map(dept => (
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
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            New Estimate
          </Button>
        </div>
      </div>

      {/* Estimates by Department */}
      {filteredDepartments.length > 0 ? (
        <div className="space-y-4">
          {filteredDepartments.map((department) => {
            const departmentEstimates = estimatesByDepartment.grouped[department] || [];
            const isExpanded = expandedDepartments.has(department);
            const departmentTotal = calculateDepartmentTotal(departmentEstimates);
            
            if (departmentEstimates.length === 0) return null;

            return (
              <Card key={department} className="overflow-hidden">
                {/* Department Header */}
                <div 
                  className="bg-slate-50 border-b px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => toggleDepartment(department)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      )}
                      <h4 className="font-semibold text-slate-900">{department}</h4>
                      <Badge variant="outline" className="ml-2">
                        {departmentEstimates.length} {departmentEstimates.length === 1 ? 'estimate' : 'estimates'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold text-slate-900">
                        {departmentTotal.toLocaleString('en-US', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Department Estimates Table */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                            Estimate #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                            Description
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">
                            Amount
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {departmentEstimates.map((estimate) => (
                          <tr key={estimate.id} className="hover:bg-slate-50 cursor-pointer">
                            <td className="px-4 py-4">
                              <span className="font-mono text-sm font-medium text-slate-900">
                                {estimate.estimate_number || estimate.id}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Calendar className="w-4 h-4" />
                                {estimate.estimate_date ? format(new Date(estimate.estimate_date), 'MMM d, yyyy') : '—'}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <p className="text-sm text-slate-900">{estimate.project_name || estimate.description || '—'}</p>
                              {estimate.notes && (
                                <p className="text-xs text-slate-500 mt-1">{estimate.notes}</p>
                              )}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <DollarSign className="w-4 h-4 text-slate-500" />
                                <span className="font-semibold text-slate-900">
                                  {estimate.total_price_with_tax || estimate.total_price 
                                    ? (estimate.total_price_with_tax || estimate.total_price).toLocaleString('en-US', { 
                                        minimumFractionDigits: 2, 
                                        maximumFractionDigits: 2 
                                      })
                                    : '—'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <Badge variant="outline" className={getStatusColor(estimate.status)}>
                                {estimate.status === 'won' ? 'WON' : 'LOST'}
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
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No estimates found</h3>
          <p className="text-slate-600 mb-4">
            {filterStatus !== 'all' || filterDepartment !== 'all' || filterYear !== 'all'
              ? 'No estimates match the selected filters'
              : 'Create your first estimate for this account'}
          </p>
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Estimate
          </Button>
        </Card>
      )}
    </div>
  );
}










