/** Question Bank page — Phase 2a implementation using Phase 1 design system.
 *  Matches Stitch screen A2 — Question Bank List.
 *  Uses QuestionMeta (Phase 1 api.ts) + Phase 1 CSS vars + ui components.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Plus, Edit2, Trash2, Lock, FileText, Search, AlertCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button, Badge, Table, LoadingState, ErrorState,
  PageHeader, EmptyState, ConfirmDialog,
} from '../components/ui';
import { questionsApi, type QuestionMeta } from '../services/api';

// ─── Demo Fallback (while backend DB is down) ────────────────

const DEMO_QUESTIONS: QuestionMeta[] = [
  { id: 'q-1a2b3c', subject: 'Physics', difficulty: 'hard', is_encrypted: true, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: '' },
  { id: 'q-4d5e6f', subject: 'Chemistry', difficulty: 'medium', is_encrypted: false, created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: '' },
  { id: 'q-7g8h9i', subject: 'Biology', difficulty: 'easy', is_encrypted: true, created_at: new Date(Date.now() - 259200000).toISOString(), updated_at: '' },
  { id: 'q-0j1k2l', subject: 'Physics', difficulty: 'medium', is_encrypted: true, created_at: new Date(Date.now() - 345600000).toISOString(), updated_at: '' },
];

// ─── Helpers ─────────────────────────────────────────────────

function subjectColor(subject: string): 'blue' | 'yellow' | 'green' | 'grey' {
  const map: Record<string, 'blue' | 'yellow' | 'green' | 'grey'> = {
    Physics: 'blue', Chemistry: 'yellow', Biology: 'green',
  };
  return map[subject] ?? 'grey';
}

function difficultyColor(d: string): 'green' | 'yellow' | 'red' | 'grey' {
  const lc = d.toLowerCase();
  return lc === 'easy' ? 'green' : lc === 'medium' ? 'yellow' : lc === 'hard' ? 'red' : 'grey';
}

// ─── Right Sidebar ────────────────────────────────────────────

function StatsSidebar({ total, encrypted, pending }: { total: number; encrypted: number; pending: number }) {
  const pctPhysics = 38, pctChem = 31, pctBio = 31;
  const C = 2 * Math.PI * 60;

  return (
    <div style={{ width: 264, flexShrink: 0, position: 'sticky', top: 74, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Subject Distribution ── */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="section-label" style={{ marginBottom: 16 }}>Database Statistics</div>

        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Subject Distribution
        </div>

        {/* Donut */}
        <div style={{ position: 'relative', width: 130, height: 130, margin: '0 auto 16px' }}>
          <svg viewBox="0 0 160 160" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="80" cy="80" r="60" fill="none" stroke="var(--surface-3)" strokeWidth="20" />
            <circle cx="80" cy="80" r="60" fill="none" stroke="var(--primary)" strokeWidth="20"
              strokeDasharray={`${(pctPhysics / 100) * C} ${C}`} strokeDashoffset="0" />
            <circle cx="80" cy="80" r="60" fill="none" stroke="var(--warning)" strokeWidth="20"
              strokeDasharray={`${(pctChem / 100) * C} ${C}`} strokeDashoffset={`${-(pctPhysics / 100) * C}`} />
            <circle cx="80" cy="80" r="60" fill="none" stroke="var(--success)" strokeWidth="20"
              strokeDasharray={`${(pctBio / 100) * C} ${C}`} strokeDashoffset={`${-((pctPhysics + pctChem) / 100) * C}`} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', lineHeight: 1 }}>{total.toLocaleString()}</span>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>Total</span>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Physics',   pct: pctPhysics, color: 'var(--primary)' },
            { label: 'Chemistry', pct: pctChem,    color: 'var(--warning)' },
            { label: 'Biology',   pct: pctBio,     color: 'var(--success)' },
          ].map(({ label, pct, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</span>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Difficulty Spread ── */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Difficulty Spread
        </div>
        <div style={{ height: 10, borderRadius: 6, display: 'flex', overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ width: '45%', background: 'var(--success)' }} />
          <div style={{ width: '35%', background: 'var(--warning)' }} />
          <div style={{ width: '20%', background: 'var(--danger)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
          <span>Easy 45%</span><span>Med 35%</span><span>Hard 20%</span>
        </div>
      </div>

      {/* ── Security Status ── */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
          Security Status
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            background: 'var(--success-light)', border: '1px solid var(--success-mid)', borderRadius: 8,
            padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={14} color="var(--success)" />
              <span style={{ fontSize: 12.5, color: 'var(--success-text)', fontWeight: 500 }}>Encrypted</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success-text)' }}>{encrypted.toLocaleString()}</span>
          </div>
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={14} color="var(--text-muted)" />
              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500 }}>Pending Review</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{pending}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function Questions() {
  const navigate     = useNavigate();
  const { getToken } = useAuth();
  const [searchParams] = useSearchParams();

  const [questions, setQuestions] = useState<QuestionMeta[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState(searchParams.get('search') ?? '');
  const [subject, setSubject]     = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [usingDemo, setUsingDemo] = useState(false);

  // Sync search from URL param when it changes
  useEffect(() => {
    const q = searchParams.get('search');
    if (q) setSearch(q);
  }, [searchParams]);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true); setError(null);
    try {
      const token = await getToken();
      const res = await questionsApi.list(token!, {
        ...(subject    ? { subject }    : {}),
        ...(difficulty ? { difficulty } : {}),
      });
      if (!signal.aborted) {
        setQuestions(res.items ?? []);
        setUsingDemo(false);
      }
    } catch (e: any) {
      if (!signal.aborted) {
        console.warn('Backend /questions endpoint failed or DB not running. Using demo data.');
        setQuestions(DEMO_QUESTIONS);
        setUsingDemo(true);
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [getToken, subject, difficulty]);

  useEffect(() => { load(); }, [load]);

  const filtered = questions.filter(q => {
    if (!search) return true;
    const s = search.toLowerCase();
    return q.subject.toLowerCase().includes(s)
      || q.id.toLowerCase().includes(s)
      || q.difficulty.toLowerCase().includes(s);
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const token = await getToken();
      await questionsApi.delete(token!, deleteId);
      setQuestions(prev => prev.filter(q => q.id !== deleteId));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const cols = [
    {
      key: 'id', label: 'Q.ID', width: 120,
      render: (v: unknown) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {String(v).slice(0, 8)}…
        </span>
      ),
    },
    {
      key: 'subject', label: 'Subject', width: 100,
      render: (v: unknown) => <Badge color={subjectColor(String(v))}>{String(v)}</Badge>,
    },
    {
      key: 'difficulty', label: 'Difficulty', width: 90,
      render: (v: unknown) => <Badge color={difficultyColor(String(v))} dot>{String(v)}</Badge>,
    },
    {
      key: 'is_encrypted', label: 'Status', width: 120,
      render: (v: unknown) => v
        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: 12, fontWeight: 700 }}><Lock size={13} />ENCRYPTED</span>
        : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}><FileText size={13} />DRAFT</span>,
    },
    {
      key: 'created_at', label: 'Created', width: 100,
      render: (v: unknown) => (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {v ? new Date(String(v)).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'id', label: 'Actions', width: 80,
      render: (_: unknown, row: unknown) => {
        const r = row as QuestionMeta;
        return (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              title="Edit"
              onClick={(e) => { e.stopPropagation(); navigate(`/questions/${r.id}/edit`); }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4 }}
            >
              <Edit2 size={15} />
            </button>
            <button
              title="Delete"
              onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, borderRadius: 4 }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      },
    },
  ];

  const encryptedCount = questions.filter(q => q.is_encrypted).length;
  const pendingCount   = questions.filter(q => !q.is_encrypted).length;

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* Main Area */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <PageHeader
          title="Question Bank"
          subtitle={`${filtered.length.toLocaleString()} questions`}
          breadcrumb={['Home', 'Question Bank']}
          actions={
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/questions/new')}>
              Add Question
            </Button>
          }
        />

        {usingDemo && (
          <div style={{
            background: 'var(--warning-light)', border: '1px solid var(--warning)',
            borderRadius: 8, padding: '10px 16px', fontSize: 13, color: 'var(--warning-text)',
            display: 'flex', alignItems: 'center', gap: 8, marginTop: -8
          }}>
            <AlertCircle size={15} />
            Showing demo data — Database is not running or backend failed to fetch.
          </div>
        )}

        {/* ── Filter Bar ── */}
        <div className="filter-bar">
          <div className="filter-bar-search">
            <Search size={13} className="filter-bar-search-icon" />
            <input
              placeholder="Search by subject or keyword…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search questions"
            />
          </div>

          <div className="filter-bar-divider" />

          <select
            className="filter-bar-select"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            aria-label="Filter by subject"
          >
            <option value="">All Subjects</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Biology">Biology</option>
            <option value="Mathematics">Mathematics</option>
          </select>

          <select
            className="filter-bar-select"
            value={difficulty}
            onChange={e => setDifficulty(e.target.value)}
            aria-label="Filter by difficulty"
          >
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <div className="filter-bar-actions">
            {(search || subject || difficulty) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setSubject(''); setDifficulty(''); }}>
                Clear Filters
              </Button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length.toLocaleString()} result{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <LoadingState message="Loading questions..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText size={32} color="var(--text-muted)" />}
            title="No questions found"
            description="Add a question or adjust your filters."
            action={<Button variant="primary" icon={<Plus size={14} />} onClick={() => navigate('/questions/new')}>Add Question</Button>}
          />
        ) : (
          <Table
            columns={cols as any}
            data={filtered as any}
            keyField="id"
            onRowClick={(row) => navigate(`/questions/${(row as unknown as QuestionMeta).id}/edit`)}
          />
        )}
      </div>

      {/* Right Sidebar */}
      <StatsSidebar total={questions.length} encrypted={encryptedCount} pending={pendingCount} />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Question"
        message="This question will be permanently removed. This action cannot be undone."
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
