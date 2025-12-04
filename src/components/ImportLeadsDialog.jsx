import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { parseContactsExport } from '@/utils/lmnContactsExportParser';
import { parseLeadsList } from '@/utils/lmnLeadsListParser';
import { mergeContactData } from '@/utils/lmnMergeData';
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
  
  // Merged data and status
  const [mergedData, setMergedData] = useState(null);
  const [importStatus, setImportStatus] = useState('idle');
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState(null);
  
  const queryClient = useQueryClient();

  // Process Contacts Export file
  const processContactsFile = (file) => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseContactsExport(text);
        
        if (parsed.stats.error) {
          setError(`Contacts Export: ${parsed.stats.error}`);
          return;
        }
        
        setContactsData(parsed);
        setContactsFile(file);
        
        // If both files loaded, merge them
        if (leadsData) {
          mergeBothFiles(parsed, leadsData);
        }
      } catch (err) {
        setError(`Error reading Contacts Export: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Process Leads List file
  const processLeadsFile = (file) => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseLeadsList(text);
        
        if (parsed.stats.error) {
          setError(`Leads List: ${parsed.stats.error}`);
          return;
        }
        
        setLeadsData(parsed);
        setLeadsFile(file);
        
        // If both files loaded, merge them
        if (contactsData) {
          mergeBothFiles(contactsData, parsed);
        }
      } catch (err) {
        setError(`Error reading Leads List: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Merge both CSVs
  const mergeBothFiles = (contacts, leads) => {
    try {
      const merged = mergeContactData(contacts, leads);
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
    if (file) processContactsFile(file);
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
    if (file) processLeadsFile(file);
  };

  // Import merged data with automatic merge/update
  const handleImport = async () => {
    if (!mergedData) return;

    setImportStatus('importing');
    setError(null);

    try {
      const results = {
        accountsCreated: 0,
        accountsUpdated: 0,
        contactsCreated: 0,
        contactsUpdated: 0,
        accountsFailed: 0,
        contactsFailed: 0,
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

      setImportResults(results);
      setImportStatus('success');

      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });

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
    setMergedData(null);
    setImportStatus('idle');
    setImportResults(null);
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const bothFilesUploaded = contactsFile && leadsFile;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Import from LMN</DialogTitle>
          <p className="text-slate-600 text-sm mt-1">
            Upload both CSV files from LMN to import complete contact data
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
                    <p className="font-semibold mb-1">Both CSV files are required:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li><strong>Contacts Export</strong> - Has CRM IDs, Contact IDs, Tags, Archived status</li>
                      <li><strong>Leads List</strong> - Has Position, Do Not Email/Mail/Call preferences</li>
                    </ol>
                    <p className="mt-2">The system will merge both files to create complete contact records.</p>
                  </div>
                </div>
              </Card>

              {/* Two Upload Sections */}
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
                          accept=".csv,text/csv,application/csv"
                          onChange={(e) => processContactsFile(e.target.files[0])}
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
                          accept=".csv,text/csv,application/csv"
                          onChange={(e) => processLeadsFile(e.target.files[0])}
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
                          Has: Position, Do Not Email/Mail/Call
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Merge Status */}
              {bothFilesUploaded && mergedData && (
                <Card className="p-6 border-emerald-200 bg-emerald-50">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                      <div>
                        <p className="font-semibold text-emerald-900">Files Merged Successfully!</p>
                        <p className="text-sm text-emerald-800 mt-1">
                          Ready to import {mergedData.stats.totalAccounts} accounts and {mergedData.stats.totalContacts} contacts
                        </p>
                      </div>
                    </div>

                    {/* Merge Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white p-3 rounded border border-emerald-200">
                        <p className="text-2xl font-bold text-slate-900">{mergedData.stats.totalAccounts}</p>
                        <p className="text-xs text-slate-600 mt-1">Accounts</p>
                      </div>
                      <div className="bg-white p-3 rounded border border-emerald-200">
                        <p className="text-2xl font-bold text-slate-900">{mergedData.stats.totalContacts}</p>
                        <p className="text-xs text-slate-600 mt-1">Contacts</p>
                      </div>
                      <div className="bg-white p-3 rounded border border-emerald-200">
                        <p className="text-2xl font-bold text-emerald-600">{mergedData.stats.matchRate}%</p>
                        <p className="text-xs text-slate-600 mt-1">Match Rate</p>
                      </div>
                    </div>

                    <div className="text-xs text-emerald-800">
                      <p>✓ {mergedData.stats.matchedContacts} contacts matched between files</p>
                      {mergedData.stats.unmatchedContacts > 0 && (
                        <p className="text-amber-700 mt-1">
                          ⚠ {mergedData.stats.unmatchedContacts} contacts only in Contacts Export (will use base data)
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Action Buttons */}
              {bothFilesUploaded && (
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

              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
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
              </div>

              {(importResults.accountsFailed > 0 || importResults.contactsFailed > 0) && (
                <Card className="p-3 bg-amber-50 border-amber-200 w-full max-w-sm">
                  <p className="text-sm text-amber-800">
                    {importResults.accountsFailed > 0 && `${importResults.accountsFailed} accounts failed`}
                    {importResults.contactsFailed > 0 && `, ${importResults.contactsFailed} contacts failed`}
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
