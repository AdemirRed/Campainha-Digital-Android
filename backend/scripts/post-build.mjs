#!/usr/bin/env node

// Post-build script - Copy sql.js WASM file to dist

import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const workspaceRoot = join(projectRoot, '..');
const sourceWasm = join(workspaceRoot, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const destDir = join(projectRoot, 'dist', 'wasm');
const destWasm = join(destDir, 'sql-wasm.wasm');

console.log('📦 Post-build tasks...');

// 1. Copy sql.js WASM file
console.log('\n📦 Copying sql.js WASM file...');

if (!existsSync(sourceWasm)) {
  console.error('❌ WASM file not found:', sourceWasm);
  process.exit(1);
}

// Create destination directory
if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}

// Copy WASM file
copyFileSync(sourceWasm, destWasm);
console.log('✓ WASM file copied to:', destWasm);

// 2. Copy JavaScript helper files (path-resolver.js, bootstrap.js)
console.log('\n📦 Copying runtime helper files...');

const srcDir = join(projectRoot, 'src');
const buildDir = join(projectRoot, 'dist', 'backend', 'src');

const helperFiles = ['path-resolver.js', 'bootstrap.js'];

helperFiles.forEach(file => {
  const src = join(srcDir, file);
  const dest = join(buildDir, file);
  
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`✓ Copied ${file}`);
  } else {
    console.warn(`⚠️  ${file} not found, skipping`);
  }
});

console.log('\n✅ Post-build completed!');
