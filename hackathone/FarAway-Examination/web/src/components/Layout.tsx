import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserButton, useUser } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Package,
  Truck,
  Building2,
  Users,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Bell,
  Search,
  Radio,
  ChevronRight,
  Sparkles,
  Monitor,
  X,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const adminNav = [
  { path: '/',             label: 'Dashboard',        icon: LayoutDashboard },
  { path: '/questions',    label: 'Question Bank',     icon: BookOpen },
  { path: '/exams',        label: 'Exam Builder',      icon: ClipboardList },
  { path: '/packages',     label: 'Packages',          icon: Package },
  { path: '/distribution', label: 'Distribution',      icon: Truck },
  { path: '/centers',      label: 'Centers',           icon: Building2 },
  { path: '/users',        label: 'User Management',   icon: Users },
];

const securityNav = [
  { path: '/audit',       label: 'Audit Explorer',  icon: ShieldCheck },
  { path: '/monitoring',  label: 'Live Monitoring', icon: Activity },
  { path: '/tamper',      label: 'Leak Monitor',    icon: AlertTriangle },
  { path: '/demo',        label: 'Hackathon Demo',  icon: Sparkles },
];

function Layout({ children }: LayoutProps) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user }  = useUser();

  const [searchQuery, setSearchQuery]   = useState('');
  const [showNotif, setShowNotif]       = useState(false);
  const [hasNotifications]              = useState(false); // TODO: wire to real notification source

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const currentPage = [...adminNav, ...securityNav].find(n => isActive(n.path));

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/questions?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'A'
    : 'A';

  return (
    <div className="app-layout">

      {/* ═══════════════════════════════════════════
          SIDEBAR
      ═══════════════════════════════════════════ */}
      <nav className="sidebar">
        {/* Logo / Brand */}
        <div className="sidebar-logo">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div className="sidebar-logo-icon">FE</div>
            <div className="sidebar-logo-text">
              <h1>FortisExam</h1>
              <span>Admin Terminal</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <div className="sidebar-nav">
          <div className="sidebar-section-label">Administration</div>
          {adminNav.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`nav-item ${isActive(path) ? 'active' : ''}`}
            >
              <Icon className="nav-item-icon" size={15} />
              {label}
            </Link>
          ))}

          <div className="sidebar-section-label">Security & Audit</div>
          {securityNav.map(({ path, label, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={`nav-item ${isActive(path) ? 'active' : ''}`}
            >
              <Icon className="nav-item-icon" size={15} />
              {label}
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserButton afterSignOutUrl="/" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                {user?.firstName ?? 'Admin'}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Administrator</div>
            </div>
          </div>
          <span className="sidebar-version">v4.12</span>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════ */}
      <div className="main-content">

        {/* ─── Topbar ─── */}
        <header className="topbar">
          <div className="topbar-left">
            {/* Breadcrumb */}
            <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
              <Link to="/" style={{ color: 'inherit', textDecoration: 'none', opacity: 0.7 }}>
                FortisExam
              </Link>
              <ChevronRight size={13} className="topbar-breadcrumb-sep" />
              <span className="current">
                {currentPage?.label ?? 'Dashboard'}
              </span>
            </nav>
          </div>

          <div className="topbar-right">
            {/* Global Search */}
            <div className="topbar-search">
              <Search className="topbar-search-icon" size={13} />
              <input
                type="text"
                placeholder="Search questions… (↵)"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKey}
                aria-label="Global search"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 0, lineHeight: 1,
                  }}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Live Monitoring shortcut */}
            <Link to="/monitoring" className="topbar-live-btn" aria-label="Live monitoring">
              <span className="topbar-live-dot" />
              <Radio size={12} />
              Live
            </Link>

            {/* Kiosk Demo — opens candidate exam app */}
            <a
              href="https://far-away-examination-kisok.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="topbar-live-btn"
              style={{ background: 'var(--primary)', gap: 6 }}
              aria-label="Open Kiosk Demo"
            >
              <Monitor size={12} />
              Kiosk Demo
            </a>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button
                className="icon-btn"
                title="Notifications"
                onClick={() => setShowNotif(v => !v)}
                aria-label="Notifications"
                aria-expanded={showNotif}
              >
                <Bell size={16} />
                {hasNotifications && <span className="badge-dot" />}
              </button>

              {showNotif && (
                <div className="notif-toast" style={{ right: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Notifications</span>
                    <button onClick={() => setShowNotif(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                    No new notifications
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar */}
            <div className="user-avatar" title={user?.fullName ?? 'Admin'}>
              {initials}
            </div>
          </div>
        </header>

        {/* ─── Page Content ─── */}
        <main className="page-content">
          {children}
        </main>

      </div>
    </div>
  );
}

export default Layout;
