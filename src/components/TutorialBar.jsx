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
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg z-[60] sticky top-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              <span className="font-semibold">Tutorial Mode</span>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                Step {currentStep + 1}: {stepNames[currentStep] || 'Tutorial'}
              </Badge>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-blue-100">
              <Lightbulb className="w-4 h-4" />
              <span>Hover over highlighted elements for tips</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToTutorialStep(currentStep)}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Back to Tutorial</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={exitTutorial}
              className="text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

