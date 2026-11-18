import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { installAtlasBridge } from './lib/atlasBridge';
import { LandingPage } from './pages/LandingPage';
import { DatasetsPage } from './pages/DatasetsPage';
import { BuildScreen } from './pages/BuildScreen';
import { ImpressumPage } from './pages/ImpressumPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { AboutModal } from './components/AboutModal';

export default function App() {
  const navigate = useNavigate();
  React.useEffect(() => installAtlasBridge(navigate), [navigate]);
  const [mcpStatus, setMcpStatus] = React.useState<{ state: string; message: string } | null>(null);
  const mcpConnection = React.useRef<import('waspatlas-mcp/client').AtlasConnection>();
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mcp') !== '1') return;
    let disposed = false;
    void import('waspatlas-mcp/client')
      .then(({ startAtlasClient }) => {
        if (!disposed)
          mcpConnection.current = startAtlasClient(() => window.waspAtlas, {
            onStatus: (status) => {
              if (!disposed) setMcpStatus(status);
            },
          });
      })
      .catch(() => {
        if (!disposed)
          setMcpStatus({ state: 'error', message: 'Could not load the Atlas MCP connection.' });
      });
    return () => {
      disposed = true;
      mcpConnection.current?.dispose();
      mcpConnection.current = undefined;
    };
  }, []);
  const [isAboutOpen, setIsAboutOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isAboutOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAboutOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAboutOpen]);

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage onOpenAbout={() => setIsAboutOpen(true)} />} />
        <Route
          path="/datasets"
          element={<DatasetsPage onOpenAbout={() => setIsAboutOpen(true)} />}
        />
        <Route
          path="/build/:slug"
          element={<BuildScreen onOpenAbout={() => setIsAboutOpen(true)} />}
        />
        <Route
          path="/impressum"
          element={<ImpressumPage onOpenAbout={() => setIsAboutOpen(true)} />}
        />
        <Route path="/privacy" element={<PrivacyPage onOpenAbout={() => setIsAboutOpen(true)} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {mcpStatus && (
        <div className="atlas-mcp-status" role="status" aria-live="polite">
          <span>{mcpStatus.message}</span>
          {['ready', 'disconnected', 'error'].includes(mcpStatus.state) && (
            <button type="button" onClick={() => mcpConnection.current?.connect()}>
              Connect MCP
            </button>
          )}
          {['connected', 'connecting'].includes(mcpStatus.state) && (
            <button type="button" onClick={() => mcpConnection.current?.disconnect()}>
              Disconnect MCP
            </button>
          )}
        </div>
      )}
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
}
