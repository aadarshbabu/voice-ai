import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ResizeObserver which is used by React Flow
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

// Mock window.crypto for randomUUID
Object.defineProperty(window, 'crypto', {
    value: {
        randomUUID: () => 'test-uuid',
    },
});
