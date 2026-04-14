// ─────────────────────────────────────────────────────────────────────────────
// Parrot — AI Types
// Single source of truth for all data contracts between renderer, main and AI.
// ─────────────────────────────────────────────────────────────────────────────

/** One screenshot captured at the moment of a click during recording */
export interface CapturedFrame {
  seq: number; // sequence number (1, 2, 3…)
  timestamp_ms: number; // ms since recording started
  image_base64: string; // JPEG base64, max 1280×720, quality 0.7
  click_x: number; // click X in pixels on the video/canvas element
  click_y: number; // click Y in pixels
  click_x_pct: number; // X as fraction of viewport width (0–1)
  click_y_pct: number; // Y as fraction of viewport height (0–1)
}

/** A single semantic step detected in the workflow */
export interface DetectedStep {
  id: number;
  action: string; // semantic verb: navigate, click, type, select, open, export…
  description: string; // human-readable explanation
}

/** A variable input detected in the workflow */
export interface DetectedInput {
  name: string;
  description: string;
}

/** One of the 3 clarifying questions from Agent 1 */
export interface ClarifyingQuestion {
  id: number; // always 1, 2 or 3
  question: string;
  context: string; // why this question is being asked
}

/** Structured output from Agent 1 (workflow analyzer) */
export interface WorkflowAnalysis {
  workflow_name: string; // max 60 chars
  workflow_description: string;
  detected_apps: string[];
  steps: DetectedStep[]; // 2–20 items
  detected_inputs: DetectedInput[];
  clarifying_questions: ClarifyingQuestion[]; // always exactly 3
}

/** User's answer to one clarifying question */
export interface UserAnswer {
  question_id: number; // 1, 2 or 3
  answer: string; // 'yes' | 'no' | free text (max 500 chars)
}

/** Final output from Agent 2 (skill generator) */
export interface SkillOutput {
  skill_name: string; // kebab-case, no extension — becomes /slash-command
  skill_filename: string; // always "SKILL.md" (Claude Code standard)
  skill_content: string; // full SKILL.md: YAML frontmatter + markdown content
  claude_code_instructions: string[]; // installation steps for Claude Code
}

// ─── IPC Payloads ─────────────────────────────────────────────────────────────

export interface AnalyzeWorkflowPayload {
  frames: CapturedFrame[]; // already sampled to max 15
  recording_duration_ms: number;
  total_clicks: number;
}

export interface GenerateSkillPayload {
  analysis: WorkflowAnalysis;
  answers: UserAnswer[];
}
