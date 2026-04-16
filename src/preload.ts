import { contextBridge, ipcRenderer } from 'electron';
import type { AnalyzeWorkflowPayload, GenerateSkillPayload, WorkflowAnalysis, SkillOutput } from './ai/types';

contextBridge.exposeInMainWorld('parrotAPI', {
  // ── Existing ────────────────────────────────────────────────────────────────
  getSources: (): Promise<{ id: string; name: string; thumbnail: string }[]> =>
    ipcRenderer.invoke('get-sources'),

  saveRecording: (buffer: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke('save-recording', buffer),

  // ── Overlay ──────────────────────────────────────────────────────────────────
  openOverlay: (): Promise<void> =>
    ipcRenderer.invoke('open-overlay'),

  closeOverlay: (): Promise<void> =>
    ipcRenderer.invoke('close-overlay'),

  setOverlayTheme: (theme: 'light' | 'dark'): Promise<void> =>
    ipcRenderer.invoke('set-overlay-theme', theme),

  onOverlayAction: (cb: (action: 'stop-analyze' | 'cancel') => void): void => {
    ipcRenderer.on('overlay-action', (_event, action) => cb(action));
  },

  // ── Phase 2: workflow analysis ───────────────────────────────────────────────
  getApiKeyStatus: (): Promise<boolean> =>
    ipcRenderer.invoke('get-api-key-status'),

  analyzeWorkflow: (payload: AnalyzeWorkflowPayload): Promise<WorkflowAnalysis> =>
    ipcRenderer.invoke('analyze-workflow', payload),

  // ── Phase 3: skill generation & installation ─────────────────────────────────
  generateSkill: (payload: GenerateSkillPayload): Promise<SkillOutput> =>
    ipcRenderer.invoke('generate-skill', payload),

  checkClaudeCodePath: (): Promise<boolean> =>
    ipcRenderer.invoke('check-claude-code-path'),

  installSkill: (content: string, skillName: string): Promise<void> =>
    ipcRenderer.invoke('install-skill', { content, skillName }),

  saveSkillFile: (content: string, filename: string): Promise<void> =>
    ipcRenderer.invoke('save-skill-file', { content, filename }),

  minimizeWindow: (): Promise<void> =>
    ipcRenderer.invoke('minimize-window'),

  listSkills: (): Promise<{ filename: string; name: string }[]> =>
    ipcRenderer.invoke('list-skills'),
});
