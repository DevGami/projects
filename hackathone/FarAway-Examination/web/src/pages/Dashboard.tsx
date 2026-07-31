/**
 * A1 — Admin Dashboard
 * System overview: stat cards, activity feed, center risk map, distribution status.
 * Falls back to demo data when GAP-3 (dashboard/stats) is not yet live.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  ClipboardList, Building2, AlertTriangle, Users,
  Package, Eye, Key, AlertCircle, RefreshCw, CheckCircle,
  Activity, TrendingUp, Shield, Truck,
} from 'lucide-react';
import { StatCard, Card, LoadingState, ErrorState, Button, Badge } from '../components/ui';
import { dashboardApi, type DashboardStats, type ActivityItem, type PackageDistStatus } from '../services/api';
import { Link } from 'react-router-dom';

// ── Color map ──────────────────────────────────────────────────

const ACTIVITY_COLORS: Record<string, string> = {
  SUCCESS: 'var(--success)',
  WARNING: 'var(--warning)',
  ERROR:   'var(--danger)',
  CRYPTO:  'var(--purple)',
  INFO:    'var(--primary)',
};

const ACTIVITY_BG: Record<string, string> = {
  SUCCESS: 'var(--success-bg)',
  WARNING: 'var(--warning-bg)',
  ERROR:   'var(--danger-bg)',
  CRYPTO:  'rgba(106,27,154,0.08)',
  INFO:    'var(--primary-bg)',
};

// ── Sub-components ─────────────────────────────────────────────

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, i) => {
        const color = ACTIVITY_COLORS[item.type] ?? 'var(--primary)';
        const bg    = ACTIVITY_BG[item.type]    ?? 'var(--primary-bg)';
        return (
          <div key={item.id ?? i} className="activity-item">
            <span
              className="activity-type-badge"
              style={{ color, background: bg }}
            >
              {item.type}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.45, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.message}
              </p>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.actor}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DistributionBar({ pkg }: { pkg: PackageDistStatus }) {
  const pct   = pkg.total > 0 ? Math.round((pkg.distributed / pkg.total) * 100) : 0;
  const color = pct === 100 ? 'var(--success)' : pct >= 60 ? 'var(--primary)' : 'var(--warning)';
  const label = pct === 100 ? 'Complete' : pct >= 60 ? 'In Progress' : 'Pending';
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{pkg.exam_name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {pkg.distributed}/{pkg.total} centers
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{pct}%</span>
          <span style={{ fontSize: 10, fontWeight: 600, color, background: color + '18', padding: '1px 6px', borderRadius: 3 }}>{label}</span>
        </div>
      </div>
      <div className="progress-bar" style={{ height: 7 }}>
        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

const RISK_CENTERS = [
  { code: 'DEL-01', risk: 'low' },  { code: 'DEL-12', risk: 'high' },
  { code: 'MUM-89', risk: 'med' },  { code: 'KOL-22', risk: 'low' },
  { code: 'CHE-05', risk: 'low' },  { code: 'BLR-47', risk: 'low' },
  { code: 'PUN-14', risk: 'low' },  { code: 'HYD-99', risk: 'med' },
  { code: 'AHM-03', risk: 'low' },  { code: 'LUC-11', risk: 'low' },
  { code: 'PAT-88', risk: 'high' }, { code: 'JAI-02', risk: 'low' },
];

const DEMO_STATS: DashboardStats = {
  total_questions: 3847, total_exams: 14,
  total_centers: 312,    total_audit_events: 10420,
  active_sessions: 227000, critical_alerts: 3,
  recent_activity: [
    { id: '1', type: 'SUCCESS', message: 'Package delivered to Center #47 (Delhi Hub)', actor: 'NTA System', timestamp: new Date(Date.now() - 120000).toISOString() },
    { id: '2', type: 'INFO',    message: 'Anomaly flagged at Delhi Center 12 — GAZE_DEVIATION', actor: 'Edge AI', timestamp: new Date(Date.now() - 300000).toISOString() },
    { id: '3', type: 'CRYPTO',  message: 'Exam package NEET-2026-S1 compiled & encrypted (AES-256-GCM)', actor: 'Admin Sharma', timestamp: new Date(Date.now() - 1080000).toISOString() },
    { id: '4', type: 'SUCCESS', message: '847 candidates authenticated via QR + biometric', actor: 'Edge Server', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: '5', type: 'WARNING', message: 'Center #89 (Mumbai) risk score elevated to HIGH', actor: 'AI Model', timestamp: new Date(Date.now() - 7200000).toISOString() },
    { id: '6', type: 'INFO',    message: 'Question bank updated — 340 new questions added', actor: 'Expert Mehta', timestamp: new Date(Date.now() - 10800000).toISOString() },
  ],
  package_distribution_status: [
    { exam_name: 'NEET-UG-2026 (Phase 1)', distributed: 280, total: 300 },
    { exam_name: 'JEE-Mains-Apr-Session 1', distributed: 85, total: 120 },
    { exam_name: 'CUET-PG-Science', distributed: 12, total: 45 },
  ],
};

// ── Main Page ──────────────────────────────────────────────────

export default function Dashboard() {
  const { getToken } = useAuth();
  const [stats,    setStats]    = useState<DashboardStats | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [usingDemo, setDemo]    = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const data  = await dashboardApi.getStats(token!);
      setStats(data);
      setDemo(false);
    } catch {
      setStats(DEMO_STATS);
      setDemo(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState message="Loading dashboard…" />;
  if (!stats)  return <ErrorState message="Failed to load dashboard." onRetry={load} />;

  const riskCounts = {
    high: RISK_CENTERS.filter(c => c.risk === 'high').length,
    med:  RISK_CENTERS.filter(c => c.risk === 'med').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Demo Banner */}
      {usingDemo && (
        <div className="alert alert-warning" style={{ marginBottom: 0 }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>Demo Data</strong> — live backend endpoint <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>GET /dashboard/stats</code> is not yet active (Backend GAP-6).
          </span>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div className="page-header-left">
          <div className="page-header-breadcrumb">Admin Portal</div>
          <h1>System Overview</h1>
          <p>National examination operations — real-time command view.</p>
        </div>
        <div className="page-header-actions">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={load} loading={loading}>
            Refresh
          </Button>
          <Link to="/monitoring">
            <Button variant="secondary" size="sm" icon={<Eye size={13} />}>Live Monitor</Button>
          </Link>
          <Button
            variant="outline" size="sm" icon={<Key size={13} />}
            style={{ color: 'var(--warning)', borderColor: 'var(--warning)' }}
          >
            Release Key
          </Button>
          <Link to="/exams">
            <Button variant="primary" size="sm" icon={<Package size={13} />}>Compile Exam</Button>
          </Link>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="stats-grid">
        <StatCard
          label="Scheduled Exams"
          value={stats.total_exams}
          change="3 in progress"
          icon={<ClipboardList size={20} />}
          color="blue"
        />
        <StatCard
          label="Active Centers"
          value={stats.total_centers}
          change="312 registered"
          icon={<Building2 size={20} />}
          color="green"
        />
        <StatCard
          label="Enrolled Candidates"
          value={stats.active_sessions.toLocaleString()}
          change={`${riskCounts.high} high-risk centers`}
          changeDir={riskCounts.high > 0 ? 'down' : 'neutral'}
          icon={<Users size={20} />}
          color="blue"
        />
        <StatCard
          label="Critical Alerts"
          value={stats.critical_alerts}
          change={stats.critical_alerts > 0 ? 'Requires attention' : 'All clear'}
          changeDir={stats.critical_alerts > 0 ? 'down' : 'up'}
          icon={<AlertTriangle size={20} />}
          color={stats.critical_alerts > 0 ? 'red' : 'green'}
        />
      </div>

      {/* ── System Status Row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow-card)' }}>
        {[
          { label: 'Audit Ledger',      ok: true  },
          { label: 'Encryption Engine', ok: true  },
          { label: 'Edge Connectivity', ok: true  },
          { label: 'AI Monitoring',     ok: true  },
          { label: 'Key Escrow',        ok: false },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            {s.ok
              ? <CheckCircle size={12} color="var(--success)" />
              : <AlertCircle size={12} color="var(--warning)" />
            }
            <span style={{ color: s.ok ? 'var(--text-secondary)' : 'var(--warning-text)', fontWeight: s.ok ? 400 : 600 }}>{s.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <Activity size={12} />
          All systems operational
        </div>
      </div>

      {/* ── Activity Feed + Risk Map ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div className="section-label">Recent Activity</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>
                Audit-trail events from the last 3 hours
              </div>
            </div>
            <Link to="/audit" style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              Full Audit Log <TrendingUp size={12} />
            </Link>
          </div>
          <ActivityFeed items={stats.recent_activity} />
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div className="section-label">Center Risk Map</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>AI Risk Model</div>
            </div>
            <Badge color="purple">AI</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, marginBottom: 12 }}>
            {RISK_CENTERS.map(c => {
              const color   = c.risk === 'high' ? 'var(--danger)' : c.risk === 'med' ? 'var(--warning)' : 'var(--success)';
              const borderC = c.risk !== 'low' ? color : 'var(--border)';
              const bgC     = c.risk !== 'low' ? color + '12' : 'var(--surface-2)';
              return (
                <div key={c.code} style={{ border: `1px solid ${borderC}`, borderRadius: 5, padding: '4px 7px', background: bgC, cursor: 'default' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: c.risk !== 'low' ? color : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.code}
                  </div>
                  <div style={{ marginTop: 2, height: 3, borderRadius: 2, background: color }} />
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            {([['var(--success)', 'Low'], ['var(--warning)', 'Medium'], ['var(--danger)', 'High']] as const).map(([c, l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />
                {l} ({l === 'Low' ? RISK_CENTERS.filter(r => r.risk === 'low').length : l === 'Medium' ? riskCounts.med : riskCounts.high})
              </span>
            ))}
          </div>

          {(riskCounts.high > 0 || riskCounts.med > 0) && (
            <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--danger-bg)', borderRadius: 6, border: '1px solid var(--danger-mid)', fontSize: 11.5, color: 'var(--danger-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={11} />
              {riskCounts.high} high-risk center{riskCounts.high !== 1 ? 's' : ''} require attention
            </div>
          )}
        </Card>
      </div>

      {/* ── Distribution Status ── */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div className="section-label">Package Distribution Status</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 1 }}>
              Encrypted exam packages → centers
            </div>
          </div>
          <Link to="/distribution">
            <Button variant="ghost" size="sm" icon={<Truck size={12} />} style={{ fontSize: 12 }}>
              Manage Distribution
            </Button>
          </Link>
        </div>
        {stats.package_distribution_status.map(pkg => (
          <DistributionBar key={pkg.exam_name} pkg={pkg} />
        ))}
      </Card>

    </div>
  );
}


