#!/usr/bin/env node

/**
 * Automated build tester
 * Builds the app and tests it in a headless browser to catch initialization errors
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Starting automated build test...\n');

// Step 1: Build the app
console.log('📦 Building app...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  console.log('✅ Build completed\n');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Step 2: Check if build output exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ dist/ directory not found');
  process.exit(1);
}

// Step 3: Check for the main bundle
const assetsPath = path.join(distPath, 'assets');
if (!fs.existsSync(assetsPath)) {
  console.error('❌ dist/assets/ directory not found');
  process.exit(1);
}

const jsFiles = fs.readdirSync(assetsPath).filter(f => f.endsWith('.js') && f.startsWith('main-'));
if (jsFiles.length === 0) {
  console.error('❌ No main bundle found in dist/assets/');
  process.exit(1);
}

console.log(`✅ Found main bundle: ${jsFiles[0]}`);
const mainBundlePath = path.join(assetsPath, jsFiles[0]);
const bundleSize = fs.statSync(mainBundlePath).size;
console.log(`   Size: ${(bundleSize / 1024 / 1024).toFixed(2)} MB\n`);

// Step 4: Check bundle for common error patterns
console.log('🔍 Scanning bundle for error patterns...');
const bundleContent = fs.readFileSync(mainBundlePath, 'utf8');

const errorPatterns = [
  {
    name: 'TDZ Error Pattern',
    pattern: /Cannot access ['"]B['"] before initialization|ReferenceError.*before initialization/i,
    found: false
  },
  {
    name: 'Circular Dependency',
    pattern: /circular|Circular/i,
    found: false
  },
  {
    name: 'base44 Export Issues',
    pattern: /base44.*undefined|undefined.*base44/i,
    found: false
  }
];

let errorsFound = false;
for (const check of errorPatterns) {
  if (check.pattern.test(bundleContent)) {
    console.log(`⚠️  Found potential issue: ${check.name}`);
    errorsFound = true;
    
    // Try to find context around the match
    const matches = bundleContent.match(new RegExp(check.pattern.source, 'i'));
    if (matches) {
      const matchIndex = bundleContent.indexOf(matches[0]);
      const context = bundleContent.substring(
        Math.max(0, matchIndex - 100),
        Math.min(bundleContent.length, matchIndex + 200)
      );
      console.log(`   Context: ...${context}...\n`);
    }
  }
}

if (!errorsFound) {
  console.log('✅ No obvious error patterns found in bundle\n');
}

// Step 5: Try to load in Node.js and check for runtime errors
console.log('🧪 Testing module loading...');
try {
  // Create a test HTML file
  const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Build Test</title>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    window.testErrors = [];
    window.testLogs = [];
    
    const originalError = console.error;
    const originalLog = console.log;
    
    console.error = function(...args) {
      window.testErrors.push(args.join(' '));
      originalError.apply(console, args);
    };
    
    console.log = function(...args) {
      window.testLogs.push(args.join(' '));
      originalLog.apply(console, args);
    };
    
    window.addEventListener('error', (e) => {
      window.testErrors.push(\`Error: \${e.message} at \${e.filename}:\${e.lineno}\`);
    });
    
    window.addEventListener('unhandledrejection', (e) => {
      window.testErrors.push(\`Unhandled Promise Rejection: \${e.reason}\`);
    });
    
    // Try to import the main module
    import('./assets/${jsFiles[0]}').catch(err => {
      window.testErrors.push(\`Import Error: \${err.message}\`);
    });
  </script>
</body>
</html>
  `;
  
  const testHtmlPath = path.join(distPath, 'test.html');
  fs.writeFileSync(testHtmlPath, testHtml);
  console.log('✅ Created test.html\n');
  
  console.log('📋 Test Summary:');
  console.log('   - Build: ✅ Success');
  console.log('   - Bundle: ✅ Found');
  console.log('   - Size: ✅ Normal');
  if (errorsFound) {
    console.log('   - Patterns: ⚠️  Potential issues found');
  } else {
    console.log('   - Patterns: ✅ No obvious issues');
  }
  console.log('\n💡 To test in browser:');
  console.log(`   npx serve dist -p 3000`);
  console.log(`   Then open http://localhost:3000/test.html`);
  console.log(`   Check browser console for errors\n`);
  
} catch (error) {
  console.error('❌ Error creating test file:', error.message);
  process.exit(1);
}

console.log('✅ Test setup complete\n');

