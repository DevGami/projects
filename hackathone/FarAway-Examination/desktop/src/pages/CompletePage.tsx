/**
 * CompletePage — Post-Submission Confirmation Screen
 * Reads submission state passed from SummaryPage via router state.
 * Clears localStorage session (no re-use allowed).
 * No API calls needed here — submission already done in SummaryPage.
 */
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function CompletePage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const state = location.state as {
    hash?: string;
    totalAnswers?: number;
    candidateName?: string;
    submittedAt?: string;
  } | null;

  // Clear session so it cannot be reused (security requirement)
  useEffect(() => {
    localStorage.removeItem('exam_session');
  }, []);

  return (
    <div className="complete-page">
      <div className="complete-card">

        {/* Success Icon */}
        <div className="complete-icon">✓</div>

        <h2>Exam Successfully Submitted</h2>
        <p>
          Your exam has been submitted and cryptographically sealed.
          You may now leave the testing area.
        </p>

        {/* Submission Details */}
        {state && (
          <div style={{ width: '100%', marginBottom: 24 }}>
            <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {state.candidateName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span style={{ color: '#666' }}>Candidate Name</span>
                  <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{state.candidateName}</span>
                </div>
              )}
              {state.submittedAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span style={{ color: '#666' }}>Submitted At</span>
                  <span style={{ fontWeight: 700, color: '#1a1a1a' }}>
                    {new Date(state.submittedAt).toLocaleString()}
                  </span>
                </div>
              )}
              {state.totalAnswers !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                  <span style={{ color: '#666' }}>Answers Recorded</span>
                  <span style={{ fontWeight: 700, color: '#26a65b' }}>{state.totalAnswers}</span>
                </div>
              )}
            </div>

            {/* Submission Hash */}
            {state.hash && (
              <div style={{ marginTop: 16 }}>
                <div className="hash-label">Submission Hash (Cryptographic Proof)</div>
                <div className="hash-display">{state.hash}</div>
              </div>
            )}
          </div>
        )}

        {/* Return Button (for invigilator to reset kiosk) */}
        <button
          style={{
            background: '#0d5caa', color: '#fff', border: 'none',
            borderRadius: 4, padding: '12px 32px',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
            width: '100%',
          }}
          onClick={() => navigate('/', { replace: true })}
        >
          Return to Login (Next Candidate)
        </button>
      </div>
    </div>
  );
}
