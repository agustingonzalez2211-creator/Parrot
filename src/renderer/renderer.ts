export {};

declare global {
  interface Window {
    parrotAPI: {
      getSources: () => Promise<{ id: string; name: string; thumbnail: string }[]>;
    };
  }
}

const btnRecord = document.getElementById('btn-record') as HTMLButtonElement;
const btnStop = document.getElementById('btn-stop') as HTMLButtonElement;
const btnAnalyze = document.getElementById('btn-analyze') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLParagraphElement;

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

btnRecord.addEventListener('click', async () => {
  statusEl.textContent = 'Seleccionando pantalla...';

  const sources = await window.parrotAPI.getSources();
  const screen = sources.find((s) => s.name === 'Entire Screen') || sources[0];

  if (!screen) {
    statusEl.textContent = 'No se encontro fuente de pantalla';
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      // @ts-ignore - electron specific constraint
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: screen.id,
      },
    },
  });

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.start();
  statusEl.textContent = 'Grabando... realizá tu flujo de trabajo';
  btnRecord.disabled = true;
  btnStop.disabled = false;
  btnAnalyze.disabled = true;
});

btnStop.addEventListener('click', () => {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  statusEl.textContent = 'Grabacion detenida. Listo para analizar.';
  btnRecord.disabled = false;
  btnStop.disabled = true;
  btnAnalyze.disabled = false;
});

btnAnalyze.addEventListener('click', () => {
  statusEl.textContent = 'Analizando con IA... (proximamente)';
});
