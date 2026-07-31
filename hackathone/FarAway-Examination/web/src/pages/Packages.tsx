/**
 * Packages — Package Management (Phase 2b)
 * Lists compiled exam packages, shows status, allows verify + download.
 * Wired to: distributionApi.listPackages, packagesApi.verify, packagesApi.generate
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Package, ShieldCheck, ShieldX, Download, RefreshCw, AlertTriangle, Hash } from 'lucide-react';
import {
  Button, Card, Table, LoadingState, PageHeader,
  StatusBadge, EmptyState, StatCard, Alert, Badge,
} from '../components/ui';
import { distributionApi, packagesApi, type PackageStatus, type PackageVerifyResponse } from '../services/api';

// ─── Demo Fallback ────────────────────────────────────────────

const DEMO_PACKAGES: PackageStatus[] = [
  { package_id: 'pkg-aab1', exam_id: 'ex-001', status: 'activated',    created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
  { package_id: 'pkg-bbc2', exam_id: 'ex-002', status: 'distributed',  created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { package_id: 'pkg-ccd3', exam_id: 'ex-003', status: 'generated',    created_at: new Date(Date.now() - 86400000).toISOString() },
];

// ─── Main Page ────────────────────────────────────────────────

export default function Packages() {
  const { getToken } = useAuth();
  const [packages, setPackages]   = useState<PackageStatus[]>([]);
  const [loading, setLoading]     = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);
  const [verifyResults, setVerifyResults] = useState<Record<string, PackageVerifyResponse>>({});
  const [verifying, setVerifying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await distributionApi.listPackages(token!);
      setPackages(res.packages ?? []);
    } catch {
      setPackages(DEMO_PACKAGES);
      setUsingDemo(true);
    } finally { setLoading(false); }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  async function handleVerify(packageId: string) {
    setVerifying(packageId);
    try {
      const token = await getToken();
      const res = await packagesApi.verify(token!, packageId);
      setVerifyResults(r => ({ ...r, [packageId]: res }));
    } catch (e: any) {
      setVerifyResults(r => ({ ...r, [packageId]: { package_id: packageId, valid: false, package_hash: '', checked_at: new Date().toISOString() } }));
    } finally { setVerifying(null); }
  }

  async function handleDownload(packageId: string) {
    try {
      const token = await getToken();
      const res = await packagesApi.download(token!, packageId);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `package-${packageId}.enc`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Download failed: ' + e.message);
    }
  }

  const stats = {
    total:       packages.length,
    generated:   packages.filter(p => p.status === 'generated').length,
    distributed: packages.filter(p => p.status === 'distributed').length,
    activated:   packages.filter(p => p.status === 'activated').length,
  };

  const cols = [
    {
      key: 'package_id',
      label: 'Package ID',
      render: (v: unknown) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={14} color="var(--text-muted)" />
          <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{String(v).substring(0, 12)}…</span>
        </div>
      ),
    },
    { key: 'exam_id', label: 'Exam ID', render: (v: unknown) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{String(v).substring(0, 10)}…</span> },
    { key: 'status',  label: 'Status',  render: (v: unknown) => <StatusBadge status={String(v)} /> },
    { key: 'created_at', label: 'Created', render: (v: unknown) => new Date(String(v)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) },
    {
      key: '__verify',
      label: 'Integrity',
      render: (_: unknown, row: PackageStatus) => {
        const r = verifyResults[row.package_id];
        if (!r) return (
          <Button variant="outline" size="sm" icon={<ShieldCheck size={13} />}
            loading={verifying === row.package_id}
            onClick={() => handleVerify(row.package_id)}
          >Verify</Button>
        );
        return r.valid
          ? <Badge color="green"><ShieldCheck size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Valid</Badge>
          : <Badge color="red"><ShieldX size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Tampered</Badge>;
      },
    },
    {
      key: '__dl',
      label: '',
      render: (_: unknown, row: PackageStatus) => (
        <button className="icon-btn" title="Download encrypted package" onClick={() => handleDownload(row.package_id)}>
          <Download size={15} color="var(--text-muted)" />
        </button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Package Management"
        subtitle="Encrypted exam packages — view status, verify signatures, download payloads"
        breadcrumb={['Home', 'Packages']}
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
        <StatCard label="Total Packages" value={stats.total}       icon={<Package size={18} />}     color="blue" />
        <StatCard label="Generated"      value={stats.generated}   icon={<Hash size={18} />}        color="purple" />
        <StatCard label="Distributed"    value={stats.distributed} icon={<Package size={18} />}     color="yellow" />
        <StatCard label="Activated"      value={stats.activated}   icon={<ShieldCheck size={18} />} color="green" />
      </div>

      {/* Security note */}
      <Alert variant="info">
        All packages are <strong>AES-256-GCM encrypted</strong> and <strong>RSA-2048 PSS signed</strong>. Use Verify to confirm integrity before distribution. The encrypted payload is unreadable without the AES key released via Exam Builder → Release Key.
      </Alert>

      {/* Table */}
      <Card title="Package Registry">
        {loading ? (
          <LoadingState message="Loading packages..." />
        ) : packages.length === 0 ? (
          <EmptyState
            icon={<Package size={40} color="var(--text-muted)" />}
            title="No packages yet"
            description="Compile an exam in Exam Builder to generate a package."
          />
        ) : (
          <Table columns={cols as any} data={packages as any[]} keyField="package_id" />
        )}
      </Card>

      {/* Verify results detail */}
      {Object.keys(verifyResults).length > 0 && (
        <Card title="Verification Results">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(verifyResults).map(([pkgId, res]) => (
              <div key={pkgId} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 8,
                background: res.valid ? 'var(--success-light)' : 'var(--danger-light)',
                border: `1px solid ${res.valid ? 'var(--success)' : 'var(--danger)'}`,
              }}>
                {res.valid ? <ShieldCheck size={16} color="var(--success)" /> : <ShieldX size={16} color="var(--danger)" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{pkgId}</div>
                  {res.package_hash && (
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 2 }}>
                      Hash: {res.package_hash.substring(0, 48)}…
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date(res.checked_at).toLocaleTimeString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
