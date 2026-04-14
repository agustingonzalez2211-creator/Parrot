<![CDATA[<div align="center">

<!-- Logo placeholder — replace with actual logo -->
<img src="assets/logo.png" alt="Parrot Logo" width="120" height="120" />

# PARROT

### *Record once. Automate forever.*

**Turn screen recordings into AI-executable skills — no code required.**

[![Electron](https://img.shields.io/badge/Electron-36.0-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Claude](https://img.shields.io/badge/Claude-Opus_4.6-D97757?style=flat-square)](https://anthropic.com)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

</div>

---

## What is Parrot?

Parrot bridges the gap between **human expertise** and **AI execution**.

You record your screen while doing any repetitive workflow. Parrot's AI pipeline — powered by Claude — watches what you did, understands it semantically, and packages it into a `.md` skill file that Claude Code (and soon Claude Desktop) can execute on demand.

No code. No documentation. No engineering team in the middle.

---

## How it works

```mermaid
flowchart LR
    A([🎬 Record]) --> B([🧠 AI Analyzes])
    B --> C([📦 Skill Generated])
    C --> D([⚡ Claude Executes])

    style A fill:#1f2335,stroke:#8b5cf6,color:#f1f5f9
    style B fill:#1f2335,stroke:#8b5cf6,color:#f1f5f9
    style C fill:#1f2335,stroke:#8b5cf6,color:#f1f5f9
    style D fill:#1f2335,stroke:#22c55e,color:#f1f5f9
```

### Step 1 — Record
Open Parrot, press record, and just work. In any app — Chrome, Excel, your internal tools. Parrot captures your screen at 2-second intervals in the background. A floating overlay keeps you in control without interrupting your flow.

### Step 2 — AI Analyzes (Agent 1)
When you stop, Parrot sends the captured frames to Claude's vision model. Claude identifies the semantic meaning of each action — not "clicked at x,y" but "opened the export menu" — and extracts the workflow steps, variable inputs, and decision points. Then it asks you up to 3 clarifying questions to resolve ambiguity.

### Step 3 — Skill Generated (Agent 2)
A second Claude agent takes the analysis + your answers and generates a structured `.md` skill file: a portable, readable document describing exactly how to execute the workflow. One click installs it directly to `~/.claude/skills/`.

### Step 4 — Claude Executes
From any Claude Code session, type `/<skill-name>` and Claude runs the workflow — with full context of your steps, your variables, and your edge cases.

---

## AI Pipeline

```mermaid
sequenceDiagram
    participant U as User
    participant P as Parrot App
    participant A1 as Agent 1<br/>Workflow Analyzer
    participant A2 as Agent 2<br/>Skill Generator
    participant CC as Claude Code

    U->>P: Press Record
    P-->>U: Overlay appears (always-on-top)
    U->>U: Works in any app
    P->>P: Captures frame every 2s

    U->>P: Press Stop & Analyze
    P->>A1: Send frames (max 15, sampled)<br/>+ recording duration
    A1-->>P: WorkflowAnalysis JSON<br/>(steps, inputs, 3 questions)
    P-->>U: Show analysis + questions

    U->>P: Answer questions (optional)<br/>+ additional context
    P->>A2: WorkflowAnalysis + answers
    A2-->>P: skill_name + .md content
    P-->>U: Show skill + install button

    U->>P: Click "Install Automatically"
    P->>CC: Write to ~/.claude/skills/<skill>.md
    CC-->>U: /skill-name ready to use
```

---

## Architecture

```mermaid
graph TB
    subgraph Renderer["🖥️ Renderer Process (Browser)"]
        UI[index.html]
        R[renderer.ts]
        OVL[overlay.html]
    end

    subgraph Main["⚙️ Main Process (Node.js)"]
        M[main.ts]
        A1[agent1-analyzer.ts]
        A2[agent2-generator.ts]
        T[types.ts]
    end

    subgraph IPC["🔌 IPC Bridge (preload.ts)"]
        PRE[parrotAPI]
        OPRE[overlayAPI]
    end

    subgraph External["☁️ External"]
        CLAUDE[Claude API<br/>claude-opus-4-6]
        FS[~/.claude/skills/]
    end

    UI --> R
    R <-->|contextBridge| PRE
    OVL <-->|contextBridge| OPRE
    PRE <-->|ipcRenderer| M
    OPRE <-->|ipcRenderer| M
    M --> A1
    M --> A2
    A1 & A2 --> T
    A1 & A2 <--> CLAUDE
    M --> FS

    style Renderer fill:#111318,stroke:#8b5cf6,color:#f1f5f9
    style Main fill:#111318,stroke:#7aa2f7,color:#f1f5f9
    style IPC fill:#111318,stroke:#e0af68,color:#f1f5f9
    style External fill:#111318,stroke:#22c55e,color:#f1f5f9
```

---

## Skill File Format

The output is a `.md` file native to Claude Code's skill system:

```markdown
# export-monthly-report

Exports the monthly sales report from the dashboard and imports it into the template spreadsheet.

```yaml
name: export-monthly-report
version: '1.0'
description: |
  Navigates to the reports section, applies the current month filter,
  exports to CSV, and imports the data into the Google Sheets template.
context:
  apps:
    - Chrome
    - Google Sheets
  preconditions:
    - Logged into the sales dashboard
steps:
  - id: 1
    action: navigate
    target: dashboard > reports > monthly
    description: Go to the monthly reports section
  - id: 2
    action: select
    target: period filter
    value: "{{current_month}}"
  - id: 3
    action: click
    target: Export CSV button
    wait_for: download complete
inputs:
  - name: current_month
    type: date_month
    required: true
outputs:
  - name: report_file
    type: spreadsheet
```
```

---

## Project Structure

```
parrot/
├── src/
│   ├── main.ts                    # Electron main process + IPC handlers
│   ├── preload.ts                 # Main window context bridge
│   ├── overlay-preload.ts         # Overlay window context bridge
│   ├── ai/
│   │   ├── types.ts               # Shared TypeScript interfaces
│   │   ├── agent1-analyzer.ts     # Workflow analysis agent (vision)
│   │   └── agent2-generator.ts    # Skill generation agent (text)
│   └── renderer/
│       ├── index.html             # Main app UI (6 screens)
│       ├── overlay.html           # Floating recording indicator
│       └── renderer.ts            # UI logic + state management
├── specs/
│   └── features/                  # Spec-driven feature docs
├── parrot_vault/
│   └── ideas/                     # Vision & decision docs
├── .env.example                   # Environment variable template
└── package.json
```

---

## Screens

```mermaid
stateDiagram-v2
    [*] --> Home
    Home --> Recording : Press "Start Recording"
    Recording --> Analyzing : Press "Stop & Analyze"\n(main window or overlay)
    Recording --> Home : Cancel
    Analyzing --> AnalysisResult : Agent 1 returns analysis
    Analyzing --> Error : API failure
    AnalysisResult --> Generating : Press "Generate Skill"
    Generating --> SkillResult : Agent 2 returns skill
    Generating --> Error : API failure
    SkillResult --> Home : "New Recording"
    Error --> Analyzing : Retry (Agent 1)
    Error --> Generating : Retry (Agent 2)
    Error --> Home : Back to Home
```

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)
- An [Anthropic API key](https://console.anthropic.com/settings/keys)

### Install

```bash
git clone https://github.com/your-org/parrot.git
cd parrot
pnpm install
```

### Configure

```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### Run

```bash
pnpm start
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic API key — get it at [console.anthropic.com](https://console.anthropic.com) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop runtime | Electron 36 |
| Language | TypeScript 5 |
| AI models | claude-opus-4-6 (vision + text) |
| AI SDK | @anthropic-ai/sdk |
| Renderer bundler | esbuild |
| Package manager | pnpm |
| Fonts | JetBrains Mono, Rajdhani |

---

## Roadmap

```mermaid
timeline
    title Parrot Roadmap
    Today : Claude Code integration
          : Slash command execution
          : Auto-install to ~/.claude/skills/
    Next 90 days : Claude Desktop integration
                 : No CLI required
                 : Non-technical user ready
    6 months : Skill marketplace
             : Share & discover skills
             : Version control for workflows
    12 months : Skill chaining
              : Enterprise audit trail
              : Multi-modal capture (screen + voice)
```

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Follow the spec-first workflow in `specs/features/`
4. Submit a PR

---

## License

MIT © 2026 Parrot

---

<div align="center">

**Built at Hackathon 2026**

*The missing link between human workflows and AI agents.*

</div>
]]>
