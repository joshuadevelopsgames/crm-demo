import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, PlayCircle, Loader2 } from 'lucide-react';

/**
 * ScribeEmbed Component
 * 
 * Displays Scribe guides created with the Scribe Chrome extension.
 * 
 * Usage:
 * 1. Create a guide using Scribe Chrome extension
 * 2. Get the embed URL or share link from Scribe
 * 3. Pass it to this component via the `scribeUrl` prop
 * 
 * Props:
 * @param {string} scribeUrl - The Scribe guide URL or embed URL
 * @param {string} title - Optional title for the embed
 * @param {string} description - Optional description
 * @param {string} height - Optional height for the iframe (default: '600px')
 */
export default function ScribeEmbed({ 
  scribeUrl, 
  title = 'Interactive Guide',
  description,
  height = '600px'
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);


  // Set a timeout to hide loading state if onLoad doesn't fire
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // Hide loading after 2 seconds

    return () => clearTimeout(timer);
  }, [scribeUrl]); // Re-run when URL changes

  if (!scribeUrl) {
    console.warn('ScribeEmbed: No scribeUrl provided');
    return (
      <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/30">
        <CardContent className="p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            No Scribe URL provided. Please add a Scribe guide URL to display the interactive tutorial.
          </p>
        </CardContent>
      </Card>
    );
  }

  console.log('ScribeEmbed: Rendering with URL:', scribeUrl);

  // Extract embed URL from Scribe share link if needed
  // Scribe URLs typically look like: https://scribehow.com/shared/... or https://scribehow.com/embed/...
  const getEmbedUrl = (url) => {
    // If it's already an embed URL, return as is
    if (url.includes('/embed/')) {
      return url;
    }
    
    // If it's a share URL, convert to embed URL
    if (url.includes('/shared/')) {
      return url.replace('/shared/', '/embed/');
    }
    
    // If it's a regular Scribe URL, try to convert
    if (url.includes('scribehow.com')) {
      // Extract the guide ID and create embed URL
      const match = url.match(/scribehow\.com\/(?:shared\/)?([^/?]+)/);
      if (match && match[1]) {
        return `https://scribehow.com/embed/${match[1]}`;
      }
    }
    
    // Return original URL if we can't determine format
    return url;
  };

  const embedUrl = getEmbedUrl(scribeUrl);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleOpenInNewTab = () => {
    window.open(scribeUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="w-full">
      <CardContent className="p-0">
        {(title || description) && (
          <div className="p-4 border-b">
            {title && (
              <h3 className="font-semibold text-lg mb-1">{title}</h3>
            )}
            {description && (
              <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
            )}
          </div>
        )}
        
        <div className="relative" style={{ minHeight: height }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900 z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                <p className="text-sm text-slate-600 dark:text-slate-400">Loading guide...</p>
              </div>
            </div>
          )}
          
          {hasError ? (
            <div className="p-8 text-center">
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                Failed to load Scribe guide. Please check the URL or try opening it in a new tab.
              </p>
              <Button 
                variant="outline" 
                onClick={handleOpenInNewTab}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </Button>
            </div>
          ) : (
            <>
              <iframe
                src={embedUrl}
                className="w-full border-0"
                style={{ 
                  height: height,
                  minHeight: '400px',
                  display: 'block',
                  width: '100%'
                }}
                title={title}
                allow="clipboard-read; clipboard-write; fullscreen"
                onLoad={handleLoad}
                onError={handleError}
              />
              <div className="p-2 border-t bg-slate-50 dark:bg-slate-900 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenInNewTab}
                  className="gap-2 text-xs"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open Full Guide
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

