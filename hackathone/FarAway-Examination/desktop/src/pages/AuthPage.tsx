/**
 * AuthPage — Secure Candidate Authentication
 * Steps: CONNECTING → SCAN_QR → [FACE_VERIFY → AUTHENTICATING] | [OVERRIDE_PICK] → SUCCESS
 *
 * Auth flows:
 *   A. Real QR scanner  → FACE_VERIFY → authenticate(qr_data, face_image)
 *   B. Supervisor Override → override picker → supervisorOverride(candidate_id, exam_id, ...)
 *
 * NOTE: [Simulate Scan] goes through Supervisor Override, NOT authenticate(),
 *       because a real QR requires an RSA-signed token from the Cloud server —
 *       we cannot generate that client-side.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  authenticate,
  checkEdgeHealth,
  supervisorOverride,
  getCandidates,
  getDemoQR,
  CandidateInfo,
} from '../services/edgeApi';

type AuthStep =
  | 'CONNECTING'
  | 'SCAN_QR'
  | 'FACE_VERIFY'
  | 'OVERRIDE_PICK'
  | 'AUTHENTICATING'
  | 'ERROR'
  | 'SUCCESS';

// ─── Human-readable error translator ─────────────────────────
function friendlyError(raw: string): string {
  const r = raw.toLowerCase();

  if (r.includes('qr token missing required fields'))
    return 'Invalid QR code format. Please use your official admit card barcode and try again.';
  if (r.includes('rsa signature') || r.includes('signature verification failed'))
    return 'QR code signature is invalid. Your admit card may have been tampered with. Please alert an invigilator.';
  if (r.includes('expired'))
    return 'Your QR code has expired. Please request a new admit card from the exam centre office.';
  if (r.includes('nonce') && r.includes('already been used'))
    return 'This QR code has already been scanned. Replay detected — please alert an invigilator.';
  if (r.includes('nonce is missing or too short'))
    return 'Invalid QR code. Please use your official admit card and try again.';
  if (r.includes('not found'))
    return 'Candidate record not found in this exam centre\'s database. Please contact an invigilator.';
  if (r.includes('face verification failed') || r.includes('similarity score'))
    return 'Face verification failed. Please ensure your face is well-lit and clearly visible, then try again.';
  if (r.includes('webcam') || r.includes('camera'))
    return 'Camera access was denied. Please allow camera permissions and try again.';
  if (r.includes('cannot connect') || r.includes('network') || r.includes('fetch'))
    return 'Cannot connect to the Edge Server. Please alert an invigilator.';
  if (r.includes('no candidates') || r.includes('seed'))
    return 'No candidates found in this exam centre\'s database. Please contact the system administrator.';
  if (r.includes('min_length') || r.includes('reason'))
    return 'Override reason is too short. Please provide a valid justification.';
  if (r.includes('500') || r.includes('internal server'))
    return 'A server error occurred. Please alert an invigilator immediately.';

  // Fallback — still sanitize: don't show raw Python tracebacks
  if (raw.length > 120) return 'An unexpected error occurred. Please alert an invigilator.';
  return raw;
}

export default function AuthPage() {
  const navigate = useNavigate();

  const [step,      setStep]      = useState<AuthStep>('CONNECTING');
  const [errorMsg,  setErrorMsg]  = useState('');
  const [qrData,    setQrData]    = useState('');
  const [similarity, setSimilarity] = useState(0);
  const [candidates, setCandidates] = useState<CandidateInfo[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateInfo | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [clickCount, setClickCount] = useState(0);

  // Hidden supervisor exit hatch: 5 fast clicks on the logo
  const handleSecretClick = () => {
    setClickCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        // @ts-ignore
        if (window.fortisAPI?.system?.onSupervisorClose) {
          // Send an event to App.tsx by simulating the shortcut
          window.dispatchEvent(new CustomEvent('trigger-supervisor-close-manual'));
        }
        return 0;
      }
      return next;
    });
    // Reset click count after 2 seconds
    setTimeout(() => setClickCount(0), 2000);
  };

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // ── Health Check ───────────────────────────────────────────
  const runHealthCheck = async (mounted = true) => {
    try {
      const isHealthy = await checkEdgeHealth();
      if (mounted) {
        if (isHealthy) setStep('SCAN_QR');
        else {
          setErrorMsg('Cannot connect to Edge Server. Please alert an invigilator.');
          setStep('ERROR');
        }
      }
    } catch {
      if (mounted) {
        setErrorMsg('Cannot connect to Edge Server. Please alert an invigilator.');
        setStep('ERROR');
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    runHealthCheck(mounted);
    return () => { mounted = false; };
  }, []);

  // Focus QR input when on SCAN_QR step
  useEffect(() => {
    if (step === 'SCAN_QR' && qrInputRef.current) {
      qrInputRef.current.focus();
    }
  }, [step]);

  // Start webcam on FACE_VERIFY
  useEffect(() => {
    if (step !== 'FACE_VERIFY') return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(s => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play();
        }
      })
      .catch(() => {
        setErrorMsg('Camera access was denied. Please allow camera permissions and try again.');
        setStep('ERROR');
      });
    return () => {
      stream?.getTracks().forEach(t => t.stop());
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [step]);

  // ── Load candidates for override picker ───────────────────
  const openOverridePicker = async () => {
    setLoadingCandidates(true);
    try {
      const list = await getCandidates();
      if (list.length === 0) {
        setErrorMsg('No candidates found in the Edge database. Please run the seed script first.');
        setStep('ERROR');
        return;
      }
      setCandidates(list);
      setSelectedCandidate(list[0]);
      setStep('OVERRIDE_PICK');
    } catch {
      setErrorMsg('Could not load candidate list from Edge Server. Please alert an invigilator.');
      setStep('ERROR');
    } finally {
      setLoadingCandidates(false);
    }
  };

  // ── Handler: QR scanner submitted (real barcode scanner) ───
  const handleQRSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = qrData.trim();
    if (!trimmed) return;

    // Basic validation before proceeding: must be JSON
    try {
      const parsed = JSON.parse(trimmed);
      // Must contain all required fields for a real QR token
      const required = ['candidate_id', 'exam_id', 'center_id', 'nonce', 'issued_at', 'expires_at', 'signature'];
      const missing = required.filter(f => !(f in parsed));
      if (missing.length > 0) {
        setErrorMsg('Invalid QR code format. Please use your official admit card and try again.');
        setStep('ERROR');
        return;
      }
    } catch {
      setErrorMsg('Invalid QR code — not a recognised format. Please try again.');
      setStep('ERROR');
      return;
    }

    setStep('FACE_VERIFY');
  };

  // ── Handler: Face capture + full authenticate() call ───────
  const handleCaptureFace = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
    (video.srcObject as MediaStream)?.getTracks().forEach(t => t.stop());
    setStep('AUTHENTICATING');

    try {
      // ── REAL API CALL — authenticate with QR + face ──
      const response = await authenticate(qrData, base64Image);
      setSimilarity(response.face_score ?? 0);
      setStep('SUCCESS');
      localStorage.setItem('exam_session', JSON.stringify(response));
      setTimeout(() => navigate('/exam'), 3000);
    } catch (err: any) {
      setErrorMsg(friendlyError(err.message || ''));
      setStep('ERROR');
    }
  };

  // ── Handler: Supervisor Override with selected candidate ────
  const handleSupervisorOverride = async () => {
    if (!selectedCandidate) return;
    setStep('AUTHENTICATING');
    try {
      // ── REAL API CALL — supervisorOverride ──
      const response = await supervisorOverride(
        selectedCandidate.id,
        selectedCandidate.exam_id,
        'invigilator_override',
        'supervisor_demo_override_for_testing',
      );
      setStep('SUCCESS');
      localStorage.setItem('exam_session', JSON.stringify(response));
      setTimeout(() => navigate('/exam'), 3000);
    } catch (err: any) {
      setErrorMsg(friendlyError(err.message || ''));
      setStep('ERROR');
    }
  };

  // ── Handler: Simulate Scan — fetches real signed QR from server ────
  const handleSimulateScan = async () => {
    setLoadingCandidates(true);
    try {
      // Fetch candidate list to pick the first one
      const list = await getCandidates();
      if (list.length === 0) {
        setErrorMsg('No candidates found in the Edge database. Please run the seed script first.');
        setStep('ERROR');
        return;
      }
      const candidate = list[0];
      // Fetch a server-signed QR token for that candidate
      const { qr_data } = await getDemoQR(candidate.id);
      setQrData(qr_data);
      setStep('FACE_VERIFY');
    } catch (err: any) {
      setErrorMsg(friendlyError(err.message || ''));
      setStep('ERROR');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const resetFlow = () => {
    setQrData('');
    setErrorMsg('');
    setCandidates([]);
    setSelectedCandidate(null);
    setStep('CONNECTING');
    runHealthCheck(true);
  };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="auth-page">

      {/* Logo */}
      <div className="auth-logo" onClick={handleSecretClick} style={{ cursor: clickCount > 0 ? 'pointer' : 'default' }}>
        <div className="auth-logo-icon">🛡️</div>
        <div className="auth-logo-title">FortisExam Secure Kiosk</div>
        <div className="auth-logo-sub">National Examination Authority · NEET UG</div>
      </div>

      {/* Auth Card */}
      <div className="auth-card">

        {/* ── CONNECTING ── */}
        {step === 'CONNECTING' && (
          <div className="flex-col items-center gap-16" style={{ width: '100%' }}>
            <div className="spinner" />
            <p style={{ color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>
              Connecting to Edge Server...
            </p>
          </div>
        )}

        {/* ── SCAN_QR ── */}
        {step === 'SCAN_QR' && (
          <div className="flex-col items-center gap-16" style={{ width: '100%' }}>
            <div className="auth-step-badge">Step 1 of 2 — QR Scan</div>
            <h2>Scan Your Admit Card</h2>
            <p>Hold your exam admit card barcode up to the scanner. The system will detect it automatically.</p>

            <div className="qr-frame">
              <div className="qr-scan-line" />
              <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.1em' }}>
                WAITING FOR SCAN
              </span>
            </div>

            {/* Hidden input captures real barcode scanner keystrokes */}
            <form onSubmit={handleQRSubmit} style={{ opacity: 0, position: 'absolute', bottom: 10, pointerEvents: 'none' }}>
              <input
                ref={qrInputRef}
                type="password"
                value={qrData}
                onChange={e => setQrData(e.target.value)}
                autoFocus
                onBlur={() => qrInputRef.current?.focus()}
                tabIndex={-1}
              />
            </form>

            {/* Invigilator / Demo helpers */}
            <div className="flex gap-12 mt-8">
              {/* Simulate Scan: fetches a server-signed QR then goes through face verify */}
              <button
                className="auth-btn auth-btn-ghost auth-btn-sm"
                disabled={loadingCandidates}
                onClick={handleSimulateScan}
              >
                {loadingCandidates ? '...' : '[Simulate Scan]'}
              </button>
              {/* Supervisor Override: bypasses QR+face entirely, always audit-logged */}
              <button
                className="auth-btn auth-btn-sm"
                style={{ background: '#d97706', color: '#fff' }}
                disabled={loadingCandidates}
                onClick={openOverridePicker}
              >
                {loadingCandidates ? 'Loading...' : '[Supervisor Override]'}
              </button>
            </div>
          </div>
        )}

        {/* ── OVERRIDE_PICK ── */}
        {step === 'OVERRIDE_PICK' && (
          <div className="flex-col items-center gap-16" style={{ width: '100%' }}>
            <div className="auth-step-badge" style={{ background: 'rgba(217,119,6,0.2)', borderColor: 'rgba(217,119,6,0.4)', color: '#fbbf24' }}>
              Supervisor Override
            </div>
            <h2>Select Candidate</h2>
            <p>Select the candidate to authenticate manually. This action is audit-logged.</p>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                REGISTERED CANDIDATES ({candidates.length})
              </label>
              <select
                value={selectedCandidate?.id || ''}
                onChange={e => {
                  const c = candidates.find(c => c.id === e.target.value) || null;
                  setSelectedCandidate(c);
                }}
                style={{
                  padding: '10px 12px', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: '#1e293b', color: '#fff', fontSize: 14,
                  width: '100%', cursor: 'pointer',
                }}
              >
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} — Roll No: {c.roll_number}
                  </option>
                ))}
              </select>

              {selectedCandidate && (
                <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                  <div>ID: <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.75)' }}>{selectedCandidate.id}</span></div>
                  <div>Exam: <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.75)' }}>{selectedCandidate.exam_id}</span></div>
                </div>
              )}
            </div>

            <div className="flex gap-12 w-full">
              <button
                className="auth-btn auth-btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setStep('SCAN_QR')}
              >
                ← Cancel
              </button>
              <button
                className="auth-btn auth-btn-primary"
                style={{ flex: 2, background: '#d97706' }}
                onClick={handleSupervisorOverride}
                disabled={!selectedCandidate}
              >
                Confirm Override
              </button>
            </div>
          </div>
        )}

        {/* ── FACE_VERIFY ── */}
        {step === 'FACE_VERIFY' && (
          <div className="flex-col items-center gap-12" style={{ width: '100%' }}>
            <div className="auth-step-badge">Step 2 of 2 — Face Verification</div>
            <h2>Face Verification</h2>
            <p>Look directly at the camera. Ensure your face is clearly visible inside the oval guide.</p>

            <div className="webcam-frame">
              <video
                ref={videoRef}
                muted autoPlay playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
              <div className="webcam-overlay">
                <div className="face-guide" />
              </div>
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <button className="auth-btn auth-btn-primary auth-btn-full" onClick={handleCaptureFace}>
              Capture &amp; Authenticate
            </button>
            <button className="auth-btn auth-btn-ghost auth-btn-sm" onClick={resetFlow}>
              ← Go Back
            </button>
          </div>
        )}

        {/* ── AUTHENTICATING ── */}
        {step === 'AUTHENTICATING' && (
          <div className="flex-col items-center gap-16" style={{ width: '100%' }}>
            <div className="spinner" style={{ width: 48, height: 48 }} />
            <h2>Verifying Identity</h2>
            <p>Checking credentials and creating your secure exam session...</p>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {step === 'SUCCESS' && (
          <div className="flex-col items-center gap-16" style={{ width: '100%' }}>
            <div className="auth-result-icon success">✓</div>
            <h2>Authentication Successful</h2>
            <div className="auth-alert auth-alert-success">
              <div>Identity Confirmed</div>
              {similarity > 0 && (
                <div style={{ fontSize: 11, fontFamily: 'monospace', marginTop: 4 }}>
                  Face Similarity Score: {(similarity * 100).toFixed(1)}%
                </div>
              )}
            </div>
            <p>Preparing your secure exam environment...</p>
            <div className="auth-progress-bar mt-8">
              <div className="auth-progress-fill" style={{ width: '100%' }} />
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {step === 'ERROR' && (
          <div className="flex-col items-center gap-16" style={{ width: '100%' }}>
            <div className="auth-result-icon error">✗</div>
            <h2>Authentication Failed</h2>
            <div className="auth-alert auth-alert-danger">{errorMsg}</div>
            <button className="auth-btn auth-btn-primary auth-btn-full" onClick={resetFlow}>
              Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
