import { Navigate, Route, Routes } from 'react-router-dom';

import { DetailEditor } from '@/pages/DetailEditor';
import { History } from '@/pages/History';
import { Home } from '@/pages/Home';
import { Landing } from '@/pages/Landing';
import { OutlineEditor } from '@/pages/OutlineEditor';
import { SettingsPage } from '@/pages/Settings';
import { SlidePreview } from '@/pages/SlidePreview';

export const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/landing" element={<Landing />} />
    <Route path="/history" element={<History />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/project/:projectId/outline" element={<OutlineEditor />} />
    <Route path="/project/:projectId/detail" element={<DetailEditor />} />
    <Route path="/project/:projectId/preview" element={<SlidePreview />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);