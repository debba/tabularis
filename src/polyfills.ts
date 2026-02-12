/**
 * Browser polyfills for Node.js modules
 * This file makes Buffer and process available globally for libraries that expect them (like wkx)
 */

import { Buffer } from 'buffer';
import process from 'process';

// Make Buffer available globally for browser environment
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).process = process;
}

// Also set on globalThis for broader compatibility
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
  (globalThis as any).process = process;
}
