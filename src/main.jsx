import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize mock API service if demo mode is enabled
import './api/mockApiService';

// Hide the initial loading screen once React is ready
const hideLoadingScreen = () => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen && loadingScreen.style) {
    console.log('Hiding loading screen...');
    loadingScreen.style.opacity = '0';
    loadingScreen.style.transition = 'opacity 0.3s ease-out';
    loadingScreen.style.pointerEvents = 'none';
    setTimeout(() => {
      if (loadingScreen && loadingScreen.style) {
        loadingScreen.style.display = 'none';
        loadingScreen.remove();
        console.log('Loading screen removed');
      }
      
      // Ensure root is visible
      const root = document.getElementById('root');
      if (root && root.style) {
        root.style.display = 'block';
        root.style.visibility = 'visible';
        root.style.opacity = '1';
        root.style.zIndex = '1';
        root.style.position = 'relative';
        console.log('Root element made visible');
      }
    }, 300);
  }
};

// Initialize Capacitor (only when running in native app, not web)
import { Capacitor } from '@capacitor/core';
if (Capacitor.isNativePlatform()) {
  import('@capacitor/status-bar').then(({ StatusBar }) => {
    StatusBar.setStyle({ style: 'light' }); // Light content (dark text) on white background
    StatusBar.setBackgroundColor({ color: '#ffffff' });
    StatusBar.setOverlaysWebView({ overlay: true }); // Allow content to go under status bar
  });
  
  import('@capacitor/keyboard').then(({ Keyboard }) => {
    Keyboard.setAccessoryBarVisible({ isVisible: true });
  });
}

// Render the app with error boundary
console.log('🚀 Starting React initialization...');
console.log('React version:', React.version);
console.log('ReactDOM available:', typeof ReactDOM !== 'undefined');

try {
  const rootElement = document.getElementById('root');
  console.log('Root element:', rootElement);
  
  if (!rootElement) {
    console.error('❌ Root element not found!');
    // Show error on loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.innerHTML = '<div style="text-align: center; color: red;"><p>Error: Root element not found</p></div>';
    }
  } else {
    console.log('✅ Root element found, creating React root...');
    const root = ReactDOM.createRoot(rootElement);
    console.log('✅ React root created, rendering App...');
    
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('✅ React app rendered successfully');
  }
} catch (error) {
  console.error('❌ Error rendering React app:', error);
  console.error('Error stack:', error.stack);
  // Show error on loading screen
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.innerHTML = `<div style="text-align: center; color: red; padding: 2rem;"><p style="font-weight: 600;">Error loading app</p><p style="margin-top: 0.5rem; font-size: 0.875rem;">${error.message}</p><details style="margin-top: 1rem; text-align: left;"><summary style="cursor: pointer; color: #64748b;">Stack trace</summary><pre style="margin-top: 0.5rem; font-size: 0.75rem; color: #64748b; overflow: auto;">${error.stack}</pre></details></div>`;
  }
}

// Ensure loading screen stays visible until React is ready
const ensureLoadingScreenVisible = () => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen && loadingScreen.style) {
    loadingScreen.style.display = 'flex';
    loadingScreen.style.opacity = '1';
    loadingScreen.style.visibility = 'visible';
  }
};

// Keep loading screen visible
ensureLoadingScreenVisible();

// Hide loading screen once React has mounted and rendered
// Use multiple checks to ensure smooth transition
let checkCount = 0;
const maxChecks = 300; // Check for up to 15 seconds (300 * 50ms)

const checkAndHide = () => {
  checkCount++;
  const root = document.getElementById('root');
  const loadingScreen = document.getElementById('loading-screen');
  
  // Always ensure loading screen stays visible until we're sure
  ensureLoadingScreenVisible();
  
    // Check if React has fully rendered with visible content
    if (root && root.children.length > 0) {
      // Check multiple ways to detect if app is ready
      const hasNav = root.querySelector('nav');
      const hasMain = root.querySelector('main');
      const hasLayout = root.querySelector('[class*="Layout"]');
      const hasDashboard = root.querySelector('[class*="Dashboard"]');
      const hasLogin = root.querySelector('[class*="Login"]') || root.textContent.includes('CRM') || root.textContent.includes('Sign in');
      const hasTutorialBar = root.querySelector('[class*="Tutorial"]');
      const hasCard = root.querySelector('[class*="Card"]');
      const hasButton = root.querySelector('button');
      const hasForm = root.querySelector('form');
    
    // Also check if content has actual height/width (is visible)
    const firstChild = root.children[0];
    const computedStyle = firstChild ? window.getComputedStyle(firstChild) : null;
    const hasVisibleContent = firstChild && (
      firstChild.offsetHeight > 50 || // At least 50px tall
      firstChild.offsetWidth > 50 ||  // At least 50px wide
      (computedStyle && computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden')
    );
    
    // Check if React Router has initialized (look for Router wrapper)
    const hasRouterContent = root.innerHTML.includes('Router') || 
                            root.querySelector('[data-reactroot]') ||
                            root.querySelector('div > div'); // Nested divs suggest React Router structure
    
    const hasRealContent = hasNav || hasMain || hasLayout || hasDashboard || hasLogin || hasTutorialBar || hasCard || hasButton || hasForm || root.textContent.includes('CRM') || root.textContent.includes('Sign in');
    
    console.log('Check', checkCount, {
      hasNav: !!hasNav,
      hasMain: !!hasMain,
      hasLayout: !!hasLayout,
      hasDashboard: !!hasDashboard,
      hasLogin: !!hasLogin,
      hasRealContent,
      hasVisibleContent,
      rootChildren: root.children.length,
      rootHTML: root.innerHTML.substring(0, 200) // First 200 chars for debugging
    });
    
    // If we have any real content AND it's visible, hide loading screen
    if (hasRealContent && hasVisibleContent) {
      // App has fully rendered and is visible, wait a moment then hide
      console.log('✅ App content detected and visible, hiding loading screen');
      
      // Make sure root is visible immediately
      if (root && root.style) {
        root.style.display = 'block';
        root.style.visibility = 'visible';
        root.style.opacity = '1';
        root.style.zIndex = '10';
        root.style.position = 'relative';
      }
      
      setTimeout(() => {
        hideLoadingScreen();
      }, 500); // Shorter delay
      return;
    }
    
    // Also check if we're on login page - force hide after a few checks
    if (window.location.pathname === '/login' && checkCount > 10) {
      console.log('✅ Login page detected, forcing loading screen to hide');
      if (root && root.style) {
        root.style.display = 'block';
        root.style.visibility = 'visible';
        root.style.opacity = '1';
        root.style.zIndex = '10';
      }
      setTimeout(() => {
        hideLoadingScreen();
      }, 200);
      return;
    }
    
    // If we have router content but no specific elements yet, keep waiting
    if (hasRouterContent && checkCount > 20) {
      // Router is initialized but content might still be loading
      console.log('Router detected but waiting for content...');
    }
  } else {
    console.log('Check', checkCount, '- Root:', root ? 'exists' : 'missing', '- Children:', root ? root.children.length : 0);
  }
  
  // Keep checking if we haven't exceeded max checks
  if (checkCount < maxChecks) {
    setTimeout(checkAndHide, 100); // Check every 100ms
  } else {
    // After max checks, force check one more time
    console.log('Max checks reached, forcing final check');
    const root = document.getElementById('root');
    if (root && root.children.length > 0) {
      // Even if content detection failed, if root has children, hide loading screen
      // The app might be rendering but our detection missed it
      console.log('Root has children after max checks, hiding loading screen anyway');
      console.log('Root content preview:', root.innerHTML.substring(0, 500));
      
      // Make sure root is visible
      root.style.display = 'block';
      root.style.visibility = 'visible';
      root.style.opacity = '1';
      root.style.zIndex = '1';
      
      setTimeout(() => {
        hideLoadingScreen();
      }, 500);
    } else {
      // Still no content - keep loading screen visible and show error
      console.error('❌ No app content detected after max checks!');
      console.error('Root element:', root);
      console.error('Root children:', root ? root.children.length : 'N/A');
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.innerHTML = '<div style="text-align: center; padding: 2rem;"><p style="color: #ef4444; font-weight: 600;">App failed to load</p><p style="color: #64748b; margin-top: 0.5rem; font-size: 0.875rem;">Please check the Xcode console for errors</p><p style="color: #64748b; margin-top: 0.5rem; font-size: 0.75rem;">Check count: ' + checkCount + '</p></div>';
      }
    }
  }
};

// Start checking after React has had time to initialize
setTimeout(checkAndHide, 1000);


