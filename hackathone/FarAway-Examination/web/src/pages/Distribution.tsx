/**
 * Distribution & Key Release (Phase 2b)
 * View all package delivery statuses, release keys to centers.
 * Wired to: distributionApi, examsApi.releaseKey
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Send, Key, RefreshCw, MapPin, AlertTriangle, Activity, CheckCircle, Clock } from 'lucide-react';
import {
  Button, Card, Table, LoadingState, PageHeader,
  StatusBadge, EmptyState, StatCard, Alert,
} from '../components/ui';
import { distributionApi, type PackageStatus } from '../services/api';

// ─── Demo Fallback ────────────────────────────────────────────

const DEMO_DISTRIBUTION: (PackageStatus & { center_name?: string; center_city?: string })[] = [
  { package_id: 'pkg-aab1', exam_id: 'ex-001', status: 'activated',    created_at: new Date(Date.now() - 86400000 * 3).toISOString(), center_name: 'Delhi Exam Hub',    center_city: 'New Delhi' },
  { package_id: 'pkg-bbc2', exam_id: 'ex-002', status: 'distributed',  created_at: new Date(Date.now() - 86400000 * 2).toISOString(), center_name: 'Mumbai Center 1', center_city: 'Mumbai' },
  { package_id: 'pkg-ccd3', exam_id: 'ex-003', status: 'generated',    created_at: new Date(Date.now() - 86400000).toISOString(),     center_name: 'Bangalore Hub',   center_city: 'Bangalore' },
];

// ─── Main Page ────────────────────────────────────────────────

export default function Distribution() {
  const { getToken } = useAuth();
  const [packages, setPackages]   = useState<typeof DEMO_DISTRIBUTION>([]);
  const [loading, setLoading]     = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await distributionApi.listPackages(token!);
      setPackages(res.packages ?? []);
    } catch {
      setPackages(DEMO_DISTRIBUTION);
      setUsingDemo(true);
    } finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const stats = {
    total:       packages.length,
    generated:   packages.filter(p => p.status === 'generated').length,
    distributed: packages.filter(p => p.status === 'distributed').length,
    activated:   packages.filter(p => p.status === 'activated').length,
  };

  // Status step display
  function StatusTimeline({ status }: { status: string }) {
    const steps = [
      { id: 'generated',   label: 'Generated',    icon: <Activity size={12} /> },
      { id: 'distributed', label: 'Distributed',  icon: <Send size={12} /> },
      { id: 'activated',   label: 'Key Released',  icon: <Key size={12} /> },
    ];
    const idx = steps.findIndex(s => s.id === status);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {steps.map((step, i) => (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: i <= idx ? 'var(--primary)' : 'var(--surface-2)',
              color: i <= idx ? '#fff' : 'var(--text-muted)',
              fontSize: 10,
            }}>
              {i < idx ? <CheckCircle size={12} /> : step.icon}
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 24, height: 2, background: i < idx ? 'var(--primary)' : 'var(--border)' }} />
            )}
          </div>
        ))}
      </div>
    );
  }

  const cols = [
    {
      key: 'center_name',
      label: 'Center',
      render: (_: unknown, row: typeof DEMO_DISTRIBUTION[0]) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{row.center_name ?? '—'}</div>
          {row.center_city && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <MapPin size={11} />{row.center_city}
            </div>
          )}
        </div>
      ),
    },
    { key: 'package_id', label: 'Package ID', render: (v: unknown) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(v).substring(0, 12)}…</span> },
    { key: 'status',     label: 'Status',     render: (v: unknown) => <StatusBadge status={String(v)} /> },
    {
      key: '__timeline',
      label: 'Progress',
      render: (_: unknown, row: typeof DEMO_DISTRIBUTION[0]) => <StatusTimeline status={row.status} />,
    },
    { key: 'created_at', label: 'Created', render: (v: unknown) => (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Clock size={11} />{new Date(String(v)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
      </div>
    )},
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Distribution & Key Release"
        subtitle="Track package delivery to exam centers and manage AES key release"
        breadcrumb={['Home', 'Distribution']}
        actions={
          <Button variant="outline" icon={<RefreshCw size={15} />} onClick={load}>Refresh</Button>
        }
      />

      {usingDemo && (
        <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15} /> Showing demo data — backend DB not running.
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard label="Total Packages" value={stats.total}       icon={<Activity size={18} />}   color="blue"   />
        <StatCard label="Generated"      value={stats.generated}   icon={<Activity size={18} />}   color="purple" />
        <StatCard label="Distributed"    value={stats.distributed} icon={<Send size={18} />}       color="yellow" />
        <StatCard label="Keys Released"  value={stats.activated}   icon={<Key size={18} />}        color="green"  />
      </div>

      <Alert variant="info">
        To release a key to a center, go to <strong>Exam Builder</strong>, find the exam, and click <strong>Release Key</strong>. Paste the center's RSA public key — only their private key can unwrap the AES exam key.
      </Alert>

      {/* Distribution table */}
      <Card title="Center Distribution Status">
        {loading ? (
          <LoadingState message="Loading distribution status..." />
        ) : packages.length === 0 ? (
          <EmptyState
            icon={<Send size={40} color="var(--text-muted)" />}
            title="No packages distributed yet"
            description="Compile an exam in Exam Builder, then come back here to track delivery."
          />
        ) : (
          <Table columns={cols as any} data={packages as any[]} keyField="package_id" />
        )}
      </Card>

      {/* Workflow guide */}
      <Card title="Distribution Workflow">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, padding: '8px 0' }}>
          {[
            { icon: <Activity size={20} />, step: '1. Generate', desc: 'Compile exam in Exam Builder. Package is encrypted + RSA-signed.' },
            { icon: <Send size={20} />, step: '2. Distribute', desc: 'Package is sent to the exam center. Center downloads encrypted payload.' },
            { icon: <Key size={20} />, step: '3. Release Key', desc: 'At exam start, admin releases AES key wrapped with center\'s RSA public key.' },
          ].map(({ icon, step, desc }) => (
            <div key={step} style={{ display: 'flex', gap: 12, padding: 16, background: 'var(--surface-2)', borderRadius: 10 }}>
              <div style={{ color: 'var(--primary)', marginTop: 2, flexShrink: 0 }}>{icon}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{step}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
