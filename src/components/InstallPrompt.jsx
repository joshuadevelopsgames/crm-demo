import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                      window.navigator.standalone ||
                      document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // If already installed, don't show prompt
    if (standalone) {
      return;
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show prompt after a delay (don't be too aggressive)
      const hasSeenPrompt = localStorage.getItem('pwa-install-prompt-seen');
      const lastShown = localStorage.getItem('pwa-install-prompt-time');
      const now = Date.now();
      
      // Show if not seen before, or if last shown more than 7 days ago
      if (!hasSeenPrompt || (lastShown && (now - parseInt(lastShown)) > 7 * 24 * 60 * 60 * 1000)) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    // Check if iOS and not installed - show custom prompt after delay
    if (iOS && !standalone) {
      const hasSeenPrompt = localStorage.getItem('pwa-install-prompt-seen');
      const lastShown = localStorage.getItem('pwa-install-prompt-time');
      const now = Date.now();
      
      if (!hasSeenPrompt || (lastShown && (now - parseInt(lastShown)) > 7 * 24 * 60 * 60 * 1000)) {
        setTimeout(() => setShowPrompt(true), 5000);
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    // Hide prompt
    setShowPrompt(false);
    localStorage.setItem('pwa-install-prompt-seen', 'true');
    localStorage.setItem('pwa-install-prompt-time', Date.now().toString());

    if (deferredPrompt) {
      // Show the install prompt (Android/Chrome)
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-prompt-seen', 'true');
    localStorage.setItem('pwa-install-prompt-time', Date.now().toString());
  };

  if (!showPrompt || isStandalone) {
    return null;
  }

  // Detect mobile device
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        onClick={handleDismiss}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}
      />
      
      <div
        style={{
          position: 'fixed',
          bottom: isMobile ? `max(20px, env(safe-area-inset-bottom, 20px))` : '20px',
          left: isMobile ? '16px' : '20px',
          right: isMobile ? '16px' : '20px',
          maxWidth: isMobile ? '100%' : '400px',
          maxHeight: isMobile ? `calc(100vh - max(40px, env(safe-area-inset-top, 40px)) - max(40px, env(safe-area-inset-bottom, 40px)))` : 'auto',
          margin: '0 auto',
          backgroundColor: 'white',
          borderRadius: isMobile ? '16px 16px 0 0' : '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          padding: isMobile ? '24px 20px max(24px, env(safe-area-inset-bottom, 24px))' : '20px',
          zIndex: 10000,
          border: '1px solid #e2e8f0',
          animation: 'slideUp 0.3s ease-out',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}
      >
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
      
      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        aria-label="Dismiss"
      >
        <X size={20} style={{ color: '#64748b' }} />
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '20px' }}>LE</span>
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            fontSize: isMobile ? '20px' : '18px', 
            fontWeight: '600', 
            color: '#0f172a',
            paddingRight: '32px'
          }}>
            Install LECRM
          </h3>
          {isIOS ? (
            <div>
              <p style={{ 
                margin: '0 0 16px 0', 
                fontSize: isMobile ? '15px' : '14px', 
                color: '#64748b', 
                lineHeight: '1.6' 
              }}>
                Install LECRM to your home screen for quick access:
              </p>
              <ol style={{ 
                margin: '0 0 16px 0', 
                paddingLeft: '24px', 
                fontSize: isMobile ? '15px' : '14px', 
                color: '#64748b', 
                lineHeight: '2',
                listStyleType: 'decimal'
              }}>
                <li style={{ marginBottom: '8px' }}>
                  Tap the <strong style={{ color: '#0f172a' }}>Share</strong> button 
                  <span style={{ fontSize: '18px', marginLeft: '4px' }}>⎋</span>
                </li>
                <li style={{ marginBottom: '8px' }}>
                  Scroll down and tap <strong style={{ color: '#0f172a' }}>"Add to Home Screen"</strong>
                </li>
                <li>
                  Tap <strong style={{ color: '#0f172a' }}>"Add"</strong> to confirm
                </li>
              </ol>
            </div>
          ) : (
            <p style={{ 
              margin: '0 0 16px 0', 
              fontSize: isMobile ? '15px' : '14px', 
              color: '#64748b', 
              lineHeight: '1.6' 
            }}>
              Install LECRM for a faster, app-like experience with offline access.
            </p>
          )}
          
          {!isIOS && (
            <button
              onClick={handleInstallClick}
              style={{
                width: '100%',
                padding: isMobile ? '14px 16px' : '12px 16px',
                backgroundColor: '#0f172a',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: isMobile ? '15px' : '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '44px',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation'
              }}
            >
              <Download size={18} />
              Install App
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

