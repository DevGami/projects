/** Question Editor page — Phase 2a implementation using Phase 1 design system.
 *  Matches Stitch screen A3 — Question Editor.
 *  Uses Phase 1's QuestionCreateRequest / QuestionDetail types exactly.
 *  Handles both /questions/new (create) and /questions/:id/edit (update).
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  Bold, Italic, Underline, FunctionSquare, Image,
  Lock, Copy, CheckCircle, Zap, Save,
} from 'lucide-react';
import {
  Button, Card, FormGroup, LoadingState, Alert, PageHeader,
} from '../components/ui';
import { questionsApi, type QuestionCreateRequest, type QuestionDetail } from '../services/api';

// ─── SHA-256 card ─────────────────────────────────────────────

function HashCard({ body }: { body: string }) {
  const [hash, setHash] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!body.trim()) { setHash(''); return; }
    const enc = new TextEncoder();
    window.crypto.subtle.digest('SHA-256', enc.encode(body)).then(buf => {
      setHash(Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
    });
  }, [body]);

  const copy = () => {
    if (hash) { navigator.clipboard.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle size={15} color="var(--success)" /> SHA-256 Hash
        </h3>
        <span style={{ background: 'var(--success-light)', color: 'var(--success-text)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--success)' }}>VERIFIED</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {hash || '(type question to compute hash)'}
        </code>
        <button onClick={copy} disabled={!hash} style={{ border: 'none', background: 'none', cursor: hash ? 'pointer' : 'default', color: copied ? 'var(--success)' : 'var(--text-muted)', padding: 4 }}>
          {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
        </button>
      </div>
    </Card>
  );
}

// ─── Answer Options ───────────────────────────────────────────

type OptionKey = 'A' | 'B' | 'C' | 'D';

function AnswerOptions({ options, correctOption, onValueChange, onCorrectChange }: {
  options: { A: string; B: string; C: string; D: string };
  correctOption: OptionKey;
  onValueChange: (key: OptionKey, value: string) => void;
  onCorrectChange: (key: OptionKey) => void;
}) {
  return (
    <Card>
      <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Answer Options
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(['A', 'B', 'C', 'D'] as OptionKey[]).map(key => {
          const isCorrect = correctOption === key;
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8,
              border: `1px solid ${isCorrect ? 'var(--success)' : 'var(--border)'}`,
              background: isCorrect ? 'var(--success-light)' : 'var(--surface)',
              transition: 'all 0.15s',
            }}>
              <input
                type="radio"
                name="correct_answer"
                checked={isCorrect}
                onChange={() => onCorrectChange(key)}
                style={{ accentColor: 'var(--success)', width: 16, height: 16 }}
              />
              <span style={{
                width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12, flexShrink: 0,
                background: isCorrect ? 'var(--success)' : 'var(--surface-2)',
                color: isCorrect ? '#fff' : 'var(--text-muted)',
              }}>{key}</span>
              <input
                type="text"
                style={{ flex: 1, border: 'none', background: 'transparent', fontFamily: 'var(--font-family)', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontWeight: isCorrect ? 600 : 400 }}
                value={options[key]}
                onChange={e => onValueChange(key, e.target.value)}
                placeholder={`Option ${key}`}
              />
              {isCorrect && <CheckCircle size={18} color="var(--success)" />}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Rich Text Preview Helper ─────────────────────────────────

/** Convert markdown-like syntax to inline HTML for the preview pane. */
function renderFormatted(text: string): React.ReactNode {
  if (!text) return null;
  // Process in order: bold (**), italic (*), underline (<u>), formula ($)
  const parts: React.ReactNode[] = [];
  // Use a regex that captures all our formatting tokens
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|<u>(.+?)<\/u>|\$(.+?)\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Push plain text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      // **bold**
      parts.push(<strong key={key++}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      // *italic*
      parts.push(<em key={key++}>{match[2]}</em>);
    } else if (match[3] !== undefined) {
      // <u>underline</u>
      parts.push(<u key={key++}>{match[3]}</u>);
    } else if (match[4] !== undefined) {
      // $formula$ — render in monospace with distinct styling
      parts.push(
        <code key={key++} style={{
          background: 'var(--primary-light)', color: 'var(--primary)',
          padding: '1px 5px', borderRadius: 4, fontFamily: 'var(--font-mono)',
          fontSize: '0.9em', border: '1px solid var(--primary-mid)',
        }}>{match[4]}</code>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

// ─── Main Page ────────────────────────────────────────────────

export default function QuestionEditor() {
  const navigate     = useNavigate();
  const { id }       = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const isEdit = !!id;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Form state using Phase 1 field names exactly
  const [content, setContent]         = useState('A particle of mass m is projected at angle θ. Find the range R.');
  const [subject, setSubject]         = useState('Physics');
  const [difficulty, setDifficulty]   = useState<'easy' | 'medium' | 'hard'>('medium');
  const [options, setOptions]         = useState<{ A: string; B: string; C: string; D: string }>({
    A: 'R = v² sin(2θ) / g', B: 'R = v² sin(θ) / g', C: 'R = v sin(2θ) / g', D: 'R = v² / g',
  });
  const [correctOption, setCorrectOption] = useState<OptionKey>('A');

  // Load existing question when editing
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const token = await getToken();
        const q: QuestionDetail = await questionsApi.get(token!, id!);
        setContent(q.content ?? '');
        setSubject(q.subject ?? 'Physics');
        setDifficulty((q.difficulty ?? 'medium') as 'easy' | 'medium' | 'hard');
        if (q.options) setOptions(q.options);
        if (q.correct_option) setCorrectOption(q.correct_option as OptionKey);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, id, getToken]);

  const handleOptionValueChange = (key: OptionKey, value: string) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (_encrypt: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      const payload: QuestionCreateRequest = {
        content,
        subject,
        difficulty,
        options,
        correct_option: correctOption,
      };
      if (isEdit) {
        await questionsApi.update(token!, id!, payload);
      } else {
        await questionsApi.create(token!, payload);
      }
      navigate('/questions');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading question..." />;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Question' : 'New Question'}
        breadcrumb={['Home', 'Question Bank', isEdit ? 'Edit' : 'New']}
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, marginTop: 16 }}>
        {/* ─── Left Column ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Question Body */}
          <Card>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Question Body
            </h3>
            {/* Mini toolbar */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              {[
                { icon: <Bold size={14} />, title: 'Bold', prefix: '**', suffix: '**' },
                { icon: <Italic size={14} />, title: 'Italic', prefix: '*', suffix: '*' },
                { icon: <Underline size={14} />, title: 'Underline', prefix: '<u>', suffix: '</u>' },
                { icon: <FunctionSquare size={14} />, title: 'Formula', prefix: '$', suffix: '$' },
                { icon: <Image size={14} />, title: 'Image', prefix: '![alt](', suffix: ')' },
              ].map(({ icon, title, prefix, suffix }) => (
                <button key={title} title={title}
                  onClick={() => {
                    const el = textareaRef.current;
                    if (!el) return;
                    const start = el.selectionStart;
                    const end = el.selectionEnd;
                    const selected = content.substring(start, end);
                    const replacement = selected
                      ? `${prefix}${selected}${suffix}`
                      : `${prefix}text${suffix}`;
                    const newContent = content.substring(0, start) + replacement + content.substring(end);
                    setContent(newContent);
                    // Restore cursor after React re-render
                    setTimeout(() => {
                      el.focus();
                      const cursorPos = selected
                        ? start + replacement.length
                        : start + prefix.length;
                      el.setSelectionRange(cursorPos, cursorPos + (selected ? 0 : 4));
                    }, 0);
                  }}
                  style={{ border: 'none', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px 8px', borderRadius: 6 }}
                >
                  {icon}
                </button>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              style={{
                width: '100%', minHeight: 180, border: 'none', outline: 'none', resize: 'vertical',
                fontFamily: 'var(--font-family)', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6,
                background: 'transparent', boxSizing: 'border-box',
              }}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Type the question here. Supports LaTeX: $E = mc^2$"
            />
          </Card>

          {/* Encryption notice */}
          <div style={{
            background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 8,
            padding: '10px 16px', fontSize: 13, color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            🔓 PLAINTEXT — question will be encrypted with AES-256-GCM on save
          </div>

          {/* Options */}
          <AnswerOptions
            options={options}
            correctOption={correctOption}
            onValueChange={handleOptionValueChange}
            onCorrectChange={setCorrectOption}
          />

          {/* AI Normalizer */}
          <Card style={{ background: 'var(--purple-light)', borderColor: '#d8b4fe' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ background: 'var(--purple)', borderRadius: 10, padding: 10 }}>
                  <Zap size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#4c1d95' }}>Linguistic Fingerprint Removal</h3>
                    <span style={{ background: 'var(--purple)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>AI</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#6b21a8' }}>Neutralize phrasing to prevent author identification.</p>
                </div>
              </div>
              <Button variant="primary" size="sm" style={{ background: 'var(--purple)', borderColor: 'var(--purple)' }}>
                Normalize
              </Button>
            </div>
          </Card>
        </div>

        {/* ─── Right Column ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Metadata */}
          <Card>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Metadata
            </h3>
            <FormGroup label="Subject" required>
              <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology">Biology</option>
                <option value="Mathematics">Mathematics</option>
              </select>
            </FormGroup>

            <FormGroup label="Difficulty" required>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['easy', 'medium', 'hard'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                      fontWeight: 600, textTransform: 'capitalize',
                      border: difficulty === d ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: difficulty === d ? 'var(--primary-light)' : 'var(--surface)',
                      color: difficulty === d ? 'var(--primary)' : 'var(--text-secondary)',
                    }}
                  >{d}</button>
                ))}
              </div>
            </FormGroup>
          </Card>

          {/* SHA-256 Hash */}
          <HashCard body={content} />

          {/* Preview */}
          <Card style={{ background: 'var(--surface-2)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Preview (Candidate View)
            </h3>
            <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 12 }}>
              {content ? renderFormatted(content) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Start typing the question…</span>}
            </div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(['A', 'B', 'C', 'D'] as OptionKey[]).map(key => (
                <li key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6,
                  border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)',
                  background: 'var(--surface)',
                }}>
                  <span style={{ fontWeight: 700, width: 20 }}>{key}.</span>
                  {options[key] ? renderFormatted(options[key]) : <span style={{ color: 'var(--text-muted)' }}>(empty)</span>}
                </li>
              ))}
            </ol>
          </Card>

          {/* Save Actions */}
          <Card>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => handleSave(false)} loading={saving}>
                <Save size={14} style={{ marginRight: 6 }} /> Save as Draft
              </Button>
              <Button variant="primary" onClick={() => handleSave(true)} loading={saving}>
                <Lock size={14} style={{ marginRight: 6 }} />
                {saving ? 'Saving…' : 'Save & Encrypt'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
