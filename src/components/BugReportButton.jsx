import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { getSupabaseAuth } from '@/services/supabaseClient';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import toast from 'react-hot-toast';

export default function BugReportButton() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [description, setDescription] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [priority, setPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const consoleLogRef = useRef([]);
  const originalConsoleRef = useRef(null);
  const consoleCaptureStartedRef = useRef(false);

  // Capture console logs - start immediately on mount, not just when dialog opens
  useEffect(() => {
    // Only set up console interception once
    if (consoleCaptureStartedRef.current) return;
    consoleCaptureStartedRef.current = true;

    // Store original console methods
    originalConsoleRef.current = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };

    // Helper to format console arguments
    const formatArgs = (args) => {
      return args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
    };

    // Override console methods to capture logs
    console.log = (...args) => {
      originalConsoleRef.current.log(...args);
      consoleLogRef.current.push({
        type: 'log',
        message: formatArgs(args),
        timestamp: new Date().toISOString(),
      });
    };

    console.error = (...args) => {
      originalConsoleRef.current.error(...args);
      consoleLogRef.current.push({
        type: 'error',
        message: formatArgs(args),
        timestamp: new Date().toISOString(),
      });
    };

    console.warn = (...args) => {
      originalConsoleRef.current.warn(...args);
      consoleLogRef.current.push({
        type: 'warn',
        message: formatArgs(args),
        timestamp: new Date().toISOString(),
      });
    };

    console.info = (...args) => {
      originalConsoleRef.current.info(...args);
      consoleLogRef.current.push({
        type: 'info',
        message: formatArgs(args),
        timestamp: new Date().toISOString(),
      });
    };

    console.debug = (...args) => {
      originalConsoleRef.current.debug(...args);
      consoleLogRef.current.push({
        type: 'debug',
        message: formatArgs(args),
        timestamp: new Date().toISOString(),
      });
    };

    // Note: We don't restore console methods on unmount because we want to capture
    // logs throughout the entire session, not just when the dialog is open
  }, []);

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
      
      const element = e.target;
      
      // Check if the clicked element is part of a dropdown menu
      const isDropdownElement = (el) => {
        if (!el) return false;
        
        // Check if element is inside a SelectContent (Radix UI Select dropdown)
        if (el.closest('[role="listbox"]') || el.closest('.select-dropdown')) {
          return true;
        }
        
        // Check if element is a SelectTrigger or has Radix Select data attributes
        if (el.hasAttribute('data-radix-select-trigger') || 
            el.closest('[data-radix-select-trigger]')) {
          return true;
        }
        
        // Check if element is a SelectItem or inside SelectContent
        if (el.hasAttribute('data-radix-select-item') ||
            el.closest('[data-radix-select-item]') ||
            el.closest('[data-radix-select-content]')) {
          return true;
        }
        
        // Check for common dropdown patterns
        if (el.getAttribute('role') === 'combobox' || 
            el.getAttribute('aria-haspopup') === 'true' ||
            el.getAttribute('aria-haspopup') === 'listbox') {
          return true;
        }
        
        // Check if element is inside a Radix Portal (where SelectContent is rendered)
        if (el.closest('[data-radix-portal]')) {
          return true;
        }
        
        // Check for custom dropdowns (like UserFilter) that use portals
        // These typically have high z-index and are positioned fixed
        const computedStyle = window.getComputedStyle(el);
        const zIndex = parseInt(computedStyle.zIndex) || 0;
        if (zIndex >= 9999 && (computedStyle.position === 'fixed' || computedStyle.position === 'absolute')) {
          // Likely a dropdown menu
          return true;
        }
        
        // Check if element is inside a high z-index container (dropdown menus)
        let current = el;
        for (let i = 0; i < 10 && current; i++) { // Check up to 10 levels up
          const style = window.getComputedStyle(current);
          const currentZIndex = parseInt(style.zIndex) || 0;
          if (currentZIndex >= 9999 && (style.position === 'fixed' || style.position === 'absolute')) {
            return true;
          }
          current = current.parentElement;
        }
        
        // Check for other common dropdown patterns (aria-expanded, etc.)
        const parent = el.parentElement;
        if (parent && (
          parent.getAttribute('role') === 'combobox' ||
          parent.getAttribute('aria-haspopup') === 'true' ||
          parent.getAttribute('aria-haspopup') === 'listbox'
        )) {
          return true;
        }
        
        // Check if clicking on a button that might open a dropdown
        // (buttons with chevron icons or similar patterns)
        if (el.tagName === 'BUTTON' || el.closest('button')) {
          const button = el.tagName === 'BUTTON' ? el : el.closest('button');
          // Check if button contains a chevron icon (common in dropdown triggers)
          if (button && (
            button.querySelector('svg[class*="chevron"]') ||
            button.querySelector('svg[class*="Chevron"]') ||
            button.getAttribute('aria-expanded') !== null
          )) {
            return true;
          }
        }
        
        return false;
      };
      
      // If it's a dropdown element, allow the click to proceed normally
      if (isDropdownElement(element)) {
        return; // Don't prevent default or stop propagation
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      if (element && element !== document.body && element !== document.documentElement) {
        // Get element information
        // Handle SVGAnimatedString for className (SVG elements)
        const classNameValue = element.className;
        const classNameString = typeof classNameValue === 'string' 
          ? classNameValue 
          : (classNameValue?.baseVal || classNameValue?.animVal || String(classNameValue) || '');
        
        const elementInfo = {
          tagName: element.tagName,
          id: element.id || '',
          className: classNameString,
          textContent: element.textContent?.substring(0, 200) || '',
          innerHTML: element.innerHTML?.substring(0, 500) || '',
          attributes: Array.from(element.attributes || []).reduce((acc, attr) => {
            // Handle SVGAnimatedString for attribute values
            const attrValue = attr.value;
            acc[attr.name] = typeof attrValue === 'string' 
              ? attrValue 
              : (attrValue?.baseVal || attrValue?.animVal || String(attrValue) || '');
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
    // Don't clear console logs - we want to keep the full history
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsInspecting(false);
    setSelectedElement(null);
    setDescription('');
    setUserEmail('');
    setPriority('medium');
    // Don't clear console logs - we want to keep the full history
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
      let currentLogs = [...consoleLogRef.current];
      
      // Limit console logs to prevent size issues (keep most recent 2000 entries, or limit to ~2MB)
      const MAX_CONSOLE_LOGS = 2000;
      const MAX_CONSOLE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
      
      if (currentLogs.length > MAX_CONSOLE_LOGS) {
        console.warn(`⚠️ Truncating console logs from ${currentLogs.length} to ${MAX_CONSOLE_LOGS} entries`);
        currentLogs = currentLogs.slice(-MAX_CONSOLE_LOGS);
      }
      
      // Further truncate if total size is too large
      let totalSize = 0;
      const truncatedLogs = [];
      for (let i = currentLogs.length - 1; i >= 0; i--) {
        const logSize = JSON.stringify(currentLogs[i]).length;
        if (totalSize + logSize > MAX_CONSOLE_SIZE_BYTES) {
          break;
        }
        truncatedLogs.unshift(currentLogs[i]);
        totalSize += logSize;
      }
      
      if (truncatedLogs.length < currentLogs.length) {
        console.warn(`⚠️ Truncated console logs due to size: ${currentLogs.length} → ${truncatedLogs.length} entries`);
        currentLogs = truncatedLogs;
      }
      
      // Limit description length (10,000 characters)
      const MAX_DESCRIPTION_LENGTH = 10000;
      const truncatedDescription = description.length > MAX_DESCRIPTION_LENGTH
        ? description.substring(0, MAX_DESCRIPTION_LENGTH) + '\n\n[Description truncated due to length]'
        : description;

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
        description: truncatedDescription,
        userEmail: userEmail || 'Not provided',
        priority,
        selectedElement,
        consoleLogs: currentLogs,
        userInfo,
      };

      // Check payload size before sending (Vercel limit is ~4.5MB)
      const payload = JSON.stringify(bugReport);
      const payloadSizeMB = payload.length / (1024 * 1024);
      const MAX_PAYLOAD_SIZE_MB = 4.0; // Leave some buffer
      
      if (payloadSizeMB > MAX_PAYLOAD_SIZE_MB) {
        // Aggressively truncate console logs
        const targetSize = MAX_PAYLOAD_SIZE_MB * 1024 * 1024;
        const descriptionSize = JSON.stringify(truncatedDescription).length;
        const otherDataSize = JSON.stringify({
          userEmail: bugReport.userEmail,
          priority: bugReport.priority,
          selectedElement: bugReport.selectedElement,
          userInfo: bugReport.userInfo
        }).length;
        const availableForLogs = targetSize - descriptionSize - otherDataSize - 10000; // 10KB buffer
        
        let logSize = 0;
        const finalLogs = [];
        for (let i = currentLogs.length - 1; i >= 0; i--) {
          const logStr = JSON.stringify(currentLogs[i]);
          if (logSize + logStr.length > availableForLogs) {
            break;
          }
          finalLogs.unshift(currentLogs[i]);
          logSize += logStr.length;
        }
        
        bugReport.consoleLogs = finalLogs;
        console.warn(`⚠️ Payload too large (${payloadSizeMB.toFixed(2)}MB), truncated console logs to ${finalLogs.length} entries`);
        
        toast('⚠️ Bug report is very large. Some console logs were truncated to ensure delivery.', { 
          duration: 5000,
          icon: '⚠️'
        });
      }

      // Get auth token for API call
      const supabase = getSupabaseAuth();
      let authToken = null;
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        authToken = session?.access_token || null;
      }

      // Send to API
      const headers = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch('/api/bug-report', {
        method: 'POST',
        headers,
        body: JSON.stringify(bugReport),
      });

      // Handle response - check if it's JSON first
      let result;
      try {
        const text = await response.text();
        result = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('❌ Failed to parse response:', parseError);
        throw new Error('Server returned invalid response. The bug report may be too large.');
      }

      if (!response.ok) {
        const errorMessage = result.error || 'Failed to send bug report';
        const details = result.details ? `\n\nDetails: ${JSON.stringify(result.details, null, 2)}` : '';
        console.error('❌ Bug report API error:', {
          status: response.status,
          error: errorMessage,
          details: result.details
        });
        
        // Provide helpful error message for size-related issues
        if (response.status === 413 || response.status === 400 || errorMessage.toLowerCase().includes('size') || errorMessage.toLowerCase().includes('too large')) {
          throw new Error('Bug report is too large. Please shorten your description or try again with fewer console logs.');
        }
        
        throw new Error(errorMessage + details);
      }

      // Show ticket number if available, regardless of email status
      if (result.ticketNumber) {
        const hasEmailWarning = result.warnings && result.warnings.some(w => w.includes('email'));
        const emailFailed = !result.emailSent;
        
        toast.success(
          (t) => (
            <div className="flex flex-col gap-2">
              <div>✓ Bug report submitted!</div>
              <div className="text-sm font-semibold">Ticket #{result.ticketNumber} created</div>
              {emailFailed && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Email notification failed, but ticket was created successfully
                </div>
              )}
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  navigate(createPageUrl('MyTickets'));
                }}
                className="text-sm underline text-blue-600 hover:text-blue-800 mt-1"
              >
                View My Tickets
              </button>
            </div>
          ),
          { duration: 8000 }
        );
      } else {
        // No ticket created - check for warnings
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
      }
      
      console.log('✅ Bug report submitted:', {
        emailSent: result.emailSent,
        notificationCreated: result.notificationCreated,
        ticketCreated: result.ticketCreated,
        ticketNumber: result.ticketNumber,
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
      
      // Check for network errors or size-related errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.', { duration: 6000 });
      } else if (errorMessage.includes('too large') || errorMessage.includes('size')) {
        toast.error(errorMessage, { duration: 8000 });
      } else {
        toast.error(`Failed to send bug report: ${errorMessage}`, { duration: 6000 });
      }
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

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="text-sm font-medium mb-2 block">
                Priority
              </label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
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
                maxLength={10000}
                required
              />
              {description.length > 9000 && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Approaching character limit ({description.length}/10,000)
                </p>
              )}
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

