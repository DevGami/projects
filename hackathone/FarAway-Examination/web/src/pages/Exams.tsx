/**
 * Exams — Exam Builder (Phase 2b)
 * Create exam blueprints, compile packages, release keys.
 * Wired to: examsApi (list/create/compile), packagesApi (generate), examsApi.releaseKey
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Plus, Play, Key, ChevronRight, FileText, Clock, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import {
  Button, Badge, Card, Table, LoadingState, PageHeader,
  Modal, FormGroup, StatusBadge, EmptyState, StatCard, Alert,
} from '../components/ui';
import { examsApi, type Exam, type ExamCreateRequest, type BlueprintItem } from '../services/api';

// ─── Demo Fallback ────────────────────────────────────────────

const DEMO_EXAMS: Exam[] = [
  { id: 'ex-001', name: 'JEE Mains Mock — Set A', status: 'COMPILED', question_count: 90, exam_date: '2026-07-15', created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 'ex-002', name: 'NEET Practice Paper 1', status: 'DISTRIBUTED', question_count: 180, exam_date: '2026-07-20', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'ex-003', name: 'UPSC Prelims Simulation', status: 'KEY_RELEASED', question_count: 100, exam_date: '2026-07-10', created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'ex-004', name: 'JEE Advanced Trial Run', status: 'DRAFT', question_count: 54, exam_date: '2026-07-25', created_at: new Date().toISOString() },
];

const SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'English', 'History', 'Geography'];
const DIFFICULTIES: BlueprintItem['difficulty'][] = ['easy', 'medium', 'hard'];


// ─── Create Exam Modal ────────────────────────────────────────

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  getToken: () => Promise<string | null>;
}

function CreateExamModal({ open, onClose, onCreated, getToken }: CreateModalProps) {
  const [name, setName]     = useState('');
  const [date, setDate]     = useState('');
  const [duration, setDuration] = useState('180');
  const [blueprint, setBlueprint] = useState<BlueprintItem[]>([
    { subject: 'Physics', difficulty: 'easy', count: 10 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function addRow() {
    setBlueprint(b => [...b, { subject: 'Chemistry', difficulty: 'medium', count: 10 }]);
  }
  function removeRow(i: number) {
    setBlueprint(b => b.filter((_, idx) => idx !== i));
  }
  function updateRow(i: number, field: keyof BlueprintItem, value: string | number) {
    setBlueprint(b => b.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  const totalQ = blueprint.reduce((s, r) => s + Number(r.count), 0);

  async function handleSubmit() {
    if (!name || !date || blueprint.length === 0) { setError('Fill all required fields.'); return; }
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      const body: ExamCreateRequest = {
        name, exam_date: date, duration_minutes: Number(duration), blueprint,
      };
      await examsApi.create(token!, body);
      onCreated();
      onClose();
      setName(''); setDate(''); setBlueprint([{ subject: 'Physics', difficulty: 'easy', count: 10 }]);
    } catch (e: any) {
      setError(e.message ?? 'Failed to create exam (backend stub — coming soon)');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Exam Blueprint" size="lg"
      footer={
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>Create Exam</Button>
        </div>
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <FormGroup label="Exam Name" required>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. JEE Mains Mock A" />
        </FormGroup>
        <FormGroup label="Exam Date" required>
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </FormGroup>
        <FormGroup label="Duration (minutes)" required>
          <input className="input" type="number" value={duration} onChange={e => setDuration(e.target.value)} min={30} max={480} />
        </FormGroup>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          Blueprint <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>{totalQ} total questions</span>
        </div>
        <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={addRow}>Add Row</Button>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', fontSize: 12, color: 'var(--text-muted)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Subject</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Difficulty</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Count</th>
              <th style={{ padding: '8px 12px', width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {blueprint.map((row, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 12px' }}>
                  <select className="input" style={{ padding: '4px 8px' }} value={row.subject} onChange={e => updateRow(i, 'subject', e.target.value)}>
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <select className="input" style={{ padding: '4px 8px' }} value={row.difficulty} onChange={e => updateRow(i, 'difficulty', e.target.value as BlueprintItem['difficulty'])}>
                    {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <input className="input" type="number" style={{ padding: '4px 8px', width: 80 }} value={row.count} min={1} max={100} onChange={e => updateRow(i, 'count', Number(e.target.value))} />
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <button className="icon-btn" onClick={() => removeRow(i)} disabled={blueprint.length === 1}>
                    <Trash2 size={14} color="var(--danger)" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// ─── Key Release Modal ────────────────────────────────────────

interface KeyReleaseModalProps {
  open: boolean;
  examId: string | null;
  onClose: () => void;
  getToken: () => Promise<string | null>;
}

function KeyReleaseModal({ open, examId, onClose, getToken }: KeyReleaseModalProps) {
  const [pem, setPem]       = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleRelease() {
    if (!pem.trim() || !examId) { setError('Paste the center RSA public key (PEM format).'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const token = await getToken();
      const res = await examsApi.releaseKey(token!, examId, pem);
      setResult(res.wrapped_key_b64);
    } catch (e: any) {
      setError(e.message ?? 'Key release failed');
    } finally { setLoading(false); }
  }

  function handleClose() { setPem(''); setResult(null); setError(null); onClose(); }

  return (
    <Modal open={open} onClose={handleClose} title="Release Exam Key (D-012)" size="lg"
      footer={
        result
          ? <Button variant="primary" onClick={handleClose}>Done</Button>
          : <div style={{ display: 'flex', gap: 12 }}>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button variant="primary" icon={<Key size={14} />} onClick={handleRelease} loading={loading}>Release Key</Button>
            </div>
      }
    >
      {!result ? (
        <>
          <Alert variant="warning">
            This action releases the AES decryption key to the exam center. The exam will become live immediately.
          </Alert>
          {error && <Alert variant="danger" >{error}</Alert>}
          <FormGroup label="Center RSA Public Key (PEM)" required hint="Paste the center's public key — only their private key can unwrap the released exam key.">
            <textarea
              className="input"
              style={{ fontFamily: 'monospace', fontSize: 12, minHeight: 160, resize: 'vertical' }}
              value={pem}
              onChange={e => setPem(e.target.value)}
              placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
            />
          </FormGroup>
        </>
      ) : (
        <>
          <Alert variant="success">Key released successfully! Share the wrapped key below with the center securely.</Alert>
          <FormGroup label="Wrapped AES Key (Base64)" hint="Copy this and send to the exam center via secure channel.">
            <textarea
              className="input"
              style={{ fontFamily: 'monospace', fontSize: 11, minHeight: 120, resize: 'none' }}
              value={result}
              readOnly
              onClick={e => (e.target as HTMLTextAreaElement).select()}
            />
          </FormGroup>
        </>
      )}
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function Exams() {
  const { getToken } = useAuth();
  const [exams, setExams]       = useState<Exam[]>([]);
  const [loading, setLoading]   = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [compiling, setCompiling] = useState<string | null>(null);
  const [releaseExamId, setReleaseExamId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await examsApi.list(token!);
      setExams((res as any)?.items ?? (Array.isArray(res) ? res : []));
    } catch {
      setExams(DEMO_EXAMS);
      setUsingDemo(true);
    } finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  async function handleCompile(examId: string) {
    setCompiling(examId);
    try {
      const token = await getToken();
      await examsApi.compile(token!, examId);
      await load();
    } catch (e: any) {
      alert('Compile failed (backend stub): ' + e.message);
    } finally { setCompiling(null); }
  }

  const stats = {
    total:     exams.length,
    compiled:  exams.filter(e => e.status === 'COMPILED').length,
    active:    exams.filter(e => ['KEY_RELEASED', 'ACTIVE'].includes(e.status)).length,
    draft:     exams.filter(e => e.status === 'DRAFT').length,
  };

  const cols = [
    { key: 'name',           label: 'Exam Name',    render: (_: unknown, row: Exam) => (
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{row.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
          {row.exam_date && !isNaN(Date.parse(row.exam_date))
            ? new Date(row.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'Date Not Set'}
        </div>
      </div>
    )},
    { key: 'question_count', label: 'Questions',    render: (v: unknown) => <span style={{ fontWeight: 600 }}>{String(v)}</span> },
    { key: 'status',         label: 'Status',       render: (v: unknown) => <StatusBadge status={String(v)} /> },
    { key: 'created_at',     label: 'Created',      render: (v: unknown) => new Date(String(v)).toLocaleDateString('en-IN') },
    { key: '__actions',      label: 'Actions',      render: (_: unknown, row: Exam) => {
      const status = (row.status || '').toUpperCase();
      return (
      <div style={{ display: 'flex', gap: 8 }}>
        {status === 'DRAFT' && (
          <Button variant="outline" size="sm" icon={<Play size={13} />}
            loading={compiling === row.id}
            onClick={e => { e.stopPropagation(); handleCompile(row.id); }}
          >Compile</Button>
        )}
        {(status === 'COMPILED' || status === 'DISTRIBUTED') && (
          <Button variant="primary" size="sm" icon={<Key size={13} />}
            onClick={e => { e.stopPropagation(); setReleaseExamId(row.id); }}
          >Release Key</Button>
        )}
        {status === 'KEY_RELEASED' && (
          <Badge color="green"><CheckCircle size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Live</Badge>
        )}
      </div>
    )}},
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Exam Builder"
        subtitle={`${stats.total} exams — ${stats.draft} draft, ${stats.compiled} compiled, ${stats.active} active`}
        breadcrumb={['Home', 'Exam Builder']}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            New Exam
          </Button>
        }
      />

      {usingDemo && (
        <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15} /> Showing demo data — backend exam CRUD is a stub (compile/release-key are fully implemented).
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="Total Exams" value={stats.total} icon={<FileText size={18} />} color="blue" />
        <StatCard label="Draft" value={stats.draft} icon={<FileText size={18} />} color="yellow" />
        <StatCard label="Compiled" value={stats.compiled} icon={<CheckCircle size={18} />} color="purple" />
        <StatCard label="Active / Live" value={stats.active} icon={<Key size={18} />} color="green" />
      </div>

      {/* Table */}
      <Card title="Exam List">
        {loading ? (
          <LoadingState message="Loading exams..." />
        ) : exams.length === 0 ? (
          <EmptyState
            icon={<FileText size={40} color="var(--text-muted)" />}
            title="No exams yet"
            description="Create your first exam blueprint to get started."
            action={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>New Exam</Button>}
          />
        ) : (
          <Table
            columns={cols as any}
            data={exams as any[]}
            keyField="id"
          />
        )}
      </Card>

      {/* Blueprint pipeline legend */}
      <Card title="Exam Pipeline">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 0' }}>
          {['DRAFT', 'COMPILED', 'DISTRIBUTED', 'KEY_RELEASED', 'ACTIVE', 'COMPLETED'].map((s, i, arr) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge status={s} />
              {i < arr.length - 1 && <ChevronRight size={14} color="var(--text-muted)" />}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
          After creating an exam, click <strong>Compile</strong> to generate a signed encrypted package. Then use <strong>Release Key</strong> to make it live at the exam center.
        </p>
      </Card>

      {/* Modals */}
      <CreateExamModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} getToken={getToken} />
      <KeyReleaseModal open={!!releaseExamId} examId={releaseExamId} onClose={() => setReleaseExamId(null)} getToken={getToken} />
    </div>
  );
}
