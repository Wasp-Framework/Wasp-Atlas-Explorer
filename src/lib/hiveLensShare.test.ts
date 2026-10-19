// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { captureHiveLensSnapshot, createHiveLensShare, normalizeHiveLensUnits } from './hiveLensShare';

describe('HiveLens snapshot sharing', () => {
  it('captures an independent snapshot through the same toData(false) export as Download', () => {
    const data = { aggregated_parts_sequence: [5], aggregated_parts: { 5: { name: 'A' } } };
    const toData = vi.fn(() => data);
    const snapshot = captureHiveLensSnapshot({ toData }, 'Test Assembly', 'mm');
    data.aggregated_parts[5].name = 'changed';
    expect(toData).toHaveBeenCalledWith(false);
    expect(snapshot.filename).toBe('Test-Assembly.json');
    expect(snapshot.modelUnits).toBe('millimeters');
    expect(snapshot.aggregation.aggregated_parts[5].name).toBe('A');
    expect(normalizeHiveLensUnits()).toBeNull();
    expect(normalizeHiveLensUnits('CM')).toBe('centimeters');
  });
  it.each(['https://test.private.blob.vercel-storage.com/snapshot', 'https://vercel.com/api/blob/?pathname=atlas-shares%2Ftest.json'])('uploads directly to %s, then finalizes', async (uploadUrl) => {
    const order: string[] = [];
    const fetcher = vi.fn(async (url: URL, options: RequestInit) => {
      const action = url.pathname.split('/').pop()!;
      order.push(action);
      expect(options.credentials).toBe('omit');
      return { ok: true, json: async () => action === 'create' ? { uploadUrl, uploadTicket: 'ticket' } : { url: 'https://hivelens.example/#share=token', expiresAt: 123 } } as Response;
    });
    const upload = vi.fn(async () => { order.push('upload'); });
    const snapshot = captureHiveLensSnapshot({ toData: () => ({}) }, 'A');
    const result = await createHiveLensShare(snapshot, 'https://hivelens.example', { fetcher: fetcher as any, upload });
    expect(order).toEqual(['create', 'upload', 'finalize']);
    expect(result.url).toBe('https://hivelens.example/#share=token');
    expect(JSON.parse(fetcher.mock.calls[1][1].body as string)).toEqual({ uploadTicket: 'ticket' });
  });
  it('rejects excessive snapshots, API errors and unexpected upload destinations', async () => {
    expect(() => captureHiveLensSnapshot({ toData: () => ({ text: 'x'.repeat(20 * 1024 * 1024) }) }, 'A')).toThrow('20 MB');
    const snapshot = captureHiveLensSnapshot({ toData: () => ({}) }, 'A');
    await expect(createHiveLensShare(snapshot, 'https://hivelens.example', { fetcher: vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Sharing disabled' }) })) as any })).rejects.toThrow('disabled');
    const upload = vi.fn();
    await expect(createHiveLensShare(snapshot, 'https://hivelens.example', { upload, fetcher: vi.fn(async () => ({ ok: true, json: async () => ({ uploadUrl: 'https://attacker.example' }) })) as any })).rejects.toThrow('destination');
    expect(upload).not.toHaveBeenCalled();
  });
  it.each(['https://vercel.com/other', 'https://vercel.com.attacker.example/api/blob/', 'http://vercel.com/api/blob/', 'https://user:pass@vercel.com/api/blob/'])('rejects lookalike or unrelated control endpoints: %s', async (uploadUrl) => {
    const snapshot = captureHiveLensSnapshot({ toData: () => ({}) }, 'A');
    const upload = vi.fn();
    await expect(createHiveLensShare(snapshot, 'https://hivelens.example', { upload, fetcher: vi.fn(async () => ({ ok: true, json: async () => ({ uploadUrl }) })) as any })).rejects.toThrow('destination');
    expect(upload).not.toHaveBeenCalled();
  });
});
