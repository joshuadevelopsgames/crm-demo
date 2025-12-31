#!/usr/bin/env node

/**
 * Extract key values from Salesperson Performance PDF
 */

import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
// pdf-parse exports the function directly when required
const pdf = pdfParse.default || pdfParse.PDFParse || pdfParse;

const pdfPath = '/Users/joshua/Downloads/Salesperson Performance.pdf';

async function extractValues() {
  try {
    console.log('📄 Reading PDF...\n');
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    
    console.log('📊 PDF Content:\n');
    console.log(data.text);
    
    // Try to extract key numbers
    const text = data.text;
    
    // Look for "Estimates Sold" count
    const countMatch = text.match(/Estimates Sold[:\s]+(\d{1,4})/i);
    if (countMatch) {
      console.log(`\n✅ Estimates Sold Count: ${countMatch[1]}`);
    }
    
    // Look for dollar amounts
    const dollarMatches = text.match(/\$[\d,]+\.?\d*/g);
    if (dollarMatches) {
      console.log(`\n💰 Dollar amounts found:`);
      dollarMatches.forEach((match, idx) => {
        const value = parseFloat(match.replace(/[$,]/g, ''));
        if (value > 1000000) { // Only show values over $1M
          console.log(`   ${match} (${value.toLocaleString()})`);
        }
      });
    }
    
    // Look for "$ of Estimates Sold"
    const soldDollarMatch = text.match(/\$\s*of\s*Estimates\s*Sold[:\s]+\$?([\d,]+\.?\d*)/i);
    if (soldDollarMatch) {
      const value = parseFloat(soldDollarMatch[1].replace(/,/g, ''));
      console.log(`\n✅ $ of Estimates Sold: $${value.toLocaleString()}`);
    }
    
  } catch (error) {
    console.error('❌ Error reading PDF:', error.message);
    console.error('\nPlease provide the following values manually:');
    console.error('1. "Estimates Sold" count');
    console.error('2. "$ of Estimates Sold" dollar amount');
  }
}

extractValues();

