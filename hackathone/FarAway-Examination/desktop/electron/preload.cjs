/**
 * FortisExam Desktop — Preload Script
 *
 * Exposes safe IPC channels to the renderer process.
 * Follows Electron security best practices: contextBridge + ipcRenderer.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fortisAPI', {
  // --- Authentication ---
  auth: {
    scanQR: () => ipcRenderer.invoke('auth:scan-qr'),
    captureFace: () => ipcRenderer.invoke('auth:capture-face'),
    authenticate: (qrData, faceImage) =>
      ipcRenderer.invoke('auth:authenticate', qrData, faceImage),
  },

  // --- Exam ---
  exam: {
    loadSession: (sessionId) => ipcRenderer.invoke('exam:load-session', sessionId),
    submitAnswer: (sessionId, questionId, option) =>
      ipcRenderer.invoke('exam:submit-answer', sessionId, questionId, option),
    submitExam: (sessionId) => ipcRenderer.invoke('exam:submit', sessionId),
  },

  // --- Recovery ---
  recovery: {
    checkSnapshot: (candidateId) =>
      ipcRenderer.invoke('recovery:check-snapshot', candidateId),
    restoreSession: (sessionId) =>
      ipcRenderer.invoke('recovery:restore-session', sessionId),
  },

  // --- Monitoring ---
  monitoring: {
    reportEvent: (eventType, severity, details) =>
      ipcRenderer.invoke('monitoring:report-event', eventType, severity, details),
  },

  // --- System ---
  system: {
    onSupervisorClose: (callback) => {
      ipcRenderer.on('trigger-supervisor-close', () => callback());
    },
    closeApp: () => ipcRenderer.send('system:close-app'),
  },
});
