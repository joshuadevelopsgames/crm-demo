import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { testRenewalNotifications, previewRenewalNotifications } from '@/utils/testRenewalNotifications';
import { Loader2 } from 'lucide-react';

export default function TestRenewalNotifications() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Auto-run preview on mount
  useEffect(() => {
    runPreview();
  }, []);

  const runPreview = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const result = await previewRenewalNotifications();
      setResults(result);
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const runTest = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const result = await testRenewalNotifications();
      setResults(result);
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Renewal Notifications</CardTitle>
          <p className="text-sm text-slate-600 mt-2">
            Safe, read-only testing - no data will be modified
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button 
              onClick={runPreview} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Preview Notifications (Safe)'
              )}
            </Button>
            <Button 
              onClick={runTest} 
              disabled={loading}
              variant="outline"
            >
              Check Existing Renewals
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 font-semibold">Error:</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}

          {results && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <h3 className="font-semibold text-slate-900 mb-2">Results:</h3>
              <pre className="text-sm text-slate-700 whitespace-pre-wrap overflow-auto max-h-96">
                {JSON.stringify(results, null, 2)}
              </pre>
              <p className="text-xs text-slate-500 mt-2">
                Check the browser console for detailed output
              </p>
            </div>
          )}

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Check your browser console (F12) for detailed output. 
              This page shows a summary, but the console will show the full preview with account names, 
              renewal dates, and notification status.
            </p>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Browser Console Usage:</strong> You can also run this directly in the console:
            </p>
            <code className="block mt-2 p-2 bg-white rounded text-xs overflow-x-auto">
              window.testRenewalPreview = async () => {'{'} const {'{'} previewRenewalNotifications {'}'} = await import('/src/utils/testRenewalNotifications.js'); return await previewRenewalNotifications(); {'}'}
            </code>
            <p className="text-xs text-amber-700 mt-2">
              Then run: <code className="bg-white px-1 rounded">testRenewalPreview()</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

