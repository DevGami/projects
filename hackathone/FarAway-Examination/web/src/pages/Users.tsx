/**
 * Users — Role Management (Phase 2b)
 * List Clerk users, sync roles to local DB, display current user profile.
 * Wired to: usersApi.me, usersApi.sync
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { UserCheck, Shield, Crown, Eye, Settings, RefreshCw, Plus } from 'lucide-react';
import {
  Button, Card, Table, LoadingState, PageHeader,
  Modal, FormGroup, EmptyState, StatCard, Alert, Badge,
} from '../components/ui';
import { usersApi, type UserMeResponse, type UserRole } from '../services/api';

// ─── Helpers ─────────────────────────────────────────────────

const ROLES: UserRole[] = ['admin', 'expert', 'center_admin', 'invigilator', 'auditor'];

function roleIcon(role: UserRole) {
  const m = { admin: Crown, expert: Settings, center_admin: Shield, invigilator: Eye, auditor: Eye };
  const Icon = m[role] ?? Shield;
  return <Icon size={14} />;
}

function roleColor(role: UserRole): 'red' | 'purple' | 'blue' | 'yellow' | 'green' {
  const m: Record<UserRole, 'red' | 'purple' | 'blue' | 'yellow' | 'green'> = {
    admin: 'red', expert: 'purple', center_admin: 'blue', invigilator: 'yellow', auditor: 'green',
  };
  return m[role] ?? 'blue';
}

// ─── Sync User Modal ─────────────────────────────────────────

interface SyncModalProps {
  open: boolean;
  onClose: () => void;
  onSynced: () => void;
  getToken: () => Promise<string | null>;
}

function SyncUserModal({ open, onClose, onSynced, getToken }: SyncModalProps) {
  const [clerkId, setClerkId] = useState('');
  const [name, setName]       = useState('');
  const [role, setRole]       = useState<UserRole>('expert');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSync() {
    if (!clerkId || !name) { setError('Clerk User ID and Name are required.'); return; }
    setSaving(true); setError(null);
    try {
      const token = await getToken();
      await usersApi.sync(token!, { clerk_user_id: clerkId, name, role });
      setSuccess(true);
      setTimeout(() => { onSynced(); onClose(); setSuccess(false); setClerkId(''); setName(''); setRole('expert'); }, 1200);
    } catch (e: any) {
      setError(e.message ?? 'Sync failed');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Sync User Role" size="md"
      footer={
        success
          ? <Button variant="success">✓ Synced</Button>
          : <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" icon={<UserCheck size={14} />} onClick={handleSync} loading={saving}>Sync User</Button>
            </div>
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}
      <Alert variant="info">
        Copy the Clerk User ID from the <strong>Clerk Dashboard → Users</strong> page and assign them a role in the FortisExam system.
      </Alert>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        <FormGroup label="Clerk User ID" required hint="Starts with user_...">
          <input className="input" value={clerkId} onChange={e => setClerkId(e.target.value)} placeholder="user_2abc123xyz..." />
        </FormGroup>
        <FormGroup label="Display Name" required>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" />
        </FormGroup>
        <FormGroup label="Role" required>
          <select className="input" value={role} onChange={e => setRole(e.target.value as UserRole)}>
            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' ')}</option>)}
          </select>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            {role === 'admin'        && 'Full access: create questions, compile exams, manage centers, release keys.'}
            {role === 'expert'       && 'Create and edit questions only.'}
            {role === 'center_admin' && 'Manage a specific exam center.'}
            {role === 'invigilator'  && 'Monitor live exam sessions.'}
            {role === 'auditor'      && 'Read-only access to audit trail.'}
          </div>
        </FormGroup>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function Users() {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [me, setMe]         = useState<UserMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncOpen, setSyncOpen] = useState(false);

  // Mock team members for display (since Clerk doesn't have a list endpoint)
  const [teamMembers] = useState<(UserMeResponse & { email?: string })[]>([
    { clerk_user_id: 'user_harsh',  name: 'Harsh Bhavsar', role: 'admin',   email: 'bhavsarharsh155@gmail.com' },
    { clerk_user_id: 'user_ayaan',  name: 'Ayaan Goel',    role: 'expert',  email: 'goel30july@gmail.com' },
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const profile = await usersApi.me(token!);
      setMe(profile);
    } catch {
      // Fallback from Clerk user object
      if (clerkUser) {
        setMe({
          clerk_user_id: clerkUser.id,
          name: clerkUser.fullName ?? clerkUser.primaryEmailAddress?.emailAddress ?? 'Unknown',
          role: 'admin',
          email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
        });
      }
    } finally { setLoading(false); }
  }, [getToken, clerkUser]);

  useEffect(() => { load(); }, [load]);

  const cols = [
    {
      key: 'name',
      label: 'User',
      render: (_: unknown, row: UserMeResponse & { email?: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--primary)', fontSize: 14, fontWeight: 700, flexShrink: 0,
          }}>
            {row.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{row.name}</div>
            {row.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.email}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (v: unknown) => (
        <Badge color={roleColor(v as UserRole)} dot>
          {roleIcon(v as UserRole)}
          <span style={{ marginLeft: 4 }}>{String(v).charAt(0).toUpperCase() + String(v).slice(1).replace('_', ' ')}</span>
        </Badge>
      ),
    },
    { key: 'clerk_user_id', label: 'Clerk ID', render: (v: unknown) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{String(v).substring(0, 18)}…</span> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="User & Role Management"
        subtitle="Manage team members and their access roles in the FortisExam system"
        breadcrumb={['Home', 'Users']}
        actions={
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={load}>Refresh</Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setSyncOpen(true)}>Sync User</Button>
          </div>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        {ROLES.map(role => {
          const Icon = { admin: Crown, expert: Settings, center_admin: Shield, invigilator: Eye, auditor: Eye }[role] ?? Shield;
          const count = teamMembers.filter(m => m.role === role).length;
          return (
            <StatCard
              key={role}
              label={role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
              value={count}
              icon={<Icon size={18} />}
              color={roleColor(role)}
            />
          );
        })}
      </div>

      {/* Current user profile card */}
      {loading ? (
        <LoadingState message="Loading profile..." />
      ) : me && (
        <Card title="Your Profile">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '8px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 22, fontWeight: 700, flexShrink: 0,
            }}>
              {me.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{me.name}</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 2 }}>{me.email}</div>
              <div style={{ marginTop: 8 }}>
                <Badge color={roleColor(me.role)} dot>
                  {roleIcon(me.role)}
                  <span style={{ marginLeft: 4 }}>{me.role.charAt(0).toUpperCase() + me.role.slice(1).replace('_', ' ')}</span>
                </Badge>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{me.clerk_user_id}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Team table */}
      <Card title="Team Members"
        subtitle="Users synced to FortisExam from Clerk. Add new users via Clerk Dashboard, then sync their role here."
      >
        {teamMembers.length === 0 ? (
          <EmptyState
            icon={<UserCheck size={40} color="var(--text-muted)" />}
            title="No synced users"
            description="Click Sync User to add a Clerk user's role to the system."
            action={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setSyncOpen(true)}>Sync User</Button>}
          />
        ) : (
          <Table columns={cols as any} data={teamMembers as any[]} keyField="clerk_user_id" />
        )}
      </Card>

      {/* Role guide */}
      <Card title="Role Permissions">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { role: 'admin' as UserRole,        desc: 'Full access — create questions, compile exams, release keys, manage all settings.' },
            { role: 'expert' as UserRole,        desc: 'Question authorship — create, edit, and review encrypted questions.' },
            { role: 'center_admin' as UserRole,  desc: 'Center operations — manage their assigned center and receive packages.' },
            { role: 'invigilator' as UserRole,   desc: 'Exam supervision — monitor live sessions and acknowledge security alerts.' },
            { role: 'auditor' as UserRole,       desc: 'Compliance — read-only access to audit trail and chain verification.' },
          ].map(({ role, desc }) => (
            <div key={role} style={{ padding: 14, background: 'var(--surface-2)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Badge color={roleColor(role)} dot>
                  {roleIcon(role)}
                  <span style={{ marginLeft: 4 }}>{role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}</span>
                </Badge>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Card>

      <SyncUserModal open={syncOpen} onClose={() => setSyncOpen(false)} onSynced={load} getToken={getToken} />
    </div>
  );
}
