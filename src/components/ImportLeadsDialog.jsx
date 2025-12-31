import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { autoAssignRevenueSegments } from '@/utils/revenueSegmentCalculator';
import { parseContactsExport } from '@/utils/lmnContactsExportParser';
import { parseLeadsList } from '@/utils/lmnLeadsListParser';
import { parseEstimatesList } from '@/utils/lmnEstimatesListParser';
import { parseJobsiteExport } from '@/utils/lmnJobsiteExportParser';
import { mergeContactData } from '@/utils/lmnMergeData';
import { autoScoreAccount } from '@/utils/autoScoreAccount';
import { extractValidIds, compareWithExisting, validateReferences } from '@/utils/importValidation';
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
import { Progress } from '@/components/ui/progress';
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
  FileCheck,
  MapPin,
  User,
  Link as LinkIcon,
  Trash2,
  Info
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import toast from 'react-hot-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

  // Validation and comparison state
  const [validationResults, setValidationResults] = useState(null);
  const [showValidation, setShowValidation] = useState(false);
  const [existingData, setExistingData] = useState({
    accounts: [],
    contacts: [],
    estimates: [],
    jobsites: []
  });
  
  const queryClient = useQueryClient();

  // Fetch accounts for manual linking
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
    enabled: open && mergedData?.orphanedJobsites?.length > 0 // Only fetch when dialog is open and there are orphaned jobsites
  });

  // State for manually linking orphaned jobsites
  const [orphanedJobsiteLinks, setOrphanedJobsiteLinks] = useState({});

  // Convert XLSX file to array of arrays (same format as parser expects)
  const convertXlsxToRows = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          // Convert to array of arrays (header: 1 means first row is headers)
          // This matches the format that parsers expect
          const rows = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: '',
            raw: false // Convert dates/numbers to strings
          });
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Process Contacts Export file (XLSX only)
  const processContactsFile = async (file) => {
    if (!file) return;
    
    try {
      // Parse XLSX directly to array of arrays
      const data = await convertXlsxToRows(file);
      const parsed = parseContactsExport(data);
      
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

  // Process Leads List file (XLSX only)
  const processLeadsFile = async (file) => {
    if (!file) return;
    
    try {
      // Parse XLSX directly to array of arrays
      const data = await convertXlsxToRows(file);
      const parsed = parseLeadsList(data);
      
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

  // Process Estimates List file (XLSX only)
  const processEstimatesFile = async (file) => {
    if (!file) return;
    
    try {
      // Parse XLSX directly to array of arrays
      const data = await convertXlsxToRows(file);
      const parsed = parseEstimatesList(data);
      
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

  // Process Jobsite Export file (XLSX only)
  const processJobsitesFile = async (file) => {
    if (!file) return;
    
    try {
      // Parse XLSX directly to array of arrays
      const data = await convertXlsxToRows(file);
      const parsed = parseJobsiteExport(data);
      
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

  // Fetch existing data from database for comparison
  const fetchExistingData = async () => {
    try {
      const [accountsRes, contactsRes, estimatesRes, jobsitesRes] = await Promise.all([
        fetch('/api/data/accounts'),
        fetch('/api/data/contacts'),
        fetch('/api/data/estimates'),
        fetch('/api/data/jobsites')
      ]);

      const accounts = accountsRes.ok ? (await accountsRes.json()).data || [] : [];
      const contacts = contactsRes.ok ? (await contactsRes.json()).data || [] : [];
      const estimates = estimatesRes.ok ? (await estimatesRes.json()).data || [] : [];
      const jobsites = jobsitesRes.ok ? (await jobsitesRes.json()).data || [] : [];

      setExistingData({ accounts, contacts, estimates, jobsites });
      return { accounts, contacts, estimates, jobsites };
    } catch (err) {
      console.error('Error fetching existing data:', err);
      return { accounts: [], contacts: [], estimates: [], jobsites: [] };
    }
  };

  // Check if all required files are loaded and merge them
  const checkAndMergeAllFiles = async (contacts, leads, estimates, jobsites) => {
    // Require all 4 files: contacts, leads, estimates, and jobsites
    if (!contacts || !leads || !estimates || !jobsites) return;
    
    try {
      // Merge contacts and leads first
      const merged = mergeContactData(contacts, leads, estimates, jobsites);
      
      // Extract valid IDs from the sheets
      const validIds = extractValidIds(contacts, leads, estimates, jobsites);
      
      // Fetch existing data and run validation
      setImportStatus('validating');
      const existing = await fetchExistingData();
      
      // Compare imported data with existing data
      const comparison = compareWithExisting(merged, existing.accounts, existing.contacts, existing.estimates, existing.jobsites, validIds);
      
      // Validate references
      const referenceValidation = validateReferences(merged, validIds);
      comparison.errors.push(...referenceValidation.errors);
      comparison.warnings.push(...referenceValidation.warnings);
      
      setValidationResults(comparison);
      setMergedData(merged);
      setImportStatus('ready');
      setError(null);
      // Reset orphaned jobsite links when new data is merged
      setOrphanedJobsiteLinks({});
    } catch (err) {
      setError(`Error merging data: ${err.message}`);
      setImportStatus('idle');
    }
  };

  // Handle manual linking of orphaned jobsite to account
  const handleLinkOrphanedJobsite = (jobsiteId, accountId) => {
    if (!accountId) {
      // Remove link if accountId is empty
      const newLinks = { ...orphanedJobsiteLinks };
      delete newLinks[jobsiteId];
      setOrphanedJobsiteLinks(newLinks);
      
      // Update mergedData to remove the link
      if (mergedData) {
        const updatedJobsites = mergedData.jobsites.map(jobsite => 
          jobsite.lmn_jobsite_id === jobsiteId 
            ? { ...jobsite, account_id: null, _is_orphaned: true }
            : jobsite
        );
        const orphanedCount = updatedJobsites.filter(j => j._is_orphaned).length;
        const linkedCount = updatedJobsites.length - orphanedCount;
        setMergedData({
          ...mergedData,
          jobsites: updatedJobsites,
          orphanedJobsites: updatedJobsites.filter(j => j._is_orphaned),
          stats: {
            ...mergedData.stats,
            jobsiteLinking: {
              ...mergedData.stats.jobsiteLinking,
              orphaned: orphanedCount,
              linked: linkedCount,
              linkRate: updatedJobsites.length > 0
                ? Math.round((linkedCount / updatedJobsites.length) * 100)
                : 0
            }
          }
        });
      }
      return;
    }

    // Add link
    setOrphanedJobsiteLinks({
      ...orphanedJobsiteLinks,
      [jobsiteId]: accountId
    });

    // Update mergedData to include the link
    if (mergedData) {
      const updatedJobsites = mergedData.jobsites.map(jobsite => 
        jobsite.lmn_jobsite_id === jobsiteId 
          ? { ...jobsite, account_id: accountId, _is_orphaned: false }
          : jobsite
      );
      const orphanedCount = updatedJobsites.filter(j => j._is_orphaned).length;
      const linkedCount = updatedJobsites.length - orphanedCount;
      setMergedData({
        ...mergedData,
        jobsites: updatedJobsites,
        orphanedJobsites: updatedJobsites.filter(j => j._is_orphaned),
        stats: {
          ...mergedData.stats,
          jobsiteLinking: {
            ...mergedData.stats.jobsiteLinking,
            orphaned: orphanedCount,
            linked: linkedCount,
            linkRate: updatedJobsites.length > 0
              ? Math.round((linkedCount / updatedJobsites.length) * 100)
              : 0
          }
        }
      });
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
      const isValidFile = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isValidFile) {
        setError('Please upload an XLSX file');
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
      const isValidFile = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isValidFile) {
        setError('Please upload an XLSX file');
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
      const isValidFile = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isValidFile) {
        setError('Please upload an XLSX file');
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
      const isValidFile = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      if (!isValidFile) {
        setError('Please upload an XLSX file');
        return;
      }
      processJobsitesFile(file);
    }
  };

  // Import merged data with automatic merge/update
  // Only imports data that exists in the sheets (no orphaned/mock data)
  const handleImport = async () => {
    if (!mergedData) return;

    setImportStatus('importing');
    setError(null);
    
    // Extract valid IDs to ensure we only import data from sheets
    const validIds = extractValidIds(contactsData, leadsData, estimatesData, jobsitesData);
    
    // Filter estimates to only include those with valid IDs from sheets
    // Note: We allow estimates even if their referenced accounts/contacts aren't in sheets
    // (we'll set account_id/contact_id to null instead of excluding the estimate)
    const validEstimates = mergedData.estimates?.filter(est => {
      const estId = est.lmn_estimate_id || est.id;
      if (!validIds.estimateIds.has(estId)) {
        console.warn(`Skipping estimate ${estId} - not in import sheets`);
        return false;
      }
      // Allow estimates even if account/contact not in sheets - we'll set to null during save
      // This ensures all estimates from the Estimates List are imported
      return true;
    }).map(est => {
      // If account_id references an account not in sheets, set it to null
      // (the API will handle this, but we can do it here for clarity)
      if (est.account_id) {
        const accountId = est.account_id.split('-').pop();
        if (!validIds.accountIds.has(est.account_id) && !validIds.accountIds.has(accountId)) {
          console.warn(`Estimate ${est.lmn_estimate_id || est.id} references account ${est.account_id} not in sheets - will set to null`);
          return { ...est, account_id: null };
        }
      }
      return est;
    }) || [];

    // Filter jobsites similarly
    const validJobsites = mergedData.jobsites?.filter(jobsite => {
      const jobsiteId = jobsite.lmn_jobsite_id || jobsite.id;
      if (!validIds.jobsiteIds.has(jobsiteId)) {
        console.warn(`Skipping jobsite ${jobsiteId} - not in import sheets`);
        return false;
      }
      return true;
    }) || [];

    // Filter accounts and contacts to only include those from sheets
    const validAccounts = mergedData.accounts?.filter(acc => {
      const accId = acc.lmn_crm_id || acc.id;
      return validIds.accountIds.has(accId);
    }) || [];

    const validContacts = mergedData.contacts?.filter(contact => {
      const contactId = contact.lmn_contact_id || contact.id;
      return validIds.contactIds.has(contactId);
    }) || [];

    // Calculate total steps for progress tracking
    // Only estimates are chunked (500 per chunk), others are single bulk operations
    const CHUNK_SIZE = 500;
    const totalSteps = 
      (validAccounts.length > 0 ? 1 : 0) +
      (validContacts.length > 0 ? 1 : 0) + // Contacts are not chunked, single bulk operation
      (validEstimates.length > 0 ? Math.ceil(validEstimates.length / CHUNK_SIZE) : 0) + // Only estimates are chunked
      (validJobsites.length > 0 ? 1 : 0); // Jobsites are not chunked, single bulk operation
    
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
        errors: [],
        newContactsFromLeads: mergedData.stats?.newContactsFromLeads || { count: 0, contacts: [] }
      };

      // Import/Update accounts using bulk upsert (much faster)
      // Only import accounts that are in the sheets (validAccounts)
      if (validAccounts.length > 0) {
        console.log(`📤 Starting accounts import: ${validAccounts.length} accounts`);
        console.log('First account sample:', {
          id: validAccounts[0].id,
          lmn_crm_id: validAccounts[0].lmn_crm_id,
          name: validAccounts[0].name
        });
        
        try {
          const response = await fetch('/api/data/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'bulk_upsert', 
              data: { accounts: validAccounts, lookupField: 'lmn_crm_id' } 
            })
          });
          
          console.log(`📥 Accounts API response status: ${response.status} ${response.statusText}`);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Accounts API error response:', errorText);
            let errorMessage = `HTTP ${response.status}: ${errorText}`;
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.error || errorMessage;
              console.error('Parsed error:', errorJson);
            } catch (e) {
              console.error('Could not parse error as JSON:', e);
              // If not JSON, use the text as-is
            }
            throw new Error(errorMessage);
          }
          
          const result = await response.json();
          console.log('Accounts API result:', result);
          
          if (result.success) {
            results.accountsCreated = result.created;
            results.accountsUpdated = result.updated;
            console.log(`✅ Bulk imported ${result.total} accounts (${result.created} created, ${result.updated} updated)`);
          } else {
            console.error('Accounts API returned success=false:', result);
            throw new Error(result.error || 'Bulk import failed');
          }
        } catch (err) {
          results.accountsFailed = validAccounts.length;
          const errorMsg = `Accounts bulk import: ${err.message}`;
          results.errors.push(errorMsg);
          console.error('❌❌❌ ACCOUNTS IMPORT FAILED ❌❌❌');
          console.error('Error object:', err);
          console.error('Error message:', err.message);
          console.error('Error name:', err.name);
          console.error('Error stack:', err.stack);
          console.error('Sample account data (first account):', JSON.stringify(validAccounts[0], null, 2));
          console.error('Total accounts to import:', validAccounts.length);
          console.error('First 3 account IDs:', validAccounts.slice(0, 3).map(a => ({ id: a.id, lmn_crm_id: a.lmn_crm_id })));
          console.error('First 3 account names:', validAccounts.slice(0, 3).map(a => a.name));
        }
      } else {
        console.warn('⚠️ No valid accounts to import');
      }

      // Import/Update contacts using bulk upsert
      // Only import contacts that are in the sheets (validContacts)
      if (validContacts.length > 0) {
        // Contacts already have the correct account_id format (e.g., "lmn-account-6857868")
        // No need to map UUIDs - just use the IDs directly
        const linkedCount = validContacts.filter(c => c.account_id).length;
        console.log(`✅ Linking ${linkedCount} of ${validContacts.length} contacts to accounts`);
        
        try {
          const response = await fetch('/api/data/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'bulk_upsert', 
              data: { contacts: validContacts, lookupField: 'lmn_contact_id' } 
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
            
            // Update progress after contacts are done (single step, not chunked)
            setImportProgress(prev => ({
              ...prev,
              completedSteps: prev.completedSteps + 1
            }));
          } else {
            throw new Error(result.error || 'Bulk import failed');
          }
        } catch (err) {
          results.contactsFailed = validContacts.length;
          results.errors.push(`Contacts bulk import: ${err.message}`);
          console.error('Contacts import error:', err);
        }
      }

      // Import/Update estimates using bulk upsert
      // Only import estimates that are in the sheets (validEstimates)
      // Split into smaller chunks to avoid 413 (Content Too Large) errors
      if (validEstimates.length > 0) {
        try {
          const CHUNK_SIZE = 500; // Process 500 at a time to avoid payload size limits
          let totalCreated = 0;
          let totalUpdated = 0;
          
          // Estimates already have account_id in the correct format (e.g., "lmn-account-XXXXX")
          // No need to map UUIDs - just use the IDs directly
          const linkedCount = validEstimates.filter(e => e.account_id).length;
          console.log(`✅ Linking ${linkedCount} of ${validEstimates.length} estimates to accounts`);
          
          for (let i = 0; i < validEstimates.length; i += CHUNK_SIZE) {
            const chunk = validEstimates.slice(i, i + CHUNK_SIZE);
            const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
            const totalChunks = Math.ceil(validEstimates.length / CHUNK_SIZE);
            
            setImportProgress(prev => ({
              ...prev,
              currentStep: `Processing estimates chunk ${chunkNum}/${totalChunks} (${chunk.length} estimates)...`,
              completedSteps: prev.completedSteps
            }));
            
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
              
              // Update progress after each chunk
              setImportProgress(prev => ({
                ...prev,
                completedSteps: prev.completedSteps + 1
              }));
            } else {
              throw new Error(result.error || 'Bulk import failed');
            }
          }
          
          results.estimatesCreated = totalCreated;
          results.estimatesUpdated = totalUpdated;
          console.log(`✅ Bulk imported ${validEstimates.length} estimates (${totalCreated} created, ${totalUpdated} updated)`);
        } catch (err) {
          results.estimatesFailed = validEstimates.length;
          results.errors.push(`Estimates bulk import: ${err.message}`);
          console.error('Estimates import error:', err);
        }
      }

      // Import/Update jobsites using bulk upsert
      // Only import jobsites that are in the sheets (validJobsites)
      // Jobsites already have account_id in the correct format (e.g., "lmn-account-XXXXX")
      if (validJobsites.length > 0) {
        // Jobsites already have the correct account_id format
        // No need to map UUIDs - just use the IDs directly
        const linkedCount = validJobsites.filter(j => j.account_id).length;
        console.log(`✅ Linking ${linkedCount} of ${validJobsites.length} jobsites to accounts`);
        
        try {
          const response = await fetch('/api/data/jobsites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'bulk_upsert', 
              data: { jobsites: validJobsites, lookupField: 'lmn_jobsite_id' } 
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
            
            // Update progress after jobsites are done (single step, not chunked)
            setImportProgress(prev => ({
              ...prev,
              completedSteps: prev.completedSteps + 1
            }));
          } else {
            throw new Error(result.error || 'Bulk import failed');
          }
        } catch (err) {
          results.jobsitesFailed = validJobsites.length;
          results.errors.push(`Jobsites bulk import: ${err.message}`);
          console.error('Jobsites import error:', err);
        }
      }

      // Data is automatically saved to Supabase via API calls above
      console.log('✅ All imported data saved to Supabase');
      console.log('🔍 Imported data counts (only from sheets):', {
        accounts: validAccounts.length,
        contacts: validContacts.length,
        estimates: validEstimates.length,
        jobsites: validJobsites.length
      });
      
      // Log filtered out records
      const filteredOut = {
        estimates: (mergedData.estimates?.length || 0) - validEstimates.length,
        jobsites: (mergedData.jobsites?.length || 0) - validJobsites.length,
        accounts: (mergedData.accounts?.length || 0) - validAccounts.length,
        contacts: (mergedData.contacts?.length || 0) - validContacts.length
      };
      
      if (filteredOut.estimates > 0 || filteredOut.jobsites > 0 || filteredOut.accounts > 0 || filteredOut.contacts > 0) {
        console.warn('⚠️ Filtered out records not in import sheets:', filteredOut);
        results.errors.push(`Filtered out ${filteredOut.estimates} estimates, ${filteredOut.jobsites} jobsites, ${filteredOut.accounts} accounts, ${filteredOut.contacts} contacts that were not in import sheets`);
      }

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
      
      // Calculate and assign revenue segments based on 12-month rolling revenue
      try {
        console.log('📊 Calculating revenue segments for all accounts...');
        const allAccounts = await base44.entities.Account.list();
        const allEstimates = await base44.entities.Estimate.list();
        
        // Group estimates by account_id
        const estimatesByAccountId = {};
        allEstimates.forEach(est => {
          if (est.account_id) {
            if (!estimatesByAccountId[est.account_id]) {
              estimatesByAccountId[est.account_id] = [];
            }
            estimatesByAccountId[est.account_id].push(est);
          }
        });
        
        // Calculate segments for all accounts
        const updatedAccounts = autoAssignRevenueSegments(allAccounts, estimatesByAccountId);
        
        // Update all accounts with their calculated segments
        // Filter out accounts without valid IDs and handle errors gracefully
        const segmentUpdates = updatedAccounts
          .filter(account => account.id && account.revenue_segment) // Only update accounts with valid ID and segment
          .map(account => 
            base44.entities.Account.update(account.id, { revenue_segment: account.revenue_segment })
              .catch(error => {
                console.warn(`⚠️ Failed to update revenue segment for account ${account.id}:`, error.message);
                return null; // Return null for failed updates
              })
          );
        
        const results = await Promise.all(segmentUpdates);
        const successCount = results.filter(r => r !== null).length;
        console.log(`✅ Assigned revenue segments to ${successCount} of ${updatedAccounts.length} accounts based on 12-month rolling revenue`);
      } catch (segmentError) {
        console.error('⚠️ Error calculating revenue segments:', segmentError);
        // Don't fail the import if segment calculation fails
      }
      
      // Update renewal notifications after import (estimates may have changed)
      try {
        const { createRenewalNotifications } = await import('@/services/notificationService');
        await createRenewalNotifications();
        console.log('✅ Updated renewal notifications after import');
      } catch (renewalError) {
        console.error('⚠️ Error updating renewal notifications:', renewalError);
        // Don't fail the import if renewal notification update fails
      }

    } catch (err) {
      setError(`Import failed: ${err.message}`);
      setImportStatus('error');
    }
  };

  // Delete orphaned record
  const handleDeleteOrphaned = async (type, id) => {
    if (!confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) {
      return;
    }

    try {
      const endpoint = `/api/data/${type === 'account' ? 'accounts' : type === 'contact' ? 'contacts' : type === 'estimate' ? 'estimates' : 'jobsites'}`;
      const response = await fetch(`${endpoint}?id=${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete record');
      }

      // Remove from validation results
      if (validationResults) {
        const updatedResults = { ...validationResults };
        const orphanedList = updatedResults[`${type}s`].orphaned.filter(item => item.id !== id);
        updatedResults[`${type}s`] = {
          ...updatedResults[`${type}s`],
          orphaned: orphanedList
        };
        setValidationResults(updatedResults);
      }

      // Refresh existing data
      await fetchExistingData();
      
      // Re-run validation
      if (contactsData && leadsData && estimatesData && jobsitesData) {
        await checkAndMergeAllFiles(contactsData, leadsData, estimatesData, jobsitesData);
      }

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`);
    } catch (err) {
      console.error('Error deleting orphaned record:', err);
      toast.error(`Failed to delete ${type}: ${err.message}`);
    }
  };

  // Delete all orphaned records
  const handleDeleteAllOrphaned = async () => {
    const totalOrphaned = 
      validationResults.accounts.orphaned.length +
      validationResults.contacts.orphaned.length +
      validationResults.estimates.orphaned.length +
      validationResults.jobsites.orphaned.length;

    if (!confirm(`Are you sure you want to delete all ${totalOrphaned} orphaned records? This action cannot be undone.`)) {
      return;
    }

    try {
      const deletePromises = [];

      // Delete all orphaned estimates
      validationResults.estimates.orphaned.forEach(est => {
        deletePromises.push(
          fetch(`/api/data/estimates?id=${est.id}`, { method: 'DELETE' })
        );
      });

      // Delete all orphaned accounts
      validationResults.accounts.orphaned.forEach(acc => {
        deletePromises.push(
          fetch(`/api/data/accounts?id=${acc.id}`, { method: 'DELETE' })
        );
      });

      // Delete all orphaned contacts
      validationResults.contacts.orphaned.forEach(contact => {
        deletePromises.push(
          fetch(`/api/data/contacts?id=${contact.id}`, { method: 'DELETE' })
        );
      });

      // Delete all orphaned jobsites
      validationResults.jobsites.orphaned.forEach(jobsite => {
        deletePromises.push(
          fetch(`/api/data/jobsites?id=${jobsite.id}`, { method: 'DELETE' })
        );
      });

      await Promise.all(deletePromises);

      // Clear validation results
      setValidationResults({
        accounts: { ...validationResults.accounts, orphaned: [] },
        contacts: { ...validationResults.contacts, orphaned: [] },
        estimates: { ...validationResults.estimates, orphaned: [] },
        jobsites: { ...validationResults.jobsites, orphaned: [] },
        warnings: validationResults.warnings.filter(w => !w.type?.startsWith('orphaned_')),
        errors: validationResults.errors
      });

      // Refresh existing data
      await fetchExistingData();
      
      // Re-run validation
      if (contactsData && leadsData && estimatesData && jobsitesData) {
        await checkAndMergeAllFiles(contactsData, leadsData, estimatesData, jobsitesData);
      }

      toast.success(`Deleted ${totalOrphaned} orphaned records`);
    } catch (err) {
      console.error('Error deleting orphaned records:', err);
      toast.error(`Failed to delete some records: ${err.message}`);
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
    setValidationResults(null);
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
          {/* Validating State */}
          {importStatus === 'validating' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
              <div className="text-center">
                <p className="text-lg font-semibold text-slate-900">Validating Data...</p>
                <p className="text-sm text-slate-600 mt-2">Comparing imported data with existing records</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {importStatus === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <RefreshCw className="w-12 h-12 text-emerald-600 animate-spin" />
              <div className="text-center w-full max-w-md">
                <p className="text-lg font-semibold text-slate-900">Importing Data...</p>
                <p className="text-sm text-slate-600 mt-2">{importProgress.currentStep}</p>
                <div className="mt-4 space-y-2">
                  <Progress value={(importProgress.completedSteps / importProgress.totalSteps) * 100} className="w-full" />
                  <p className="text-xs text-slate-500">
                    Step {importProgress.completedSteps} of {importProgress.totalSteps}
                  </p>
                </div>
                <p className="text-xs text-amber-600 mt-4 font-medium">
                </p>
                <p className="text-xs text-slate-500 mt-2">Please wait while we import your data</p>
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
                    <p className="font-semibold mb-1">Required files (XLSX):</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li><strong>Contacts Export</strong> - Has CRM IDs, Contact IDs, Tags, Archived status</li>
                      <li><strong>Leads List</strong> - Has Position, Do Not Email/Mail/Call preferences</li>
                      <li><strong>Estimates List</strong> - Has Estimate IDs, Dates, Status, Pricing (required)</li>
                      <li><strong>Jobsite Export</strong> - Has Jobsite IDs, Addresses, Contact links (required)</li>
                    </ol>
                    <p className="mt-2">All four files are required. Estimates and Jobsites are needed to calculate revenue and account scores. XLSX format is required.</p>
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
                          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const isValidFile = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                              if (!isValidFile) {
                                setError('Please upload an XLSX file');
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
                          XLSX format
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
                          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const isValidFile = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                              if (!isValidFile) {
                                setError('Please upload an XLSX file');
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
                          XLSX format
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
                          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const isValidFile = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                              if (!isValidFile) {
                                setError('Please upload an XLSX file');
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
                          XLSX format
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
                          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const isValidFile = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                              if (!isValidFile) {
                                setError('Please upload an XLSX file');
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
                          XLSX format
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

                    {/* Orphaned Jobsites Details and Manual Linking */}
                    {mergedData.orphanedJobsites && mergedData.orphanedJobsites.length > 0 && (
                      <div className="mt-4 p-4 rounded border bg-amber-50 border-amber-200">
                        <div className="flex items-start gap-2 mb-3">
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-amber-900">
                              Orphaned Jobsites - Manual Linking Required
                            </p>
                            <p className="text-xs text-amber-800 mt-1">
                              The following jobsites couldn't be automatically linked. Please select an account for each.
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {mergedData.orphanedJobsites.map((jobsite) => {
                            // Check if this jobsite has been manually linked
                            const manualLink = orphanedJobsiteLinks[jobsite.lmn_jobsite_id];
                            // Get the current jobsite from mergedData (in case it was updated)
                            const currentJobsite = mergedData.jobsites.find(j => j.lmn_jobsite_id === jobsite.lmn_jobsite_id);
                            const selectedAccountId = manualLink || (currentJobsite && !currentJobsite._is_orphaned ? currentJobsite.account_id : null);
                            const isLinked = !!selectedAccountId;
                            // Use special value for unlinked state, or the actual account ID
                            const selectValue = selectedAccountId || '__unlink__';
                            
                            return (
                              <Card key={jobsite.lmn_jobsite_id} className={`p-3 border ${isLinked ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-white'}`}>
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-slate-500" />
                                        <p className="font-medium text-sm text-slate-900">
                                          {jobsite.name || 'Unnamed Jobsite'}
                                        </p>
                                        {isLinked && (
                                          <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-700 border-emerald-300">
                                            <LinkIcon className="w-3 h-3 mr-1" />
                                            Linked
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      {jobsite.address_1 && (
                                        <p className="text-xs text-slate-600 ml-6">
                                          {jobsite.address_1}
                                          {jobsite.address_2 && `, ${jobsite.address_2}`}
                                          {jobsite.city && `, ${jobsite.city}`}
                                          {jobsite.state && ` ${jobsite.state}`}
                                          {jobsite.postal_code && ` ${jobsite.postal_code}`}
                                        </p>
                                      )}
                                      
                                      {jobsite.contact_name && (
                                        <div className="flex items-center gap-2 ml-6">
                                          <User className="w-3 h-3 text-slate-400" />
                                          <p className="text-xs text-slate-600">{jobsite.contact_name}</p>
                                        </div>
                                      )}
                                      
                                      {jobsite.lmn_contact_id && (
                                        <p className="text-xs text-slate-500 ml-6">
                                          Contact ID: {jobsite.lmn_contact_id}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="pt-2 border-t border-amber-200">
                                    <Label className="text-xs text-slate-700 dark:text-white mb-1.5 block">
                                      Link to Account:
                                    </Label>
                                    <Select
                                      value={selectValue}
                                      onValueChange={(value) => handleLinkOrphanedJobsite(jobsite.lmn_jobsite_id, value === '__unlink__' ? null : value)}
                                    >
                                      <SelectTrigger className="w-full h-9">
                                        <SelectValue placeholder="Select an account..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__unlink__">None (Leave unlinked)</SelectItem>
                                        {accounts
                                          .filter(acc => !acc.archived && acc.status !== 'archived')
                                          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                          .map(account => (
                                            <SelectItem key={account.id} value={account.id}>
                                              {account.name}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Validation Results */}
              {validationResults && importStatus === 'ready' && (
                <Card className="p-4 border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <h3 className="font-semibold text-slate-900">Data Validation Results</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowValidation(!showValidation)}
                    >
                      {showValidation ? 'Hide Details' : 'Show Details'}
                    </Button>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-2xl font-bold text-blue-600">
                        {validationResults.accounts.new.length + validationResults.contacts.new.length + 
                         validationResults.estimates.new.length + validationResults.jobsites.new.length}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">New Records</p>
                    </div>
                    <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-2xl font-bold text-amber-600">
                        {validationResults.accounts.updated.length + validationResults.contacts.updated.length + 
                         validationResults.estimates.updated.length + validationResults.jobsites.updated.length}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Will Be Updated</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-2xl font-bold text-red-600">
                        {validationResults.accounts.orphaned.length + validationResults.contacts.orphaned.length + 
                         validationResults.estimates.orphaned.length + validationResults.jobsites.orphaned.length}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Orphaned (Not in Sheets)</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-2xl font-bold text-slate-600">
                        {validationResults.warnings.length + validationResults.errors.length}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Warnings/Errors</p>
                    </div>
                  </div>

                  {/* Detailed Results */}
                  {showValidation && (
                    <div className="space-y-4 mt-4 pt-4 border-t border-slate-200">
                      {/* Orphaned Records Warning */}
                      {(validationResults.accounts.orphaned.length > 0 || 
                        validationResults.contacts.orphaned.length > 0 || 
                        validationResults.estimates.orphaned.length > 0 || 
                        validationResults.jobsites.orphaned.length > 0) && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-red-900">⚠️ Orphaned Records Found</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleDeleteAllOrphaned}
                              className="text-red-700 border-red-300 hover:bg-red-100"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete All Orphaned
                            </Button>
                          </div>
                          <p className="text-sm text-red-800 mb-3">
                            These records exist in your database but are NOT in the import sheets. 
                            You can delete them if they're inconsistent or no longer needed.
                          </p>
                          
                          {validationResults.estimates.orphaned.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-red-900 mb-2">
                                Orphaned Estimates ({validationResults.estimates.orphaned.length}):
                              </p>
                              <div className="max-h-64 overflow-y-auto space-y-2">
                                {validationResults.estimates.orphaned.map(est => (
                                  <div key={est.id} className="bg-white p-2 rounded border border-red-200 flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-medium text-red-900">
                                          {est.estimate_number || est.lmn_estimate_id}
                                        </p>
                                        {est._source && (
                                          <Badge variant="outline" className="text-xs">
                                            {est._source === 'previous_import' ? 'Previous Import' : 
                                             est._source === 'possibly_mock' ? 'Possibly Mock' : 'Unknown'}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-red-700 mt-1">
                                        {est.contact_name || 'Unknown'} 
                                        {est.total_price_with_tax ? ` • $${est.total_price_with_tax.toLocaleString()}` : ''}
                                      </p>
                                      {est._sourceNote && (
                                        <div className="mt-1 flex items-start gap-1">
                                          <Info className="w-3 h-3 text-red-600 flex-shrink-0 mt-0.5" />
                                          <p className="text-xs text-red-600 italic">{est._sourceNote}</p>
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteOrphaned('estimate', est.id)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-100 flex-shrink-0"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {validationResults.accounts.orphaned.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-red-900 mb-2">
                                Orphaned Accounts ({validationResults.accounts.orphaned.length}):
                              </p>
                              <div className="max-h-64 overflow-y-auto space-y-2">
                                {validationResults.accounts.orphaned.map(acc => (
                                  <div key={acc.id} className="bg-white p-2 rounded border border-red-200 flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-medium text-red-900">{acc.name}</p>
                                        {acc._source && (
                                          <Badge variant="outline" className="text-xs">
                                            {acc._source === 'previous_import' ? 'Previous Import' : 
                                             acc._source === 'possibly_mock' ? 'Possibly Mock' : 'Unknown'}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-red-700 mt-1">
                                        ID: {acc.lmn_crm_id || acc.id}
                                      </p>
                                      {acc._sourceNote && (
                                        <div className="mt-1 flex items-start gap-1">
                                          <Info className="w-3 h-3 text-red-600 flex-shrink-0 mt-0.5" />
                                          <p className="text-xs text-red-600 italic">{acc._sourceNote}</p>
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteOrphaned('account', acc.id)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-100 flex-shrink-0"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {validationResults.contacts.orphaned.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-red-900 mb-2">
                                Orphaned Contacts ({validationResults.contacts.orphaned.length}):
                              </p>
                              <div className="max-h-64 overflow-y-auto space-y-2">
                                {validationResults.contacts.orphaned.map(contact => (
                                  <div key={contact.id} className="bg-white p-2 rounded border border-red-200 flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-medium text-red-900">
                                          {contact.first_name} {contact.last_name}
                                        </p>
                                        {contact._source && (
                                          <Badge variant="outline" className="text-xs">
                                            {contact._source === 'previous_import' ? 'Previous Import' : 
                                             contact._source === 'possibly_mock' ? 'Possibly Mock' : 'Unknown'}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-red-700 mt-1">
                                        ID: {contact.lmn_contact_id || contact.id}
                                      </p>
                                      {contact._sourceNote && (
                                        <div className="mt-1 flex items-start gap-1">
                                          <Info className="w-3 h-3 text-red-600 flex-shrink-0 mt-0.5" />
                                          <p className="text-xs text-red-600 italic">{contact._sourceNote}</p>
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteOrphaned('contact', contact.id)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-100 flex-shrink-0"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {validationResults.jobsites.orphaned.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-red-900 mb-2">
                                Orphaned Jobsites ({validationResults.jobsites.orphaned.length}):
                              </p>
                              <div className="max-h-64 overflow-y-auto space-y-2">
                                {validationResults.jobsites.orphaned.map(jobsite => (
                                  <div key={jobsite.id} className="bg-white p-2 rounded border border-red-200 flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-medium text-red-900">
                                          {jobsite.name || jobsite.lmn_jobsite_id}
                                        </p>
                                        {jobsite._source && (
                                          <Badge variant="outline" className="text-xs">
                                            {jobsite._source === 'previous_import' ? 'Previous Import' : 
                                             jobsite._source === 'possibly_mock' ? 'Possibly Mock' : 'Unknown'}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-red-700 mt-1">
                                        ID: {jobsite.lmn_jobsite_id || jobsite.id}
                                      </p>
                                      {jobsite._sourceNote && (
                                        <div className="mt-1 flex items-start gap-1">
                                          <Info className="w-3 h-3 text-red-600 flex-shrink-0 mt-0.5" />
                                          <p className="text-xs text-red-600 italic">{jobsite._sourceNote}</p>
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteOrphaned('jobsite', jobsite.id)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-100 flex-shrink-0"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Field Differences */}
                      {(validationResults.accounts.updated.length > 0 || 
                        validationResults.contacts.updated.length > 0 || 
                        validationResults.estimates.updated.length > 0) && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="font-semibold text-amber-900 mb-2">📝 Records with Field Differences</p>
                          <p className="text-sm text-amber-800 mb-3">
                            These records will be updated with new values from the import sheets.
                          </p>
                          
                          {validationResults.accounts.updated.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-amber-900 mb-1">
                                Accounts ({validationResults.accounts.updated.length}):
                              </p>
                              <div className="max-h-40 overflow-y-auto space-y-2">
                                {validationResults.accounts.updated.slice(0, 5).map((item, idx) => (
                                  <div key={idx} className="text-xs bg-white p-2 rounded border border-amber-200">
                                    <p className="font-medium text-amber-900">{item.account.name}</p>
                                    {item.differences.slice(0, 3).map((diff, dIdx) => (
                                      <p key={dIdx} className="text-amber-700 mt-1">
                                        • {diff.field}: "{diff.existing}" → "{diff.imported}"
                                      </p>
                                    ))}
                                    {item.differences.length > 3 && (
                                      <p className="text-amber-600 italic mt-1">
                                        ... and {item.differences.length - 3} more changes
                                      </p>
                                    )}
                                  </div>
                                ))}
                                {validationResults.accounts.updated.length > 5 && (
                                  <p className="text-xs text-amber-600 italic">
                                    ... and {validationResults.accounts.updated.length - 5} more accounts
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {validationResults.estimates.updated.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-amber-900 mb-1">
                                Estimates ({validationResults.estimates.updated.length}):
                              </p>
                              <div className="max-h-40 overflow-y-auto space-y-2">
                                {validationResults.estimates.updated.slice(0, 5).map((item, idx) => (
                                  <div key={idx} className="text-xs bg-white p-2 rounded border border-amber-200">
                                    <p className="font-medium text-amber-900">
                                      {item.estimate.estimate_number || item.estimate.lmn_estimate_id}
                                    </p>
                                    {item.differences.slice(0, 3).map((diff, dIdx) => (
                                      <p key={dIdx} className="text-amber-700 mt-1">
                                        • {diff.field}: "{diff.existing}" → "{diff.imported}"
                                      </p>
                                    ))}
                                  </div>
                                ))}
                                {validationResults.estimates.updated.length > 5 && (
                                  <p className="text-xs text-amber-600 italic">
                                    ... and {validationResults.estimates.updated.length - 5} more estimates
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Warnings and Errors */}
                      {(validationResults.warnings.length > 0 || validationResults.errors.length > 0) && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="font-semibold text-red-900 mb-2">⚠️ Warnings & Errors</p>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {validationResults.errors.map((err, idx) => (
                              <p key={idx} className="text-xs text-red-800">
                                ❌ {err.message || err}
                              </p>
                            ))}
                            {validationResults.warnings.slice(0, 10).map((warn, idx) => (
                              <p key={idx} className="text-xs text-red-700">
                                ⚠️ {warn.message || warn}
                              </p>
                            ))}
                            {validationResults.warnings.length > 10 && (
                              <p className="text-xs text-red-600 italic">
                                ... and {validationResults.warnings.length - 10} more warnings
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
                    disabled={!mergedData || importStatus === 'importing' || importStatus === 'validating'}
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
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
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
                    <p className="text-sm font-semibold text-blue-600 mt-1">{importResults.accountsUpdated} Updated</p>
                  )}
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-2xl font-bold text-purple-600">{importResults.contactsCreated}</p>
                  <p className="text-xs text-slate-600 mt-1">Contacts Created</p>
                  {importResults.contactsUpdated > 0 && (
                    <p className="text-sm font-semibold text-blue-600 mt-1">{importResults.contactsUpdated} Updated</p>
                  )}
                </div>
                {(importResults.estimatesCreated > 0 || importResults.estimatesUpdated > 0) && (
                  <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-2xl font-bold text-amber-600">{importResults.estimatesCreated}</p>
                    <p className="text-xs text-slate-600 mt-1">Estimates Created</p>
                    {importResults.estimatesUpdated > 0 && (
                      <p className="text-sm font-semibold text-blue-600 mt-1">{importResults.estimatesUpdated} Updated</p>
                    )}
                  </div>
                )}
                {(importResults.jobsitesCreated > 0 || importResults.jobsitesUpdated > 0) && (
                  <div className="text-center p-3 bg-teal-50 rounded-lg border border-teal-200">
                    <p className="text-2xl font-bold text-teal-600">{importResults.jobsitesCreated}</p>
                    <p className="text-xs text-slate-600 mt-1">Jobsites Created</p>
                    {importResults.jobsitesUpdated > 0 && (
                      <p className="text-sm font-semibold text-blue-600 mt-1">{importResults.jobsitesUpdated} Updated</p>
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

              {/* Notification for new contacts created from Leads without Contact ID */}
              {importResults.newContactsFromLeads && importResults.newContactsFromLeads.count > 0 && (
                <Card className="p-4 bg-blue-50 border-blue-200 w-full max-w-2xl mt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 text-sm font-bold">ℹ️</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-blue-900 mb-2">
                        {importResults.newContactsFromLeads.count} New Contact{importResults.newContactsFromLeads.count !== 1 ? 's' : ''} Created (No Contact ID)
                      </p>
                      <p className="text-sm text-blue-800 mb-3">
                        The following contact{importResults.newContactsFromLeads.count !== 1 ? 's were' : ' was'} created from the Leads sheet but {importResults.newContactsFromLeads.count !== 1 ? 'do not have' : 'does not have'} a Contact ID. {importResults.newContactsFromLeads.count !== 1 ? 'They have been' : 'It has been'} attributed to {importResults.newContactsFromLeads.count !== 1 ? 'their respective' : 'its'} account{importResults.newContactsFromLeads.count !== 1 ? 's' : ''}:
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {importResults.newContactsFromLeads.contacts.map((contact, idx) => (
                          <div key={idx} className="p-2 bg-white rounded border border-blue-200">
                            <p className="text-sm font-medium text-blue-900">
                              {contact.contact_name || 'Unknown Contact'}
                              {contact.email && <span className="text-blue-700 font-normal"> ({contact.email})</span>}
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                              → Attributed to: <span className="font-semibold">{contact.account_name}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
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



