/**
 * ReviewPage — Pre-submission Question Review Screen
 *
 * Shows all questions grouped by status (Answered, Marked, Not Answered, Not Visited)
 * before the candidate confirms final submission.
 *
 * Reached from ExamPage via "Submit" button.
 * Routes to SummaryPage on confirm, back to ExamPage on "Return".
 */
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSession, ExamSession, AuthResponse } from '../services/edgeApi';

type QStatus = 'answered' | 'marked' | 'ans-marked' | 'not-answered' | 'not-visited';

interface ReviewQuestion {
  id: string;
  index: number;
  content: string;
  status: QStatus;
  selected_option?: 'A' | 'B' | 'C' | 'D';
}

export default function ReviewPage() {
  const navigate   = useNavigate();
  const location   = useLocation();

  // Answers/marked state passed from ExamPage via router state
  const passedAnswers  = (location.state?.answers || {})  as Record<string, 'A'|'B'|'C'|'D'>;
  const passedMarked   = new Set<string>(location.state?.marked || []);
  const passedVisited  = new Set<string>(location.state?.visited || []);

  const [session,    setSession]    = useState<ExamSession | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [questions,  setQuestions]  = useState<ReviewQuestion[]>([]);
  const [activeTab,  setActiveTab]  = useState<QStatus | 'all'>('all');

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('exam_session');
      if (!stored) { navigate('/'); return; }
      const auth: AuthResponse = JSON.parse(stored);

      try {
        const sess = await getSession(auth.session_id, auth.token);
        setSession(sess);

        // Enrich each question with its computed status
        const qs: ReviewQuestion[] = sess.questions.map((q, i) => {
          const answered  = !!(passedAnswers[q.id] || q.selected_option);
          const marked    = passedMarked.has(q.id);
          const visited   = passedVisited.has(q.id) || answered || marked;

          let status: QStatus;
          if (answered && marked) status = 'ans-marked';
          else if (answered)      status = 'answered';
          else if (marked)        status = 'marked';
          else if (visited)       status = 'not-answered';
          else                    status = 'not-visited';

          return {
            id: q.id,
            index: i,
            content: q.content,
            status,
            selected_option: passedAnswers[q.id] || q.selected_option,
          };
        });
        setQuestions(qs);
        setLoading(false);
      } catch {
        navigate('/exam');
      }
    };
    init();
  }, []);

  if (loading || !session) return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #e0e0e0', borderTopColor: '#0d5caa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  // Counts
  const answered    = questions.filter(q => q.status === 'answered' || q.status === 'ans-marked').length;
  const notAnswered = questions.filter(q => q.status === 'not-answered').length;
  const marked      = questions.filter(q => q.status === 'marked' || q.status === 'ans-marked').length;
  const notVisited  = questions.filter(q => q.status === 'not-visited').length;

  // Filter by tab
  const filtered = activeTab === 'all'
    ? questions
    : questions.filter(q => q.status === activeTab);

  const statusLabel: Record<QStatus, string> = {
    'answered':     'Answered',
    'not-answered': 'Not Answered',
    'not-visited':  'Not Visited',
    'marked':       'Marked for Review',
    'ans-marked':   'Answered & Marked',
  };
  const statusColor: Record<QStatus, string> = {
    'answered':     '#26a65b',
    'not-answered': '#e74c3c',
    'not-visited':  '#95a5a6',
    'marked':       '#8e44ad',
    'ans-marked':   '#27ae60',
  };

  return (
    <div className="review-page">

      {/* ── Header ── */}
      <div className="review-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🛡️</span>
          <div>
            <div className="review-header-title">Review Your Answers</div>
            <div className="review-header-sub">{session.exam_title} · {session.candidate_name}</div>
          </div>
        </div>
        <button className="review-back-btn" onClick={() => navigate('/exam', { state: { answers: passedAnswers, marked: [...passedMarked] } })}>
          ← Return to Exam
        </button>
      </div>

      {/* ── Summary Stats Bar ── */}
      <div className="review-stats-bar">
        <div className="review-stat-item total" onClick={() => setActiveTab('all')}>
          <span className="stat-num">{questions.length}</span>
          <span className="stat-lbl">Total</span>
        </div>
        <div className="review-stat-item answered" onClick={() => setActiveTab('answered')}>
          <span className="stat-num">{answered}</span>
          <span className="stat-lbl">Answered</span>
        </div>
        <div className="review-stat-item not-answered" onClick={() => setActiveTab('not-answered')}>
          <span className="stat-num">{notAnswered}</span>
          <span className="stat-lbl">Not Answered</span>
        </div>
        <div className="review-stat-item marked" onClick={() => setActiveTab('marked')}>
          <span className="stat-num">{marked}</span>
          <span className="stat-lbl">Marked for Review</span>
        </div>
        <div className="review-stat-item not-visited" onClick={() => setActiveTab('not-visited')}>
          <span className="stat-num">{notVisited}</span>
          <span className="stat-lbl">Not Visited</span>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="review-tabs">
        {(['all', 'answered', 'not-answered', 'marked', 'not-visited'] as const).map(tab => (
          <button
            key={tab}
            className={`review-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            style={activeTab === tab ? { borderBottomColor: tab === 'all' ? '#0d5caa' : statusColor[tab as QStatus] || '#0d5caa' } : {}}
          >
            {tab === 'all' ? 'All Questions' : statusLabel[tab as QStatus]}
            <span className="review-tab-count">
              {tab === 'all' ? questions.length
                : tab === 'answered' ? answered
                : tab === 'not-answered' ? notAnswered
                : tab === 'marked' ? marked
                : notVisited}
            </span>
          </button>
        ))}
      </div>

      {/* ── Warning Banner ── */}
      {notAnswered > 0 && (
        <div className="review-warning">
          ⚠ You have <strong>{notAnswered}</strong> unanswered question{notAnswered > 1 ? 's' : ''} that will receive zero marks.
          {notVisited > 0 && <> Additionally, <strong>{notVisited}</strong> question{notVisited > 1 ? 's' : ''} {notVisited > 1 ? 'were' : 'was'} never visited.</>}
        </div>
      )}

      {/* ── Question List ── */}
      <div className="review-list-wrapper">
        {filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
            No questions in this category.
          </div>
        ) : (
          <div className="review-question-list">
            {filtered.map(q => (
              <div
                key={q.id}
                className="review-question-card"
                onClick={() => navigate('/exam', { state: { jumpTo: q.index, answers: passedAnswers, marked: [...passedMarked] } })}
              >
                <div className="rq-number-col">
                  <div className="rq-pill" style={{ background: statusColor[q.status] }}>
                    {q.index + 1}
                  </div>
                </div>
                <div className="rq-content-col">
                  <div className="rq-content">
                    {q.content.length > 120 ? q.content.slice(0, 120) + '…' : q.content}
                  </div>
                  <div className="rq-meta">
                    <span className="rq-status-badge" style={{ background: statusColor[q.status] + '22', color: statusColor[q.status], borderColor: statusColor[q.status] + '55' }}>
                      {statusLabel[q.status]}
                    </span>
                    {q.selected_option && (
                      <span className="rq-answer-badge">
                        Selected: <strong>{q.selected_option}</strong>
                      </span>
                    )}
                  </div>
                </div>
                <div className="rq-edit-col">
                  <button className="rq-edit-btn">Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="review-footer">
        <div style={{ fontSize: 12.5, color: '#666' }}>
          Once submitted, your answers cannot be changed. Please review carefully.
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="review-footer-btn back"
            onClick={() => navigate('/exam', { state: { answers: passedAnswers, marked: [...passedMarked] } })}
          >
            ← Go Back to Exam
          </button>
          <button
            className="review-footer-btn submit"
            onClick={() => navigate('/summary')}
          >
            ✓ Confirm &amp; Submit
          </button>
        </div>
      </div>
    </div>
  );
}
