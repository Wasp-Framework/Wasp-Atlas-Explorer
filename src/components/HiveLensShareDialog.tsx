import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { createHiveLensShare, type HiveLensSnapshot, type HiveLensShare } from '../lib/hiveLensShare';

export function HiveLensShareDialog({ snapshot, destination, onClose, onDownload }: {
  snapshot: HiveLensSnapshot; destination: string; onClose: () => void; onDownload: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [share, setShare] = useState<HiveLensShare | null>(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => { controller.current?.abort(); controller.current = null; dialog.current?.close(); previous?.focus?.(); };
  }, []);
  async function create() {
    if (busy) return;
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setStatus('Preparing upload…');
    const timer = window.setTimeout(() => active.abort(), 180_000);
    try {
      const result = await createHiveLensShare(snapshot, destination, { signal: active.signal, onProgress: (percent) => setStatus(percent === 100 ? 'Validating snapshot…' : `Uploading snapshot… ${percent}%`) });
      if (active.signal.aborted) return;
      setShare(result);
      setStatus('Link ready. Scan the QR code on your phone or copy the link to your headset.');
      try {
        const image = await QRCode.toDataURL(result.url, { width: 256, margin: 2, errorCorrectionLevel: 'M' });
        if (controller.current === active && !active.signal.aborted) setQr(image);
      }
      catch { setStatus('Link ready. Copy the link; the QR code could not be generated.'); }
    } catch (error) {
      if (controller.current !== active) return;
      if (!active.signal.aborted) setStatus(error instanceof Error ? error.message : 'Could not create a share link.');
      else setStatus('Sharing timed out. Please try again.');
    } finally { clearTimeout(timer); if (controller.current === active) setBusy(false); }
  }
  return <dialog ref={dialog} className="hivelens-share-dialog" aria-labelledby="hivelens-share-title" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="hivelens-share-dialog__header">
      <h2 id="hivelens-share-title">Open in HiveLens</h2>
      <button type="button" onClick={onClose} aria-label="Close sharing dialog">×</button>
    </div>
    <p>{snapshot.filename}</p>
    <p>Create a snapshot link, then open it on your phone or headset. Anyone with the link can download this assembly for 24 hours. Imported copies can remain on their devices.</p>
    {!share ? <button type="button" disabled={busy} onClick={create}>{busy ? 'Creating link…' : 'Create link'}</button> : <>
      {qr ? <img src={qr} width="256" height="256" alt="QR code for opening the shared assembly in HiveLens" /> : null}
      <label>Share link<input aria-label="HiveLens share link" value={share.url} readOnly onFocus={(event) => event.target.select()} /></label>
      <p>Expires {new Date(share.expiresAt).toLocaleString()}.</p>
      <div className="hivelens-share-dialog__buttons">
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(share.url); setStatus('Link copied.'); } catch { setStatus('Select and copy the link above.'); } }}>Copy link</button>
        <a href={share.url} target="_blank" rel="noopener noreferrer">Open here</a>
      </div>
    </>}
    <p role="status">{status}</p>
    <button type="button" onClick={onDownload}>Download JSON instead</button>
  </dialog>;
}
