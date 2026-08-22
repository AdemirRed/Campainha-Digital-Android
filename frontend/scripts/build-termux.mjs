#!/usr/bin/env node

// Build script for Termux - disables PWA plugin to avoid Terser issues

import { execSync } from 'child_process';

console.log('🔨 Building frontend for Termux (PWA plugin disabled)...\n');

// Set environment variable
process.env.DISABLE_PWA = 'true';

try {
  // Run TypeScript compiler
  console.log('📝 Running TypeScript compiler...');
  execSync('tsc', { stdio: 'inherit', env: process.env });
  
  // Run Vite build
  console.log('\n📦 Running Vite build...');
  execSync('vite build', { stdio: 'inherit', env: process.env });
  
  // Run post-build script
  console.log('\n🔧 Running post-build tasks...');
  execSync('node scripts/post-build.mjs', { stdio: 'inherit', env: process.env });
  
  console.log('\n✅ Build completed successfully!');
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
