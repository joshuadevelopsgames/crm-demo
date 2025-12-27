import React, { useState, useRef, useEffect } from 'react';
import { useTutorial } from '../contexts/TutorialContext';
import { Card, CardContent } from '@/components/ui/card';
import { Info } from 'lucide-react';

export default function TutorialTooltip({ 
  children, 
  tip, 
  step, 
  position = 'bottom',
  className = '' 
}) {
  const { isTutorialMode, currentStep, highlightedElement, setHighlightedElement } = useTutorial();
  const [showTooltip, setShowTooltip] = useState(false);
  const wrapperRef = useRef(null);
  const timeoutRef = useRef(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Only show tooltip if in tutorial mode and on the relevant step
  if (!isTutorialMode || (step !== undefined && currentStep !== step)) {
    return children;
  }

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (isTutorialMode) {
      setShowTooltip(true);
      setHighlightedElement(step);
    }
  };

  const handleMouseLeave = (e) => {
    // Check if we're moving to the tooltip itself
    const relatedTarget = e.relatedTarget;
    if (wrapperRef.current && wrapperRef.current.contains(relatedTarget)) {
      return; // Don't hide if moving to tooltip
    }
    
    // Add a small delay to prevent flickering
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
      setHighlightedElement(null);
    }, 100);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  };

  return (
    <div 
      ref={wrapperRef}
      className={`relative ${className} ${highlightedElement === step ? 'ring-2 ring-blue-500 ring-offset-2 rounded' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {showTooltip && tip && (
        <div 
          className={`absolute z-50 ${positionClasses[position]}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Card className="bg-blue-600 text-white border-blue-500 shadow-xl max-w-md">
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p className="text-sm leading-relaxed">{tip}</p>
              </div>
              {position === 'top' && (
                <div className="absolute w-0 h-0 border-4 border-transparent border-t-blue-600 top-full left-1/2 transform -translate-x-1/2" />
              )}
              {position === 'bottom' && (
                <div className="absolute w-0 h-0 border-4 border-transparent border-b-blue-600 bottom-full left-1/2 transform -translate-x-1/2" />
              )}
              {position === 'left' && (
                <div className="absolute w-0 h-0 border-4 border-transparent border-l-blue-600 left-full top-1/2 transform -translate-y-1/2" />
              )}
              {position === 'right' && (
                <div className="absolute w-0 h-0 border-4 border-transparent border-r-blue-600 right-full top-1/2 transform -translate-y-1/2" />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

