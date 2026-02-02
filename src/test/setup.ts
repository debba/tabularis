import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock browser APIs missing in JSDOM for Monaco Editor
Object.defineProperty(document, 'queryCommandSupported', {
  value: vi.fn().mockImplementation(() => true),
});
Object.defineProperty(document, 'execCommand', {
  value: vi.fn(),
});
