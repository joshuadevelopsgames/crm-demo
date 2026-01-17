/**
 * Generate favicon and app icons from atom symbol SVG
 * Requires: npm install sharp
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Atom symbol SVG template
const atomSVG = `
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .nucleus { fill: #0f172a; }
      .orbit { stroke: #0f172a; stroke-width: 2; fill: none; opacity: 0.8; }
      .electron { fill: #0f172a; }
    </style>
  </defs>
  <!-- Background circle for better visibility -->
  <circle cx="50" cy="50" r="48" fill="#ffffff" />
  
  <!-- Atom nucleus (center circle) -->
  <circle class="nucleus" cx="50" cy="50" r="8" />
  
  <!-- Electron orbits (3 elliptical paths) -->
  <!-- Orbit 1 - Horizontal -->
  <ellipse class="orbit" cx="50" cy="50" rx="36" ry="20" />
  <!-- Electron on orbit 1 -->
  <circle class="electron" cx="86" cy="50" r="4" />
  
  <!-- Orbit 2 - Rotated 60 degrees -->
  <ellipse class="orbit" cx="50" cy="50" rx="36" ry="20" transform="rotate(60 50 50)" />
  <!-- Electron on orbit 2 -->
  <circle class="electron" cx="70" cy="30" r="4" />
  
  <!-- Orbit 3 - Rotated 120 degrees -->
  <ellipse class="orbit" cx="50" cy="50" rx="36" ry="20" transform="rotate(120 50 50)" />
  <!-- Electron on orbit 3 -->
  <circle class="electron" cx="30" cy="70" r="4" />
</svg>
`;

// Dark mode version
const atomSVGDark = `
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .nucleus { fill: #f1f5f9; }
      .orbit { stroke: #f1f5f9; stroke-width: 2; fill: none; opacity: 0.8; }
      .electron { fill: #f1f5f9; }
    </style>
  </defs>
  <!-- Background circle for better visibility -->
  <circle cx="50" cy="50" r="48" fill="#0f172a" />
  
  <!-- Atom nucleus (center circle) -->
  <circle class="nucleus" cx="50" cy="50" r="8" />
  
  <!-- Electron orbits (3 elliptical paths) -->
  <!-- Orbit 1 - Horizontal -->
  <ellipse class="orbit" cx="50" cy="50" rx="36" ry="20" />
  <!-- Electron on orbit 1 -->
  <circle class="electron" cx="86" cy="50" r="4" />
  
  <!-- Orbit 2 - Rotated 60 degrees -->
  <ellipse class="orbit" cx="50" cy="50" rx="36" ry="20" transform="rotate(60 50 50)" />
  <!-- Electron on orbit 2 -->
  <circle class="electron" cx="70" cy="30" r="4" />
  
  <!-- Orbit 3 - Rotated 120 degrees -->
  <ellipse class="orbit" cx="50" cy="50" rx="36" ry="20" transform="rotate(120 50 50)" />
  <!-- Electron on orbit 3 -->
  <circle class="electron" cx="30" cy="70" r="4" />
</svg>
`;

const publicDir = path.join(__dirname, '..', 'public');

async function generateIcons() {
  try {
    // Generate favicon.ico (16x16, 32x32)
    console.log('Generating favicon.ico...');
    await sharp(Buffer.from(atomSVG))
      .resize(32, 32)
      .png()
      .toFile(path.join(publicDir, 'favicon-32x32.png'));
    
    // Generate favicon-192x192.png
    console.log('Generating favicon-192x192.png...');
    await sharp(Buffer.from(atomSVG))
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'favicon-192x192.png'));
    
    // Generate app-icon-192.png
    console.log('Generating app-icon-192.png...');
    await sharp(Buffer.from(atomSVG))
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'app-icon-192.png'));
    
    // Generate app-icon-512.png
    console.log('Generating app-icon-512.png...');
    await sharp(Buffer.from(atomSVG))
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'app-icon-512.png'));
    
    // Generate app-icon-1024.png
    console.log('Generating app-icon-1024.png...');
    await sharp(Buffer.from(atomSVG))
      .resize(1024, 1024)
      .png()
      .toFile(path.join(publicDir, 'app-icon-1024.png'));
    
    // Generate apple-touch-icon.png (180x180)
    console.log('Generating apple-touch-icon.png...');
    await sharp(Buffer.from(atomSVG))
      .resize(180, 180)
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    
    // Generate favicon.ico (32x32 PNG - browsers accept PNG as favicon)
    console.log('Generating favicon.ico (as PNG)...');
    await sharp(Buffer.from(atomSVG))
      .resize(32, 32)
      .png()
      .toFile(path.join(publicDir, 'favicon.ico'));
    
    console.log('✅ All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    if (error.message.includes('sharp')) {
      console.error('💡 Install sharp: npm install sharp');
    }
    throw error;
  }
}

generateIcons();
