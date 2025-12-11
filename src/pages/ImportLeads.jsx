import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { parseLmnCsv, validateImportData, previewLmnCsv } from '@/utils/lmnCsvParser';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileText,
  Users,
  Building2,
  CheckCircle,
  AlertCircle,
  Download,
  RefreshCw,
  ArrowRight
} from 'lucide-react';

export default function ImportLeads() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [validation, setValidation] = useState(null);
  const [importStatus, setImportStatus] = useState('idle'); // idle, parsing, validating, importing, success, error
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState(null);
  
  const queryClient = useQueryClient();

  // Handle file selection
  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setImportStatus('parsing');

    // Read and preview the file
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        
        // Show preview
        const previewData = previewLmnCsv(text, 5);
        setPreview(previewData);
        
        // Parse full data
        const parsed = parseLmnCsv(text);
        
        if (parsed.stats.error) {
          setError(parsed.stats.error);
          setImportStatus('error');
          return;
        }
        
        setParsedData(parsed);
        
        // Validate data
        const validationResults = validateImportData(parsed.accounts, parsed.contacts);
        setValidation(validationResults);
        
        setImportStatus('validating');
      } catch (err) {
        setError(`Error parsing CSV: ${err.message}`);
        setImportStatus('error');
      }
    };
    
    reader.onerror = () => {
      setError('Error reading file');
      setImportStatus('error');
    };
    
    reader.readAsText(selectedFile);
  };

  // Import data to CRM
  const handleImport = async () => {
    if (!parsedData || !validation?.isValid) return;

    setImportStatus('importing');
    setError(null);

    try {
      const results = {
        accountsCreated: 0,
        contactsCreated: 0,
        accountsFailed: 0,
        contactsFailed: 0,
        errors: []
      };

      // Import accounts first
      for (const account of parsedData.accounts) {
        try {
          await base44.entities.Account.create(account);
          results.accountsCreated++;
        } catch (err) {
          results.accountsFailed++;
          results.errors.push(`Failed to create account "${account.name}": ${err.message}`);
        }
      }

      // Then import contacts
      for (const contact of parsedData.contacts) {
        try {
          await base44.entities.Contact.create(contact);
          results.contactsCreated++;
        } catch (err) {
          results.contactsFailed++;
          results.errors.push(`Failed to create contact "${contact.first_name} ${contact.last_name}": ${err.message}`);
        }
      }

      setImportResults(results);
      setImportStatus('success');

      // Refresh account and contact lists
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });

    } catch (err) {
      setError(`Import failed: ${err.message}`);
      setImportStatus('error');
    }
  };

  // Reset form
  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setParsedData(null);
    setValidation(null);
    setImportStatus('idle');
    setImportResults(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Import Leads from LMN</h1>
        <p className="text-slate-600 mt-2">
          Upload a CSV file from golmn.com to automatically create accounts and contacts
        </p>
      </div>

      {/* Upload Section */}
      {importStatus === 'idle' && (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
              <Upload className="w-10 h-10 text-blue-600" />
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Upload LMN Leads CSV
              </h2>
              <p className="text-slate-600 max-w-md">
                Select a CSV file exported from LMN (golmn.com). The system will automatically
                parse Lead Names as accounts and contact information.
              </p>
            </div>

            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-file-input"
            />
            
            <label htmlFor="csv-file-input">
              <Button asChild className="bg-blue-600 hover:bg-blue-700 cursor-pointer">
                <span>
                  <FileText className="w-4 h-4 mr-2" />
                  Choose CSV File
                </span>
              </Button>
            </label>

            <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg mt-4">
              <p className="font-semibold mb-2">Expected CSV Columns:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-left">
                <div>
                  <p className="font-medium text-slate-700 mb-1">Required:</p>
                  <ul className="space-y-0.5">
                    <li>• <strong>Lead Name</strong> (Account)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-700 mb-1">Contact Fields:</p>
                  <ul className="space-y-0.5">
                    <li>• First Name, Last Name</li>
                    <li>• Position, Billing Contact</li>
                    <li>• Email 1, Email 2</li>
                    <li>• Phone 1, Phone 2</li>
                    <li>• Do Not Email/Mail/Call</li>
                    <li>• Send SMS, Notes</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2 italic">
                See LMN_CSV_FORMAT.md for detailed format guide
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-800 mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
              >
                Try Again
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Preview & Validation */}
      {(importStatus === 'parsing' || importStatus === 'validating') && preview && parsedData && (
        <div className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 border-l-4 border-l-blue-500">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-slate-600">Total Rows</p>
                  <p className="text-2xl font-bold text-slate-900">{parsedData.stats.totalRows}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-3">
                <Building2 className="w-8 h-8 text-emerald-600" />
                <div>
                  <p className="text-sm text-slate-600">Accounts Found</p>
                  <p className="text-2xl font-bold text-slate-900">{parsedData.stats.accountsCreated}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-l-purple-500">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-sm text-slate-600">Contacts Found</p>
                  <p className="text-2xl font-bold text-slate-900">{parsedData.stats.contactsCreated}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Avg {parsedData.stats.averageContactsPerAccount} per account
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Preview Table */}
          <Card className="p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Data Preview (First 5 rows)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    {preview.headers.map((header, idx) => (
                      <th key={idx} className="px-4 py-2 text-left text-xs font-semibold text-slate-700 uppercase">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.preview.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-50">
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="px-4 py-2 text-slate-600">
                          {cell || <span className="text-slate-400">-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Validation Results */}
          {validation && (
            <Card className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Validation Results</h3>
              
              {validation.isValid ? (
                <div className="flex items-center gap-2 text-emerald-700 mb-4">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Data is valid and ready to import!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-700 mb-4">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Please fix the following errors:</span>
                </div>
              )}

              {validation.errors && validation.errors.length > 0 && (
                <div className="mb-4">
                  <p className="font-medium text-red-900 mb-2">Errors:</p>
                  <ul className="list-disc list-inside space-y-1 text-red-800 text-sm">
                    {validation.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.warnings && validation.warnings.length > 0 && (
                <div>
                  <p className="font-medium text-amber-900 mb-2">Warnings:</p>
                  <ul className="list-disc list-inside space-y-1 text-amber-800 text-sm">
                    {validation.warnings.map((warn, idx) => (
                      <li key={idx}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={!validation?.isValid || importStatus === 'importing'}
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
                  Import {parsedData.stats.accountsCreated} Accounts & {parsedData.stats.contactsCreated} Contacts
                </>
              )}
            </Button>
            
            <Button variant="outline" onClick={handleReset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Success Results */}
      {importStatus === 'success' && importResults && (
        <Card className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Import Successful!
              </h2>
              <p className="text-slate-600">
                Your leads have been imported into LECRM
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 w-full max-w-md mt-4">
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-3xl font-bold text-emerald-600">{importResults.accountsCreated}</p>
                <p className="text-sm text-slate-600 mt-1">Accounts Created</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">{importResults.contactsCreated}</p>
                <p className="text-sm text-slate-600 mt-1">Contacts Created</p>
              </div>
            </div>

            {(importResults.accountsFailed > 0 || importResults.contactsFailed > 0) && (
              <div className="text-sm text-amber-700 bg-amber-50 p-4 rounded-lg w-full max-w-md">
                <p className="font-semibold mb-2">Some items failed to import:</p>
                {importResults.accountsFailed > 0 && (
                  <p>• {importResults.accountsFailed} accounts failed</p>
                )}
                {importResults.contactsFailed > 0 && (
                  <p>• {importResults.contactsFailed} contacts failed</p>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button onClick={() => window.location.href = '/accounts'} className="bg-slate-900">
                <Building2 className="w-4 h-4 mr-2" />
                View Accounts
              </Button>
              <Button onClick={() => window.location.href = '/contacts'} variant="outline">
                <Users className="w-4 h-4 mr-2" />
                View Contacts
              </Button>
              <Button onClick={handleReset} variant="outline">
                Import More
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}




