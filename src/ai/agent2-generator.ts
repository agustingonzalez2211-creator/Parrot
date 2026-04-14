import Anthropic from '@anthropic-ai/sdk';
import { WorkflowAnalysis, UserAnswer, SkillOutput } from './types';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an AI Skill generator for Claude Code. You receive a workflow analysis and the user's answers to clarifying questions. Your job is to produce a .md skill file that Claude Code can load and execute.

The output .md file must have this format:
# <skill-name>

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

Rules:
- Use semantic action verbs: navigate, click, select, type, open, export, import, wait_for
- Extract variable data into inputs (dates, names, IDs that change each run)
- Keep steps atomic and executable
- skill_name must be kebab-case
- Return ONLY valid JSON with this exact schema (no markdown wrapping, just the JSON):
{
  "skill_name": "kebab-case-name",
  "skill_filename": "kebab-case-name.md",
  "skill_content": "full .md content as a string",
  "claude_code_instructions": [
    "Save the .md file to ~/.claude/skills/<skill-name>.md",
    "Invoke the skill in any Claude Code session with: /<skill-name>",
    "Claude Code will load and execute the skill step by step"
  ]
}`;

function buildUserMessage(analysis: WorkflowAnalysis, answers: UserAnswer[]): string {
  return `Workflow Analysis:
${JSON.stringify(analysis, null, 2)}

User's answers to clarifying questions:
${JSON.stringify(answers, null, 2)}

Generate the .md skill file for Claude Code and return the JSON output.`;
}

function parseSkillOutput(text: string): SkillOutput | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.skill_content === 'string') {
      return parsed as SkillOutput;
    }
    return null;
  } catch {
    return null;
  }
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
    messages: [
      { role: 'user', content: userMessage }
    ]
  });

  const firstText = firstResponse.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  const firstResult = parseSkillOutput(firstText);
  if (firstResult) {
    console.log(`[parrot:agent2] received skill: ${firstResult.skill_name}`);
    return firstResult;
  }

  // Retry once
  const retryResponse = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: firstText },
      { role: 'user', content: 'Your previous response was not valid JSON matching the schema. Return ONLY the JSON object, nothing else.' }
    ]
  });

  const retryText = retryResponse.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  const retryResult = parseSkillOutput(retryText);
  if (retryResult) {
    console.log(`[parrot:agent2] received skill: ${retryResult.skill_name}`);
    return retryResult;
  }

  throw new Error('[parrot:agent2] Failed to generate valid skill output after retry');
}
