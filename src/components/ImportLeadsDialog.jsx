import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { parseContactsExport } from '@/utils/lmnContactsExportParser';
import { parseLeadsList } from '@/utils/lmnLeadsListParser';
import { parseEstimatesList } from '@/utils/lmnEstimatesListParser';
import { parseJobsiteExport } from '@/utils/lmnJobsiteExportParser';
import { mergeContactData } from '@/utils/lmnMergeData';
// Data is now stored server-side via API endpoints, no Google Sheets needed
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Upload,
  FileText,
  Users,
  Building2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  X,
  FileCheck
} from 'lucide-react';

export default function ImportLeadsDialog({ open, onClose }) {
  // File 1: Contacts Export
  const [contactsFile, setContactsFile] = useState(null);
  const [contactsData, setContactsData] = useState(null);
  const [contactsDragging, setContactsDragging] = useState(false);
  
  // File 2: Leads List
  const [leadsFile, setLeadsFile] = useState(null);
  const [leadsData, setLeadsData] = useState(null);
  const [leadsDragging, setLeadsDragging] = useState(false);
  
  // File 3: Estimates List
  const [estimatesFile, setEstimatesFile] = useState(null);
  const [estimatesData, setEstimatesData] = useState(null);
  const [estimatesDragging, setEstimatesDragging] = useState(false);
  
  // File 4: Jobsite Export
  const [jobsitesFile, setJobsitesFile] = useState(null);
  const [jobsitesData, setJobsitesData] = useState(null);
  const [jobsitesDragging, setJobsitesDragging] = useState(false);
  
  // Merged data and status
  const [mergedData, setMergedData] = useState(null);
  const [importStatus, setImportStatus] = useState('idle');
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState(null);
  const [importProgress, setImportProgress] = useState({
    currentStep: '',
    progress: 0,
    totalSteps: 0,
    completedSteps: 0
  });
  
  const queryClient = useQueryClient();

  // Convert XLSX file to CSV text
  const convertXlsxToCsv = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csvText = XLSX.utils.sheet_to_csv(worksheet);
          resolve(csvText);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Process Contacts Export file (CSV or XLSX)
  const processContactsFile = async (file) => {
    if (!file) return;
    
    // Check file type
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    try {
      let csvText;
      
      if (isXlsx) {
        csvText = await convertXlsxToCsv(file);
      } else {
        // Read CSV file as text
        csvText = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      }
      
      const parsed = parseContactsExport(csvText);
      
      if (parsed.stats.error) {
        setError(`Contacts Export: ${parsed.stats.error}`);
        return;
      }
      
      setContactsData(parsed);
      setContactsFile(file);
      
      // Try to merge all loaded files
      checkAndMergeAllFiles(parsed, leadsData, estimatesData, jobsitesData);
    } catch (err) {
      setError(`Error reading Contacts Export: ${err.message}`);
    }
  };

  // Process Leads List file (CSV or XLSX)
  const processLeadsFile = async (file) => {
    if (!file) return;
    
    // Check file type
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    try {
      let csvText;
      
      if (isXlsx) {
        csvText = await convertXlsxToCsv(file);
      } else {
        // Read CSV file as text
        csvText = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      }
      
      const parsed = parseLeadsList(csvText);
      
      if (parsed.stats.error) {
        setError(`Leads List: ${parsed.stats.error}`);
        return;
      }
      
      setLeadsData(parsed);
      setLeadsFile(file);
      
      // Try to merge all loaded files
      checkAndMergeAllFiles(contactsData, parsed, estimatesData, jobsitesData);
    } catch (err) {
      setError(`Error reading Leads List: ${err.message}`);
    }
  };

  // Process Estimates List file (CSV or XLSX)
  const processEstimatesFile = async (file) => {
    if (!file) return;
    
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    try {
      let csvText;
      
      if (isXlsx) {
        csvText = await convertXlsxToCsv(file);
      } else {
        csvText = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      }
      
      const parsed = parseEstimatesList(csvText);
      
      if (parsed.stats.error) {
        setError(`Estimates List: ${parsed.stats.error}`);
        return;
      }
      
      setEstimatesData(parsed);
      setEstimatesFile(file);
      
      // Try to merge all loaded files
      checkAndMergeAllFiles(contactsData, leadsData, parsed, jobsitesData);
    } catch (err) {
      setError(`Error reading Estimates List: ${err.message}`);
    }
  };

  // Process Jobsite Export file (CSV or XLSX)
  const processJobsitesFile = async (file) => {
    if (!file) return;
    
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    try {
      let csvText;
      
      if (isXlsx) {
        csvText = await convertXlsxToCsv(file);
      } else {
        csvText = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      }
      
      const parsed = parseJobsiteExport(csvText);
      
      if (parsed.stats.error) {
        setError(`Jobsite Export: ${parsed.stats.error}`);
        return;
      }
      
      setJobsitesData(parsed);
      setJobsitesFile(file);
      
      // Try to merge all loaded files
      checkAndMergeAllFiles(contactsData, leadsData, estimatesData, parsed);
    } catch (err) {
      setError(`Error reading Jobsite Export: ${err.message}`);
    }
  };

  // Check if all required files are loaded and merge them
  const checkAndMergeAllFiles = (contacts, leads, estimates, jobsites) => {
    // Require all 4 files: contacts, leads, estimates, and jobsites
    if (!contacts || !leads || !estimates || !jobsites) return;
    
    try {
      // Merge contacts and leads first
      const merged = mergeContactData(contacts, leads, estimates, jobsites);
      
      setMergedData(merged);
      setImportStatus('ready');
      setError(null);
    } catch (err) {
      setError(`Error merging data: ${err.message}`);
    }
  };

  // Drag and drop handlers for Contacts Export
  const handleContactsDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContactsDragging(true);
  };

  const handleContactsDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContactsDragging(false);
  };

  const handleContactsDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setContactsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const isValidFile = file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isValidFile) {
        setError('Please upload a CSV or XLSX file');
        return;
      }
      processContactsFile(file);
    }
  };

  // Drag and drop handlers for Leads List
  const handleLeadsDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLeadsDragging(true);
  };

  const handleLeadsDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLeadsDragging(false);
  };

  const handleLeadsDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLeadsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const isValidFile = file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isValidFile) {
        setError('Please upload a CSV or XLSX file');
        return;
      }
      processLeadsFile(file);
    }
  };

  // Drag and drop handlers for Estimates List
  const handleEstimatesDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEstimatesDragging(true);
  };

  const handleEstimatesDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEstimatesDragging(false);
  };

  const handleEstimatesDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEstimatesDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const isValidFile = file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isValidFile) {
        setError('Please upload a CSV or XLSX file');
        return;
      }
      processEstimatesFile(file);
    }
  };

  // Drag and drop handlers for Jobsite Export
  const handleJobsitesDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setJobsitesDragging(true);
  };

  const handleJobsitesDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setJobsitesDragging(false);
  };

  const handleJobsitesDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setJobsitesDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const isValidFile = file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isValidFile) {
        setError('Please upload a CSV or XLSX file');
        return;
      }
      processJobsitesFile(file);
    }
  };

  // Import merged data with automatic merge/update
  const handleImport = async () => {
    if (!mergedData) return;

    setImportStatus('importing');
    setError(null);
    
    // Calculate total steps for progress tracking
    const totalSteps = 
      (mergedData.accounts?.length > 0 ? 1 : 0) +
      (mergedData.contacts?.length > 0 ? Math.ceil(mergedData.contacts.length / 500) : 0) +
      (mergedData.estimates?.length > 0 ? Math.ceil(mergedData.estimates.length / 500) : 0) +
      (mergedData.jobsites?.length > 0 ? Math.ceil(mergedData.jobsites.length / 500) : 0);
    
    setImportProgress({
      currentStep: 'Starting import...',
      progress: 0,
      totalSteps: totalSteps,
      completedSteps: 0
    });

    try {
      const results = {
        accountsCreated: 0,
        accountsUpdated: 0,
        contactsCreated: 0,
        contactsUpdated: 0,
        estimatesCreated: 0,
        estimatesUpdated: 0,
        jobsitesCreated: 0,
        jobsitesUpdated: 0,
        accountsFailed: 0,
        contactsFailed: 0,
        estimatesFailed: 0,
        jobsitesFailed: 0,
        errors: []
      };

      // Import/Update accounts using bulk upsert (much faster)
      if (mergedData.accounts && mergedData.accounts.length > 0) {
        try {
          const response = await fetch('/api/data/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'bulk_upsert', 
              data: { accounts: mergedData.accounts, lookupField: 'lmn_crm_id' } 
            })
          });
          const result = await response.json();
          if (result.success) {
            results.accountsCreated = result.created;
            results.accountsUpdated = result.updated;
            console.log(`✅ Bulk imported ${result.total} accounts (${result.created} created, ${result.updated} updated)`);
          } else {
            throw new Error(result.error || 'Bulk import failed');
          }
        } catch (err) {
          results.accountsFailed = mergedData.accounts.length;
          results.errors.push(`Accounts bulk import: ${err.message}`);
        }
      }

      // Import/Update contacts using bulk upsert
      if (mergedData.contacts && mergedData.contacts.length > 0) {
        try {
          const response = await fetch('/api/data/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'bulk_upsert', 
              data: { contacts: mergedData.contacts, lookupField: 'lmn_contact_id' } 
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
          
          const result = await response.json();
          if (result.success) {
            results.contactsCreated = result.created;
            results.contactsUpdated = result.updated;
            console.log(`✅ Bulk imported ${result.total} contacts (${result.created} created, ${result.updated} updated)`);
          } else {
            throw new Error(result.error || 'Bulk import failed');
          }
        } catch (err) {
          results.contactsFailed = mergedData.contacts.length;
          results.errors.push(`Contacts bulk import: ${err.message}`);
          console.error('Contacts import error:', err);
        }
      }

      // Import/Update estimates using bulk upsert
      // Split into smaller chunks to avoid 413 (Content Too Large) errors
      if (mergedData.estimates && mergedData.estimates.length > 0) {
        try {
          const CHUNK_SIZE = 500; // Process 500 at a time to avoid payload size limits
          let totalCreated = 0;
          let totalUpdated = 0;
          
          for (let i = 0; i < mergedData.estimates.length; i += CHUNK_SIZE) {
            const chunk = mergedData.estimates.slice(i, i + CHUNK_SIZE);
            const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
            const totalChunks = Math.ceil(mergedData.estimates.length / CHUNK_SIZE);
            
            console.log(`📝 Processing estimates chunk ${chunkNum}/${totalChunks} (${chunk.length} estimates)...`);
            
            const response = await fetch('/api/data/estimates', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                action: 'bulk_upsert', 
                data: { estimates: chunk, lookupField: 'lmn_estimate_id' } 
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            if (result.success) {
              totalCreated += result.created;
              totalUpdated += result.updated;
              console.log(`✅ Chunk ${chunkNum}: ${result.created} created, ${result.updated} updated`);
            } else {
              throw new Error(result.error || 'Bulk import failed');
            }
          }
          
          results.estimatesCreated = totalCreated;
          results.estimatesUpdated = totalUpdated;
          console.log(`✅ Bulk imported ${mergedData.estimates.length} estimates (${totalCreated} created, ${totalUpdated} updated)`);
        } catch (err) {
          results.estimatesFailed = mergedData.estimates.length;
          results.errors.push(`Estimates bulk import: ${err.message}`);
          console.error('Estimates import error:', err);
        }
      }

      // Import/Update jobsites using bulk upsert
      if (mergedData.jobsites && mergedData.jobsites.length > 0) {
        try {
          const response = await fetch('/api/data/jobsites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'bulk_upsert', 
              data: { jobsites: mergedData.jobsites, lookupField: 'lmn_jobsite_id' } 
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
          
          const result = await response.json();
          if (result.success) {
            results.jobsitesCreated = result.created;
            results.jobsitesUpdated = result.updated;
            console.log(`✅ Bulk imported ${result.total} jobsites (${result.created} created, ${result.updated} updated)`);
          } else {
            throw new Error(result.error || 'Bulk import failed');
          }
        } catch (err) {
          results.jobsitesFailed = mergedData.jobsites.length;
          results.errors.push(`Jobsites bulk import: ${err.message}`);
          console.error('Jobsites import error:', err);
        }
      }

      // Data is automatically saved to Supabase via API calls above
      console.log('✅ All imported data saved to Supabase');
      console.log('🔍 Imported data counts:', {
        accounts: mergedData?.accounts?.length || 0,
        contacts: mergedData?.contacts?.length || 0,
        estimates: mergedData?.estimates?.length || 0,
        jobsites: mergedData?.jobsites?.length || 0
      });

      setImportResults(results);
      setImportStatus('success');

      // Force refresh data from server
      {
        // Small delay to ensure server has processed all writes
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Invalidate all queries to force fresh data load
      queryClient.invalidateQueries();
      
      // Wait a moment for invalidation to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force refetch all active queries
      await queryClient.refetchQueries({ type: 'active' });

    } catch (err) {
      setError(`Import failed: ${err.message}`);
      setImportStatus('error');
    }
  };

  // Reset
  const handleReset = () => {
    setContactsFile(null);
    setContactsData(null);
    setLeadsFile(null);
    setLeadsData(null);
    setEstimatesFile(null);
    setEstimatesData(null);
    setJobsitesFile(null);
    setJobsitesData(null);
    setMergedData(null);
    setImportStatus('idle');
    setImportResults(null);
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const allFilesUploaded = contactsFile && leadsFile && estimatesFile && jobsitesFile;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Import from LMN</DialogTitle>
          <p className="text-slate-600 text-sm mt-1">
            Upload LMN export files to import accounts, contacts, estimates, and jobsites
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Loading State */}
          {importStatus === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <RefreshCw className="w-12 h-12 text-emerald-600 animate-spin" />
              <div className="text-center">
                <p className="text-lg font-semibold text-slate-900">Importing Data...</p>
                <p className="text-sm text-slate-600 mt-2">{importProgress.currentStep}</p>
                <p className="text-xs text-slate-500 mt-3">Please wait while we import your data</p>
              </div>
            </div>
          )}

          {/* Upload Section */}
          {importStatus === 'idle' || importStatus === 'ready' ? (
            <>
              {/* Instructions */}
              <Card className="p-4 bg-blue-50 border-blue-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Required files (CSV or XLSX):</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li><strong>Contacts Export</strong> - Has CRM IDs, Contact IDs, Tags, Archived status</li>
                      <li><strong>Leads List</strong> - Has Position, Do Not Email/Mail/Call preferences</li>
                      <li><strong>Estimates List</strong> - Has Estimate IDs, Dates, Status, Pricing (required)</li>
                      <li><strong>Jobsite Export</strong> - Has Jobsite IDs, Addresses, Contact links (required)</li>
                    </ol>
                    <p className="mt-2">All four files are required. Estimates and Jobsites are needed to calculate revenue and account scores. Both CSV and XLSX formats are supported.</p>
                  </div>
                </div>
              </Card>

              {/* Four Upload Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* File 1: Contacts Export */}
                <div
                  onDragOver={handleContactsDragOver}
                  onDragLeave={handleContactsDragLeave}
                  onDrop={handleContactsDrop}
                  className={`border-2 border-dashed rounded-lg p-6 transition-all ${
                    contactsDragging ? 'border-blue-500 bg-blue-50' : 
                    contactsFile ? 'border-emerald-500 bg-emerald-50' : 
                    'border-slate-300 bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    {contactsFile ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                          <FileCheck className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-900">File 1 Uploaded ✓</p>
                          <p className="text-sm text-emerald-700 mt-1">{contactsFile.name}</p>
                          <p className="text-xs text-slate-600 mt-2">
                            {contactsData?.stats.accountsFound} accounts, {contactsData?.stats.contactsFound} contacts
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setContactsFile(null);
                            setContactsData(null);
                            setMergedData(null);
                          }}
                          className="text-slate-600"
                        >
                          Remove
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">File 1: Contacts Export</p>
                          <p className="text-xs text-slate-600 mt-1">
                            Drag & drop or click to upload
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls,text/csv,application/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const isValidFile = file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                              if (!isValidFile) {
                                setError('Please upload a CSV or XLSX file');
                                return;
                              }
                              processContactsFile(file);
                            }
                          }}
                          className="hidden"
                          id="contacts-file-input"
                        />
                        <Button asChild size="sm" variant="outline">
                          <label htmlFor="contacts-file-input" className="cursor-pointer">
                            <FileText className="w-3 h-3 mr-1" />
                            Choose File
                          </label>
                        </Button>
                        <p className="text-xs text-slate-500 mt-2">
                          CSV or XLSX format
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Has: CRM ID, Contact ID, Tags, Archived
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* File 2: Leads List */}
                <div
                  onDragOver={handleLeadsDragOver}
                  onDragLeave={handleLeadsDragLeave}
                  onDrop={handleLeadsDrop}
                  className={`border-2 border-dashed rounded-lg p-6 transition-all ${
                    leadsDragging ? 'border-blue-500 bg-blue-50' : 
                    leadsFile ? 'border-emerald-500 bg-emerald-50' : 
                    'border-slate-300 bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    {leadsFile ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                          <FileCheck className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-900">File 2 Uploaded ✓</p>
                          <p className="text-sm text-emerald-700 mt-1">{leadsFile.name}</p>
                          <p className="text-xs text-slate-600 mt-2">
                            {leadsData?.stats.contactsFound} contacts with preferences
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLeadsFile(null);
                            setLeadsData(null);
                            setMergedData(null);
                          }}
                          className="text-slate-600"
                        >
                          Remove
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">File 2: Leads List</p>
                          <p className="text-xs text-slate-600 mt-1">
                            Drag & drop or click to upload
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls,text/csv,application/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const isValidFile = file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                              if (!isValidFile) {
                                setError('Please upload a CSV or XLSX file');
                                return;
                              }
                              processLeadsFile(file);
                            }
                          }}
                          className="hidden"
                          id="leads-file-input"
                        />
                        <Button asChild size="sm" variant="outline">
                          <label htmlFor="leads-file-input" className="cursor-pointer">
                            <FileText className="w-3 h-3 mr-1" />
                            Choose File
                          </label>
                        </Button>
                        <p className="text-xs text-slate-500 mt-2">
                          CSV or XLSX format
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Has: Position, Do Not Email/Mail/Call
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* File 3: Estimates List */}
                <div
                  onDragOver={handleEstimatesDragOver}
                  onDragLeave={handleEstimatesDragLeave}
                  onDrop={handleEstimatesDrop}
                  className={`border-2 border-dashed rounded-lg p-6 transition-all ${
                    estimatesDragging ? 'border-blue-500 bg-blue-50' : 
                    estimatesFile ? 'border-emerald-500 bg-emerald-50' : 
                    'border-slate-300 bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    {estimatesFile ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                          <FileCheck className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-900">File 3 Uploaded ✓</p>
                          <p className="text-sm text-emerald-700 mt-1">{estimatesFile.name}</p>
                          <p className="text-xs text-slate-600 mt-2">
                            {estimatesData?.stats.total} estimates
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEstimatesFile(null);
                            setEstimatesData(null);
                            setMergedData(null);
                            setImportStatus('idle');
                          }}
                          className="text-slate-600"
                        >
                          Remove
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">File 3: Estimates List</p>
                          <p className="text-xs text-red-600 font-semibold">(Required)</p>
                          <p className="text-xs text-slate-600 mt-1">
                            Drag & drop or click to upload
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls,text/csv,application/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const isValidFile = file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                              if (!isValidFile) {
                                setError('Please upload a CSV or XLSX file');
                                return;
                              }
                              processEstimatesFile(file);
                            }
                          }}
                          className="hidden"
                          id="estimates-file-input"
                        />
                        <Button asChild size="sm" variant="outline">
                          <label htmlFor="estimates-file-input" className="cursor-pointer">
                            <FileText className="w-3 h-3 mr-1" />
                            Choose File
                          </label>
                        </Button>
                        <p className="text-xs text-slate-500 mt-2">
                          CSV or XLSX format
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Has: Estimate ID, Date, Status, Pricing
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* File 4: Jobsite Export */}
                <div
                  onDragOver={handleJobsitesDragOver}
                  onDragLeave={handleJobsitesDragLeave}
                  onDrop={handleJobsitesDrop}
                  className={`border-2 border-dashed rounded-lg p-6 transition-all ${
                    jobsitesDragging ? 'border-blue-500 bg-blue-50' : 
                    jobsitesFile ? 'border-emerald-500 bg-emerald-50' : 
                    'border-slate-300 bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    {jobsitesFile ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                          <FileCheck className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-emerald-900">File 4 Uploaded ✓</p>
                          <p className="text-sm text-emerald-700 mt-1">{jobsitesFile.name}</p>
                          <p className="text-xs text-slate-600 mt-2">
                            {jobsitesData?.stats.total} jobsites
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setJobsitesFile(null);
                            setJobsitesData(null);
                            setMergedData(null);
                            setImportStatus('idle');
                          }}
                          className="text-slate-600"
                        >
                          Remove
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-teal-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">File 4: Jobsite Export</p>
                          <p className="text-xs text-red-600 font-semibold">(Required)</p>
                          <p className="text-xs text-slate-600 mt-1">
                            Drag & drop or click to upload
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls,text/csv,application/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const isValidFile = file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                              if (!isValidFile) {
                                setError('Please upload a CSV or XLSX file');
                                return;
                              }
                              processJobsitesFile(file);
                            }
                          }}
                          className="hidden"
                          id="jobsites-file-input"
                        />
                        <Button asChild size="sm" variant="outline">
                          <label htmlFor="jobsites-file-input" className="cursor-pointer">
                            <FileText className="w-3 h-3 mr-1" />
                            Choose File
                          </label>
                        </Button>
                        <p className="text-xs text-slate-500 mt-2">
                          CSV or XLSX format
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Has: Jobsite ID, Address, Contact links
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Merge Status */}
              {allFilesUploaded && mergedData && (
                <Card className="p-6 border-emerald-200 bg-emerald-50">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-emerald-900">Files Merged Successfully!</p>
                        <p className="text-sm text-emerald-800 mt-1">
                          Ready to import {mergedData.stats.totalAccounts} accounts and {mergedData.stats.totalContacts} contacts
                          {mergedData.estimates && mergedData.estimates.length > 0 && `, ${mergedData.estimates.length} estimates`}
                          {mergedData.jobsites && mergedData.jobsites.length > 0 && `, ${mergedData.jobsites.length} jobsites`}
                        </p>
                      </div>
                    </div>

                    {/* Merge Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white p-3 rounded border border-emerald-200">
                        <p className="text-2xl font-bold text-slate-900">{mergedData.stats.totalAccounts}</p>
                        <p className="text-xs text-slate-600 mt-1">Accounts</p>
                      </div>
                      <div className="bg-white p-3 rounded border border-emerald-200">
                        <p className="text-2xl font-bold text-slate-900">{mergedData.stats.totalContacts}</p>
                        <p className="text-xs text-slate-600 mt-1">Contacts</p>
                      </div>
                      {mergedData.estimates && mergedData.estimates.length > 0 && (
                        <div className="bg-white p-3 rounded border border-amber-200">
                          <p className="text-2xl font-bold text-amber-600">{mergedData.estimates.length}</p>
                          <p className="text-xs text-slate-600 mt-1">Estimates</p>
                        </div>
                      )}
                      {mergedData.jobsites && mergedData.jobsites.length > 0 && (
                        <div className="bg-white p-3 rounded border border-teal-200">
                          <p className="text-2xl font-bold text-teal-600">{mergedData.jobsites.length}</p>
                          <p className="text-xs text-slate-600 mt-1">Jobsites</p>
                        </div>
                      )}
                      {(!mergedData.estimates || mergedData.estimates.length === 0) && 
                       (!mergedData.jobsites || mergedData.jobsites.length === 0) && (
                        <div className="bg-white p-3 rounded border border-emerald-200">
                          <p className="text-2xl font-bold text-emerald-600">{mergedData.stats.matchRate}%</p>
                          <p className="text-xs text-slate-600 mt-1">Match Rate</p>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-emerald-800">
                      <p>✓ {mergedData.stats.matchedContacts} contacts matched between files</p>
                      {mergedData.stats.unmatchedContacts > 0 && (
                        <p className="text-amber-700 mt-1">
                          ⚠ {mergedData.stats.unmatchedContacts} contacts only in Contacts Export (will use base data)
                        </p>
                      )}
                    </div>

                    {/* Estimate Linking Validation */}
                    {mergedData.stats.estimateLinking && mergedData.stats.estimateLinking.total > 0 && (
                      <div className={`mt-4 p-3 rounded border ${
                        mergedData.stats.estimateLinking.orphaned > 0 
                          ? 'bg-amber-50 border-amber-200' 
                          : 'bg-emerald-50 border-emerald-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          {mergedData.stats.estimateLinking.orphaned > 0 ? (
                            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className={`font-semibold text-sm ${
                              mergedData.stats.estimateLinking.orphaned > 0 ? 'text-amber-900' : 'text-emerald-900'
                            }`}>
                              Estimate Linking: {mergedData.stats.estimateLinking.linkRate}% linked to accounts
                            </p>
                            <div className="text-xs mt-1 space-y-0.5">
                              {mergedData.stats.estimateLinking.linkedByContactId > 0 && (
                                <p className={mergedData.stats.estimateLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                  • {mergedData.stats.estimateLinking.linkedByContactId} by Contact ID (most reliable)
                                </p>
                              )}
                              {mergedData.stats.estimateLinking.linkedByEmail > 0 && (
                                <p className={mergedData.stats.estimateLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                  • {mergedData.stats.estimateLinking.linkedByEmail} by Email → Contact
                                </p>
                              )}
                              {mergedData.stats.estimateLinking.linkedByPhone > 0 && (
                                <p className={mergedData.stats.estimateLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                  • {mergedData.stats.estimateLinking.linkedByPhone} by Phone → Contact
                                </p>
                              )}
                              {mergedData.stats.estimateLinking.linkedByCrmTags > 0 && (
                                <p className={mergedData.stats.estimateLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                  • {mergedData.stats.estimateLinking.linkedByCrmTags} by CRM Tags
                                </p>
                              )}
                              {mergedData.stats.estimateLinking.linkedByAddress > 0 && (
                                <p className={mergedData.stats.estimateLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                  • {mergedData.stats.estimateLinking.linkedByAddress} by Address
                                </p>
                              )}
                              {mergedData.stats.estimateLinking.linkedByNameMatch > 0 && (
                                <p className={mergedData.stats.estimateLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                  • {mergedData.stats.estimateLinking.linkedByNameMatch} by Name Match (fuzzy)
                                </p>
                              )}
                              {mergedData.stats.estimateLinking.linkedByContactId === 0 && 
                               mergedData.stats.estimateLinking.linkedByEmail === 0 &&
                               mergedData.stats.estimateLinking.linkedByPhone === 0 &&
                               mergedData.stats.estimateLinking.linkedByCrmTags === 0 &&
                               mergedData.stats.estimateLinking.linkedByAddress === 0 &&
                               mergedData.stats.estimateLinking.linkedByNameMatch === 0 && (
                                <p className={mergedData.stats.estimateLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                  • 0 by Contact ID (most reliable)
                                </p>
                              )}
                              {mergedData.stats.estimateLinking.orphaned > 0 && (
                                <p className="text-amber-700 font-medium">
                                  ⚠ {mergedData.stats.estimateLinking.orphaned} estimates not linked to any account
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Jobsite Linking Validation */}
                    {mergedData.stats.jobsiteLinking && mergedData.stats.jobsiteLinking.total > 0 && (
                      <div className={`mt-2 p-3 rounded border ${
                        mergedData.stats.jobsiteLinking.orphaned > 0 
                          ? 'bg-amber-50 border-amber-200' 
                          : 'bg-emerald-50 border-emerald-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          {mergedData.stats.jobsiteLinking.orphaned > 0 ? (
                            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className={`font-semibold text-sm ${
                              mergedData.stats.jobsiteLinking.orphaned > 0 ? 'text-amber-900' : 'text-emerald-900'
                            }`}>
                              Jobsite Linking: {mergedData.stats.jobsiteLinking.linkRate}% linked to accounts
                            </p>
                            <div className="text-xs mt-1 space-y-0.5">
                              {mergedData.stats.jobsiteLinking.linkedByContactId > 0 && (
                                <p className={mergedData.stats.jobsiteLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                  • {mergedData.stats.jobsiteLinking.linkedByContactId} by Contact ID (most reliable)
                                </p>
                              )}
                              {mergedData.stats.jobsiteLinking.linkedByAddress > 0 && (
                                <p className={mergedData.stats.jobsiteLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                  • {mergedData.stats.jobsiteLinking.linkedByAddress} by Address
                                </p>
                              )}
                              {mergedData.stats.jobsiteLinking.linkedByJobsiteName > 0 && (
                                <p className={mergedData.stats.jobsiteLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                  • {mergedData.stats.jobsiteLinking.linkedByJobsiteName} by Jobsite Name
                                </p>
                              )}
                              {mergedData.stats.jobsiteLinking.linkedByNameMatch > 0 && (
                                <p className={mergedData.stats.jobsiteLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                  • {mergedData.stats.jobsiteLinking.linkedByNameMatch} by Name Match (fuzzy)
                                </p>
                              )}
                              {mergedData.stats.jobsiteLinking.linkedByContactId === 0 && 
                               mergedData.stats.jobsiteLinking.linkedByAddress === 0 &&
                               mergedData.stats.jobsiteLinking.linkedByJobsiteName === 0 &&
                               mergedData.stats.jobsiteLinking.linkedByNameMatch === 0 && (
                                <p className={mergedData.stats.jobsiteLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                  • 0 by Contact ID
                                </p>
                              )}
                              {mergedData.stats.jobsiteLinking.orphaned > 0 && (
                                <p className="text-amber-700 font-medium">
                                  ⚠ {mergedData.stats.jobsiteLinking.orphaned} jobsites not linked to any account
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Action Buttons */}
              {allFilesUploaded && (
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={handleReset}>
                    Start Over
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!mergedData || importStatus === 'importing'}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {importStatus === 'importing' ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Import All Data
                      </>
                    )}
                  </Button>
                </div>
              )}

            </>
          ) : null}

          {/* Error Display */}
          {error && (
            <Card className="p-4 border-red-200 bg-red-50">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900">Error</p>
                  <p className="text-red-800 text-sm mt-1">{error}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          )}

          {/* Success */}
          {importStatus === 'success' && importResults && (
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">
                  Import Complete!
                </h3>
                <p className="text-slate-600 text-sm">
                  Your LMN data has been imported into LECRM
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
                <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-2xl font-bold text-emerald-600">{importResults.accountsCreated}</p>
                  <p className="text-xs text-slate-600 mt-1">Accounts Created</p>
                  {importResults.accountsUpdated > 0 && (
                    <p className="text-xs text-blue-600 mt-1">+{importResults.accountsUpdated} Updated</p>
                  )}
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-2xl font-bold text-purple-600">{importResults.contactsCreated}</p>
                  <p className="text-xs text-slate-600 mt-1">Contacts Created</p>
                  {importResults.contactsUpdated > 0 && (
                    <p className="text-xs text-blue-600 mt-1">+{importResults.contactsUpdated} Updated</p>
                  )}
                </div>
                {(importResults.estimatesCreated > 0 || importResults.estimatesUpdated > 0) && (
                  <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-2xl font-bold text-amber-600">{importResults.estimatesCreated}</p>
                    <p className="text-xs text-slate-600 mt-1">Estimates Created</p>
                    {importResults.estimatesUpdated > 0 && (
                      <p className="text-xs text-blue-600 mt-1">+{importResults.estimatesUpdated} Updated</p>
                    )}
                  </div>
                )}
                {(importResults.jobsitesCreated > 0 || importResults.jobsitesUpdated > 0) && (
                  <div className="text-center p-3 bg-teal-50 rounded-lg border border-teal-200">
                    <p className="text-2xl font-bold text-teal-600">{importResults.jobsitesCreated}</p>
                    <p className="text-xs text-slate-600 mt-1">Jobsites Created</p>
                    {importResults.jobsitesUpdated > 0 && (
                      <p className="text-xs text-blue-600 mt-1">+{importResults.jobsitesUpdated} Updated</p>
                    )}
                  </div>
                )}
              </div>

              {(importResults.accountsFailed > 0 || importResults.contactsFailed > 0 || importResults.estimatesFailed > 0 || importResults.jobsitesFailed > 0) && (
                <Card className="p-3 bg-amber-50 border-amber-200 w-full max-w-sm">
                  <p className="text-sm text-amber-800">
                    {[
                      importResults.accountsFailed > 0 && `${importResults.accountsFailed} accounts failed`,
                      importResults.contactsFailed > 0 && `${importResults.contactsFailed} contacts failed`,
                      importResults.estimatesFailed > 0 && `${importResults.estimatesFailed} estimates failed`,
                      importResults.jobsitesFailed > 0 && `${importResults.jobsitesFailed} jobsites failed`
                    ].filter(Boolean).join(', ')}
                  </p>
                </Card>
              )}

              <Button onClick={handleClose} className="bg-slate-900 mt-4">
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}



