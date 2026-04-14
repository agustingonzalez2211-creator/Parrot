import { contextBridge, ipcRenderer } from 'electron';
import type { AnalyzeWorkflowPayload, GenerateSkillPayload, WorkflowAnalysis, SkillOutput } from './ai/types';

contextBridge.exposeInMainWorld('parrotAPI', {
  // ── Existing ────────────────────────────────────────────────────────────────
  getSources: (): Promise<{ id: string; name: string; thumbnail: string }[]> =>
    ipcRenderer.invoke('get-sources'),

  saveRecording: (buffer: ArrayBuffer): Promise<void> =>
    ipcRenderer.invoke('save-recording', buffer),

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
});
