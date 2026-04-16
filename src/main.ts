import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { app, BrowserWindow, ipcMain, desktopCapturer, dialog, screen } from 'electron';
import * as fs from 'fs/promises';
import * as os from 'os';
import { analyzeWorkflow } from './ai/agent1-analyzer';
import { generateSkill } from './ai/agent2-generator';
import type { AnalyzeWorkflowPayload, GenerateSkillPayload } from './ai/types';

let mainWindow:    BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // DevTools disabled — uncomment to debug:
  // if (!app.isPackaged) mainWindow.webContents.openDevTools({ mode: 'bottom' });

  mainWindow.on('closed', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
      overlayWindow = null;
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Existing IPC ──────────────────────────────────────────────────────────────

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 320, height: 180 },
  });
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
  }));
});

// ─── Overlay IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('open-overlay', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) return;

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 280,
    height: 72,
    x: width - 296,
    y: height - 88,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  overlayWindow.on('closed', () => { overlayWindow = null; });
});

ipcMain.handle('set-overlay-theme', (_event, theme: 'light' | 'dark') => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay-theme-change', theme);
  }
});

ipcMain.handle('close-overlay', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
});

// Overlay sends action → forward to main window
ipcMain.on('overlay-action', (_event, action: 'stop-analyze' | 'cancel') => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('overlay-action', action);
});

// ─── Phase 2 IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('get-api-key-status', () => {
  return !!process.env.ANTHROPIC_API_KEY;
});

ipcMain.handle('analyze-workflow', async (_event, payload: AnalyzeWorkflowPayload) => {
  try {
    console.log(`[parrot:main] analyze-workflow — ${payload.frames.length} frames`);
    return await analyzeWorkflow(payload);
  } catch (err) {
    console.error('[parrot:main] analyze-workflow error:', err);
    throw err;
  }
});

// ─── Phase 3 IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('generate-skill', async (_event, payload: GenerateSkillPayload) => {
  try {
    console.log('[parrot:main] generate-skill');
    return await generateSkill(payload.analysis, payload.answers);
  } catch (err) {
    console.error('[parrot:main] generate-skill error:', err);
    throw err;
  }
});

ipcMain.handle('check-claude-code-path', async () => {
  const skillsDir = path.join(os.homedir(), '.claude', 'skills');
  try {
    await fs.access(skillsDir);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('install-skill', async (_event, { content, skillName }: { content: string; skillName: string }) => {
  const skillsDir = path.join(os.homedir(), '.claude', 'skills');
  const filePath  = path.join(skillsDir, `${skillName}.md`);
  try {
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`[parrot:main] skill installed at ${filePath}`);
  } catch (err) {
    console.error('[parrot:main] install-skill error:', err);
    throw err;
  }
});

ipcMain.handle('save-skill-file', async (_event, { content, filename }: { content: string; filename: string }) => {
  if (!mainWindow) return;

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename,
    filters: [{ name: 'Claude Code Skill', extensions: ['md'] }],
  });

  if (canceled || !filePath) return;

  try {
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`[parrot:main] skill saved to ${filePath}`);
  } catch (err) {
    console.error('[parrot:main] save-skill-file error:', err);
    throw err;
  }
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});

ipcMain.handle('list-skills', async () => {
  const skillsDir = path.join(os.homedir(), '.claude', 'skills');
  try {
    const files = await fs.readdir(skillsDir);
    return files
      .filter(f => f.endsWith('.md'))
      .map(f => ({ filename: f, name: f.replace(/\.md$/, '').replace(/-/g, ' ') }));
  } catch {
    return [];
  }
});
