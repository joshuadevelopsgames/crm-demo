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
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: isMobile ? 'calc(100% - 32px)' : '360px',
          maxWidth: '360px',
          maxHeight: 'calc(100vh - 64px)',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
          padding: '20px',
          zIndex: 10000,
          border: '1px solid #e2e8f0',
          animation: 'popIn 0.3s ease-out',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
      <style>{`
        @keyframes popIn {
          from {
            transform: translate(-50%, -50%) scale(0.9);
            opacity: 0;
          }
          to {
            transform: translate(-50%, -50%) scale(1);
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
      
      <div style={{ position: 'relative' }}>
        <button
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: '-8px',
            right: '-8px',
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '50%',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            width: '32px',
            height: '32px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
          aria-label="Dismiss"
        >
          <X size={16} style={{ color: '#64748b' }} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '24px' }}>LE</span>
          </div>
          
          <div style={{ width: '100%' }}>
            <h3 style={{ 
              margin: '0 0 8px 0', 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#0f172a'
            }}>
              Install LECRM
            </h3>
            {isIOS ? (
              <div style={{ textAlign: 'left' }}>
                <p style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '13px', 
                  color: '#64748b', 
                  lineHeight: '1.4' 
                }}>
                  Add to your home screen:
                </p>
                <ol style={{ 
                  margin: '0 0 0 0', 
                  paddingLeft: '18px', 
                  fontSize: '13px', 
                  color: '#64748b', 
                  lineHeight: '1.5',
                  listStyleType: 'decimal'
                }}>
                  <li style={{ marginBottom: '4px' }}>
                    Tap <strong style={{ color: '#0f172a' }}>Share</strong>
                  </li>
                  <li style={{ marginBottom: '4px' }}>
                    Select <strong style={{ color: '#0f172a' }}>"Add to Home Screen"</strong>
                  </li>
                  <li>
                    Tap <strong style={{ color: '#0f172a' }}>"Add"</strong>
                  </li>
                </ol>
              </div>
            ) : (
              <p style={{ 
                margin: '0 0 16px 0', 
                fontSize: '13px', 
                color: '#64748b', 
                lineHeight: '1.5' 
              }}>
                Get a faster, app-like experience with offline access.
              </p>
            )}
            
            {!isIOS && (
              <button
                onClick={handleInstallClick}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#0f172a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
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
                <Download size={16} />
                Install App
              </button>
            )}
          </div>
        </div>
    </div>
    </>
  );
}

