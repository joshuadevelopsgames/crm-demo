import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [description, setDescription] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      // Don't highlight the inspection indicator itself
      if (element && element !== document.body && element !== document.documentElement && !element.closest('.inspection-indicator')) {
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
      // Don't capture clicks on the inspection indicator
      if (e.target.closest('.inspection-indicator')) {
        return;
      }
      
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
        setIsOpen(true); // Reopen dialog after selection
        
        // Remove all outlines
        document.querySelectorAll('*').forEach(el => {
          el.style.outline = '';
        });
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsInspecting(false);
        setIsOpen(true); // Reopen dialog
        document.querySelectorAll('*').forEach(el => {
          el.style.outline = '';
        });
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleEscape);
      
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
    consoleLogRef.current = [];
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsInspecting(false);
    setSelectedElement(null);
    setDescription('');
    setUserEmail('');
    consoleLogRef.current = [];
  };

  const handleStartInspection = () => {
    setIsInspecting(true);
    setSelectedElement(null);
    setIsOpen(false); // Close dialog to allow clicking on the page
  };

  const handleCancelInspection = () => {
    setIsInspecting(false);
    setIsOpen(true); // Reopen dialog
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
      // Get current console logs (not shown to user, only sent in email)
      const currentLogs = [...consoleLogRef.current];

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
        const errorMessage = result.error || 'Failed to send bug report';
        const details = result.details ? `\n\nDetails: ${JSON.stringify(result.details, null, 2)}` : '';
        console.error('❌ Bug report API error:', {
          status: response.status,
          error: errorMessage,
          details: result.details
        });
        throw new Error(errorMessage + details);
      }

      // Check for warnings (e.g., email failed but notification succeeded)
      if (result.warnings && result.warnings.length > 0) {
        console.warn('⚠️ Bug report sent with warnings:', result.warnings);
        
        // Show detailed error message if email failed
        if (!result.emailSent && result.emailError) {
          console.error('❌ Email error:', result.emailError);
          toast.error(`Bug report notification created, but email failed: ${result.emailError}`, { duration: 8000 });
        } else if (!result.emailSent) {
          toast('✓ Bug report notification created, but email could not be sent. Check Vercel logs for details.', { 
            duration: 8000,
            icon: '⚠️'
          });
        } else {
          toast.success('✓ Bug report sent! (Some issues occurred - check console for details)', { duration: 5000 });
        }
      } else {
      toast.success('✓ Bug report sent successfully!');
      }
      
      console.log('✅ Bug report submitted:', {
        emailSent: result.emailSent,
        notificationCreated: result.notificationCreated,
        emailError: result.emailError || 'none',
        notificationError: result.notificationError || 'none'
      });
      
      // Invalidate notifications query to refresh the notification bell
      // This ensures the new bug report notification appears immediately
      if (result.notificationCreated) {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        console.log('🔄 Invalidated notifications query to refresh notification bell');
      }
      
      handleClose();
    } catch (error) {
      console.error('❌ Error submitting bug report:', error);
      const errorMessage = error.message || 'Failed to send bug report';
      toast.error(`Failed to send bug report: ${errorMessage}`, { duration: 6000 });
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
        <Bug className="h-8 w-8 text-white" />
      </Button>

      {/* Inspection Mode Indicator */}
      {isInspecting && (
        <div className="inspection-indicator fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
          <MousePointer2 className="h-5 w-5" />
          <div>
            <p className="font-semibold text-sm">Inspection Mode Active</p>
            <p className="text-xs opacity-90">Click on the problematic feature, or press ESC to cancel</p>
          </div>
          <Button
            onClick={handleCancelInspection}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-blue-700 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Bug Report Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open && isInspecting) {
          // Cancel inspection if dialog is closed while inspecting
          setIsInspecting(false);
          document.querySelectorAll('*').forEach(el => {
            el.style.outline = '';
          });
        }
      }}>
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
                name="user-email"
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
              {!selectedElement && (
                <Button
                  onClick={handleStartInspection}
                  variant="outline"
                  className="w-full"
                >
                  <MousePointer2 className="h-4 w-4 mr-2" />
                  Click to Select Feature
                </Button>
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
                name="description"
                placeholder="What went wrong? What were you trying to do? What did you expect to happen?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="resize-none"
                required
              />
            </div>
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

