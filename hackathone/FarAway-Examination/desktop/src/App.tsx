import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import ExamPage from './pages/ExamPage';
import ReviewPage from './pages/ReviewPage';
import SummaryPage from './pages/SummaryPage';
import CompletePage from './pages/CompletePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const session = localStorage.getItem('exam_session');
  if (!session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  const [showSupervisorModal, setShowSupervisorModal] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    const handleClose = () => setShowSupervisorModal(true);
    
    // @ts-ignore
    if (window.fortisAPI && window.fortisAPI.system) {
      // @ts-ignore
      window.fortisAPI.system.onSupervisorClose(handleClose);
    }
    
    // Manual fallback listener for the 5-click hidden button
    window.addEventListener('trigger-supervisor-close-manual', handleClose);
    return () => window.removeEventListener('trigger-supervisor-close-manual', handleClose);
  }, []);

  const handleSupervisorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1501') {
      // @ts-ignore
      if (window.fortisAPI && window.fortisAPI.system) {
        // @ts-ignore
        window.fortisAPI.system.closeApp();
      }
    } else {
      setPinError(true);
      setPin('');
    }
  };

  return (
    <>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        
        {/* Protected Routes */}
        <Route path="/exam" element={
          <ProtectedRoute>
            <ExamPage />
          </ProtectedRoute>
        } />

        <Route path="/review" element={
          <ProtectedRoute>
            <ReviewPage />
          </ProtectedRoute>
        } />
        
        <Route path="/summary" element={
          <ProtectedRoute>
            <SummaryPage />
          </ProtectedRoute>
        } />
        
        <Route path="/complete" element={<CompletePage />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>

      {/* Supervisor Close Modal */}
      {showSupervisorModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: '#fff', padding: 30, borderRadius: 8, width: 350, textAlign: 'center' }}>
            <h3 style={{ color: '#0d5caa', marginBottom: 15, fontSize: 18, fontWeight: 700 }}>Supervisor Authorization</h3>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>Enter supervisor PIN to exit the secure kiosk.</p>
            <form onSubmit={handleSupervisorSubmit}>
              <input 
                type="password" 
                value={pin}
                onChange={e => { setPin(e.target.value); setPinError(false); }}
                placeholder="Enter PIN"
                autoFocus
                style={{
                  width: '100%', padding: '10px', fontSize: 16, textAlign: 'center',
                  border: `2px solid ${pinError ? '#e74c3c' : '#ccc'}`, borderRadius: 4, marginBottom: 15
                }}
              />
              {pinError && <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 15 }}>Invalid PIN. Access denied.</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => { setShowSupervisorModal(false); setPin(''); setPinError(false); }}
                  style={{ flex: 1, padding: 10, background: '#f0f0f0', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit"
                  style={{ flex: 1, padding: 10, background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>Exit Kiosk</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
