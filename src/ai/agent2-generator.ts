import Anthropic from "@anthropic-ai/sdk";
import { WorkflowAnalysis, UserAnswer, SkillOutput } from "./types";

const client = new Anthropic();

// Two-part response format: JSON metadata THEN raw .md content separated by ---SKILL_CONTENT---
// This avoids embedding multi-line markdown (with backtick blocks) inside a JSON string,
// which reliably causes JSON parse failures.
const SYSTEM_PROMPT = `You are an AI Skill generator for Claude Code. You receive a workflow analysis and the user's answers to clarifying questions. Your job is to produce an executable SKILL.md file that Claude Code can load and replay using computer-use MCP tools.

Respond in EXACTLY this two-part format, with no extra text before or after:

PART 1 — one line of JSON metadata (no newlines inside the JSON):
{"skill_name":"kebab-case-name","skill_filename":"SKILL.md","claude_code_instructions":["Create directory: mkdir -p ~/.claude/skills/<skill-name>","Save to: ~/.claude/skills/<skill-name>/SKILL.md","Run with: /<skill-name>","Claude Code will execute the skill step by step using available MCP tools"]}

PART 2 — the raw SKILL.md content after the delimiter:
---SKILL_CONTENT---
(full SKILL.md content here)

## Critical: The skill must be EXECUTABLE, not just descriptive

The skill will be loaded by Claude Code and executed using one of these MCP servers:
- **Windows-MCP** (on Windows): tools like click, type, scroll, screenshot, open app, powershell
- **desktop-pilot-mcp** (on macOS): tools like pilot_click, pilot_type, pilot_screenshot, pilot_find, pilot_script
- **computer-use-mcp** (cross-platform fallback): screenshot-based click/type

The skill format is IDENTICAL for all platforms. Claude adapts to whichever MCP tools are available at runtime. Do NOT generate platform-specific skills.

Claude will read the skill and translate each step into MCP tool calls. The skill must give Claude enough context to:
1. FIND the right element (visual description, not coordinates)
2. EXECUTE the action
3. VERIFY it worked (what should the screen look like after)
4. RECOVER if something goes wrong (fallback strategy)

## SKILL.md format (Claude Code standard)

The SKILL.md in PART 2 MUST start with YAML frontmatter between --- markers, followed by markdown content:

---
name: kebab-case-skill-name
description: "One-line description. Use when [trigger condition]."
disable-model-invocation: true
allowed-tools: Bash(start *) Bash(open *) Bash(xdg-open *) mcp__windows-mcp__screenshot mcp__windows-mcp__snapshot mcp__windows-mcp__scrape mcp__windows-mcp__app mcp__windows-mcp__type mcp__windows-mcp__click mcp__windows-mcp__scroll
---

## Setup automatico

Sistema operativo: !\`uname -s\`
uv disponible: !\`uv --version 2>/dev/null || echo "no instalado"\`
Windows-MCP disponible: !\`uvx windows-mcp --version 2>/dev/null || echo "no instalado"\`

Si Windows-MCP no esta instalado, seguir estos pasos antes de continuar:
1. Instalar uv: pip install uv
2. Agregar Windows-MCP: claude mcp add --transport stdio windows-mcp -- uvx windows-mcp
3. Reiniciar Claude Code para que cargue el MCP.
4. Verificar con /mcp que windows-mcp aparece como conectado.

## Objetivo

(Clear description of what the workflow does end-to-end)

## Pasos

### 1. Step title
Description of what to do.
Use specific MCP tool references: mcp__windows-mcp__snapshot, mcp__windows-mcp__click, mcp__windows-mcp__type, etc.
Include verification after each action.

### 2. Next step
...

## Parametros
List any inputs or say "Ninguno" for fixed skills.

## Resultado esperado
What the user gets when the skill completes successfully.

## Notas
Extra context, MCP tool reference, links.

## Rules for generating skills

1. **YAML frontmatter is MANDATORY** — Must start with --- markers containing name, description, disable-model-invocation: true, and allowed-tools with MCP tool names.
2. **Setup automatico section** — Always include the dynamic context injection block with uname, uv, and Windows-MCP version checks.
3. **name in frontmatter** must be kebab-case, max 40 characters, descriptive. This becomes the /slash-command.
4. **description in frontmatter** must say what the skill does AND when to use it.
5. **disable-model-invocation: true** is always set — these are user-triggered replay skills, not auto-triggered.
6. **Use specific MCP tool names** in steps — mcp__windows-mcp__snapshot, mcp__windows-mcp__click, mcp__windows-mcp__type, mcp__windows-mcp__scroll, mcp__windows-mcp__screenshot, mcp__windows-mcp__app.
7. **Verify after each action** — Take a snapshot and verify the expected state before proceeding.
8. **Steps must be atomic** — One action per step. "Open Chrome and navigate to URL" = two steps.
9. **action verbs must be from this list:** open_app, click, double_click, right_click, type, key, select, navigate, scroll, wait, verify, drag
10. **Include a verify step at the end** — Final screenshot + confirmation that the workflow completed.
11. **Platform-agnostic where possible** — Use start || open || xdg-open pattern for opening URLs/apps.
12. **Troubleshooting at end** — How to handle common failures.

CRITICAL FORMAT RULES:
- The JSON in PART 1 must be a single line with no newlines
- The delimiter ---SKILL_CONTENT--- must be on its own line
- Do NOT wrap the JSON in markdown code fences
- Do NOT add any text outside the two parts`;

const DELIMITER = "---SKILL_CONTENT---";

function buildUserMessage(
  analysis: WorkflowAnalysis,
  answers: UserAnswer[],
): string {
  const regularAnswers = answers.filter((a) => a.question_id !== 0);
  const additionalContext = answers.find((a) => a.question_id === 0);

  const answersText = regularAnswers
    .map((a) => {
      const answer = a.answer.trim() ? a.answer : "(no answer provided)";
      return `Q${a.question_id}: ${answer}`;
    })
    .join("\n");

  const additionalText = additionalContext?.answer
    ? `\n\nAdditional context from user:\n${additionalContext.answer}`
    : "";

  return `Workflow Analysis:
${JSON.stringify(analysis, null, 2)}

User's answers to clarifying questions (unanswered = no answer provided):
${answersText || "(all questions left unanswered)"}${additionalText}

Generate the executable skill following the two-part format described in your instructions.
Remember: YAML frontmatter is mandatory, include Setup automatico section, use specific MCP tool names in steps, verify after each action.`;
}

function parseResponse(text: string): SkillOutput | null {
  const delimIdx = text.indexOf(DELIMITER);
  if (delimIdx === -1) {
    console.warn("[parrot:agent2] delimiter not found in response");
    console.warn(
      "[parrot:agent2] raw response (first 600 chars):",
      text.slice(0, 600),
    );
    return null;
  }

  const metaPart = text.slice(0, delimIdx).trim();
  const contentPart = text.slice(delimIdx + DELIMITER.length).trim();

  // metaPart may be wrapped in a code fence — strip it
  const jsonLine = metaPart
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let meta: {
    skill_name: string;
    skill_filename: string;
    claude_code_instructions: string[];
  };
  try {
    meta = JSON.parse(jsonLine);
  } catch (e) {
    console.warn(
      "[parrot:agent2] metadata JSON parse failed:",
      (e as Error).message,
    );
    console.warn("[parrot:agent2] meta part:", metaPart.slice(0, 300));
    return null;
  }

  if (!meta.skill_name || !contentPart) {
    console.warn("[parrot:agent2] missing skill_name or content");
    return null;
  }

  return {
    skill_name: meta.skill_name,
    skill_filename: "SKILL.md",
    skill_content: contentPart,
    claude_code_instructions: meta.claude_code_instructions ?? [
      `Create directory: mkdir -p ~/.claude/skills/${meta.skill_name}`,
      `Save to: ~/.claude/skills/${meta.skill_name}/SKILL.md`,
      `Run with: /${meta.skill_name}`,
      "Claude Code will execute the skill step by step using available MCP tools",
    ],
  };
}

export async function generateSkill(
  analysis: WorkflowAnalysis,
  answers: UserAnswer[],
): Promise<SkillOutput> {
  console.log("[parrot:agent2] sending analysis + answers");

  const userMessage = buildUserMessage(analysis, answers);

  const firstResponse = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const firstText = firstResponse.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const firstResult = parseResponse(firstText);
  if (firstResult) {
    console.log(`[parrot:agent2] received skill: ${firstResult.skill_name}`);
    return firstResult;
  }

  // Retry with explicit reminder
  const retryResponse = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: userMessage },
      { role: "assistant", content: firstText },
      {
        role: "user",
        content:
          `Your response was not in the correct format. Remember:\n` +
          `1. First line: single-line JSON with skill_name, skill_filename, claude_code_instructions\n` +
          `2. Then the exact delimiter on its own line: ${DELIMITER}\n` +
          `3. Then the raw SKILL.md content (starting with --- YAML frontmatter ---)\n` +
          `No extra text. Try again.`,
      },
    ],
  });

  const retryText = retryResponse.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const retryResult = parseResponse(retryText);
  if (retryResult) {
    console.log(
      `[parrot:agent2] received skill (retry): ${retryResult.skill_name}`,
    );
    return retryResult;
  }

  throw new Error(
    "[parrot:agent2] Failed to generate valid skill output after retry",
  );
}
