/** Shared UI Components — FortisExam Design System v2.0
 *  All components upgraded for government-grade professional appearance.
 *  No components removed — only improved.
 */

import React from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle, ChevronRight } from 'lucide-react';

// ────────────────────────────────────────────────────────────────
// BUTTON
// ────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type BtnSize    = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const sizeClass = size === 'md' ? '' : `btn-${size}`;
  return (
    <button
      className={`btn btn-${variant} ${sizeClass} ${className}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading
        ? <Spinner size="sm" />
        : icon
      }
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────
// SPINNER
// ────────────────────────────────────────────────────────────────

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const style: React.CSSProperties =
    size === 'sm'  ? { width: 14, height: 14, borderWidth: 2 }   :
    size === 'lg'  ? { width: 36, height: 36, borderWidth: 3 }   :
                    {};
  return <div className="spinner" style={style} />;
}

// ────────────────────────────────────────────────────────────────
// CARD
// ────────────────────────────────────────────────────────────────

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  noPadding?: boolean;
}

export function Card({ title, subtitle, action, children, className = '', style, noPadding = false }: CardProps) {
  return (
    <div className={`card ${className}`} style={{ padding: noPadding ? 0 : undefined, ...style }}>
      {(title || action) && (
        <div className="card-header">
          <div>
            {title    && <div className="card-title">{title}</div>}
            {subtitle && <div className="card-subtitle">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// STAT CARD
// ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeDir?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

export function StatCard({ label, value, change, changeDir = 'neutral', icon, color = 'blue' }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-card-icon ${color}`}>{icon}</div>
      <div className="stat-card-body">
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {change && (
          <div className={`stat-card-change ${changeDir}`}>{change}</div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// BADGE
// ────────────────────────────────────────────────────────────────

type BadgeColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'grey';

interface BadgeProps {
  color?: BadgeColor;
  dot?: boolean;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

export function Badge({ color = 'grey', dot = false, children, size }: BadgeProps) {
  return (
    <span
      className={`badge badge-${color}`}
      style={size === 'sm' ? { fontSize: 10, padding: '1px 6px' } : undefined}
    >
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

// Status badge — maps backend status strings to color + label
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: BadgeColor; label: string }> = {
    generated:     { color: 'blue',   label: 'Generated'    },
    distributed:   { color: 'yellow', label: 'Distributed'  },
    activated:     { color: 'green',  label: 'Activated'    },
    key_released:  { color: 'green',  label: 'Key Released' },
    DRAFT:         { color: 'grey',   label: 'Draft'        },
    ENCRYPTED:     { color: 'purple', label: 'Encrypted'    },
    ACTIVE:        { color: 'green',  label: 'Active'       },
    COMPILED:      { color: 'blue',   label: 'Compiled'     },
    DISTRIBUTED:   { color: 'yellow', label: 'Distributed'  },
    KEY_RELEASED:  { color: 'green',  label: 'Key Released' },
    COMPLETED:     { color: 'purple', label: 'Completed'    },
    Easy:          { color: 'green',  label: 'Easy'         },
    Medium:        { color: 'yellow', label: 'Medium'       },
    Hard:          { color: 'red',    label: 'Hard'         },
    valid:         { color: 'green',  label: 'Valid'        },
    tampered:      { color: 'red',    label: 'Tampered'     },
    LOW:           { color: 'green',  label: 'Low'          },
    MEDIUM:        { color: 'yellow', label: 'Medium'       },
    HIGH:          { color: 'red',    label: 'High'         },
    CRITICAL:      { color: 'red',    label: 'Critical'     },
    active:        { color: 'green',  label: 'Active'       },
    inactive:      { color: 'grey',   label: 'Inactive'     },
    submitted:     { color: 'blue',   label: 'Submitted'    },
    recovered:     { color: 'purple', label: 'Recovered'    },
    draft:         { color: 'grey',   label: 'Draft'        },
    compiled:      { color: 'blue',   label: 'Compiled'     },
    completed:     { color: 'purple', label: 'Completed'    },
  };
  // Try exact match first, then uppercase fallback
  const cfg = map[status] ?? map[status.toUpperCase()] ?? { color: 'grey' as BadgeColor, label: status };
  return <Badge color={cfg.color} dot>{cfg.label}</Badge>;
}

// ────────────────────────────────────────────────────────────────
// MODAL
// ────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  if (!open) return null;
  const maxWidth = size === 'sm' ? 400 : size === 'lg' ? 760 : size === 'xl' ? 960 : 560;
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ maxWidth }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// EMPTY STATE
// ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// LOADING STATE
// ────────────────────────────────────────────────────────────────

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="loading-state">
      <Spinner size="lg" />
      <p>{message}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// ERROR STATE
// ────────────────────────────────────────────────────────────────

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state">
      <AlertCircle size={32} color="var(--danger)" />
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// ALERT
// ────────────────────────────────────────────────────────────────

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export function Alert({ variant = 'info', children }: { variant?: AlertVariant; children: React.ReactNode }) {
  const icons = {
    info:    Info,
    success: CheckCircle,
    warning: AlertTriangle,
    danger:  AlertCircle,
  };
  const Icon = icons[variant];
  return (
    <div className={`alert alert-${variant}`}>
      <Icon size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// CONFIRM DIALOG
// ────────────────────────────────────────────────────────────────

interface ConfirmProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({
  open, onClose, onConfirm,
  title, message,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────
// FORM GROUP
// ────────────────────────────────────────────────────────────────

interface FormGroupProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

export function FormGroup({ label, required, hint, children }: FormGroupProps) {
  return (
    <div className="form-group">
      <label className="form-label">
        {label}
        {required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <span className="form-hint">{hint}</span>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// TABLE
// ────────────────────────────────────────────────────────────────

interface Column<T> {
  key: string;
  label: string;
  width?: string | number;
  render?: (value: unknown, row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  footer?: React.ReactNode;
}

export function Table<T extends Record<string, unknown>>({
  columns, data, keyField, onRowClick, emptyMessage = 'No records found.', footer,
}: TableProps<T>) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                style={{ width: col.width, textAlign: col.align ?? 'left' }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                  {emptyMessage}
                </div>
              </td>
            </tr>
          ) : (
            data.map(row => (
              <tr
                key={String(row[keyField])}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'clickable' : ''}
              >
                {columns.map(col => (
                  <td key={col.key} style={{ textAlign: col.align ?? 'left' }}>
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {footer && (
        <div className="pagination">
          {footer}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// TABS
// ────────────────────────────────────────────────────────────────

interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span style={{
              marginLeft: 7,
              fontSize: 10,
              fontWeight: 700,
              background: active === tab.id ? 'var(--primary-bg)' : 'var(--surface-3)',
              color: active === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              padding: '1px 7px',
              borderRadius: 99,
              border: '1px solid',
              borderColor: active === tab.id ? 'var(--primary-border)' : 'var(--border)',
              verticalAlign: 'middle',
            }}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// PAGE HEADER
// ────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumb?: string[];
  badge?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions, breadcrumb, badge }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        {breadcrumb && (
          <div className="page-header-breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <ChevronRight size={10} style={{ margin: '0 3px', opacity: 0.5 }} />}
                <span>{crumb}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1>{title}</h1>
          {badge}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && (
        <div className="page-header-actions">{actions}</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// SECTION HEADER (inside cards)
// ────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ label, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div className="section-label">{label}</div>
      {action}
    </div>
  );
}
