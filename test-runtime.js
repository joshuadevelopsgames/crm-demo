#!/usr/bin/env node

/**
 * Runtime tester using Puppeteer
 * Actually loads the app in a headless browser and checks for errors
 */

const puppeteer = require('puppeteer');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');

const PORT = 3001;
const DIST_PATH = path.join(__dirname, 'dist');

async function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let filePath = path.join(DIST_PATH, req.url === '/' ? 'index.html' : req.url);
      
      // Security: prevent directory traversal
      filePath = path.normalize(filePath);
      if (!filePath.startsWith(DIST_PATH)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        
        const ext = path.extname(filePath);
        const contentType = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.svg': 'image/svg+xml'
        }[ext] || 'application/octet-stream';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });
    
    server.listen(PORT, () => {
      console.log(`✅ Test server started on http://localhost:${PORT}`);
      resolve(server);
    });
    
    server.on('error', reject);
  });
}

async function testApp() {
  console.log('🧪 Starting runtime test...\n');
  
  // Check if dist exists
  if (!fs.existsSync(DIST_PATH)) {
    console.error('❌ dist/ directory not found. Run "npm run build" first.');
    process.exit(1);
  }
  
  // Start server
  const server = await startServer();
  
  let browser;
  try {
    // Launch browser
    console.log('🌐 Launching headless browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Collect console messages and errors
    const logs = [];
    const errors = [];
    const warnings = [];
    
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      if (type === 'error') {
        errors.push(text);
      } else if (type === 'warning') {
        warnings.push(text);
      } else {
        logs.push(`[${type}] ${text}`);
      }
    });
    
    page.on('pageerror', error => {
      errors.push(`Page Error: ${error.message}`);
    });
    
    page.on('requestfailed', request => {
      errors.push(`Request Failed: ${request.url()} - ${request.failure().errorText}`);
    });
    
    // Navigate to app
    console.log('📱 Loading app...');
    await page.goto(`http://localhost:${PORT}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Wait a bit for initialization
    await page.waitForTimeout(2000);
    
    // Check for specific error
    const pageContent = await page.content();
    const hasTdzError = errors.some(e => 
      e.includes('Cannot access') && 
      (e.includes('before initialization') || e.includes('B'))
    );
    
    // Check for base44Client logs
    const hasBase44Logs = logs.some(l => l.includes('[base44Client]'));
    
    // Print results
    console.log('\n📊 Test Results:');
    console.log('─'.repeat(50));
    
    if (hasTdzError) {
      console.log('❌ TDZ ERROR DETECTED!');
      console.log('\nError details:');
      errors.filter(e => e.includes('Cannot access') || e.includes('before initialization')).forEach(e => {
        console.log(`   ${e}`);
      });
    } else {
      console.log('✅ No TDZ errors detected');
    }
    
    if (hasBase44Logs) {
      console.log('\n✅ base44Client logs found:');
      logs.filter(l => l.includes('[base44Client]')).slice(0, 5).forEach(l => {
        console.log(`   ${l}`);
      });
    } else {
      console.log('\n⚠️  No base44Client logs found (module may not have loaded)');
    }
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Total errors: ${errors.length}`);
      errors.slice(0, 10).forEach(e => {
        console.log(`   ${e.substring(0, 100)}${e.length > 100 ? '...' : ''}`);
      });
    } else {
      console.log('\n✅ No errors detected');
    }
    
    if (warnings.length > 0) {
      console.log(`\n⚠️  Warnings: ${warnings.length}`);
    }
    
    console.log('─'.repeat(50));
    
    // Return success/failure
    return !hasTdzError;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

// Run test
testApp().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

