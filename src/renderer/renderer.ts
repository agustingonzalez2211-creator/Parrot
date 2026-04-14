declare const gsap: any;

// ── SCREEN REGISTRY ────────────────────────────────────────────────────────

const SCREEN_ORDER = ['library','source','recording','processing','validation','detail','share'] as const;
type ScreenId = typeof SCREEN_ORDER[number];

const SCREEN_TITLES: Record<ScreenId, string> = {
  library:    'YOUR SKILLS',
  source:     'NEW SKILL · CHOOSE SOURCE',
  recording:  'RECORDING',
  processing: 'ANALYZING',
  validation: 'VALIDATE SKILL',
  detail:     'SKILL DETAIL',
  share:      'SHARE SKILL',
};

let currentScreen: ScreenId = 'library';
let isAnimating = false;

// ── TOPBAR ─────────────────────────────────────────────────────────────────

const topbarTitle = document.getElementById('topbar-title')!;
const btnBack     = document.getElementById('btn-back') as HTMLButtonElement;

const BACK_MAP: Partial<Record<ScreenId, ScreenId>> = {
  source:     'library',
  processing: 'library',
  validation: 'processing',
  detail:     'library',
  share:      'detail',
};

function updateTopbar(screen: ScreenId) {
  topbarTitle.textContent = SCREEN_TITLES[screen];
  const backTarget = BACK_MAP[screen];
  btnBack.style.display = backTarget ? 'flex' : 'none';
}

btnBack.addEventListener('click', () => {
  const target = BACK_MAP[currentScreen];
  if (target) goTo(currentScreen, target, -1);
});

// ── NAVIGATION ─────────────────────────────────────────────────────────────

function goTo(from: string, to: ScreenId, dir: number = 1) {
  if (isAnimating || from === to) return;
  isAnimating = true;

  const fromEl = document.getElementById('screen-' + from)!;
  const toEl   = document.getElementById('screen-' + to)!;

  gsap.to(fromEl, {
    autoAlpha: 0,
    y: dir * -12,
    duration: 0.18,
    ease: 'power2.in',
    onComplete: () => {
      fromEl.classList.remove('active');
      gsap.set(fromEl, { y: 0 });

      toEl.classList.add('active');
      gsap.fromTo(toEl,
        { autoAlpha: 0, y: dir * 16 },
        { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out',
          onComplete: () => {
            isAnimating = false;
            currentScreen = to;
            updateTopbar(to);
            onScreenEnter(to);
          }
        }
      );
    }
  });
}

function onScreenEnter(screen: ScreenId) {
  if (screen === 'recording') startRecording();
  if (screen === 'processing') startProcessingMock();
  if (screen === 'validation') renderQuestion();
}

// ── SKILL DATA ─────────────────────────────────────────────────────────────

interface Step {
  num: string;
  label: string;
  sub: string;
  desc: string;
  code: string;
}

interface SkillData {
  name: string;
  steps: Step[];
}

const SKILLS: Record<string, SkillData> = {
  checkout: {
    name: 'Checkout Flow',
    steps: [
      { num:'01', label:'Open Tab',    sub:'OPEN TAB · BROWSER',
        desc:'Open a new browser tab and navigate to the target store URL to begin the checkout flow.',
        code:`action: navigate\ntarget: "https://store.example.com"\nwait_for: DOMContentLoaded\ntimeout: 5000` },
      { num:'02', label:'Navigate',    sub:'NAVIGATE · BROWSER',
        desc:'Wait for the homepage to fully render, then locate the primary product listing section.',
        code:`action: wait_for_selector\nselector: ".product-grid"\ntimeout: 8000` },
      { num:'03', label:'Add Item',    sub:'CLICK · BROWSER',
        desc:'Click the "Add to Cart" button on the first product in the listing.',
        code:`action: click\nselector: ".product-grid .btn-add-to-cart:first-child"\nwait_after: 500` },
      { num:'04', label:'Checkout',    sub:'NAVIGATE · BROWSER',
        desc:'Open the cart drawer and proceed to the checkout page.',
        code:`action: click\nselector: "#cart-proceed-btn"\nwait_for: navigation` },
      { num:'05', label:'Fill Email',  sub:'TYPE · BROWSER',
        desc:'Enter the customer email address in the contact field.',
        code:`action: type\nselector: "#email"\nvalue: "{{customer_email}}"\nclear_first: true` },
      { num:'06', label:'Fill Card',   sub:'TYPE · BROWSER',
        desc:'Enter payment card details in the Stripe iframe.',
        code:`action: type_in_frame\nframe_selector: "#stripe-frame"\nselector: "#cardNumber"\nvalue: "{{card_number}}"` },
      { num:'07', label:'Confirm',     sub:'CLICK · BROWSER',
        desc:'Submit the order and wait for the confirmation page to load.',
        code:`action: click\nselector: "#btn-place-order"\nwait_for: selector\nexpect_selector: ".order-confirmation"` },
    ]
  },
  deploy: {
    name: 'Deploy Script',
    steps: [
      { num:'01', label:'Git Pull',    sub:'TERMINAL · GIT',
        desc:'Pull the latest changes from the main branch before deploying.',
        code:`action: exec\ncmd: "git pull origin main"\nexpect_exit: 0` },
      { num:'02', label:'Run Tests',   sub:'TERMINAL · NPM',
        desc:'Execute the full test suite and abort on failure.',
        code:`action: exec\ncmd: "npm test"\nexpect_exit: 0\ntimeout: 120000` },
      { num:'03', label:'Build',       sub:'TERMINAL · NPM',
        desc:'Build the production bundle.',
        code:`action: exec\ncmd: "npm run build"\nexpect_exit: 0` },
      { num:'04', label:'Deploy',      sub:'TERMINAL · SSH',
        desc:'Deploy the build artifact to the production server.',
        code:`action: exec\ncmd: "rsync -az dist/ prod:/var/www/app/"\nexpect_exit: 0` },
      { num:'05', label:'Smoke Test',  sub:'HTTP · GET',
        desc:'Hit the health check endpoint and verify 200 OK.',
        code:`action: http\nmethod: GET\nurl: "https://app.example.com/health"\nexpect_status: 200` },
      { num:'06', label:'Notify',      sub:'SLACK · WEBHOOK',
        desc:'Post a deployment notification to the #deploys channel.',
        code:`action: webhook\nurl: "{{slack_webhook}}"\nbody: { "text": "Deployed to prod ✓" }` },
      { num:'07', label:'Tag Release', sub:'TERMINAL · GIT',
        desc:'Create a Git release tag for the deployed version.',
        code:`action: exec\ncmd: "git tag v{{version}} && git push origin v{{version}}"\nexpect_exit: 0` },
      { num:'08', label:'Done',        sub:'COMPLETE',
        desc:'Deployment complete. All steps passed successfully.',
        code:`status: success\nmessage: "Deployment pipeline completed"` },
    ]
  },
  triage: {
    name: 'Issue Triage',
    steps: [
      { num:'01', label:'Open Issues', sub:'BROWSER · GITHUB',
        desc:'Navigate to the repository\'s issue list filtered by label: "needs-triage".',
        code:`action: navigate\ntarget: "https://github.com/{{org}}/{{repo}}/issues?q=is:open+label:needs-triage"` },
      { num:'02', label:'Read Issue',  sub:'BROWSER · CLICK',
        desc:'Open the oldest unread triage issue.',
        code:`action: click\nselector: ".js-issue-row:last-child a.js-navigation-open"` },
      { num:'03', label:'Classify',    sub:'BROWSER · LABEL',
        desc:'Apply the appropriate severity and component labels.',
        code:`action: click\nselector: "#labels-select-menu-button"\nwait_for: ".labels-select-menu .js-label-list"` },
      { num:'04', label:'Assign',      sub:'BROWSER · ASSIGN',
        desc:'Assign the issue to the on-call engineer.',
        code:`action: click\nselector: "#assignees-select-menu-button"\ntype: "{{oncall_user}}"` },
      { num:'05', label:'Comment',     sub:'BROWSER · TYPE',
        desc:'Post the standard triage acknowledgement comment.',
        code:`action: type\nselector: "#new_comment_field"\nvalue: "Triaged. Assigned to {{oncall_user}}. Priority: {{priority}}."\nsubmit: true` },
      { num:'06', label:'Remove Tag',  sub:'BROWSER · LABEL',
        desc:'Remove the "needs-triage" label to mark as triaged.',
        code:`action: click\nselector: "[data-name='needs-triage'] .js-label-remove"` },
    ]
  },
};

let currentSkill = 'checkout';
let currentStepIdx = 0;

(window as any).goToDetail = function(skillId: string) {
  currentSkill = skillId;
  currentStepIdx = 0;
  loadDetailScreen(skillId);
  goTo(currentScreen, 'detail', 1);
};

function loadDetailScreen(skillId: string) {
  const skill = SKILLS[skillId] || SKILLS.checkout;
  const nameEl    = document.getElementById('detail-name')!;
  const stepNumEl = document.getElementById('step-num')!;
  const stepSubEl = document.getElementById('step-sub')!;
  const stepDescEl= document.getElementById('step-desc')!;
  const stepCodeEl= document.getElementById('step-code')!;

  nameEl.textContent = skill.name;
  topbarTitle.textContent = skill.name.toUpperCase();

  // Rebuild sidebar
  const sidebar = document.querySelector('.detail-sidebar')!;
  sidebar.innerHTML = skill.steps.map((s, i) =>
    `<div class="step-item${i===0?' active':''}" onclick="selectStep(${i},this)">
      <div>
        <div class="step-num">${s.num}</div>
        <div class="step-label">${s.label}</div>
      </div>
    </div>`
  ).join('');

  showStep(0);
}

function showStep(idx: number) {
  const skill = SKILLS[currentSkill] || SKILLS.checkout;
  const step  = skill.steps[idx];
  if (!step) return;

  document.getElementById('step-num')!.textContent  = step.num;
  document.getElementById('step-sub')!.textContent  = step.sub;
  document.getElementById('step-desc')!.textContent = step.desc;
  document.getElementById('step-code')!.textContent = step.code;
}

(window as any).selectStep = function(idx: number, el: HTMLElement) {
  currentStepIdx = idx;
  document.querySelectorAll('.step-item').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  const mainEl = document.querySelector('.detail-main');
  if (mainEl) {
    gsap.fromTo(mainEl, { autoAlpha: 0, x: 8 }, { autoAlpha: 1, x: 0, duration: 0.18, ease: 'power2.out' });
  }
  showStep(idx);
};

// ── SOURCE SELECTION ───────────────────────────────────────────────────────

let selectedSourceIdx = 0;

document.querySelectorAll('.source-card').forEach((card, idx) => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.source-card').forEach(c => c.classList.remove('sel'));
    card.classList.add('sel');
    selectedSourceIdx = idx;
  });
});

document.getElementById('btn-source-cancel')!.addEventListener('click', () => {
  goTo('source', 'library', -1);
});

document.getElementById('btn-source-start')!.addEventListener('click', () => {
  goTo('source', 'recording', 1);
});

document.getElementById('btn-new-skill')!.addEventListener('click', () => {
  goTo('library', 'source', 1);
});

// ── FILTER TABS ────────────────────────────────────────────────────────────

document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const filter = (tab as HTMLElement).dataset.filter || 'all';
    document.querySelectorAll<HTMLElement>('.skill-card').forEach(card => {
      card.style.display = (filter === 'all') ? '' : 'none';
    });
  });
});

// ── TIMER ──────────────────────────────────────────────────────────────────

let timerInterval: ReturnType<typeof setInterval> | null = null;
let seconds = 0;

function formatTime(s: number): string {
  const m   = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}<span style="opacity:0.5">:</span>${sec}`;
}

function startTimer() {
  seconds = 0;
  const el = document.getElementById('rec-timer')!;
  el.innerHTML = formatTime(0);
  timerInterval = setInterval(() => {
    seconds++;
    el.innerHTML = formatTime(seconds);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

// ── SIMULATION ─────────────────────────────────────────────────────────────

let simInterval: ReturnType<typeof setInterval> | null = null;

function startSimulation() {
  const canvas  = document.getElementById('sim-canvas') as HTMLCanvasElement;
  const preview = document.getElementById('preview')    as HTMLVideoElement;
  canvas.style.display  = 'block';
  preview.style.display = 'none';

  const ctx = canvas.getContext('2d')!;
  canvas.width  = canvas.offsetWidth  || 860;
  canvas.height = canvas.offsetHeight || 540;

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
  const canvas  = document.getElementById('sim-canvas') as HTMLCanvasElement;
  const preview = document.getElementById('preview')    as HTMLVideoElement;
  canvas.style.display  = 'none';
  preview.style.display = 'none';
}

// ── LIVE DETECTION FEED ────────────────────────────────────────────────────

const FEED_EVENTS = [
  'CLICK · div.btn-primary',
  'NAVIGATE · /checkout',
  'TYPE · input#email',
  'SCROLL · 340px',
  'CLICK · button[data-id="add-cart"]',
  'NAVIGATE · /cart',
  'TYPE · input#card-number',
  'CLICK · .payment-submit',
  'NAVIGATE · /confirmation',
  'CLICK · a.product-link',
  'HOVER · .nav-dropdown',
  'TYPE · input#search',
  'KEYDOWN · Enter',
  'CLICK · label[for="terms"]',
];

let feedInterval: ReturnType<typeof setInterval> | null = null;
let eventCount = 0;

function startFeed() {
  const feedBody  = document.getElementById('feed-body')!;
  const eventsEl  = document.getElementById('rec-events')!;
  feedBody.innerHTML = '';
  eventCount = 0;

  feedInterval = setInterval(() => {
    eventCount++;
    const ev   = FEED_EVENTS[Math.floor(Math.random() * FEED_EVENTS.length)];
    const ts   = new Date().toLocaleTimeString('en-US', { hour12: false });
    const line = document.createElement('div');
    line.className = 'feed-line';
    line.innerHTML = `<span class="ts">${ts}</span> <span class="ev">${ev}</span>`;
    feedBody.appendChild(line);
    feedBody.scrollTop = feedBody.scrollHeight;
    // Keep only last 20 lines
    while (feedBody.children.length > 20) feedBody.removeChild(feedBody.firstChild!);
    eventsEl.textContent = `${eventCount} EVENTS`;
  }, 1400 + Math.random() * 800);
}

function stopFeed() {
  if (feedInterval) { clearInterval(feedInterval); feedInterval = null; }
}

// ── RECORDING ─────────────────────────────────────────────────────────────

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[]              = [];
let activeStream: MediaStream | null    = null;

async function startRecording() {
  const recNameEl = document.getElementById('rec-skill-name')!;
  recNameEl.textContent = 'New Skill';
  startTimer();
  startFeed();

  try {
    const sources = await (window as any).parrotAPI.getSources();
    if (!sources.length) throw new Error('No sources available');

    const screen = sources[selectedSourceIdx] || sources[0];
    recNameEl.textContent = screen.name;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        // @ts-ignore
        mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: screen.id },
      },
    });

    activeStream = stream;
    const preview = document.getElementById('preview') as HTMLVideoElement;
    const canvas  = document.getElementById('sim-canvas') as HTMLCanvasElement;
    preview.srcObject  = stream;
    preview.style.display = 'block';
    canvas.style.display  = 'none';

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.start(1000);

  } catch (err) {
    console.warn('[ghost] using simulation:', err);
    startSimulation();
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (activeStream) {
    activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
  }
  const preview = document.getElementById('preview') as HTMLVideoElement;
  preview.srcObject = null;
  stopTimer();
  stopSimulation();
  stopFeed();
}

document.getElementById('btn-stop')!.addEventListener('click', () => {
  stopRecording();
  goTo('recording', 'processing', 1);
});

document.getElementById('btn-cancel-rec')!.addEventListener('click', () => {
  stopRecording();
  recordedChunks = [];
  goTo('recording', 'source', -1);
});

// ── PROCESSING MOCK ────────────────────────────────────────────────────────

const LOG_LINES = [
  '<span class="p">→</span> DETECTING INTERACTIONS...',
  '<span class="sub"><span class="arrow">  ↳</span> <span class="etype">CLICK</span> at (420,280) t=1.2s</span>',
  '<span class="sub"><span class="arrow">  ↳</span> <span class="etype">NAVIGATE</span> /checkout t=3.4s</span>',
  '<span class="sub"><span class="arrow">  ↳</span> <span class="etype">TYPE</span> input#email t=5.1s</span>',
  '<span class="sub"><span class="arrow">  ↳</span> <span class="etype">CLICK</span> .btn-place-order t=8.7s</span>',
  '<span class="p">→</span> CLUSTERING STEPS...',
  '<span class="p">→</span> EXTRACTING SELECTORS...',
  '<span class="p">→</span> INFERRING INTENT WITH AI...',
  '<span class="sub"><span class="arrow">  ↳</span> STEP 1: "Navigate to store"</span>',
  '<span class="sub"><span class="arrow">  ↳</span> STEP 2: "Add product to cart"</span>',
  '<span class="sub"><span class="arrow">  ↳</span> STEP 3: "Proceed to checkout"</span>',
  '<span class="sub"><span class="arrow">  ↳</span> STEP 4: "Fill shipping info"</span>',
  '<span class="p">→</span> GENERATING YAML SKILL...',
  '<span class="p">→</span> <span style="color:var(--success)">SKILL READY · 12 STEPS EXTRACTED</span>',
];

let procElapsed = 0;
let procElapsedTimer: ReturnType<typeof setInterval> | null = null;

function startProcessingMock() {
  const fillDetect = document.getElementById('fill-detect')!;
  const fillBuild  = document.getElementById('fill-build')!;
  const pctDetect  = document.getElementById('pct-detect')!;
  const pctBuild   = document.getElementById('pct-build')!;
  const pctLoad    = document.getElementById('pct-load')!;
  const logBody    = document.getElementById('proc-log-body')!;
  const stepsEl    = document.getElementById('proc-steps')!;
  const framesEl   = document.getElementById('proc-frames')!;
  const elapsedEl  = document.getElementById('proc-elapsed')!;

  // Reset state
  fillDetect.style.width = '0%';
  fillDetect.classList.remove('done');
  fillBuild.style.width  = '0%';
  fillBuild.classList.remove('done');
  pctDetect.textContent  = '0%';
  pctBuild.textContent   = '—';
  pctLoad.textContent    = '100%';
  stepsEl.textContent    = '0';
  framesEl.textContent   = '0%';
  logBody.innerHTML      = `
    <div class="proc-log-line"><span class="p">→</span> LOADING RECORDING <span style="color:var(--success);float:right">DONE</span></div>
    <div class="proc-log-line"><span class="p">→</span> SAMPLING FRAMES 2048/2048 <span style="color:var(--success);float:right">DONE</span></div>
  `;

  procElapsed = 0;
  elapsedEl.innerHTML = '00:00';
  if (procElapsedTimer) clearInterval(procElapsedTimer);
  procElapsedTimer = setInterval(() => {
    procElapsed++;
    const m = Math.floor(procElapsed / 60).toString().padStart(2,'0');
    const s = (procElapsed % 60).toString().padStart(2,'0');
    elapsedEl.textContent = `${m}:${s}`;
  }, 1000);

  // Phase 1: Detect (0→100% over ~4s)
  let detectPct = 0;
  let stepCount = 0;
  const detectInt = setInterval(() => {
    detectPct = Math.min(detectPct + 4, 100);
    fillDetect.style.width = detectPct + '%';
    pctDetect.textContent  = detectPct + '%';

    // Increment frame counter
    const fc = Math.round((detectPct / 100) * 2048);
    framesEl.textContent = Math.round((fc / 2048) * 100) + '%';

    // Log lines
    const logIdx = Math.floor((detectPct / 100) * 5);
    const current = logBody.querySelectorAll('.proc-log-line').length - 2;
    if (logIdx > current && logIdx < 5) {
      const line = document.createElement('div');
      line.className = 'proc-log-line';
      line.innerHTML = LOG_LINES[logIdx];
      logBody.appendChild(line);
      logBody.scrollTop = logBody.scrollHeight;
    }

    if (detectPct >= 100) {
      clearInterval(detectInt);
      fillDetect.classList.add('done');

      // Phase 2: Build (0→100% over ~3s)
      pctBuild.textContent = '0%';
      let buildPct = 0;
      const buildInt = setInterval(() => {
        buildPct = Math.min(buildPct + 5, 100);
        fillBuild.style.width = buildPct + '%';
        pctBuild.textContent  = buildPct + '%';

        const logIdx2 = 5 + Math.floor((buildPct / 100) * (LOG_LINES.length - 5));
        const currentLines = logBody.querySelectorAll('.proc-log-line').length - 2;
        if (logIdx2 > currentLines && logIdx2 < LOG_LINES.length) {
          const line = document.createElement('div');
          line.className = 'proc-log-line';
          line.innerHTML = LOG_LINES[logIdx2];
          logBody.appendChild(line);
          logBody.scrollTop = logBody.scrollHeight;
          stepCount++;
          stepsEl.textContent = String(Math.min(stepCount * 2, 12));
        }

        if (buildPct >= 100) {
          clearInterval(buildInt);
          fillBuild.classList.add('done');
          stepsEl.textContent = '12';
          if (procElapsedTimer) { clearInterval(procElapsedTimer); procElapsedTimer = null; }

          // Auto-advance to validation after 800ms
          setTimeout(() => goTo('processing', 'validation', 1), 800);
        }
      }, 150);
    }
  }, 100);
}

// ── VALIDATION ─────────────────────────────────────────────────────────────

interface Question {
  label: string;
  text: string;
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    label: 'QUESTION 1 · INTENT',
    text:  'What is the primary goal of this skill?',
    options: [
      'Automate a repetitive browser workflow',
      'Document a process for team reference',
      'Test application functionality end-to-end',
      'Learn from an expert\'s workflow',
    ]
  },
  {
    label: 'QUESTION 2 · FREQUENCY',
    text:  'How often will this skill typically run?',
    options: [
      'Multiple times per day (high volume)',
      'Once per session or work cycle',
      'Occasionally — triggered by events',
      'One-time setup or migration task',
    ]
  },
  {
    label: 'QUESTION 3 · AUDIENCE',
    text:  'Who is the primary audience for this skill?',
    options: [
      'Developers / engineers',
      'QA / testing team',
      'Product managers / stakeholders',
      'Any team member',
    ]
  },
];

let currentQ = 0;
const selectedOpts: number[] = [-1, -1, -1];

function renderQuestion() {
  const q = QUESTIONS[currentQ];
  document.getElementById('val-q-counter')!.textContent = `Q ${currentQ + 1} / ${QUESTIONS.length}`;
  document.getElementById('val-q-label')!.textContent   = q.label;
  document.getElementById('val-question')!.textContent  = q.text;

  const optContainer = document.getElementById('val-options')!;
  gsap.to(optContainer, { autoAlpha: 0, y: -6, duration: 0.12, ease: 'power2.in', onComplete: () => {
    optContainer.innerHTML = q.options.map((opt, i) =>
      `<div class="val-opt${selectedOpts[currentQ] === i ? ' sel' : ''}"
            onclick="selectOpt(this,${i})">${opt}</div>`
    ).join('');
    gsap.fromTo(optContainer, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.18, ease: 'power2.out' });
  }});

  // Segments
  for (let i = 0; i < 3; i++) {
    const seg = document.getElementById(`val-seg-${i}`)!;
    seg.className = 'val-seg' + (i < currentQ ? ' done' : i === currentQ ? ' on' : '');
  }

  // Dots
  for (let i = 0; i < 3; i++) {
    const dot = document.getElementById(`vd-${i}`)!;
    dot.className = 'val-dot' + (i === currentQ ? ' on' : '');
  }

  // Back button visibility
  const btnValBack = document.getElementById('btn-val-back') as HTMLButtonElement;
  btnValBack.style.visibility = currentQ === 0 ? 'hidden' : 'visible';

  // Next button label
  const btnValNext = document.getElementById('btn-val-next')!;
  btnValNext.textContent = currentQ === QUESTIONS.length - 1 ? 'FINISH →' : 'NEXT →';
}

(window as any).selectOpt = function(el: HTMLElement, idx: number) {
  selectedOpts[currentQ] = idx;
  document.querySelectorAll('.val-opt').forEach(o => o.classList.remove('sel'));
  el.classList.add('sel');
};

document.getElementById('btn-val-back')!.addEventListener('click', () => {
  if (currentQ > 0) {
    currentQ--;
    renderQuestion();
  } else {
    goTo('validation', 'processing', -1);
  }
});

document.getElementById('btn-val-next')!.addEventListener('click', () => {
  if (currentQ < QUESTIONS.length - 1) {
    currentQ++;
    renderQuestion();
  } else {
    currentQ = 0; // reset for next time
    currentSkill = 'checkout';
    loadDetailScreen('checkout');
    goTo('validation', 'detail', 1);
  }
});

// ── SHARE ──────────────────────────────────────────────────────────────────

(window as any).copyLink = function() {
  const btn = document.getElementById('btn-copy')!;
  btn.textContent = 'COPIED!';
  setTimeout(() => { btn.textContent = 'COPY'; }, 2000);
};

(window as any).exportSkill = function(type: string) {
  const successEl = document.getElementById('share-success')!;
  successEl.style.display = 'flex';
  gsap.fromTo(successEl, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out' });
  console.log('[ghost] export:', type);
};

// ── goTo GLOBAL EXPORT ─────────────────────────────────────────────────────
// HTML onclick attributes call goTo(from, to, dir) directly
(window as any).goTo = goTo;

// ── INIT ───────────────────────────────────────────────────────────────────

(function init() {
  // Ensure library screen is visible
  const libScreen = document.getElementById('screen-library')!;
  gsap.set(libScreen, { autoAlpha: 1 });
  updateTopbar('library');

  // Animate library cards on load
  gsap.fromTo('.skill-card',
    { autoAlpha: 0, y: 12 },
    { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.07, ease: 'power2.out', delay: 0.1 }
  );
})();
