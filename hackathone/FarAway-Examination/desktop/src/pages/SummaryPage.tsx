/**
 * SummaryPage — Pre-submission Review Screen
 * API calls: getSession (load), submitExam (confirm)
 * All API contracts and localStorage logic preserved exactly.
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSession, submitExam, ExamSession, AuthResponse } from '../services/edgeApi';

export default function SummaryPage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const autoSubmit = location.state?.autoSubmit || false;

  const [authData,   setAuthData]   = useState<AuthResponse | null>(null);
  const [session,    setSession]    = useState<ExamSession | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg,   setErrorMsg]   = useState('');

  // ── Load session (API call UNCHANGED) ──────────────────────
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const stored = localStorage.getItem('exam_session');
        if (!stored) throw new Error('No active session found.');
        const auth: AuthResponse = JSON.parse(stored);
        setAuthData(auth);
        // ── REAL API CALL — getSession unchanged ──
        const examData = await getSession(auth.session_id, auth.token);
        if (!mounted) return;
        setSession(examData);
        setLoading(false);
        if (autoSubmit) handleFinalSubmit(examData, auth);
      } catch (err: any) {
        if (mounted) {
          setErrorMsg(err.message || 'Failed to load exam summary');
          setLoading(false);
        }
      }
    };
    init();
    return () => { mounted = false; };
  }, [autoSubmit]);

  // ── Final Submit (API call UNCHANGED) ──────────────────────
  const handleFinalSubmit = async (sess = session, auth = authData) => {
    if (!sess || !auth) return;
    setSubmitting(true);
    try {
      // ── REAL API CALL — submitExam unchanged ──
      const response = await submitExam(sess.session_id, auth.token);
      navigate('/complete', {
        state: {
          hash: response.submission_hash,
          totalAnswers: response.total_answers,
          candidateName: sess.candidate_name,
          submittedAt: response.submitted_at,
        },
        replace: true,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit exam. Please call an invigilator.');
      setSubmitting(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────
  if (loading) return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '4px solid #e0e0e0', borderTopColor: '#0d5caa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#777', fontSize: 14 }}>Loading exam summary...</p>
    </div>
  );
  if (!session || !authData) return null;

  // ── Computed stats (purely local — no API) ──────────────────
  const answeredCount   = session.questions.filter(q => !!q.selected_option).length;
  const unansweredCount = session.total_questions - answeredCount;

  return (
    <div className="summary-page">

      {/* Header */}
      <div className="summary-header">
        <span style={{ fontSize: 24 }}>📋</span>
        <div>
          <div className="summary-header-title">Exam Submission Summary</div>
          <p>Please review your attempt before final submission</p>
        </div>
      </div>

      {/* Content */}
      <div className="summary-content">

        {/* Auto-submit warning */}
        {autoSubmit && (
          <div style={{ background: '#fef9e7', border: '1px solid #f8c471', borderRadius: 6, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#e67e22', fontWeight: 600 }}>
            ⏰ Time is up! Your exam is being automatically submitted.
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div style={{ background: '#fdf2f1', border: '1px solid #f1948a', borderRadius: 6, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#e74c3c' }}>
            {errorMsg}
          </div>
        )}

        {/* Submitting state */}
        {submitting ? (
          <div className="summary-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
            <div style={{ width: 48, height: 48, border: '4px solid #e0e0e0', borderTopColor: '#0d5caa', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Submitting Securely...</h3>
            <p style={{ color: '#777', fontSize: 13 }}>Generating cryptographic proof of your answers.</p>
          </div>
        ) : (
          <>
            {/* Candidate Info */}
            <div className="summary-card">
              <h4>Candidate Details</h4>
              <div className="summary-row">
                <span className="summary-row-label">Candidate Name</span>
                <span className="summary-row-value">{session.candidate_name}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Exam</span>
                <span className="summary-row-value">{session.exam_title}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Candidate ID</span>
                <span className="summary-row-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{session.candidate_id}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Session ID</span>
                <span className="summary-row-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{session.session_id}</span>
              </div>
            </div>

            {/* Attempt Stats */}
            <div className="summary-card">
              <h4>Attempt Statistics</h4>
              <div className="summary-stats-grid">
                <div className="summary-stat-box total">
                  <div className="stat-num">{session.total_questions}</div>
                  <div className="stat-lbl">Total Questions</div>
                </div>
                <div className="summary-stat-box answered">
                  <div className="stat-num">{answeredCount}</div>
                  <div className="stat-lbl">Answered</div>
                </div>
                <div className="summary-stat-box unanswered">
                  <div className="stat-num">{unansweredCount}</div>
                  <div className="stat-lbl">Not Answered</div>
                </div>
                <div className="summary-stat-box marked">
                  <div className="stat-num">0</div>
                  <div className="stat-lbl">Marked for Review</div>
                </div>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div style={{ background: '#fef9e7', border: '1px solid #f8c471', borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#e67e22' }}>
                ⚠ You have <strong>{unansweredCount}</strong> unanswered question{unansweredCount > 1 ? 's' : ''}. They will receive zero marks.
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Footer */}
      {!submitting && (
        <div className="summary-actions">
          <button
            className="summary-btn summary-btn-back"
            onClick={() => navigate('/exam')}
            disabled={submitting}
          >
            ← Return to Exam
          </button>
          <button
            className="summary-btn summary-btn-submit"
            onClick={() => handleFinalSubmit()}
            disabled={submitting}
          >
            ✓ Confirm &amp; Submit Exam
          </button>
        </div>
      )}
    </div>
  );
}
