import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAppStore } from './store';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Editor from './pages/Editor';
import Templates from './pages/Templates';
import AIStudio from './pages/AIStudio';
import Settings from './pages/Settings';
import Import from './pages/Import';
import ApplicationVault from './pages/ApplicationVault';

export default function App() {
  const { fetchResumes, fetchProviders, fetchActiveProvider, fetchSettings } = useAppStore();

  useEffect(() => {
    fetchResumes();
    fetchProviders();
    fetchActiveProvider();
    fetchSettings();
  }, [fetchResumes, fetchProviders, fetchActiveProvider, fetchSettings]);

  return (
    <BrowserRouter>
      <div className="grain" />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"         element={<Dashboard />} />
          <Route path="/vault"             element={<ApplicationVault />} />
          <Route path="/editor/:id"        element={<Editor />} />
          <Route path="/templates"         element={<Templates />} />
          <Route path="/ai-studio/:id?"   element={<AIStudio />} />
          <Route path="/settings"          element={<Settings />} />
          <Route path="/import"            element={<Import />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

