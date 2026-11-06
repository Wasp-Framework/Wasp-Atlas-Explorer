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
        <Route path="/datasets" element={<DatasetsPage onOpenAbout={() => setIsAboutOpen(true)} />} />
        <Route path="/build/:slug" element={<BuildScreen onOpenAbout={() => setIsAboutOpen(true)} />} />
        <Route path="/impressum" element={<ImpressumPage onOpenAbout={() => setIsAboutOpen(true)} />} />
        <Route path="/privacy" element={<PrivacyPage onOpenAbout={() => setIsAboutOpen(true)} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </>
  );
}
