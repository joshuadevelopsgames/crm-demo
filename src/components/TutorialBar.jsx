import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTutorial } from '../contexts/TutorialContext';
import { Button } from '@/components/ui/button';
import { X, ArrowLeft, BookOpen, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const stepNames = {
  0: 'Welcome',
  1: 'Dashboard',
  2: 'Accounts',
  3: 'Account Detail',
  4: 'Scoring',
  5: 'Interactions',
  6: 'Tasks',
  7: 'Sequences',
  8: 'Contacts',
  9: 'Notifications',
  10: 'Reports',
  11: 'Settings',
  12: 'Google Sheets',
  13: 'Complete'
};

export default function TutorialBar() {
  const location = useLocation();
  const { isTutorialMode, currentStep, exitTutorial, goToTutorialStep } = useTutorial();

  // Don't show bar on tutorial page or login page - check this FIRST
  const isOnTutorialPage = location.pathname === '/tutorial' || location.pathname.startsWith('/tutorial');
  const isOnLoginPage = location.pathname === '/login' || location.pathname.startsWith('/login');
  
  if (isOnTutorialPage || isOnLoginPage) {
    return null;
  }
  
  // Only show if in tutorial mode
  if (!isTutorialMode) return null;

  return (
    <div 
      ref={(el) => {
        if (el) {
          // #region agent log
          const barBg = window.getComputedStyle(el).backgroundColor;
          const barPosition = window.getComputedStyle(el).position;
          const barZIndex = window.getComputedStyle(el).zIndex;
          const barRect = el.getBoundingClientRect();
          // Check if Tutorial page fixed div still exists
          const allFixed = document.querySelectorAll('[style*="position: fixed"]');
          const tutorialFixedDivs = Array.from(allFixed).filter(el => {
            const style = el.getAttribute('style') || '';
            const rect = el.getBoundingClientRect();
            return style.includes('position: fixed') && 
                   style.includes('top: 0') && 
                   style.includes('left: 0') &&
                   rect.width >= window.innerWidth * 0.9 &&
                   rect.height >= window.innerHeight * 0.9;
          });
          const bodyBg = window.getComputedStyle(document.body).backgroundColor;
          const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
          const rootBg = document.getElementById('root') ? window.getComputedStyle(document.getElementById('root')).backgroundColor : 'no root';
          const rootChildren = Array.from(document.getElementById('root')?.children || []).map(c => ({
            tag: c.tagName,
            className: c.className,
            hasFixed: window.getComputedStyle(c).position === 'fixed',
            zIndex: window.getComputedStyle(c).zIndex
          }));
          // Check viewport and what's visible
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;
          // Check if TutorialBar or its parent has full height
          const parent = el.parentElement;
          const parentBg = parent ? window.getComputedStyle(parent).backgroundColor : 'no parent';
          const parentHeight = parent ? window.getComputedStyle(parent).height : 'no parent';
          const parentPosition = parent ? window.getComputedStyle(parent).position : 'no parent';
          // Check root element
          const root = document.getElementById('root');
          const rootComputedBg = root ? window.getComputedStyle(root).backgroundColor : 'no root';
          const rootComputedHeight = root ? window.getComputedStyle(root).height : 'no root';
          // Check what's actually visible in viewport
          const visibleElements = Array.from(document.elementsFromPoint(viewportWidth / 2, viewportHeight / 2)).slice(0, 5).map(el => ({
            tag: el.tagName,
            className: el.className,
            bg: window.getComputedStyle(el).backgroundColor,
            position: window.getComputedStyle(el).position,
            zIndex: window.getComputedStyle(el).zIndex
          }));
          const logData4 = {location:'TutorialBar.jsx:bar-ref',message:'TutorialBar element styles and dimensions',data:{barBg,barPosition,barZIndex,barRect:{top:barRect.top,left:barRect.left,width:barRect.width,height:barRect.height,bottom:barRect.bottom},viewportHeight,viewportWidth,parentBg,parentHeight,parentPosition,rootComputedBg,rootComputedHeight,tutorialFixedDivsCount:tutorialFixedDivs.length,allFixedCount:allFixed.length,bodyBg,htmlBg,rootBg,rootChildren,visibleElements},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:['A','B','E']};
          console.log('🔍 DEBUG TutorialBar:', JSON.stringify(logData4, null, 2));
          fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData4)}).catch(err=>console.error('Log fetch error:',err));
          // #endregion
        }
      }}
      className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg z-[60] sticky top-0"
      style={{ 
        position: 'sticky', 
        top: 0, 
        width: '100%',
        height: 'auto',
        minHeight: '3rem',
        maxHeight: '3rem',
        overflow: 'hidden'
      }}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-12 gap-2">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="font-semibold text-xs sm:text-sm hidden xs:inline">Tutorial</span>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                {currentStep + 1}: {stepNames[currentStep]?.split(' ')[0] || 'Tutorial'}
              </Badge>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-blue-100">
              <Lightbulb className="w-4 h-4" />
              <span>Hover over highlighted elements for tips</span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToTutorialStep(currentStep)}
              className="text-white hover:bg-white/20 h-8 sm:h-9 px-2 sm:px-3"
            >
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={exitTutorial}
              className="text-white hover:bg-white/20 h-8 w-8 sm:h-9 sm:w-9 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

