import React from 'react';
import { renderThumbnail, retainThumbnailRenderer } from '../lib/thumbnailRenderer';

type Props = {
  source: any;
  color: string;
  label: string;
};

export function PartPreviewCanvas({ source, color, label }: Props) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => retainThumbnailRenderer(), []);

  React.useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const render = () => {
      // Clear the old snapshot as well when a source is removed.
      canvas.width = canvas.width;
      renderThumbnail(canvas, source, color, host.clientWidth || 120, host.clientHeight || 120);
    };
    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);
    return () => resizeObserver.disconnect();
  }, [color, source]);

  return (
    <div ref={hostRef} className="part-preview-canvas" aria-label={`${label} preview`}>
      <canvas ref={canvasRef} style={{ pointerEvents: 'none' }} aria-hidden="true" />
    </div>
  );
}
