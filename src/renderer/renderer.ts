// ─── Inline types (no cross-boundary imports — renderer runs in browser) ───────

interface CapturedFrame {
  seq: number;
  timestamp_ms: number;
  image_base64: string;
  click_x: number;
  click_y: number;
  click_x_pct: number;
  click_y_pct: number;
}

interface DetectedStep    { id: number; action: string; description: string; }
interface DetectedInput   { name: string; description: string; }
interface ClarifyingQuestion { id: number; question: string; context: string; }

interface WorkflowAnalysis {
  workflow_name: string;
  workflow_description: string;
  detected_apps: string[];
  steps: DetectedStep[];
  detected_inputs: DetectedInput[];
  clarifying_questions: ClarifyingQuestion[];
}

interface UserAnswer  { question_id: number; answer: string; }

interface SkillOutput {
  skill_name: string;
  skill_filename: string;
  skill_content: string;
  claude_code_instructions: string[];
}

interface AnalyzeWorkflowPayload {
  frames: CapturedFrame[];
  recording_duration_ms: number;
  total_clicks: number;
}

interface GenerateSkillPayload {
  analysis: WorkflowAnalysis;
  answers: UserAnswer[];
}

// ─── parrotAPI type ────────────────────────────────────────────────────────────
interface Window {
  parrotAPI: {
    getSources: () => Promise<{ id: string; name: string; thumbnail: string }[]>;
    saveRecording: (buffer: ArrayBuffer) => Promise<void>;
    openOverlay: () => Promise<void>;
    closeOverlay: () => Promise<void>;
    onOverlayAction: (cb: (action: 'stop-analyze' | 'cancel') => void) => void;
    getApiKeyStatus: () => Promise<boolean>;
    analyzeWorkflow: (payload: AnalyzeWorkflowPayload) => Promise<WorkflowAnalysis>;
    generateSkill: (payload: GenerateSkillPayload) => Promise<SkillOutput>;
    saveSkillFile: (content: string, filename: string) => Promise<void>;
    installSkill: (content: string, skillName: string) => Promise<void>;
    checkClaudeCodePath: () => Promise<boolean>;
  };
}

// ─── Elements ─────────────────────────────────────────────────────────────────
const screenHome       = document.getElementById('screen-home')!;
const screenLibrary    = document.getElementById('screen-library')!;
const screenRecording  = document.getElementById('screen-recording')!;
const screenAnalyzing  = document.getElementById('screen-analyzing')!;
const screenAnalysis   = document.getElementById('screen-analysis-result')!;
const screenGenerating = document.getElementById('screen-generating')!;
const screenSkill      = document.getElementById('screen-skill-result')!;
const screenError      = document.getElementById('screen-error')!;

const btnRecord        = document.getElementById('btn-record')         as HTMLButtonElement;
const btnOpenLibrary   = document.getElementById('btn-open-library')   as HTMLButtonElement;
const btnCancel      = document.getElementById('btn-cancel')       as HTMLButtonElement;
const btnStopAnalyze = document.getElementById('btn-stop-analyze') as HTMLButtonElement;
const preview        = document.getElementById('preview')          as HTMLVideoElement;
const canvas         = document.getElementById('sim-canvas')       as HTMLCanvasElement;
const recTimer       = document.getElementById('rec-timer')!;
const vfSource       = document.getElementById('vf-source')!;
const sbSize         = document.getElementById('sb-size')!;
const clickCounter   = document.getElementById('click-counter')!;

// ─── Session state ─────────────────────────────────────────────────────────────
let mediaRecorder:    MediaRecorder | null = null;
let recordedChunks:   Blob[]               = [];
let activeStream:     MediaStream | null   = null;
let timerInterval:    ReturnType<typeof setInterval> | null = null;
let simInterval:      ReturnType<typeof setInterval> | null = null;
let captureInterval:  ReturnType<typeof setInterval> | null = null;
let seconds    = 0;
let frameCount = 0;
let isRecording = false;

let capturedFrames: CapturedFrame[] = [];
let currentAnalysis: WorkflowAnalysis | null = null;
let currentSkill: SkillOutput | null = null;
let retryAction: (() => void) | null = null;

// ─── Screen navigation ─────────────────────────────────────────────────────────
function showScreen(id: string): void {
  [screenHome, screenLibrary, screenRecording, screenAnalyzing, screenAnalysis,
   screenGenerating, screenSkill, screenError].forEach(s => {
    (s as HTMLElement).style.display = 'none';
  });
  const target = document.getElementById(id);
  if (target) (target as HTMLElement).style.display = 'flex';
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function formatTime(s: number): string {
  const m   = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}<span>:</span>${sec}`;
}

function startTimer() {
  seconds = 0;
  recTimer.innerHTML = formatTime(0);
  timerInterval = setInterval(() => { seconds++; recTimer.innerHTML = formatTime(seconds); }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ─── Simulation ────────────────────────────────────────────────────────────────
function startSimulation() {
  canvas.style.display  = 'block';
  preview.style.display = 'none';

  const ctx = canvas.getContext('2d')!;
  canvas.width  = canvas.offsetWidth  || 800;
  canvas.height = canvas.offsetHeight || 450;

  let tick = 0;

  function draw() {
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#1a1b26';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#16161e';
    ctx.fillRect(0, h - 36, w, 36);

    ctx.fillStyle = '#24283b';
    ctx.fillRect(40, 40, w - 80, h - 110);

    ctx.fillStyle = '#1f2335';
    ctx.fillRect(40, 40, w - 80, 32);

    const dots = ['#ff5f57', '#febc2e', '#28c840'];
    dots.forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(62 + i * 20, 56, 6, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    });

    const lineColors = ['#7aa2f7', '#9ece6a', '#e0af68', '#bb9af7', '#7dcfff'];
    for (let i = 0; i < 14; i++) {
      const y      = 94 + i * 22;
      const len    = ((Math.sin(tick * 0.03 + i * 1.3) + 1) / 2) * (w * 0.4) + w * 0.1;
      const indent = (i % 3) * 20;
      ctx.fillStyle = lineColors[i % lineColors.length];
      ctx.globalAlpha = 0.6 + (Math.sin(tick * 0.05 + i) + 1) * 0.2;
      ctx.fillRect(60 + indent, y, len, 3);
    }
    ctx.globalAlpha = 1;

    if (Math.floor(tick / 20) % 2 === 0) {
      ctx.fillStyle = '#c0caf5';
      ctx.fillRect(64, 94 + 14 * 22, 2, 16);
    }

    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = '#414868';
      ctx.fillRect(w / 2 - 80 + i * 28, h - 28, 20, 20);
    }

    ctx.fillStyle = '#565f89';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleTimeString(), w - 12, h - 12);

    const scanY = (tick * 2) % h;
    const grad  = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8);
    grad.addColorStop(0, 'rgba(139,92,246,0)');
    grad.addColorStop(0.5, 'rgba(139,92,246,0.08)');
    grad.addColorStop(1, 'rgba(139,92,246,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, scanY - 8, w, 16);

    tick++;
  }

  simInterval = setInterval(draw, 33);
  draw();
}

function stopSimulation() {
  if (simInterval) { clearInterval(simInterval); simInterval = null; }
  canvas.style.display  = 'none';
  preview.style.display = 'none';
}

// ─── Frame capture (interval-based) ───────────────────────────────────────────
function captureFrameByInterval(): void {
  if (!isRecording) return;

  const videoEl = preview.style.display !== 'none' ? preview : canvas;

  // Skip if video stream not ready yet
  if (videoEl instanceof HTMLVideoElement && videoEl.readyState < 2) return;

  const MAX_W = 1280, MAX_H = 720;
  const rect  = videoEl.getBoundingClientRect();
  const srcW  = videoEl instanceof HTMLVideoElement ? (videoEl.videoWidth  || rect.width)  : rect.width;
  const srcH  = videoEl instanceof HTMLVideoElement ? (videoEl.videoHeight || rect.height) : rect.height;

  let outW = srcW, outH = srcH;
  if (outW > MAX_W) { outH = Math.round(outH * MAX_W / outW); outW = MAX_W; }
  if (outH > MAX_H) { outW = Math.round(outW * MAX_H / outH); outH = MAX_H; }

  const offscreen = document.createElement('canvas');
  offscreen.width  = outW;
  offscreen.height = outH;
  offscreen.getContext('2d')!.drawImage(videoEl, 0, 0, outW, outH);

  const image_base64 = offscreen.toDataURL('image/jpeg', 0.7).split(',')[1];
  const seq = capturedFrames.length + 1;
  const timestamp_ms = seconds * 1000;

  capturedFrames.push({ seq, timestamp_ms, image_base64, click_x: 0, click_y: 0, click_x_pct: 0, click_y_pct: 0 });

  clickCounter.textContent = `${capturedFrames.length} frame${capturedFrames.length !== 1 ? 's' : ''}`;
  btnStopAnalyze.disabled = false;

  console.log(`[parrot] frame captured seq=${seq} t=${timestamp_ms}ms (interval)`);
}

function startCaptureInterval(): void {
  stopCaptureInterval();
  captureInterval = setInterval(captureFrameByInterval, 2000);
}

function stopCaptureInterval(): void {
  if (captureInterval) { clearInterval(captureInterval); captureInterval = null; }
}

function sampleFrames(frames: CapturedFrame[], max: number): CapturedFrame[] {
  if (frames.length <= max) return frames;
  const result: CapturedFrame[] = [];
  for (let i = 0; i < max; i++) {
    const idx = Math.round(i * (frames.length - 1) / (max - 1));
    result.push(frames[idx]);
  }
  return result;
}

// ─── Reset session ─────────────────────────────────────────────────────────────
function resetSession(): void {
  stopCaptureInterval();
  capturedFrames   = [];
  currentAnalysis  = null;
  currentSkill     = null;
  retryAction      = null;
  recordedChunks   = [];
  frameCount       = 0;
  clickCounter.textContent = '0 frames';
  btnStopAnalyze.disabled  = true;
}

// ─── Stop recording helper ─────────────────────────────────────────────────────
function stopRecording(): void {
  isRecording = false;
  stopCaptureInterval();
  (window as any).parrotAPI.closeOverlay();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (activeStream) { activeStream.getTracks().forEach(t => t.stop()); activeStream = null; }
  preview.srcObject = null;
  stopTimer();
  stopSimulation();
}

// ─── Error screen ──────────────────────────────────────────────────────────────
function showError(message: string, onRetry?: () => void): void {
  const msgEl    = document.getElementById('error-message')!;
  const retryBtn = document.getElementById('btn-error-retry') as HTMLButtonElement;
  const homeBtn  = document.getElementById('btn-error-home')  as HTMLButtonElement;

  msgEl.textContent = message;
  retryAction = onRetry ?? null;

  retryBtn.style.display = onRetry ? 'flex' : 'none';
  homeBtn.style.display  = 'flex';

  showScreen('screen-error');
}

// ─── Agent 1: analyze workflow ─────────────────────────────────────────────────
async function runAnalysis(): Promise<void> {
  const sampled = sampleFrames(capturedFrames, 15);

  // Check API key first
  const hasKey = await (window as any).parrotAPI.getApiKeyStatus();
  if (!hasKey) {
    showError('Falta ANTHROPIC_API_KEY. Seteá la variable de entorno y reiniciá la app.');
    return;
  }

  // Show analyzing screen
  const analyzingFrames = document.getElementById('analyzing-frames')!;
  analyzingFrames.textContent = `Enviando ${sampled.length} frames a Claude…`;
  showScreen('screen-analyzing');

  try {
    console.log(`[parrot:agent1] sending ${sampled.length} frames`);
    const analysis = await (window as any).parrotAPI.analyzeWorkflow({
      frames: sampled,
      recording_duration_ms: seconds * 1000,
      total_frames: capturedFrames.length,
    });
    console.log('[parrot:agent1] received analysis:', analysis.workflow_name);
    currentAnalysis = analysis;
    populateAnalysisResult(analysis);
    showScreen('screen-analysis-result');
  } catch (err: any) {
    console.error('[parrot:agent1] error:', err);
    showError(
      `Error al analizar el workflow: ${err?.message ?? err}`,
      () => runAnalysis(),
    );
  }
}

// ─── Populate SCR-04 ───────────────────────────────────────────────────────────
function populateAnalysisResult(analysis: WorkflowAnalysis): void {
  const nameEl  = document.getElementById('wr-name')!;
  const descEl  = document.getElementById('wr-desc')!;
  const stepsEl = document.getElementById('wr-steps')!;
  const questEl = document.getElementById('wr-questions')!;

  nameEl.textContent = analysis.workflow_name;
  descEl.textContent = analysis.workflow_description;

  stepsEl.innerHTML = analysis.steps.map(s =>
    `<li><span class="step-action">${s.action}</span> — ${s.description}</li>`
  ).join('');

  questEl.innerHTML = analysis.clarifying_questions.map(q => `
    <div class="question-card" data-qid="${q.id}">
      <div class="question-header">
        <span class="question-num">${q.id}.</span>
        <p class="question-text">${q.question}</p>
        <span class="badge-optional">opcional</span>
      </div>
      <p class="question-ctx">${q.context}</p>
      <div class="question-answers">
        <button class="btn-answer" data-answer="yes">Sí</button>
        <button class="btn-answer" data-answer="no">No</button>
        <textarea class="answer-textarea" placeholder="O escribí tu respuesta aquí…" maxlength="500"></textarea>
      </div>
    </div>
  `).join('');

  // Wire up Sí/No buttons (no validation required — all optional)
  questEl.querySelectorAll('.question-card').forEach(card => {
    const btns     = card.querySelectorAll<HTMLButtonElement>('.btn-answer');
    const textarea = card.querySelector<HTMLTextAreaElement>('.answer-textarea')!;

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        textarea.value = '';
      });
    });

    textarea.addEventListener('input', () => {
      if (textarea.value.trim()) btns.forEach(b => b.classList.remove('active'));
    });
  });

  // Always enabled — questions are optional
  const btnGenerate = document.getElementById('btn-generate-skill') as HTMLButtonElement;
  btnGenerate.disabled = false;
}

function collectAnswers(): UserAnswer[] {
  const answers: UserAnswer[] = [];

  document.querySelectorAll('.question-card').forEach(card => {
    const qid       = parseInt((card as HTMLElement).dataset.qid ?? '0', 10);
    const activeBtn = card.querySelector<HTMLButtonElement>('.btn-answer.active');
    const textarea  = card.querySelector<HTMLTextAreaElement>('.answer-textarea')!;

    let answer = '';
    if (textarea.value.trim())       answer = textarea.value.trim();
    else if (activeBtn)              answer = activeBtn.dataset.answer ?? '';
    // empty string = user left it unanswered (optional)

    answers.push({ question_id: qid, answer });
  });

  // Include additional context if provided (question_id = 0)
  const additionalCtx = (document.getElementById('additional-context') as HTMLTextAreaElement)?.value?.trim();
  if (additionalCtx) {
    answers.push({ question_id: 0, answer: additionalCtx });
  }

  return answers;
}

// ─── Agent 2: generate skill ───────────────────────────────────────────────────
async function runGenerate(): Promise<void> {
  if (!currentAnalysis) return;

  const answers = collectAnswers();
  showScreen('screen-generating');

  try {
    console.log('[parrot:agent2] sending analysis + answers');
    const skill = await (window as any).parrotAPI.generateSkill({
      analysis: currentAnalysis,
      answers,
    });
    console.log('[parrot:agent2] received skill:', skill.skill_name);
    currentSkill = skill;
    await populateSkillResult(skill);
    showScreen('screen-skill-result');
  } catch (err: any) {
    console.error('[parrot:agent2] error:', err);
    showError(
      `Error al generar el skill: ${err?.message ?? err}`,
      () => runGenerate(),
    );
  }
}

// ─── Populate SCR-06 ───────────────────────────────────────────────────────────
async function populateSkillResult(skill: SkillOutput): Promise<void> {
  const nameEl    = document.getElementById('sr-name')!;
  const fileEl    = document.getElementById('sr-filename')!;
  const codeEl    = document.getElementById('sr-code')!;
  const stepsEl   = document.getElementById('sr-install-steps')!;
  const autoBtn   = document.getElementById('btn-install-auto') as HTMLButtonElement;
  const autoWrap  = document.getElementById('sr-auto-install')!;
  const manualWrap= document.getElementById('sr-manual-install')!;
  const pathEl    = document.getElementById('sr-install-path')!;

  nameEl.textContent = skill.skill_name;
  fileEl.textContent = skill.skill_filename;
  codeEl.innerHTML   = syntaxHighlight(skill.skill_content);

  stepsEl.innerHTML = skill.claude_code_instructions
    .map((step, i) => `<li><span class="inst-num">${i + 1}</span>${step}</li>`)
    .join('');

  // Check if ~/.claude/skills/ exists
  const hasPath = await (window as any).parrotAPI.checkClaudeCodePath();
  const installPath = `~/.claude/skills/${skill.skill_filename}`;
  pathEl.textContent = installPath;

  if (hasPath) {
    autoWrap.style.display  = 'flex';
    manualWrap.style.display = 'none';
  } else {
    autoWrap.style.display  = 'none';
    manualWrap.style.display = 'flex';
  }

  // Auto-install button
  autoBtn.onclick = async () => {
    try {
      await (window as any).parrotAPI.installSkill(skill.skill_content, skill.skill_name);
      autoBtn.textContent = `✓ Instalado en ${installPath}`;
      autoBtn.disabled = true;
      autoBtn.classList.add('installed');
    } catch (err: any) {
      showError(`No se pudo instalar: ${err?.message ?? err}`);
    }
  };
}

function syntaxHighlight(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // YAML keys (word: )
    .replace(/^(\s*)([\w_-]+)(:)/gm, '$1<span class="hl-key">$2</span><span class="hl-punct">$3</span>')
    // Strings in quotes
    .replace(/'([^']*)'/g, '<span class="hl-str">\'$1\'</span>')
    // Comments
    .replace(/(#.*)$/gm, '<span class="hl-comment">$1</span>')
    // Markdown headers
    .replace(/^(#{1,3} .+)$/gm, '<span class="hl-header">$1</span>');
}

// ─── Library screen ────────────────────────────────────────────────────────────
async function loadLibrary(): Promise<void> {
  const grid    = document.getElementById('skill-grid')!;
  const emptyEl = document.getElementById('lib-empty')!;
  const countEl = document.getElementById('lib-count')!;

  const skills: { filename: string; name: string }[] =
    await (window as any).parrotAPI.listSkills();

  countEl.textContent = `${skills.length} SKILL${skills.length !== 1 ? 'S' : ''}`;

  // Remove stale cards (keep empty state element)
  grid.querySelectorAll('.skill-lib-card').forEach(el => el.remove());

  if (skills.length === 0) {
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.style.display = 'none';

  skills.forEach(skill => {
    const initials = skill.name.trim().substring(0, 2).toUpperCase();
    const card = document.createElement('div');
    card.className = 'skill-lib-card';
    card.innerHTML = `
      <div class="skill-lib-thumb">
        <div class="skill-lib-initials">${initials}</div>
      </div>
      <div class="skill-lib-body">
        <div class="skill-lib-name">${skill.name}</div>
        <div class="skill-lib-file">${skill.filename}</div>
        <div class="skill-lib-tag">READY</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ─── Event listeners ───────────────────────────────────────────────────────────

// Library button
btnOpenLibrary.addEventListener('click', () => {
  showScreen('screen-library');
  loadLibrary();
});

// Library — back button & FAB
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.id === 'btn-library-back') {
    showScreen('screen-home');
  }
  if (target.id === 'btn-fab-new' || target.id === 'btn-new-from-empty') {
    showScreen('screen-home');
    btnRecord.click();
  }
});

// Library — filter tabs (visual only)
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('lib-tab')) {
    target.closest('.lib-filter-bar')
      ?.querySelectorAll('.lib-tab')
      .forEach(t => t.classList.remove('active'));
    target.classList.add('active');
  }
});

// Record button
btnRecord.addEventListener('click', async () => {
  resetSession();
  showScreen('screen-recording');
  startTimer();
  vfSource.textContent = 'Iniciando…';

  try {
    console.log('[parrot] getSources…');
    const sources = await (window as any).parrotAPI.getSources();

    if (!sources.length) throw new Error('No hay fuentes de pantalla disponibles');

    const screen = sources[0];
    vfSource.textContent = screen.name;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        // @ts-ignore
        mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: screen.id },
      },
    });

    activeStream = stream;
    preview.srcObject  = stream;
    preview.style.display = 'block';
    canvas.style.display  = 'none';

    recordedChunks = [];
    frameCount = 0;

    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
        frameCount++;
        const mb = (recordedChunks.reduce((a, b) => a + b.size, 0) / 1024 / 1024).toFixed(1);
        sbSize.textContent = `${frameCount} chunks · ${mb} MB`;
      }
    };
    mediaRecorder.start(1000);
    isRecording = true;
    startCaptureInterval();
    (window as any).parrotAPI.openOverlay();
    (window as any).parrotAPI.minimizeWindow();

  } catch (err) {
    console.warn('[parrot] captura real falló, usando simulación:', err);
    vfSource.textContent = 'Simulación (sin permisos)';
    sbSize.textContent   = 'Modo simulado · VP9 · 30fps';
    startSimulation();
    isRecording = true;
    startCaptureInterval();
    (window as any).parrotAPI.openOverlay();
    (window as any).parrotAPI.minimizeWindow();
  }
});

// Cancel button
btnCancel.addEventListener('click', () => {
  stopRecording();
  resetSession();
  showScreen('screen-home');
});

// Stop & Analyze button
btnStopAnalyze.addEventListener('click', () => {
  stopRecording();
  runAnalysis();
});

// Generate skill button
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.id === 'btn-generate-skill') {
    runGenerate();
  }
});

// Download .md button
document.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;
  if (target.id === 'btn-download-skill' && currentSkill) {
    try {
      await (window as any).parrotAPI.saveSkillFile(currentSkill.skill_content, currentSkill.skill_filename);
    } catch (err: any) {
      showError(`No se pudo descargar: ${err?.message ?? err}`);
    }
  }
});

// New recording button
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.id === 'btn-new-recording') {
    resetSession();
    showScreen('screen-home');
  }
});

// Error screen buttons
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.id === 'btn-error-retry' && retryAction) {
    retryAction();
  }
  if (target.id === 'btn-error-home') {
    resetSession();
    showScreen('screen-home');
  }
});

// Frame capture runs via setInterval (startCaptureInterval) — no click listener needed

// ─── Overlay action handler ────────────────────────────────────────────────────
(window as any).parrotAPI.onOverlayAction((action: 'stop-analyze' | 'cancel') => {
  if (action === 'stop-analyze') {
    stopRecording();
    runAnalysis();
  } else if (action === 'cancel') {
    stopRecording();
    resetSession();
    showScreen('screen-home');
  }
});

// ─── Init ──────────────────────────────────────────────────────────────────────
showScreen('screen-home');
btnStopAnalyze.disabled = true;
