import Anthropic from '@anthropic-ai/sdk';
import { WorkflowAnalysis, UserAnswer, SkillOutput } from './types';

const client = new Anthropic();

// Two-part response format: JSON metadata THEN raw .md content separated by ---SKILL_CONTENT---
// This avoids embedding multi-line markdown (with backtick blocks) inside a JSON string,
// which reliably causes JSON parse failures.
const SYSTEM_PROMPT = `You are an AI Skill generator for Claude Code. You receive a workflow analysis and the user's answers to clarifying questions. Your job is to produce a .md skill file that Claude Code can load and execute.

Respond in EXACTLY this two-part format, with no extra text before or after:

PART 1 — one line of JSON metadata (no newlines inside the JSON):
{"skill_name":"kebab-case-name","skill_filename":"kebab-case-name.md","claude_code_instructions":["Save the .md file to ~/.claude/skills/<skill-name>.md","Invoke the skill in any Claude Code session with: /<skill-name>","Claude Code will load and execute the skill step by step"]}

PART 2 — the raw .md content after the delimiter:
---SKILL_CONTENT---
# skill-name

Brief description of what this skill does.

\`\`\`yaml
name: kebab-case-skill-name
version: '1.0'
description: |
  Clear description of what this skill does.
context:
  apps:
    - App Name
  preconditions:
    - Condition that must be true before starting
steps:
  - id: 1
    action: verb
    target: what to act on
    description: human-readable explanation
inputs:
  - name: input_name
    type: string|date|number|file
    required: true
    description: what this input is
outputs:
  - name: output_name
    type: string|file|spreadsheet
    description: what this output is
\`\`\`

Rules for the skill content:
- Use semantic action verbs: navigate, click, select, type, open, export, import, wait_for
- Extract variable data into inputs (dates, names, IDs that change each run)
- Keep steps atomic and executable
- skill_name must be kebab-case

CRITICAL FORMAT RULES:
- The JSON in PART 1 must be a single line with no newlines
- The delimiter ---SKILL_CONTENT--- must be on its own line
- Do NOT wrap the JSON in markdown code fences
- Do NOT add any text outside the two parts`;

const DELIMITER = '---SKILL_CONTENT---';

function buildUserMessage(analysis: WorkflowAnalysis, answers: UserAnswer[]): string {
  const regularAnswers    = answers.filter(a => a.question_id !== 0);
  const additionalContext = answers.find(a => a.question_id === 0);

  const answersText = regularAnswers.map(a => {
    const answer = a.answer.trim() ? a.answer : '(no answer provided)';
    return `Q${a.question_id}: ${answer}`;
  }).join('\n');

  const additionalText = additionalContext?.answer
    ? `\n\nAdditional context from user:\n${additionalContext.answer}`
    : '';

  return `Workflow Analysis:
${JSON.stringify(analysis, null, 2)}

User's answers to clarifying questions (unanswered = no answer provided):
${answersText || '(all questions left unanswered)'}${additionalText}

Generate the skill following the two-part format described in your instructions.`;
}

function parseResponse(text: string): SkillOutput | null {
  const delimIdx = text.indexOf(DELIMITER);
  if (delimIdx === -1) {
    console.warn('[parrot:agent2] delimiter not found in response');
    console.warn('[parrot:agent2] raw response (first 600 chars):', text.slice(0, 600));
    return null;
  }

  const metaPart    = text.slice(0, delimIdx).trim();
  const contentPart = text.slice(delimIdx + DELIMITER.length).trim();

  // metaPart may be wrapped in a code fence — strip it
  const jsonLine = metaPart.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/, '').trim();

  let meta: { skill_name: string; skill_filename: string; claude_code_instructions: string[] };
  try {
    meta = JSON.parse(jsonLine);
  } catch (e) {
    console.warn('[parrot:agent2] metadata JSON parse failed:', (e as Error).message);
    console.warn('[parrot:agent2] meta part:', metaPart.slice(0, 300));
    return null;
  }

  if (!meta.skill_name || !contentPart) {
    console.warn('[parrot:agent2] missing skill_name or content');
    return null;
  }

  return {
    skill_name: meta.skill_name,
    skill_filename: meta.skill_filename ?? `${meta.skill_name}.md`,
    skill_content: contentPart,
    claude_code_instructions: meta.claude_code_instructions ?? [
      `Save the .md file to ~/.claude/skills/${meta.skill_name}.md`,
      `Invoke the skill in any Claude Code session with: /${meta.skill_name}`,
      'Claude Code will load and execute the skill step by step',
    ],
  };
}

export async function generateSkill(
  analysis: WorkflowAnalysis,
  answers: UserAnswer[]
): Promise<SkillOutput> {
  console.log('[parrot:agent2] sending analysis + answers');

  const userMessage = buildUserMessage(analysis, answers);

  const firstResponse = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const firstText = firstResponse.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  const firstResult = parseResponse(firstText);
  if (firstResult) {
    console.log(`[parrot:agent2] received skill: ${firstResult.skill_name}`);
    return firstResult;
  }

  // Retry with explicit reminder
  const retryResponse = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: firstText },
      {
        role: 'user',
        content:
          `Your response was not in the correct format. Remember:\n` +
          `1. First line: single-line JSON with skill_name, skill_filename, claude_code_instructions\n` +
          `2. Then the exact delimiter on its own line: ${DELIMITER}\n` +
          `3. Then the raw .md content\n` +
          `No extra text. Try again.`,
      },
    ],
  });

  const retryText = retryResponse.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  const retryResult = parseResponse(retryText);
  if (retryResult) {
    console.log(`[parrot:agent2] received skill (retry): ${retryResult.skill_name}`);
    return retryResult;
  }

  throw new Error('[parrot:agent2] Failed to generate valid skill output after retry');
}
