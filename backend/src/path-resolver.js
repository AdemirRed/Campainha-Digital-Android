// Runtime path resolver for @shared imports
// This must be imported before any other modules

const path = require('path');
const Module = require('module');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain) {
  // Replace @shared/* with correct path
  if (request.startsWith('@shared/')) {
    const relativePath = request.replace('@shared/', '');
    // From dist/backend/src to dist/shared
    const resolved = path.join(__dirname, '../../shared', relativePath);
    return originalResolveFilename(resolved, parent, isMain);
  }
  
  return originalResolveFilename(request, parent, isMain);
};
