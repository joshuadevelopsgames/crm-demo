import React, { useState, useEffect, useRef } from 'react';
import { Bug, X, MousePointer2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import toast from 'react-hot-toast';

export default function BugReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [description, setDescription] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const consoleLogRef = useRef([]);
  const originalConsoleRef = useRef(null);

  // Capture console logs
  useEffect(() => {
    if (isOpen) {
      // Store original console methods
      originalConsoleRef.current = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
      };

      // Override console methods to capture logs
      console.log = (...args) => {
        originalConsoleRef.current.log(...args);
        consoleLogRef.current.push({
          type: 'log',
          message: args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '),
          timestamp: new Date().toISOString(),
        });
      };

      console.error = (...args) => {
        originalConsoleRef.current.error(...args);
        consoleLogRef.current.push({
          type: 'error',
          message: args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '),
          timestamp: new Date().toISOString(),
        });
      };

      console.warn = (...args) => {
        originalConsoleRef.current.warn(...args);
        consoleLogRef.current.push({
          type: 'warn',
          message: args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '),
          timestamp: new Date().toISOString(),
        });
      };

      console.info = (...args) => {
        originalConsoleRef.current.info(...args);
        consoleLogRef.current.push({
          type: 'info',
          message: args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '),
          timestamp: new Date().toISOString(),
        });
      };
    }

    return () => {
      // Restore original console methods
      if (originalConsoleRef.current) {
        console.log = originalConsoleRef.current.log;
        console.error = originalConsoleRef.current.error;
        console.warn = originalConsoleRef.current.warn;
        console.info = originalConsoleRef.current.info;
      }
    };
  }, [isOpen]);

  // Handle element inspection
  useEffect(() => {
    if (!isInspecting) return;

    const handleMouseOver = (e) => {
      e.stopPropagation();
      const element = e.target;
      if (element && element !== document.body && element !== document.documentElement) {
        element.style.outline = '2px solid #3b82f6';
        element.style.outlineOffset = '2px';
      }
    };

    const handleMouseOut = (e) => {
      const element = e.target;
      if (element) {
        element.style.outline = '';
      }
    };

    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const element = e.target;
      if (element && element !== document.body && element !== document.documentElement) {
        // Get element information
        const elementInfo = {
          tagName: element.tagName,
          id: element.id,
          className: element.className,
          textContent: element.textContent?.substring(0, 200) || '',
          innerHTML: element.innerHTML?.substring(0, 500) || '',
          attributes: Array.from(element.attributes || []).reduce((acc, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {}),
          computedStyles: window.getComputedStyle(element) ? {
            display: window.getComputedStyle(element).display,
            position: window.getComputedStyle(element).position,
            width: window.getComputedStyle(element).width,
            height: window.getComputedStyle(element).height,
          } : {},
          boundingRect: element.getBoundingClientRect(),
          xpath: getXPath(element),
        };

        setSelectedElement(elementInfo);
        setIsInspecting(false);
        
        // Remove all outlines
        document.querySelectorAll('*').forEach(el => {
          el.style.outline = '';
        });
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleClick, true);
      
      // Remove all outlines
      document.querySelectorAll('*').forEach(el => {
        el.style.outline = '';
      });
    };
  }, [isInspecting]);

  // Get XPath for element
  const getXPath = (element) => {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    if (element === document.body) {
      return '/html/body';
    }
    
    let ix = 0;
    const siblings = element.parentNode?.childNodes || [];
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === element) {
        return `${getXPath(element.parentNode)}/${element.tagName.toLowerCase()}[${ix + 1}]`;
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
    return '';
  };

  const handleOpen = () => {
    setIsOpen(true);
    setConsoleLogs([]);
    consoleLogRef.current = [];
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsInspecting(false);
    setSelectedElement(null);
    setDescription('');
    setUserEmail('');
    setConsoleLogs([]);
    consoleLogRef.current = [];
  };

  const handleStartInspection = () => {
    setIsInspecting(true);
    setSelectedElement(null);
  };

  const handleCancelInspection = () => {
    setIsInspecting(false);
    document.querySelectorAll('*').forEach(el => {
      el.style.outline = '';
    });
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Please describe the problem');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current console logs
      const currentLogs = [...consoleLogRef.current];
      setConsoleLogs(currentLogs);

      // Get user info
      const userInfo = {
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        timestamp: new Date().toISOString(),
      };

      // Prepare bug report data
      const bugReport = {
        description,
        userEmail: userEmail || 'Not provided',
        selectedElement,
        consoleLogs: currentLogs,
        userInfo,
      };

      // Send to API
      const response = await fetch('/api/bug-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bugReport),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send bug report');
      }

      toast.success('✓ Bug report sent successfully!');
      handleClose();
    } catch (error) {
      console.error('Error submitting bug report:', error);
      toast.error(`Failed to send bug report: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Bug Report Button */}
      <Button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        aria-label="Report a bug"
      >
        <Bug className="h-6 w-6 text-white" />
      </Button>

      {/* Bug Report Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report a Bug</DialogTitle>
            <DialogDescription>
              Help us improve by reporting any issues you encounter. Click on the problematic feature to highlight it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* User Email (Optional) */}
            <div>
              <label htmlFor="user-email" className="text-sm font-medium mb-2 block">
                Your Email (Optional)
              </label>
              <Input
                id="user-email"
                type="email"
                placeholder="your.email@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
            </div>

            {/* Element Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Select Problematic Feature
              </label>
              {!selectedElement && !isInspecting && (
                <Button
                  onClick={handleStartInspection}
                  variant="outline"
                  className="w-full"
                >
                  <MousePointer2 className="h-4 w-4 mr-2" />
                  Click to Select Feature
                </Button>
              )}
              
              {isInspecting && (
                <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MousePointer2 className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Click on the feature that's having problems
                        </span>
                      </div>
                      <Button
                        onClick={handleCancelInspection}
                        variant="ghost"
                        size="sm"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedElement && (
                <Card className="mt-2">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Selected Element:</span>
                        <Button
                          onClick={() => setSelectedElement(null)}
                          variant="ghost"
                          size="sm"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div><strong>Tag:</strong> {selectedElement.tagName}</div>
                        {selectedElement.id && <div><strong>ID:</strong> {selectedElement.id}</div>}
                        {selectedElement.className && (
                          <div><strong>Class:</strong> {selectedElement.className}</div>
                        )}
                        {selectedElement.textContent && (
                          <div><strong>Text:</strong> {selectedElement.textContent.substring(0, 100)}</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="text-sm font-medium mb-2 block">
                Describe the Problem <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="description"
                placeholder="What went wrong? What were you trying to do? What did you expect to happen?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="resize-none"
              />
            </div>

            {/* Console Logs Preview */}
            {consoleLogs.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Console Logs Captured ({consoleLogs.length})
                </label>
                <Card>
                  <CardContent className="p-4 max-h-40 overflow-y-auto">
                    <pre className="text-xs font-mono space-y-1">
                      {consoleLogs.slice(-20).map((log, idx) => (
                        <div key={idx} className={`${
                          log.type === 'error' ? 'text-red-600' :
                          log.type === 'warn' ? 'text-yellow-600' :
                          'text-gray-600'
                        }`}>
                          <span className="text-gray-400">[{log.timestamp}]</span> {log.message}
                        </div>
                      ))}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !description.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Report'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

