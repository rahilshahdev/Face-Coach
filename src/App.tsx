import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useState } from 'react';
import Landing from './pages/Landing';
import Session from './pages/Session';
import Report from './pages/Report';
import History from './pages/History';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('facecoach_gemini_api_key') || '');
  const [modelType, setModelType] = useState(() => {
    const saved = localStorage.getItem('facecoach_gemini_model') || 'gemini-3.1-flash-lite';
    return ['gemini-3.1-flash-lite', 'gemini-3.1-flash', 'gemini-3.1-pro'].includes(saved) ? saved : 'custom';
  });
  const [customModel, setCustomModel] = useState(() => {
    const saved = localStorage.getItem('facecoach_gemini_model') || '';
    return ['gemini-3.1-flash-lite', 'gemini-3.1-flash', 'gemini-3.1-pro'].includes(saved) ? '' : saved;
  });
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-white flex flex-col">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold">
              FC
            </div>
            <span className="text-xl font-bold tracking-tight">FaceCoach</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link to="/history" className="text-white/70 hover:text-white smooth-transition font-medium">History</Link>
            <button 
              onClick={() => setShowSettings(true)}
              className="text-white/70 hover:text-white smooth-transition p-2 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10"
              title="API Key Settings"
            >
              <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <Link to="/session" className="bg-accent hover:bg-orange-600 text-white px-5 py-2 rounded-xl font-medium smooth-transition shadow-lg shadow-accent/20">
              Start Session
            </Link>
          </nav>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/session" element={<Session />} />
            <Route path="/report/:id" element={<Report />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="py-8 text-center text-sm text-white/40 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <span>Made and built with ❤️ by Rahil</span>
          <a 
            href="https://github.com/rahilshahdev" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 hover:text-white text-white/80 rounded-xl text-xs font-semibold border border-white/10 smooth-transition"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.08-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.18 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
            </svg>
            <span>GitHub Profile</span>
          </a>
        </footer>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-card border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">API Settings</h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-white/40 hover:text-white smooth-transition"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-white/60 mb-6">
                Paste your Google Gemini API key below. The key is saved securely in your browser's local storage and is only used to generate coaching report feedback.
              </p>
              <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Gemini Model</label>
                <select 
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent smooth-transition text-white"
                >
                  <option value="gemini-3.1-flash-lite" className="bg-neutral-900 text-white">Gemini 3.1 Flash Lite (Default)</option>
                  <option value="gemini-3.1-flash" className="bg-neutral-900 text-white">Gemini 3.1 Flash (Standard)</option>
                  <option value="gemini-3.1-pro" className="bg-neutral-900 text-white">Gemini 3.1 Pro (Heavy)</option>
                  <option value="custom" className="bg-neutral-900 text-white">Custom Model...</option>
                </select>
              </div>

              {modelType === 'custom' && (
                <div className="mb-4 animate-fade-in">
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Custom Model Name</label>
                  <input 
                    type="text" 
                    value={customModel} 
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="gemini-3.5-pro-preview"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent smooth-transition text-white"
                  />
                </div>
              )}

              <div className="mb-6">
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Gemini API Key</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent smooth-transition text-white"
                />
                <p className="mt-2 text-xs text-white/40">
                  Don't have a key? Get one for free at <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-accent hover:underline">Google AI Studio</a>.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => {
                    localStorage.removeItem('facecoach_gemini_api_key');
                    localStorage.removeItem('facecoach_gemini_model');
                    setApiKey('');
                    setModelType('gemini-3.1-flash-lite');
                    setCustomModel('');
                    setShowSettings(false);
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-sm smooth-transition"
                >
                  Clear Key
                </button>
                <button 
                  onClick={() => {
                    localStorage.setItem('facecoach_gemini_api_key', apiKey.trim());
                    const finalModel = modelType === 'custom' ? customModel.trim() : modelType;
                    localStorage.setItem('facecoach_gemini_model', finalModel || 'gemini-3.1-flash-lite');
                    setShowSettings(false);
                  }}
                  className="px-5 py-2 bg-accent hover:bg-orange-600 text-white rounded-xl text-sm font-bold smooth-transition shadow-lg shadow-accent/20"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}

export default App;
