export {};

declare global {
  interface Window {
    parrotAPI: {
      getSources: () => Promise<{ id: string; name: string; thumbnail: string }[]>;
    };
  }
}

const screenHome      = document.getElementById('screen-home')!;
const screenRecording = document.getElementById('screen-recording')!;
const btnRecord       = document.getElementById('btn-record')       as HTMLButtonElement;
const btnCancel       = document.getElementById('btn-cancel')       as HTMLButtonElement;
const preview         = document.getElementById('preview')          as HTMLVideoElement;
const recTimer        = document.getElementById('rec-timer')!;
const vfSource        = document.getElementById('vf-source')!;
const sbSize          = document.getElementById('sb-size')!;

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let activeStream: MediaStream | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let seconds = 0;
let frameCount = 0;

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}<span>:</span>${sec}`;
}

function startTimer() {
  seconds = 0;
  recTimer.innerHTML = formatTime(0);
  timerInterval = setInterval(() => {
    seconds++;
    recTimer.innerHTML = formatTime(seconds);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function showRecording() {
  screenHome.style.display = 'none';
  screenRecording.style.display = 'flex';
}

function showHome() {
  screenHome.style.display = 'flex';
  screenRecording.style.display = 'none';
}

btnRecord.addEventListener('click', async () => {
  // Transicion inmediata — no esperamos a que capture
  showRecording();
  startTimer();
  vfSource.textContent = 'Iniciando...';

  try {
    const sources = await window.parrotAPI.getSources();
    const screen = sources[0];

    if (!screen) {
      vfSource.textContent = 'Sin fuente — verificá permisos';
      return;
    }

    vfSource.textContent = screen.name;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        // @ts-ignore — Electron-specific constraint
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: screen.id,
        },
      },
    });

    activeStream = stream;
    preview.srcObject = stream;
    preview.style.display = 'block';

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

  } catch (err) {
    console.error('Capture error:', err);
    vfSource.textContent = 'Error al capturar pantalla';
    sbSize.textContent = 'Verificá permisos de grabación';
  }
});

btnCancel.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (activeStream) {
    activeStream.getTracks().forEach((t) => t.stop());
    activeStream = null;
  }
  preview.srcObject = null;
  preview.style.display = 'none';
  recordedChunks = [];
  stopTimer();
  showHome();
});
