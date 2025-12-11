import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { parseContactsExport } from '@/utils/lmnContactsExportParser';
import { parseLeadsList } from '@/utils/lmnLeadsListParser';
import { parseEstimatesList } from '@/utils/lmnEstimatesListParser';
import { parseJobsiteExport } from '@/utils/lmnJobsiteExportParser';
import { mergeContactData } from '@/utils/lmnMergeData';
import { 
  writeAccountsToSheet, 
  writeContactsToSheet, 
  writeEstimatesToSheet, 
  writeJobsitesToSheet 
} from '@/services/googleSheetsService';
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

      // Import/Update accounts using upsert (merge by lmn_crm_id)
      for (const account of mergedData.accounts) {
        try {
          const result = await base44.entities.Account.upsert(account, 'lmn_crm_id');
          if (result._action === 'created') {
            results.accountsCreated++;
          } else if (result._action === 'updated') {
            results.accountsUpdated++;
          }
        } catch (err) {
          results.accountsFailed++;
          results.errors.push(`Account "${account.name}": ${err.message}`);
        }
      }

      // Import/Update contacts using upsert (merge by lmn_contact_id)
      for (const contact of mergedData.contacts) {
        try {
          const result = await base44.entities.Contact.upsert(contact, 'lmn_contact_id');
          if (result._action === 'created') {
            results.contactsCreated++;
          } else if (result._action === 'updated') {
            results.contactsUpdated++;
          }
        } catch (err) {
          results.contactsFailed++;
          results.errors.push(`Contact "${contact.first_name} ${contact.last_name}": ${err.message}`);
        }
      }

      // Import/Update estimates using upsert (merge by lmn_estimate_id)
      if (mergedData.estimates && mergedData.estimates.length > 0) {
        for (const estimate of mergedData.estimates) {
          try {
            const result = await base44.entities.Estimate.upsert(estimate, 'lmn_estimate_id');
            if (result._action === 'created') {
              results.estimatesCreated++;
            } else if (result._action === 'updated') {
              results.estimatesUpdated++;
            }
          } catch (err) {
            results.estimatesFailed++;
            results.errors.push(`Estimate "${estimate.estimate_number}": ${err.message}`);
          }
        }
      }

      // Import/Update jobsites using upsert (merge by lmn_jobsite_id)
      if (mergedData.jobsites && mergedData.jobsites.length > 0) {
        for (const jobsite of mergedData.jobsites) {
          try {
            const result = await base44.entities.Jobsite.upsert(jobsite, 'lmn_jobsite_id');
            if (result._action === 'created') {
              results.jobsitesCreated++;
            } else if (result._action === 'updated') {
              results.jobsitesUpdated++;
            }
          } catch (err) {
            results.jobsitesFailed++;
            results.errors.push(`Jobsite "${jobsite.name}": ${err.message}`);
          }
        }
      }

      // Write all imported data to Google Sheets
      const webAppUrl = import.meta.env.VITE_GOOGLE_SHEETS_WEB_APP_URL;
      console.log('🔍 Web App URL check:', webAppUrl ? 'Found' : 'Missing');
      console.log('🔍 Merged data counts:', {
        accounts: mergedData?.accounts?.length || 0,
        contacts: mergedData?.contacts?.length || 0,
        estimates: mergedData?.estimates?.length || 0,
        jobsites: mergedData?.jobsites?.length || 0
      });
      
      if (!webAppUrl) {
        console.warn('⚠️ Google Sheets Web App URL not configured. Imported data will not be saved to Google Sheets.');
        console.warn('Set VITE_GOOGLE_SHEETS_WEB_APP_URL in your environment variables to enable Google Sheets sync.');
        console.warn('Current env vars:', Object.keys(import.meta.env).filter(k => k.includes('GOOGLE')));
      } else {
        try {
          console.log('📝 Writing imported data to Google Sheets...');
          console.log('📝 Web App URL:', webAppUrl.substring(0, 50) + '...');
          
          // Write accounts
          if (mergedData.accounts && mergedData.accounts.length > 0) {
            setImportProgress(prev => ({
              ...prev,
              currentStep: `Writing ${mergedData.accounts.length} accounts...`,
              completedSteps: prev.completedSteps,
              progress: (prev.completedSteps / prev.totalSteps) * 100
            }));
            
            const accountsResult = await writeAccountsToSheet(mergedData.accounts);
            if (!accountsResult.success) {
              console.error('❌ Failed to write accounts to Google Sheet:', accountsResult.error);
              results.errors.push(`Google Sheets: Failed to write accounts - ${accountsResult.error}`);
            } else {
              console.log(`✅ Wrote ${accountsResult.result?.total || 0} accounts to Google Sheets`);
            }
            
            setImportProgress(prev => ({
              ...prev,
              completedSteps: prev.completedSteps + 1,
              progress: ((prev.completedSteps + 1) / prev.totalSteps) * 100
            }));
          }

          // Write contacts (split into batches to avoid timeout)
          if (mergedData.contacts && mergedData.contacts.length > 0) {
            console.log(`📝 Writing ${mergedData.contacts.length} contacts in batches...`);
            const BATCH_SIZE = 500; // Process 500 contacts at a time
            const totalBatches = Math.ceil(mergedData.contacts.length / BATCH_SIZE);
            let totalCreated = 0;
            let totalUpdated = 0;
            let hasError = false;
            
            for (let i = 0; i < mergedData.contacts.length; i += BATCH_SIZE) {
              const batch = mergedData.contacts.slice(i, i + BATCH_SIZE);
              const batchNum = Math.floor(i / BATCH_SIZE) + 1;
              
              setImportProgress(prev => ({
                ...prev,
                currentStep: `Writing contacts batch ${batchNum}/${totalBatches} (${batch.length} contacts)...`,
                completedSteps: prev.completedSteps,
                progress: (prev.completedSteps / prev.totalSteps) * 100
              }));
              
              console.log(`📝 Writing contacts batch ${batchNum}/${totalBatches} (${batch.length} contacts)...`);
              
              const contactsResult = await writeContactsToSheet(batch);
              if (!contactsResult.success) {
                console.error(`❌ Failed to write contacts batch ${batchNum}:`, contactsResult.error);
                results.errors.push(`Google Sheets: Failed to write contacts batch ${batchNum} - ${contactsResult.error}`);
                hasError = true;
              } else {
                totalCreated += contactsResult.result?.created || 0;
                totalUpdated += contactsResult.result?.updated || 0;
                console.log(`✅ Wrote contacts batch ${batchNum} (${contactsResult.result?.total || 0} contacts)`);
              }
              
              setImportProgress(prev => ({
                ...prev,
                completedSteps: prev.completedSteps + 1,
                progress: ((prev.completedSteps + 1) / prev.totalSteps) * 100
              }));
            }
            
            if (!hasError) {
              console.log(`✅ Successfully wrote all ${mergedData.contacts.length} contacts to Google Sheets (${totalCreated} created, ${totalUpdated} updated)`);
            }
          }

          // Write estimates (split into batches to avoid timeout)
          if (mergedData.estimates && mergedData.estimates.length > 0) {
            console.log(`📝 Writing ${mergedData.estimates.length} estimates in batches...`);
            const BATCH_SIZE = 500;
            const totalBatches = Math.ceil(mergedData.estimates.length / BATCH_SIZE);
            let totalCreated = 0;
            let totalUpdated = 0;
            let hasError = false;
            
            for (let i = 0; i < mergedData.estimates.length; i += BATCH_SIZE) {
              const batch = mergedData.estimates.slice(i, i + BATCH_SIZE);
              const batchNum = Math.floor(i / BATCH_SIZE) + 1;
              
              setImportProgress(prev => ({
                ...prev,
                currentStep: `Writing estimates batch ${batchNum}/${totalBatches} (${batch.length} estimates)...`,
                completedSteps: prev.completedSteps,
                progress: (prev.completedSteps / prev.totalSteps) * 100
              }));
              
              console.log(`📝 Writing estimates batch ${batchNum}/${totalBatches} (${batch.length} estimates)...`);
              
              const estimatesResult = await writeEstimatesToSheet(batch);
              if (!estimatesResult.success) {
                console.error(`❌ Failed to write estimates batch ${batchNum}:`, estimatesResult.error);
                results.errors.push(`Google Sheets: Failed to write estimates batch ${batchNum} - ${estimatesResult.error}`);
                hasError = true;
              } else {
                totalCreated += estimatesResult.result?.created || 0;
                totalUpdated += estimatesResult.result?.updated || 0;
                console.log(`✅ Wrote estimates batch ${batchNum} (${estimatesResult.result?.total || 0} estimates)`);
              }
              
              setImportProgress(prev => ({
                ...prev,
                completedSteps: prev.completedSteps + 1,
                progress: ((prev.completedSteps + 1) / prev.totalSteps) * 100
              }));
            }
            
            if (!hasError) {
              console.log(`✅ Successfully wrote all ${mergedData.estimates.length} estimates to Google Sheets (${totalCreated} created, ${totalUpdated} updated)`);
            }
          }

          // Write jobsites (split into batches to avoid timeout)
          if (mergedData.jobsites && mergedData.jobsites.length > 0) {
            console.log(`📝 Writing ${mergedData.jobsites.length} jobsites in batches...`);
            const BATCH_SIZE = 500;
            const totalBatches = Math.ceil(mergedData.jobsites.length / BATCH_SIZE);
            let totalCreated = 0;
            let totalUpdated = 0;
            let hasError = false;
            
            for (let i = 0; i < mergedData.jobsites.length; i += BATCH_SIZE) {
              const batch = mergedData.jobsites.slice(i, i + BATCH_SIZE);
              const batchNum = Math.floor(i / BATCH_SIZE) + 1;
              
              setImportProgress(prev => ({
                ...prev,
                currentStep: `Writing jobsites batch ${batchNum}/${totalBatches} (${batch.length} jobsites)...`,
                completedSteps: prev.completedSteps,
                progress: (prev.completedSteps / prev.totalSteps) * 100
              }));
              
              console.log(`📝 Writing jobsites batch ${batchNum}/${totalBatches} (${batch.length} jobsites)...`);
              
              const jobsitesResult = await writeJobsitesToSheet(batch);
              if (!jobsitesResult.success) {
                console.error(`❌ Failed to write jobsites batch ${batchNum}:`, jobsitesResult.error);
                results.errors.push(`Google Sheets: Failed to write jobsites batch ${batchNum} - ${jobsitesResult.error}`);
                hasError = true;
              } else {
                totalCreated += jobsitesResult.result?.created || 0;
                totalUpdated += jobsitesResult.result?.updated || 0;
                console.log(`✅ Wrote jobsites batch ${batchNum} (${jobsitesResult.result?.total || 0} jobsites)`);
              }
              
              setImportProgress(prev => ({
                ...prev,
                completedSteps: prev.completedSteps + 1,
                progress: ((prev.completedSteps + 1) / prev.totalSteps) * 100
              }));
            }
            
            if (!hasError) {
              console.log(`✅ Successfully wrote all ${mergedData.jobsites.length} jobsites to Google Sheets (${totalCreated} created, ${totalUpdated} updated)`);
            }
          }

          console.log('✅ Successfully wrote all imported data to Google Sheets');
        } catch (err) {
          console.error('❌ Error writing to Google Sheets:', err);
          results.errors.push(`Google Sheets: ${err.message}`);
          // Don't fail the import if Google Sheets write fails - data is still imported to the app
        }
      }

      setImportResults(results);
      setImportStatus('success');

      // Clear caches and force refresh after writing to Google Sheets
      if (webAppUrl) {
        // Wait longer for Google Sheets to process all the writes
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Clear the base44Client cache
        const { clearSheetDataCache } = await import('@/api/base44Client');
        if (clearSheetDataCache) {
          clearSheetDataCache();
        }
        
        // Also clear the googleSheetsService cache
        const { getSheetData } = await import('@/services/googleSheetsService');
        // Force refresh by calling getSheetData with forceRefresh=true
        try {
          await getSheetData(true);
        } catch (err) {
          console.warn('Error force refreshing sheet data:', err);
        }
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
                              <p className={mergedData.stats.estimateLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                • {mergedData.stats.estimateLinking.linkedByContactId} by Contact ID (most reliable)
                                {mergedData.stats.estimateLinking.linkedByNameMatch > 0 && (
                                  <span>, {mergedData.stats.estimateLinking.linkedByNameMatch} by name match</span>
                                )}
                                {mergedData.stats.estimateLinking.linkedByCrmTags > 0 && (
                                  <span>, {mergedData.stats.estimateLinking.linkedByCrmTags} by CRM tags</span>
                                )}
                              </p>
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
                              <p className={mergedData.stats.jobsiteLinking.orphaned > 0 ? 'text-amber-800' : 'text-emerald-800'}>
                                • {mergedData.stats.jobsiteLinking.linkedByContactId} by Contact ID
                                {mergedData.stats.jobsiteLinking.linkedByNameMatch > 0 && (
                                  <span>, {mergedData.stats.jobsiteLinking.linkedByNameMatch} by name match</span>
                                )}
                              </p>
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

              {/* Progress Bar */}
              {importStatus === 'importing' && (
                <Card className="p-4 border-emerald-200 bg-emerald-50">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-emerald-900">{importProgress.currentStep}</span>
                      <span className="text-emerald-700">
                        {importProgress.completedSteps} / {importProgress.totalSteps} steps
                      </span>
                    </div>
                    <div className="w-full bg-emerald-200 rounded-full h-2.5">
                      <div
                        className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.min(importProgress.progress, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-emerald-700 text-center">
                      {Math.round(importProgress.progress)}% complete
                    </p>
                  </div>
                </Card>
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



