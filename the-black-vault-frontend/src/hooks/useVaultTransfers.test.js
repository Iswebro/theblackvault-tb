// src/hooks/useVaultTransfers.test.js
import { renderHook, act } from '@testing-library/react-hooks';
import useVaultTransfers from './useVaultTransfers';

// Mock fetch globally
beforeAll(() => {
  global.fetch = jest.fn();
});
afterAll(() => {
  global.fetch.mockRestore();
});
afterEach(() => {
  global.fetch.mockClear();
});

describe('useVaultTransfers', () => {
  const wallet = '0x123';
  const vault = '0x456';
  const mockTransfers = [
    { hash: '0xabc', contractAddress: vault, from: wallet, to: vault, value: '100' },
    { hash: '0xdef', contractAddress: vault, from: vault, to: wallet, value: '50' },
  ];

  it('fetches and returns transfers', async () => {
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ result: mockTransfers })
    });
    const { result, waitForNextUpdate } = renderHook(() => useVaultTransfers(wallet, vault));
    expect(result.current.loading).toBe(true);
    await waitForNextUpdate();
    expect(result.current.transfers).toEqual(mockTransfers);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('handles fetch error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('fail'));
    const { result, waitForNextUpdate } = renderHook(() => useVaultTransfers(wallet, vault));
    await waitForNextUpdate();
    expect(result.current.error).toBe('fail');
    expect(result.current.transfers).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('returns empty if wallet or vault missing', () => {
    const { result } = renderHook(() => useVaultTransfers('', ''));
    expect(result.current.transfers).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
