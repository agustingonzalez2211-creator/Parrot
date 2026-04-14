# PARROT — Hackathon Pitch
### Audience: CEOs / executives — MercadoLibre, Pomelo, Anthropic, etc.

---

## OPENING LINE

> *"Every company has hundreds of people doing the same thing, the same way, every single day. We built the tool that ends that."*

---

## THE PITCH (3 minutes, tight)

---

### THE PROBLEM

Right now, there's a $100B gap between AI's potential and its actual deployment inside organizations.

Not because the models aren't good enough.
Not because companies don't want to adopt AI.

But because **AI agents can't learn from humans the way humans actually work.**

You can't point an AI agent at your screen and say "do what I just did."
Someone has to sit down, write the code, document the process, map every edge case.
That takes months. It requires engineering resources. And the moment the process changes, you do it all over again.

The result: the people closest to the problem — the analysts, the ops teams, the domain experts — can't transfer what they know to AI. Their knowledge stays locked in their heads, in spreadsheets, in Slack messages.

**That's the problem Parrot solves.**

---

### THE SOLUTION

Parrot is a desktop application with a single promise:

**If you can do it, Parrot can learn it.**

Here's how it works in three steps:

**1. Record** — You open Parrot and press record. Then you just work. In any app. Chrome, Excel, your internal tools, anything. Parrot watches your screen in the background. No code. No setup. No interruptions. You work exactly as you always do.

**2. Understand** — When you stop, Parrot sends what it saw to Claude. The AI doesn't see pixels — it understands context. It identifies what you were doing at a semantic level: *navigating to the reports section, applying the monthly filter, exporting the data, importing it into the template.* It extracts the steps, the decisions, the variables. Then it asks you 3 targeted questions to resolve ambiguity. Thirty seconds of your time.

**3. Deploy** — Parrot packages your workflow into a skill file. One click. Installed. From that moment forward, any Claude session can execute that workflow on command — with the full context of how *you specifically* do it, with all the edge cases you handle without thinking.

This is the bridge between human expertise and AI execution.

---

### WHY NOW

We are at an inflection point.

Models like Claude can now understand screen context at a semantic level. They can reason about *what* someone is doing, not just *where* they clicked. That capability didn't exist 18 months ago.

At the same time, the AI agent ecosystem is exploding — Claude Code, Claude Desktop, agentic frameworks — and all of them share the same constraint: they need skills, instructions, structured knowledge to act on.

Parrot is the **supply side** of that equation. It's how skills get created at scale, without an engineering team.

---

### THE USER

Think about the people inside your organization who do the same thing every day:

- The analyst who builds the Friday report from three different systems
- The operations team member who processes 50 similar requests a day
- The account manager who follows the same onboarding flow for every new client
- The finance team running the same reconciliation every month-end

These people are experts at what they do. They have years of accumulated knowledge about edge cases, exceptions, the right way to handle ambiguous situations.

Today, none of that knowledge is accessible to AI.

With Parrot, every one of those people can become a skill author — without writing a single line of code.

---

### CURRENT STATE & ROADMAP

**Today:** Parrot generates skills that run inside Claude Code. You record a workflow, Claude analyzes it, a skill file is generated, installed with one click, and executed via slash commands. End to end, in under 5 minutes from recording to automated execution.

**Next 90 days:** Claude Desktop integration. Same workflow, no CLI required. This brings Parrot to every non-technical user in an organization — not just developers.

**12-month vision:**
- A skill marketplace where organizations can share, audit, and version-control their institutional knowledge
- Enterprise workflows that chain multiple skills together into complex automations
- Every repetitive task in a company, encoded, auditable, and improvable over time

---

### THE BIG PICTURE

This isn't just about saving time on repetitive tasks.

It's about something bigger: **making institutional knowledge executable.**

Every company has enormous operational intelligence — in the heads of their best people, in undocumented processes, in tribal knowledge that disappears when someone leaves.

Parrot is the infrastructure that captures that knowledge and makes it available to AI at scale.

---

### CLOSING

We're building the layer between what humans know and what AI can do.

One recording at a time, we're closing the gap between human expertise and AI execution — without requiring a single engineer in the middle.

**Parrot. Record once. Automate forever.**

---

## SLIDE DECK STRUCTURE (if needed)

| Slide | Content |
|---|---|
| 1 | **Title** — PARROT + tagline: *"Record once. Automate forever."* |
| 2 | **The gap** — AI potential vs. actual deployment. The $100B problem. |
| 3 | **The insight** — Knowledge is locked in humans. AI can't learn by watching. Until now. |
| 4 | **How it works** — Record → Understand → Deploy. Three steps, visual flow. |
| 5 | **Demo** — Live or video of the full flow |
| 6 | **Why now** — Claude's vision capabilities + agent ecosystem explosion |
| 7 | **The user** — Personas. Repetitive workflows. No code required. |
| 8 | **Roadmap** — Claude Code today → Claude Desktop → Marketplace |
| 9 | **The big picture** — Institutional knowledge, made executable |
| 10 | **CTA** — What you're asking for / the ask |

---

## KEY LINES (pick one for the opener)

> *"Every company has hundreds of people doing the same thing, the same way, every day. We built the tool that ends that."*

> *"AI can reason. AI can write. AI can analyze. But AI still can't learn from watching you work. Parrot changes that."*

> *"The gap isn't in the models. The gap is in the interface between human knowledge and AI execution. That's what we're closing."*

> *"Show it once. Teach it forever. That's Parrot."*

---

## TECHNICAL CREDIBILITY (for the Anthropic exec)

- Built on **claude-opus-4-6** with multimodal vision — frame-by-frame semantic analysis of screen recordings
- Two-agent pipeline: Agent 1 analyzes the workflow and generates structured understanding + clarifying questions. Agent 2 takes that understanding plus user answers and generates the executable skill.
- Skill format is native to **Claude Code** — `.md` files in `~/.claude/skills/`, invokable as slash commands
- Next step: same format will integrate directly with **Claude Desktop**
- Architecture is designed to scale: the skill generation pipeline is model-agnostic and the output format can target any AI runtime
