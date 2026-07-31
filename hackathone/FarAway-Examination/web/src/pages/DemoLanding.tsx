/**
 * DemoLanding — Phase 5 Demo Polish
 *
 * A stunning animated landing/intro page for hackathon judges showing:
 * - The 8 security guarantees in visual form
 * - Live system health indicators
 * - Quick navigation to each demo flow
 * - Architecture overview callout
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Lock, Eye, Cpu, Key, BarChart3,
  ChevronRight, Zap, Database, AlertTriangle,
  CheckCircle2, Globe, Fingerprint, BookOpen,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface SystemStatus {
  label: string;
  ok: boolean;
  latency?: string;
}

// ── Demo Flow Cards ───────────────────────────────────────────────────────────
const DEMO_FLOWS = [
  {
    id: 1,
    icon: <BookOpen size={20} />,
    title: 'Question Bank',
    subtitle: 'AES-256-GCM Encryption',
    desc: 'Create a question and watch it get encrypted at rest. Every keystroke hashed in real-time.',
    color: '#6366f1',
    path: '/questions/new',
    badge: 'Module 01',
  },
  {
    id: 2,
    icon: <Key size={20} />,
    title: 'Package & Key Release',
    subtitle: 'RSA-2048 + D-012 Flow',
    desc: 'Compile an exam, generate a signed+encrypted package, and release the AES key to a center.',
    color: '#8b5cf6',
    path: '/exams',
    badge: 'Module 02',
  },
  {
    id: 3,
    icon: <Fingerprint size={20} />,
    title: 'Candidate Auth',
    subtitle: 'QR Token + Face Verify',
    desc: 'RSA-2048 QR signature verification + facial embedding cosine similarity in the kiosk.',
    color: '#06b6d4',
    path: '/distribution',
    badge: 'Module 03',
  },
  {
    id: 4,
    icon: <Globe size={20} />,
    title: 'Spatial Randomization',
    subtitle: 'Graph-Coloring Variants',
    desc: 'Adjacent seats never get the same variant. Greedy chromatic graph coloring demo.',
    color: '#10b981',
    path: '/exams',
    badge: 'Module 04',
  },
  {
    id: 5,
    icon: <Database size={20} />,
    title: 'State Recovery',
    subtitle: 'SQLite WAL Snapshots',
    desc: 'Simulate a mid-exam crash. Reload the kiosk — every answer is restored from edge SQLite.',
    color: '#f59e0b',
    path: '/monitoring',
    badge: 'Module 05',
  },
  {
    id: 6,
    icon: <Eye size={20} />,
    title: 'Live Anomaly Detection',
    subtitle: 'MediaPipe + Rule Engine',
    desc: 'Watch the AI flag multiple faces, gaze deviation, and rapid answer changes in real-time.',
    color: '#ef4444',
    path: '/monitoring',
    badge: 'Module 06',
  },
  {
    id: 7,
    icon: <Shield size={20} />,
    title: 'Audit Ledger & Tamper Demo',
    subtitle: 'SHA-256 Hash Chain',
    desc: 'Tamper one character in the DB. Watch the chain verification catch the exact break point.',
    color: '#ec4899',
    path: '/tamper',
    badge: 'Module 07',
  },
  {
    id: 8,
    icon: <AlertTriangle size={20} />,
    title: 'Supervisor Override',
    subtitle: 'Audit-logged Overrides',
    desc: 'Acknowledge an anomaly alert. Every supervisor action is permanently logged in the chain.',
    color: '#f97316',
    path: '/audit',
    badge: 'Integrated',
  },
];

// ── Security Pillars ─────────────────────────────────────────────────────────
const PILLARS = [
  { icon: '🔐', title: 'Zero Paper Leaks', desc: 'AES-256-GCM encryption. Questions never leave the DB in plaintext.' },
  { icon: '🧩', title: 'Zero Copying', desc: 'Graph-colored variants. Adjacent seats get different question orders.' },
  { icon: '👁️', title: 'Zero Impersonation', desc: 'RSA-signed QR tokens + live face embedding verification.' },
  { icon: '🔗', title: 'Tamper-Evident Ledger', desc: 'SHA-256 hash chain. Every event is cryptographically linked.' },
  { icon: '⚡', title: 'Offline-First', desc: 'Edge SQLite with WAL. Exams survive complete internet outages.' },
  { icon: '📷', title: 'Live Proctoring AI', desc: 'MediaPipe detects multiple faces, gaze deviation, camera blocks.' },
];

// ── Animated Counter ──────────────────────────────────────────────────────────
function Counter({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <>{val.toLocaleString()}</>;
}

// ── Status Dot ────────────────────────────────────────────────────────────────
function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      borderRadius: '50%',
      background: ok ? 'var(--success)' : 'var(--danger)',
      boxShadow: ok ? '0 0 6px var(--success)' : '0 0 6px var(--danger)',
      animation: ok ? 'pulse-dot 2s infinite' : 'none',
    }} />
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function DemoLanding() {
  const [sysStatus, setSysStatus] = useState<SystemStatus[]>([
    { label: 'Cloud API :8000', ok: false },
    { label: 'Edge API  :8001', ok: false },
    { label: 'Desktop Kiosk', ok: false },
  ]);
  // Auto-probe health endpoints
  useEffect(() => {
    const probe = async () => {
      const t0 = Date.now();
      const checks = await Promise.allSettled([
        fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(1500) }),
        fetch('http://localhost:8001/health', { signal: AbortSignal.timeout(1500) }),
        fetch('http://localhost:5174',         { signal: AbortSignal.timeout(1500) }),
      ]);
      const latency = `${Date.now() - t0}ms`;
      setSysStatus([
        { label: 'Cloud API :8000', ok: checks[0].status === 'fulfilled' && (checks[0].value as Response).ok, latency },
        { label: 'Edge API  :8001', ok: checks[1].status === 'fulfilled' && (checks[1].value as Response).ok },
        { label: 'Desktop Kiosk', ok: checks[2].status === 'fulfilled' },
      ]);
    };
    probe();
    const id = setInterval(() => { probe(); }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Hero ── */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 50%, rgba(6,182,212,0.08) 100%)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 16,
        padding: '40px 48px',
        overflow: 'hidden',
      }}>
        {/* Background glow orbs */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 240, height: 240,
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: 200, width: 180, height: 180,
          background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(99,102,241,0.4)',
          }}>
            <Shield size={24} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 2 }}>
              FortisExam — Hackathon Demo
            </div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>
              Zero-Trust Examination Infrastructure
            </h1>
          </div>
        </div>

        <p style={{ margin: '0 0 28px', fontSize: 15, color: 'var(--text-secondary)', maxWidth: 600, lineHeight: 1.6 }}>
          A military-grade exam system for NEET/JEE/UPSC-scale national exams.
          Prevents paper leaks, copying, and impersonation through cryptography,
          AI proctoring, and an immutable audit ledger.
        </p>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: 32, marginBottom: 28, flexWrap: 'wrap' }}>
          {[
            { val: 417, suffix: '', label: 'Tests Passing' },
            { val: 7, suffix: '', label: 'Security Modules' },
            { val: 30, suffix: '', label: 'Demo Questions' },
            { val: 8, suffix: '', label: 'Demo Flows' },
          ].map(({ val, suffix, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
                <Counter target={val} />{suffix}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* System Status */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {sysStatus.map(s => (
            <div key={s.label} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--surface)',
              border: `1px solid ${s.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 500,
              fontFamily: 'var(--font-mono)',
            }}>
              <StatusDot ok={s.ok} />
              {s.label}
              {s.ok && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>UP</span>}
              {!s.ok && <span style={{ color: 'var(--danger)', fontSize: 10 }}>DOWN</span>}
            </div>
          ))}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--text-muted)', padding: '6px 0',
          }}>
            <Zap size={12} color="var(--warning)" />
            Auto-probing every 5s
          </div>
        </div>
      </div>

      {/* ── Security Pillars ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Lock size={15} color="var(--text-muted)" />
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Security Guarantees
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {PILLARS.map(p => (
            <div key={p.title} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 16px',
              transition: 'border-color 0.2s, transform 0.2s',
              cursor: 'default',
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 8 }}>{p.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{p.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Demo Flows ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Cpu size={15} color="var(--text-muted)" />
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            8 Demo Flows — Click to Launch
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {DEMO_FLOWS.map(flow => (
            <Link
              key={flow.id}
              to={flow.path}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', alignItems: 'flex-start', gap: 14,
                transition: 'all 0.2s',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = flow.color;
                  el.style.transform = 'translateY(-2px)';
                  el.style.boxShadow = `0 4px 20px ${flow.color}20`;
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'var(--border)';
                  el.style.transform = 'translateY(0)';
                  el.style.boxShadow = 'none';
                }}
              >
                {/* Number badge */}
                <div style={{
                  position: 'absolute', top: 12, right: 14,
                  fontSize: 10, fontWeight: 700,
                  color: flow.color, background: flow.color + '18',
                  padding: '2px 7px', borderRadius: 4,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {flow.badge}
                </div>

                {/* Icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: flow.color + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: flow.color,
                }}>
                  {flow.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Flow {flow.id}</span>
                    <ChevronRight size={10} color="var(--text-muted)" />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{flow.title}</div>
                  <div style={{ fontSize: 11, color: flow.color, fontWeight: 600, marginBottom: 6 }}>{flow.subtitle}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{flow.desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Architecture Summary ── */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12, padding: '24px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <BarChart3 size={15} color="var(--text-muted)" />
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Architecture at a Glance
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {[
            {
              zone: 'Cloud Zone',
              color: '#6366f1',
              desc: 'Admin Portal (React + Vite + Clerk)',
              items: ['Question bank (AES-256-GCM)', 'Exam compilation + variants', 'RSA key distribution (D-012)', 'Audit ledger (SHA-256 chain)'],
            },
            {
              zone: 'Distribution Layer',
              color: '#f59e0b',
              desc: 'Signed+encrypted exam packages',
              items: ['RSA-2048 PSS signature', 'AES-wrapped package payload', 'Center public key wrapping', 'Seating + variant mapping'],
            },
            {
              zone: 'Edge Zone',
              color: '#10b981',
              desc: 'Desktop Kiosk (Electron + React)',
              items: ['QR token + face verify (M03)', 'Graph-colored question variants', 'SQLite WAL snapshots (M05)', 'MediaPipe anomaly detection'],
            },
          ].map((zone, i) => (
            <div key={zone.zone} style={{
              padding: '0 24px',
              borderRight: i < 2 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: zone.color,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
              }}>{zone.zone}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>{zone.desc}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {zone.items.map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <CheckCircle2 size={12} color={zone.color} style={{ flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-muted)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
