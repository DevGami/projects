/**
 * Centers — Center Management (Phase 2b)
 * CRUD for exam centers, seating capacity, assigned exams.
 * Wired to: centersApi (GAP-1/2/3 — falls back to demo data until backend adds centers.py)
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Plus, MapPin, Users, Building, Edit2, Trash2, AlertTriangle, Search } from 'lucide-react';
import {
  Button, Card, Table, LoadingState, PageHeader,
  Modal, FormGroup, StatusBadge, ConfirmDialog, EmptyState, StatCard, Alert,
} from '../components/ui';
import { centersApi, type Center, type CenterCreateRequest } from '../services/api';

// ─── Demo Fallback ────────────────────────────────────────────

const DEMO_CENTERS: Center[] = [
  { id: 'ctr-001', name: 'Delhi Examination Hub',    city: 'New Delhi',  state: 'Delhi',         seat_count: 200, assigned_exam: 'JEE Mains Mock — Set A', risk_score: 0.12, status: 'active' },
  { id: 'ctr-002', name: 'Mumbai Central Venue',     city: 'Mumbai',     state: 'Maharashtra',   seat_count: 350, assigned_exam: 'NEET Practice Paper 1',  risk_score: 0.08, status: 'active' },
  { id: 'ctr-003', name: 'Bangalore South Center',   city: 'Bangalore',  state: 'Karnataka',     seat_count: 150, assigned_exam: undefined,                risk_score: 0.05, status: 'active' },
  { id: 'ctr-004', name: 'Chennai Exam Hall A',      city: 'Chennai',    state: 'Tamil Nadu',    seat_count: 180, assigned_exam: 'UPSC Prelims Simulation', risk_score: 0.21, status: 'active' },
  { id: 'ctr-005', name: 'Pune Technology Park',     city: 'Pune',       state: 'Maharashtra',   seat_count: 120, assigned_exam: undefined,                risk_score: 0.03, status: 'inactive' },
];

const INDIAN_STATES = ['Andhra Pradesh','Delhi','Goa','Gujarat','Karnataka','Kerala','Maharashtra','Rajasthan','Tamil Nadu','Telangana','Uttar Pradesh','West Bengal'];

// ─── Risk Bar ────────────────────────────────────────────────

function RiskBar({ score }: { score?: number }) {
  const s = score ?? 0;
  const color = s > 0.2 ? 'var(--danger)' : s > 0.1 ? 'var(--warning)' : 'var(--success)';
  const label = s > 0.2 ? 'High' : s > 0.1 ? 'Medium' : 'Low';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 60, height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(s * 500, 100)}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>
    </div>
  );
}

// ─── Create/Edit Modal ────────────────────────────────────────

interface CenterModalProps {
  open: boolean;
  editing: Center | null;
  onClose: () => void;
  onSaved: () => void;
  getToken: () => Promise<string | null>;
  usingDemo: boolean;
}

function CenterModal({ open, editing, onClose, onSaved, getToken, usingDemo }: CenterModalProps) {
  const [form, setForm] = useState<CenterCreateRequest>({ name: '', city: '', state: 'Delhi', address: '', seat_count: 100 });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({ name: editing.name, city: editing.city, state: editing.state, address: '', seat_count: editing.seat_count });
    } else {
      setForm({ name: '', city: '', state: 'Delhi', address: '', seat_count: 100 });
    }
    setError(null);
  }, [editing, open]);

  function set(field: keyof CenterCreateRequest, value: string | number) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.name || !form.city) { setError('Name and city are required.'); return; }
    setSaving(true); setError(null);
    try {
      if (usingDemo) {
        // Simulate success in demo mode
        await new Promise(r => setTimeout(r, 600));
        onSaved(); onClose();
        return;
      }
      const token = await getToken();
      if (editing) {
        await centersApi.update(token!, editing.id, form);
      } else {
        await centersApi.create(token!, form);
      }
      onSaved(); onClose();
    } catch (e: any) {
      setError(e.message ?? 'Save failed (backend endpoint not yet implemented — GAP-1/2)');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Center' : 'Add Exam Center'} size="lg"
      footer={
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Add Center'}</Button>
        </div>
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}
      {usingDemo && <Alert variant="warning">Demo mode — changes won't persist to DB.</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <FormGroup label="Center Name" required>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Delhi Exam Hub" />
        </FormGroup>
        <FormGroup label="Seat Count" required>
          <input className="input" type="number" min={10} max={1000} value={form.seat_count} onChange={e => set('seat_count', Number(e.target.value))} />
        </FormGroup>
        <FormGroup label="City" required>
          <input className="input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Mumbai" />
        </FormGroup>
        <FormGroup label="State" required>
          <select className="input" value={form.state} onChange={e => set('state', e.target.value)}>
            {INDIAN_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
        </FormGroup>
      </div>
      <FormGroup label="Full Address" hint="Building number, street, landmark">
        <textarea className="input" rows={2} value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, Connaught Place…" />
      </FormGroup>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function Centers() {
  const { getToken } = useAuth();
  const [centers, setCenters]   = useState<Center[]>([]);
  const [loading, setLoading]   = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [search, setSearch]     = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]   = useState<Center | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await centersApi.list(token!);
      setCenters(res.items ?? []);
    } catch {
      setCenters(DEMO_CENTERS);
      setUsingDemo(true);
    } finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setModalOpen(true); }
  function openEdit(c: Center) { setEditing(c); setModalOpen(true); }

  async function handleDelete() {
    if (!deleteId) return;
    if (usingDemo) {
      setCenters(c => c.filter(x => x.id !== deleteId));
      setDeleteId(null); return;
    }
    
    try {
      const token = await getToken();
      await centersApi.delete(token!, deleteId);
      load(); // Reload after delete
    } catch (e: any) {
      alert(e.message ?? 'Failed to delete center');
    } finally {
      setDeleteId(null);
    }
  }

  function onSaved() {
    if (usingDemo) {
      // Re-load demo data
      setCenters(DEMO_CENTERS);
    } else { load(); }
  }

  const filtered = centers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.city.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total:    centers.length,
    active:   centers.filter(c => c.status === 'active').length,
    assigned: centers.filter(c => c.assigned_exam).length,
    seats:    centers.reduce((s, c) => s + c.seat_count, 0),
  };

  const cols = [
    {
      key: 'name',
      label: 'Center',
      render: (_: unknown, row: Center) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Building size={13} color="var(--text-muted)" />{row.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <MapPin size={11} />{row.city}, {row.state}
          </div>
        </div>
      ),
    },
    {
      key: 'seat_count',
      label: 'Seats',
      render: (v: unknown) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={13} color="var(--text-muted)" />
          <span style={{ fontWeight: 600 }}>{String(v)}</span>
        </div>
      ),
    },
    { key: 'assigned_exam', label: 'Assigned Exam', render: (v: unknown) => v ? <span style={{ fontSize: 13 }}>{String(v)}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span> },
    { key: 'risk_score',   label: 'Risk Score',    render: (v: unknown) => <RiskBar score={Number(v)} /> },
    { key: 'status',       label: 'Status',        render: (v: unknown) => <StatusBadge status={String(v)} /> },
    {
      key: '__actions',
      label: '',
      render: (_: unknown, row: Center) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn" title="Edit center" onClick={() => openEdit(row)}><Edit2 size={14} /></button>
          <button className="icon-btn" title="Delete center" onClick={() => setDeleteId(row.id)}><Trash2 size={14} color="var(--danger)" /></button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Center Management"
        subtitle={`${stats.total} exam centers — ${stats.active} active, ${stats.assigned} assigned`}
        breadcrumb={['Home', 'Centers']}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>Add Center</Button>
        }
      />

      {usingDemo && (
        <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15} /> Showing demo data — backend GAP-1/2/3 (centers CRUD) not yet implemented.
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="Total Centers"   value={stats.total}    icon={<Building size={18} />} color="blue" />
        <StatCard label="Active"          value={stats.active}   icon={<Building size={18} />} color="green" />
        <StatCard label="Exam Assigned"   value={stats.assigned} icon={<MapPin size={18} />}   color="yellow" />
        <StatCard label="Total Seats"     value={stats.seats}    icon={<Users size={18} />}    color="purple" />
      </div>

      {/* ── Filter Bar ── */}
      <div className="filter-bar">
        <div className="filter-bar-search">
          <Search size={13} className="filter-bar-search-icon" />
          <input
            placeholder="Search by name or city…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search centers"
          />
        </div>
        <div className="filter-bar-actions">
          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch('')}>Clear</Button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {filtered.length} of {centers.length} centers
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <Card title="Exam Centers" subtitle={`${stats.active} active · ${stats.seats.toLocaleString()} total seats`}>
        {loading ? (
          <LoadingState message="Loading centers..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Building size={40} color="var(--text-muted)" />}
            title={search ? 'No centers match your search' : 'No centers yet'}
            description={!search ? 'Add your first exam center to get started.' : undefined}
            action={!search ? <Button variant="primary" icon={<Plus size={14} />} onClick={openCreate}>Add Center</Button> : undefined}
          />
        ) : (
          <Table columns={cols as any} data={filtered as any[]} keyField="id" />
        )}
      </Card>

      {/* Modals */}
      <CenterModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} onSaved={onSaved} getToken={getToken} usingDemo={usingDemo} />
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Center"
        message="Are you sure you want to delete this exam center? This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
