#!/usr/bin/env node

// Post-build script for Termux
// Copies simple service worker when PWA plugin is disabled

import { copyFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isPWADisabled = process.env.DISABLE_PWA === 'true' || process.env.TERMUX_VERSION;

if (isPWADisabled) {
  console.log('📦 PWA plugin disabled - copying simple service worker...');
  
  const distDir = join(__dirname, '..', 'dist');
  const publicDir = join(__dirname, '..', 'public');
  
  // Copy simple service worker
  const swSource = join(publicDir, 'sw-simple.js');
  const swDest = join(distDir, 'sw.js');
  
  if (existsSync(swSource)) {
    copyFileSync(swSource, swDest);
    console.log('✓ Service worker copied to dist/sw.js');
  }
  
  // Create simple manifest
  const manifest = {
    name: 'Campainha Digital Inteligente',
    short_name: 'Campainha',
    description: 'Sistema de campainha inteligente',
    theme_color: '#1e293b',
    background_color: '#0f172a',
    display: 'fullscreen',
    orientation: 'portrait',
    start_url: '/',
    icons: []
  };
  
  const manifestPath = join(distDir, 'manifest.webmanifest');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✓ Manifest created');
  
  // Create SW registration script
  const registerSW = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg))
      .catch(err => console.log('SW registration failed:', err));
  });
}
`;
  
  const registerPath = join(distDir, 'registerSW.js');
  writeFileSync(registerPath, registerSW.trim());
  console.log('✓ SW registration script created');
}
