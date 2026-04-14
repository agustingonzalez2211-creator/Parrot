interface Window {
  parrotAPI: {
    getSources: () => Promise<{ id: string; name: string; thumbnail: string }[]>;
  };
}

// Elements
const screenHome      = document.getElementById('screen-home')!;
const screenRecording = document.getElementById('screen-recording')!;
const btnRecord       = document.getElementById('btn-record')       as HTMLButtonElement;
const btnCancel       = document.getElementById('btn-cancel')       as HTMLButtonElement;
const preview         = document.getElementById('preview')          as HTMLVideoElement;
const canvas          = document.getElementById('sim-canvas')       as HTMLCanvasElement;
const recTimer        = document.getElementById('rec-timer')!;
const vfSource        = document.getElementById('vf-source')!;
const sbSize          = document.getElementById('sb-size')!;

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[]              = [];
let activeStream: MediaStream | null    = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let simInterval: ReturnType<typeof setInterval>   | null = null;
let seconds    = 0;
let frameCount = 0;

// ── Timer ──────────────────────────────────────────────────────────────────
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

// ── Screen transitions ─────────────────────────────────────────────────────
function showRecording() {
  screenHome.style.display      = 'none';
  screenRecording.style.display = 'flex';
}

function showHome() {
  screenHome.style.display      = 'flex';
  screenRecording.style.display = 'none';
}

// ── Simulation ─────────────────────────────────────────────────────────────
function startSimulation() {
  canvas.style.display = 'block';
  preview.style.display = 'none';

  const ctx = canvas.getContext('2d')!;
  canvas.width  = canvas.offsetWidth  || 800;
  canvas.height = canvas.offsetHeight || 450;

  let tick = 0;

  function draw() {
    const w = canvas.width;
    const h = canvas.height;

    // Background
    ctx.fillStyle = '#1a1b26';
    ctx.fillRect(0, 0, w, h);

    // Fake taskbar
    ctx.fillStyle = '#16161e';
    ctx.fillRect(0, h - 36, w, 36);

    // Fake window
    ctx.fillStyle = '#24283b';
    ctx.fillRect(40, 40, w - 80, h - 110);

    // Window titlebar
    ctx.fillStyle = '#1f2335';
    ctx.fillRect(40, 40, w - 80, 32);

    // Window dots
    const dots = ['#ff5f57', '#febc2e', '#28c840'];
    dots.forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(62 + i * 20, 56, 6, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    });

    // Fake code lines — animadas
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

    // Cursor blink
    if (Math.floor(tick / 20) % 2 === 0) {
      ctx.fillStyle = '#c0caf5';
      ctx.fillRect(64, 94 + 14 * 22, 2, 16);
    }

    // Fake taskbar icons
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = '#414868';
      ctx.fillRect(w / 2 - 80 + i * 28, h - 28, 20, 20);
    }

    // Clock
    ctx.fillStyle = '#565f89';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    const now = new Date();
    ctx.fillText(now.toLocaleTimeString(), w - 12, h - 12);

    // Scan line overlay
    const scanY = (tick * 2) % h;
    const grad  = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8);
    grad.addColorStop(0, 'rgba(139,92,246,0)');
    grad.addColorStop(0.5, 'rgba(139,92,246,0.08)');
    grad.addColorStop(1, 'rgba(139,92,246,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, scanY - 8, w, 16);

    tick++;
  }

  simInterval = setInterval(draw, 33); // ~30fps
  draw();
}

function stopSimulation() {
  if (simInterval) { clearInterval(simInterval); simInterval = null; }
  canvas.style.display  = 'none';
  preview.style.display = 'none';
}

// ── Record button ──────────────────────────────────────────────────────────
btnRecord.addEventListener('click', async () => {
  showRecording();
  startTimer();
  vfSource.textContent = 'Iniciando...';

  try {
    console.log('[parrot] getSources...');
    const sources = await window.parrotAPI.getSources();
    console.log('[parrot] sources:', sources.length, sources.map(s => s.name));

    if (!sources.length) {
      throw new Error('No hay fuentes de pantalla disponibles');
    }

    const screen = sources[0];
    vfSource.textContent = screen.name;

    console.log('[parrot] getUserMedia con source:', screen.id);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        // @ts-ignore
        mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: screen.id },
      },
    });

    console.log('[parrot] stream ok, tracks:', stream.getVideoTracks().length);
    activeStream       = stream;
    preview.srcObject  = stream;
    preview.style.display = 'block';
    canvas.style.display  = 'none';

    recordedChunks = [];
    frameCount     = 0;

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

  } catch (err) {
    console.warn('[parrot] captura real falló, usando simulación:', err);
    vfSource.textContent = 'Simulación (sin permisos de pantalla)';
    sbSize.textContent   = 'Modo simulado · VP9 · 30fps';
    startSimulation();
  }
});

// ── Cancel button ──────────────────────────────────────────────────────────
btnCancel.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
  }
  preview.srcObject = null;
  recordedChunks    = [];
  stopTimer();
  stopSimulation();
  showHome();
});
