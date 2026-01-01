#!/usr/bin/env node

/**
 * Continuous test loop
 * Keeps building and testing until the error is fixed
 */

const { execSync } = require('child_process');
const fs = require('fs');

const MAX_ATTEMPTS = 10;
let attempt = 0;

async function runTest() {
  attempt++;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Attempt ${attempt}/${MAX_ATTEMPTS}`);
  console.log(`=${'='.repeat(60)}\n`);
  
  try {
    // Build
    console.log('📦 Building...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Run build test
    console.log('\n🔍 Running build test...');
    execSync('node test-build.js', { stdio: 'inherit' });
    
    // Run runtime test
    console.log('\n🧪 Running runtime test...');
    try {
      execSync('node test-runtime.js', { stdio: 'inherit' });
      console.log('\n✅ All tests passed! No TDZ error detected.');
      return true;
    } catch (error) {
      if (error.status === 1) {
        console.log('\n❌ TDZ error still present. Trying next fix...');
        return false;
      }
      throw error;
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting continuous test loop');
  console.log('This will keep testing until the TDZ error is fixed\n');
  
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const success = await runTest();
    if (success) {
      console.log(`\n🎉 Success! Fixed on attempt ${attempt}`);
      process.exit(0);
    }
    
    if (i < MAX_ATTEMPTS - 1) {
      console.log('\n⏳ Waiting 2 seconds before next attempt...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`\n❌ Failed to fix after ${MAX_ATTEMPTS} attempts`);
  process.exit(1);
}

main();

