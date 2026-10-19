import { exportAggregationData, getAggregationDownloadFileName } from './buildRuntime';

export const MAX_SHARE_BYTES = 20 * 1024 * 1024;
export type HiveLensSnapshot = { version: 1; filename: string; modelUnits: string | null; aggregation: any };
export type HiveLensShare = { url: string; expiresAt: number };

export function normalizeHiveLensUnits(units?: string): string | null {
  const value = units?.trim().toLowerCase();
  if (['mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres'].includes(value)) return 'millimeters';
  if (['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres'].includes(value)) return 'centimeters';
  if (['m', 'meter', 'meters', 'metre', 'metres'].includes(value)) return 'meters';
  return null;
}

export function captureHiveLensSnapshot(aggregation: any, name: string, units?: string): HiveLensSnapshot {
  const snapshot: HiveLensSnapshot = {
    version: 1, filename: getAggregationDownloadFileName(name).slice(0, 250).replace(/\.json$/i, '') + '.json',
    modelUnits: normalizeHiveLensUnits(units),
    aggregation: JSON.parse(JSON.stringify(exportAggregationData(aggregation))),
  };
  if (new Blob([JSON.stringify(snapshot)]).size > MAX_SHARE_BYTES) throw new Error('This snapshot exceeds the 20 MB sharing limit. Download the JSON instead.');
  return snapshot;
}

export async function createHiveLensShare(snapshot: HiveLensSnapshot, destination: string, {
  signal, onProgress = () => {}, fetcher = fetch, upload = uploadSnapshot,
}: { signal?: AbortSignal; onProgress?: (percent: number) => void; fetcher?: typeof fetch; upload?: typeof uploadSnapshot } = {}): Promise<HiveLensShare> {
  const base = new URL(destination);
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error('HiveLens sharing requires HTTPS.');
  const request = async (action: string, data: object) => {
    const response = await fetcher(new URL(`/api/shares/${action}`, base), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Sharing is unavailable. Try again or download the JSON.');
    return result;
  };
  const body = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
  if (body.size > MAX_SHARE_BYTES) throw new Error('This snapshot exceeds the 20 MB sharing limit.');
  const { uploadUrl, uploadTicket } = await request('create', {});
  const uploadLocation = new URL(uploadUrl);
  const isBlobControlPlane = uploadLocation.origin === 'https://vercel.com' && uploadLocation.pathname === '/api/blob/';
  const isBlobStorage = uploadLocation.hostname === 'blob.vercel-storage.com' || uploadLocation.hostname.endsWith('.blob.vercel-storage.com');
  if (uploadLocation.protocol !== 'https:' || (!isBlobControlPlane && !isBlobStorage) || uploadLocation.username || uploadLocation.password) throw new Error('Invalid upload destination.');
  await upload(uploadLocation.href, body, signal, onProgress);
  const result = await request('finalize', { uploadTicket });
  const link = new URL(result.url);
  if (link.origin !== base.origin || !link.hash.startsWith('#share=') || !Number.isFinite(result.expiresAt)) throw new Error('Invalid share link returned by HiveLens.');
  return { url: link.href, expiresAt: result.expiresAt };
}

export function uploadSnapshot(url: string, body: Blob, signal?: AbortSignal, onProgress: (percent: number) => void = () => {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => { signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(); };
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300 ? undefined : new Error('Upload failed. Please try again.'));
    xhr.onerror = () => finish(new Error('Upload failed. Check your connection and try again.'));
    xhr.ontimeout = () => finish(new Error('Upload timed out. Please try again.'));
    xhr.onabort = () => finish(new DOMException('Sharing canceled.', 'AbortError'));
    if (signal?.aborted) { finish(new DOMException('Sharing canceled.', 'AbortError')); return; }
    signal?.addEventListener('abort', abort, { once: true });
    xhr.send(body);
  });
}
