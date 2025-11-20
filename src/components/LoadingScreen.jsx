import React from 'react';

export default function LoadingScreen() {
  return (
    <div 
      className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3">
        <div className="relative">
          <img 
            src="/logo.png" 
            alt="LECRM Logo" 
            className="h-16 w-auto transition-transform"
            onError={(e) => {
              // Fallback if logo doesn't load
              e.target.style.display = 'none';
            }}
          />
        </div>
        <span className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
          LECRM
        </span>
      </div>

      {/* Loading Spinner */}
      <div className="relative">
        <div className="w-12 h-12 border-4 border-slate-200 rounded-full"></div>
        <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
      </div>

      {/* Loading Text */}
      <p className="mt-6 text-slate-600 text-sm font-medium">Loading...</p>
    </div>
  );
}


