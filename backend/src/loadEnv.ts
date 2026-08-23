// Must be the very first import in index.ts. TypeScript emits import
// statements as require() calls in the order they're written, so
// importing this file before any other local module guarantees
// process.env is populated before those modules read it at load time
// (several services, like OllamaService, read env vars into top-level
// consts when the module is first required).
import dotenv from 'dotenv';

dotenv.config();
