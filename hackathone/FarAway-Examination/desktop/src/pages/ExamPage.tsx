/**
 * ExamPage — NTA-Pattern NEET/JEE Exam Interface
 * Layout: Header | Section Tabs | [Question Pane | Palette Sidebar] | Footer
 * Includes full anomaly detection (focus loss, visibility change, copy attempt)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getSession,
  submitAnswer,
  reportMonitoringEvent,
  ExamSession,
  AuthResponse,
} from '../services/edgeApi';

// ─── Types ────────────────────────────────────────────────────
type QuestionStatus = 'not-visited' | 'not-answered' | 'answered' | 'marked' | 'ans-marked';

export default function ExamPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [authData,   setAuthData]   = useState<AuthResponse | null>(null);
  const [session,    setSession]    = useState<ExamSession | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [errorMsg,   setErrorMsg]   = useState('');

  // Navigation state
  const [currentIndex,  setCurrentIndex]  = useState(0);
  const [localAnswers,  setLocalAnswers]  = useState<Record<string, 'A'|'B'|'C'|'D'>>({});
  const [markedReview,  setMarkedReview]  = useState<Set<string>>(new Set());
  const [visitedQs,     setVisitedQs]     = useState<Set<string>>(new Set());

  // Timer
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI State
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showInstructions, setShowInstructions]  = useState(true);

  // Anomaly detection state
  const [anomalyMsg,      setAnomalyMsg]      = useState('');
  const [showAnomalyOverlay, setShowAnomalyOverlay] = useState(false);
  const [anomalyCount,    setAnomalyCount]    = useState(0);
  const anomalyTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 1. Session Load ──────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const stored = localStorage.getItem('exam_session');
        if (!stored) throw new Error('No active session found. Please authenticate.');
        const auth: AuthResponse = JSON.parse(stored);
        setAuthData(auth);

        const examData = await getSession(auth.session_id, auth.token);
        if (!mounted) return;

        setSession(examData);

        // Restore state if returning from ReviewPage (jumpTo, answers, marked)
        const state = location.state as any;
        if (state?.jumpTo !== undefined) {
          setCurrentIndex(state.jumpTo);
        } else {
          setCurrentIndex(examData.current_question_index || 0);
        }
        setRemainingSeconds(examData.remaining_seconds);

        // Pre-populate answers — prefer passed state (ReviewPage returns), fallback to DB
        const answers: Record<string, 'A'|'B'|'C'|'D'> = state?.answers || {};
        const visited = new Set<string>(state?.visited || []);
        if (Object.keys(answers).length === 0) {
          examData.questions.forEach(q => {
            if (q.selected_option) {
              answers[q.id] = q.selected_option;
              visited.add(q.id);
            }
          });
        }
        if (state?.marked) {
          setMarkedReview(new Set(state.marked));
        }
        setLocalAnswers(answers);
        setVisitedQs(visited);
        setLoading(false);
      } catch (err: any) {
        if (mounted) {
          setErrorMsg(err.message || 'Failed to load exam session.');
          setLoading(false);
        }
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  // ── 2. Timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !!errorMsg || remainingSeconds <= 0) return;
    timerRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          navigate('/summary', { state: { autoSubmit: true } });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading, errorMsg]);

  // ── 3. Anomaly Detection ──────────────────────────────────────
  const triggerAnomaly = useCallback((msg: string, severity: 'WARNING' | 'CRITICAL' = 'WARNING') => {
    if (!authData || !session) return;
    const newCount = anomalyCount + 1;
    setAnomalyCount(newCount);
    setAnomalyMsg(`⚠ ${msg} (Incident #${newCount} logged)`);
    setShowAnomalyOverlay(true);

    reportMonitoringEvent(
      { event_type: msg.replace(/\s+/g, '_').toUpperCase(), severity, details: { count: newCount, timestamp: new Date().toISOString() } },
      authData.token, session.session_id, session.candidate_id
    );

    // Auto-dismiss overlay after 3s
    if (anomalyTimerRef.current) clearTimeout(anomalyTimerRef.current);
    anomalyTimerRef.current = setTimeout(() => {
      setShowAnomalyOverlay(false);
      setAnomalyMsg('');
    }, 3000);
  }, [authData, session, anomalyCount]);

  useEffect(() => {
    if (!authData || !session) return;

    const onBlur    = () => triggerAnomaly('Tab switch detected');
    const onVisibility = () => {
      if (document.hidden) triggerAnomaly('Window hidden', 'CRITICAL');
    };
    const onCopy    = (e: ClipboardEvent) => { e.preventDefault(); triggerAnomaly('Copy attempt blocked'); };
    const onCut     = (e: ClipboardEvent) => { e.preventDefault(); triggerAnomaly('Cut attempt blocked'); };
    const onPrint   = () => triggerAnomaly('Print attempt detected', 'CRITICAL');
    const onContextMenu = (e: MouseEvent) => { e.preventDefault(); triggerAnomaly('Right-click blocked'); };
    const onKeyDown = (e: KeyboardEvent) => {
      // Block F12, Ctrl+Shift+I, Ctrl+U, etc.
      if (e.key === 'F12') { e.preventDefault(); triggerAnomaly('DevTools shortcut blocked', 'CRITICAL'); }
      if (e.ctrlKey && e.shiftKey && e.key === 'I') { e.preventDefault(); triggerAnomaly('DevTools shortcut blocked', 'CRITICAL'); }
      if (e.ctrlKey && e.key === 'u') { e.preventDefault(); triggerAnomaly('View source blocked', 'CRITICAL'); }
      if (e.altKey && e.key === 'Tab') { e.preventDefault(); triggerAnomaly('Alt+Tab blocked'); }
    };

    window.addEventListener('blur',            onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('copy',          onCopy);
    document.addEventListener('cut',           onCut);
    window.addEventListener('beforeprint',     onPrint);
    document.addEventListener('contextmenu',   onContextMenu);
    document.addEventListener('keydown',       onKeyDown);

    return () => {
      window.removeEventListener('blur',            onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('copy',          onCopy);
      document.removeEventListener('cut',           onCut);
      window.removeEventListener('beforeprint',     onPrint);
      document.removeEventListener('contextmenu',   onContextMenu);
      document.removeEventListener('keydown',       onKeyDown);
    };
  }, [triggerAnomaly, authData, session]);

  // ── Question Status Logic ─────────────────────────────────────
  const getStatus = (qId: string, index: number): QuestionStatus => {
    const answered  = !!localAnswers[qId];
    const marked    = markedReview.has(qId);
    const visited   = visitedQs.has(qId) || index === currentIndex;
    if (answered && marked) return 'ans-marked';
    if (answered)           return 'answered';
    if (marked)             return 'marked';
    if (visited)            return 'not-answered';
    return 'not-visited';
  };

  // ── Handlers ─────────────────────────────────────────────────
  const handleSelectOption = async (option: 'A'|'B'|'C'|'D') => {
    if (!session || !authData) return;
    const q = session.questions[currentIndex];
    setLocalAnswers(prev => ({ ...prev, [q.id]: option }));
    setVisitedQs(prev => new Set(prev).add(q.id));
    try {
      await submitAnswer(session.session_id, q.id, option, currentIndex, remainingSeconds, authData.token);
    } catch (err) {
      console.error('Answer save failed (offline queued):', err);
    }
  };

  const handleClearResponse = () => {
    if (!session) return;
    const q = session.questions[currentIndex];
    setLocalAnswers(prev => {
      const next = { ...prev };
      delete next[q.id];
      return next;
    });
  };

  const handleMarkForReview = () => {
    if (!session) return;
    const q = session.questions[currentIndex];
    setMarkedReview(prev => {
      const next = new Set(prev);
      if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
      return next;
    });
    // Always move to next after marking
    jumpTo(currentIndex + 1);
  };

  const handleSaveAndNext = async () => {
    if (!session || !authData) return;
    const q = session.questions[currentIndex];
    if (localAnswers[q.id]) {
      try {
        await submitAnswer(session.session_id, q.id, localAnswers[q.id], currentIndex, remainingSeconds, authData.token);
      } catch {}
    }
    jumpTo(currentIndex + 1);
  };

  const jumpTo = (index: number) => {
    if (!session) return;
    if (index < 0 || index >= session.questions.length) return;
    // Mark current question as visited before leaving
    const currentQ = session.questions[currentIndex];
    setVisitedQs(prev => new Set(prev).add(currentQ.id));
    setCurrentIndex(index);
    setShowInstructions(false);
  };

  // ── Format time ──────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── Loading / Error States ────────────────────────────────────
  if (loading) return (
    <div className="exam-loading" style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#fff' }}>
      <div className="spinner" style={{ width: 40, height: 40, border: '4px solid #e0e0e0', borderTopColor: '#0d5caa', borderRadius: '50%' }} />
      <p style={{ color: '#777', fontSize: 14 }}>Loading your exam session...</p>
    </div>
  );

  if (errorMsg) return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0', gap: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: 40, width: 440, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>Session Error</h3>
        <p style={{ color: '#e74c3c', fontSize: 13, marginBottom: 24 }}>{errorMsg}</p>
        <button
          style={{ background: '#0d5caa', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          Return to Login
        </button>
      </div>
    </div>
  );

  if (!session || !authData) return null;

  // ── Computed values ───────────────────────────────────────────
  const currentQ       = session.questions[currentIndex];
  const answeredCount  = Object.keys(localAnswers).length;
  const notVisitedCount = session.questions.filter((q, i) => !visitedQs.has(q.id) && i !== currentIndex).length;
  const markedCount    = markedReview.size;
  const notAnsweredCount = session.questions.filter((q, i) =>
    (visitedQs.has(q.id) || i === currentIndex) && !localAnswers[q.id]
  ).length;
  const isLastQ = currentIndex === session.questions.length - 1;
  const isWarningTime = remainingSeconds < 300;

  return (
    <div className="exam-shell exam-mode">

      {/* ══ Anomaly Overlay ══ */}
      {showAnomalyOverlay && <div className="anomaly-overlay" />}
      {anomalyMsg && (
        <div className="anomaly-toast">
          <span>⚠</span> {anomalyMsg}
        </div>
      )}

      {/* ══ 1. HEADER BAR ══ */}
      <div className="exam-header">
        <span style={{ fontSize: 22, flexShrink: 0 }}>🛡️</span>
        <div className="exam-header-title">
          NEET UG — FortisExam Secure Examination System
        </div>
        <div className="exam-header-actions">
          <button className="exam-header-btn" title="Contact invigilator for assistance">
            🔍 Zoom
          </button>
          <div className="candidate-strip">
            <div className="candidate-photo">👤</div>
            <div className="candidate-name">{session.candidate_name}</div>
          </div>
        </div>
      </div>

      {/* ══ 2. SECTION TAB BAR ══ */}
      <div className="section-bar">
        <div className="section-bar-left">
          <button className="section-tab active">
            {session.exam_title || 'Section A'}
            <span className="tab-info-icon" title="Section information">i</span>
          </button>
          <button className="section-tab">
            Physics
            <span className="tab-info-icon">i</span>
          </button>
          <button className="section-tab">
            Chemistry
            <span className="tab-info-icon">i</span>
          </button>
          <button className="section-tab">
            Biology
            <span className="tab-info-icon">i</span>
          </button>
        </div>
        <div className="timer-display" style={isWarningTime ? { color: '#e74c3c' } : {}}>
          <span className="timer-label">Time Left :</span>
          <strong>{formatTime(remainingSeconds)}</strong>
          {isWarningTime && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#e74c3c' }}>⏰</span>}
        </div>
      </div>

      {/* ══ 3. QUESTION META BAR ══ */}
      <div className="question-meta-bar">
        <div className="meta-item">
          <span>Question Type:</span>
          <strong>Multiple Choice</strong>
        </div>
        <div className="meta-item" style={{ marginLeft: 'auto' }}>
          <span>Marks for correct answer:</span>
          <strong className="marks-correct" style={{ marginLeft: 5 }}>+4</strong>
          <span style={{ margin: '0 8px' }}>|</span>
          <span>Negative Marks:</span>
          <strong className="marks-negative" style={{ marginLeft: 5 }}>-1</strong>
        </div>
      </div>

      {/* ══ 4. MAIN BODY ══ */}
      <div className="exam-body">

        {/* ── Left: Question Pane ── */}
        <div className="question-pane">
          <div className="question-pane-scroll">

            {/* Question Number + Bookmark */}
            <div className="question-number-bar">
              <span className="question-number-label">
                Question No. {currentIndex + 1}
              </span>
              <button
                className={`bookmark-btn ${markedReview.has(currentQ?.id) ? 'active' : ''}`}
                onClick={() => {
                  if (!currentQ) return;
                  setMarkedReview(prev => {
                    const next = new Set(prev);
                    if (next.has(currentQ.id)) next.delete(currentQ.id); else next.add(currentQ.id);
                    return next;
                  });
                }}
              >
                🔖 {markedReview.has(currentQ?.id) ? 'Bookmarked' : 'Bookmark'}
              </button>
            </div>

            {/* Section Instructions (Collapsible) */}
            {currentIndex === 0 && (
              <div className="instructions-box">
                <div className="instructions-box-header" onClick={() => setShowInstructions(p => !p)}>
                  <span>{session.exam_title} (Maximum Marks: {session.total_questions * 4})</span>
                  <span style={{ fontSize: 18 }}>{showInstructions ? '∧' : '∨'}</span>
                </div>
                {showInstructions && (
                  <div className="instructions-box-body">
                    <ul>
                      <li>This section contains <strong>{session.total_questions} ({session.total_questions})</strong> questions.</li>
                      <li>Each question has <strong>FOUR</strong> options (A), (B), (C) and (D). <strong>ONLY ONE</strong> of these four options is the correct answer.</li>
                      <li>For each question, choose the option corresponding to the correct answer.</li>
                      <li>Answer to each question will be evaluated according to the following marking scheme:
                        <ul style={{ marginTop: 4 }}>
                          <li><em>Full Marks</em> : <strong>+4</strong> if ONLY the correct option is chosen</li>
                          <li><em>Zero Marks</em> : 0 if none of the options is chosen</li>
                          <li><em>Negative Marks</em> : <strong>-1</strong> in all other cases</li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Question Content */}
            {!currentQ ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12, color: '#777' }}>
                <span style={{ fontSize: 48 }}>📋</span>
                <p>No questions found. Please contact an invigilator.</p>
              </div>
            ) : (
              <>
                <div className="question-content">
                  {currentQ.content}
                </div>

                {/* Answer Options */}
                <div className="options-list">
                  {(['A', 'B', 'C', 'D'] as const).map(opt => {
                    const isSelected = localAnswers[currentQ.id] === opt;
                    return (
                      <button
                        key={opt}
                        className={`option-row ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectOption(opt)}
                      >
                        <div className="option-radio">
                          <div className="option-radio-dot" />
                        </div>
                        <div className="option-letter">{opt}.</div>
                        <div className="option-text">{currentQ.options[opt]}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Right: Palette Sidebar ── */}
        <div className="palette-sidebar">

          {/* Candidate Info */}
          <div className="candidate-info-panel">
            <div className="candidate-info-photo">👤</div>
            <div>
              <div className="candidate-info-name">{session.candidate_name}</div>
              <div className="candidate-info-id">ID: {session.candidate_id}</div>
            </div>
          </div>

          {/* Legend */}
          <div className="palette-legend">
            <div className="legend-item">
              <div className="legend-dot answered">{answeredCount}</div>
              <span>Answered</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot not-answered">{notAnsweredCount}</div>
              <span>Not Answered</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot not-visited">{notVisitedCount}</div>
              <span>Not Visited</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot marked">{markedCount}</div>
              <span>Marked for Review</span>
            </div>
          </div>

          {/* Section Header */}
          <div className="palette-section-header">{session.exam_title || 'Section A'}</div>
          <div className="palette-choose-label">Choose a Question</div>

          {/* Question Grid */}
          <div className="palette-scroll">
            <div className="palette-grid">
              {session.questions.map((q, i) => {
                const status = getStatus(q.id, i);
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={q.id}
                    className={`q-pill ${isCurrent ? 'current' : status}`}
                    onClick={() => jumpTo(i)}
                    title={`Question ${i + 1} — ${status.replace('-', ' ')}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ══ 5. FOOTER ACTION BAR ══ */}
      <div className="exam-footer">
        <div className="footer-left">
          <button
            className="footer-btn footer-btn-mark-review"
            onClick={handleMarkForReview}
            disabled={!currentQ}
          >
            🔖 Mark for Review &amp; Next
          </button>
          <button
            className="footer-btn footer-btn-clear"
            onClick={handleClearResponse}
            disabled={!currentQ || !localAnswers[currentQ?.id]}
          >
            ✖ Clear Response
          </button>
        </div>

        <div className="footer-right">
          <button
            className="footer-btn footer-btn-prev"
            onClick={() => jumpTo(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            ← Previous
          </button>
          <button
            className="footer-btn footer-btn-save-next"
            onClick={handleSaveAndNext}
            disabled={!currentQ || isLastQ}
          >
            Save &amp; Next →
          </button>
          <button
            className="footer-btn footer-btn-submit"
            onClick={() => navigate('/review', {
              state: {
                answers: localAnswers,
                marked:  [...markedReview],
                visited: [...visitedQs],
              }
            })}
          >
            Submit
          </button>
        </div>
      </div>

      {/* ══ 6. SUBMIT CONFIRMATION DIALOG ══ */}
      {showSubmitDialog && (
        <div className="submit-dialog-overlay" onClick={() => setShowSubmitDialog(false)}>
          <div className="submit-dialog" onClick={e => e.stopPropagation()}>
            <h3>Confirm Exam Submission</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              Please review your attempt summary below before submitting. This action cannot be undone.
            </p>

            <div className="submit-dialog-stats">
              <div className="dialog-stat-row">
                <span className="dialog-stat-label">Total Questions</span>
                <span className="dialog-stat-value">{session.total_questions}</span>
              </div>
              <div className="dialog-stat-row">
                <span className="dialog-stat-label">Answered</span>
                <span className="dialog-stat-value answered">{answeredCount}</span>
              </div>
              <div className="dialog-stat-row">
                <span className="dialog-stat-label">Not Answered</span>
                <span className="dialog-stat-value not-answered">{notAnsweredCount}</span>
              </div>
              <div className="dialog-stat-row">
                <span className="dialog-stat-label">Marked for Review</span>
                <span className="dialog-stat-value marked">{markedCount}</span>
              </div>
              <div className="dialog-stat-row">
                <span className="dialog-stat-label">Not Visited</span>
                <span className="dialog-stat-value">{notVisitedCount}</span>
              </div>
            </div>

            {notAnsweredCount > 0 && (
              <div className="dialog-warning">
                ⚠ You have {notAnsweredCount} unanswered question{notAnsweredCount > 1 ? 's' : ''}. They will be marked as zero.
              </div>
            )}

            <div className="dialog-actions">
              <button className="dialog-btn dialog-btn-cancel" onClick={() => setShowSubmitDialog(false)}>
                Return to Exam
              </button>
              <button
                className="dialog-btn dialog-btn-submit"
                onClick={() => {
                  setShowSubmitDialog(false);
                  navigate('/summary');
                }}
              >
                Yes, Submit Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
