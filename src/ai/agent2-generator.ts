import Anthropic from "@anthropic-ai/sdk";
import { WorkflowAnalysis, UserAnswer, SkillOutput } from "./types";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an AI Skill generator for Claude Code. You receive a workflow analysis (from screenshots of a user performing a task) and the user's answers to clarifying questions. Your job is to produce an executable .md skill file that Claude Code can load and replay using computer-use MCP tools.

## Critical: The skill must be EXECUTABLE, not just descriptive

The skill will be loaded by Claude Code and executed using one of these MCP servers:
- **Windows-MCP** (on Windows): tools like click, type, scroll, screenshot, open app, powershell
- **desktop-pilot-mcp** (on macOS): tools like pilot_click, pilot_type, pilot_screenshot, pilot_find, pilot_script
- **computer-use-mcp** (cross-platform fallback): screenshot-based click/type

Claude will read the skill and translate each step into MCP tool calls. The skill must give Claude enough context to:
1. FIND the right element (visual description, not coordinates)
2. EXECUTE the action
3. VERIFY it worked (what should the screen look like after)
4. RECOVER if something goes wrong (fallback strategy)

## Skill .md format

The output must be a complete .md file with this structure:

\`\`\`
# <Skill Name>

> One-line description of what this skill does.

## Prerequisites
- List of apps that must be installed/open
- List of conditions that must be true before starting
- Any credentials or data the user needs to provide

## Execution Instructions

Execute this workflow step by step using the computer-use MCP tools available in this session.

**Before starting:**
1. Take a screenshot to see the current state of the screen.
2. Verify prerequisites are met.
3. If an app needs to be opened, open it first and wait for it to load.

**For each step:**
1. Read the step description and visual_hint to understand what to look for.
2. Take a screenshot if you need to locate the element.
3. Perform the action described.
4. Take a screenshot and verify the expected result matches the verify field.
5. If verification fails, try the fallback strategy before moving to the next step.
6. Only proceed to the next step after verification passes.

**If a step fails after fallback:** Stop execution, report which step failed, include the screenshot, and ask the user how to proceed.

## Workflow

\\\`\\\`\\\`yaml
name: kebab-case-name
version: "1.0"
description: |
  Multi-line description of the full workflow.

inputs:
  - name: input_name
    type: string | number | date | file
    required: true
    description: What this input is and where to use it

steps:
  - id: 1
    action: open_app | click | type | key | select | navigate | scroll | wait | verify
    target: "semantic description of what to interact with"
    description: "Human-readable explanation of this step's purpose"
    visual_hint: "How to visually identify the target element on screen (color, position, icon, text label)"
    verify: "What the screen should look like after this action succeeds"
    fallback: "What to try if the primary action fails"

  - id: 2
    action: type
    target: "input field"
    text: "{{input_name}}"
    description: "Fill in the field with the user-provided value"
    visual_hint: "Text input with placeholder '...', below the label '...'"
    verify: "The typed text is visible in the field"
    fallback: "Click on the field first to ensure focus, then type"

outputs:
  - name: output_name
    type: string | file | screenshot
    description: What this workflow produces
\\\`\\\`\\\`

## Troubleshooting

- Common issue 1 and how to resolve it
- Common issue 2 and how to resolve it
\`\`\`

## Rules for generating skills

1. **visual_hint is mandatory for every step** — Claude needs to find elements by appearance, not coordinates. Describe color, position relative to other elements, text label, icon shape.
2. **verify is mandatory for every step** — Claude must confirm each action worked before proceeding. Describe what changes on screen.
3. **fallback is mandatory for every step** — Always provide an alternative approach (keyboard shortcut, different path, retry strategy).
4. **Use {{input_name}} for variable data** — Dates, names, IDs, URLs that change between runs must be declared as inputs and referenced with double curly braces.
5. **Steps must be atomic** — One action per step. "Open Chrome and navigate to URL" must be two steps.
6. **action verbs must be from this list:** open_app, click, double_click, right_click, type, key, select, navigate, scroll, wait, verify, drag
7. **Include a verify-only step at the end** — A final step that takes a screenshot and confirms the entire workflow completed successfully.
8. **Troubleshooting section** — Include 2-4 common issues based on the workflow type (e.g., "app not responding", "element not found", "dialog blocking the view").
9. **skill_name must be kebab-case**, max 40 characters, descriptive.
10. **The Execution Instructions section is critical** — It tells Claude HOW to run the skill. Do not omit or simplify it.

Return ONLY valid JSON matching the SkillOutput schema. No markdown wrapping, no explanation, just the JSON object.`;

const SKILL_OUTPUT_SCHEMA: Anthropic.Tool = {
  name: "submit_skill",
  description: "Submit the generated skill file for Claude Code",
  input_schema: {
    type: "object" as const,
    properties: {
      skill_name: {
        type: "string",
        description:
          'Kebab-case skill name, max 40 chars (e.g. "exportar-reporte-mensual")',
      },
      skill_filename: {
        type: "string",
        description:
          'Filename with .md extension (e.g. "exportar-reporte-mensual.md")',
      },
      skill_content: {
        type: "string",
        description:
          "Complete .md file content: title, description, prerequisites, execution instructions, YAML workflow block, and troubleshooting section",
      },
      claude_code_instructions: {
        type: "array",
        items: { type: "string" },
        description: "Steps to install and use the skill in Claude Code",
      },
    },
    required: [
      "skill_name",
      "skill_filename",
      "skill_content",
      "claude_code_instructions",
    ],
  },
};

function buildUserMessage(
  analysis: WorkflowAnalysis,
  answers: UserAnswer[],
): string {
  return `## Workflow Analysis (from screen recording)

${JSON.stringify(analysis, null, 2)}

## User's Answers to Clarifying Questions

${JSON.stringify(answers, null, 2)}

Generate the executable .md skill file for Claude Code. Remember:
- Every step needs visual_hint, verify, and fallback
- Variable data must be extracted as inputs with {{name}} syntax
- The skill must be executable by Claude using computer-use MCP tools
- Include the full Execution Instructions section
- Include a Troubleshooting section

Call the submit_skill tool with the complete skill.`;
}

export async function generateSkill(
  analysis: WorkflowAnalysis,
  answers: UserAnswer[],
): Promise<SkillOutput> {
  console.log("[parrot:agent2] sending analysis + answers");

  const userMessage = buildUserMessage(analysis, answers);

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    tools: [SKILL_OUTPUT_SCHEMA],
    tool_choice: { type: "tool" as const, name: "submit_skill" },
    messages: [{ role: "user", content: userMessage }],
  });

  // With tool_choice forced, the response will always contain a tool_use block
  const toolBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolBlock) {
    throw new Error(
      "[parrot:agent2] No tool_use block in response — unexpected",
    );
  }

  const input = toolBlock.input as {
    skill_name: string;
    skill_filename: string;
    skill_content: string;
    claude_code_instructions: string[];
  };

  // Validate the essential fields
  if (!input.skill_content || input.skill_content.length < 100) {
    throw new Error("[parrot:agent2] skill_content is empty or too short");
  }

  if (!input.skill_name || !input.skill_filename) {
    throw new Error("[parrot:agent2] skill_name or skill_filename missing");
  }

  const result: SkillOutput = {
    skill_name: input.skill_name,
    skill_filename: input.skill_filename,
    skill_content: input.skill_content,
    claude_code_instructions: input.claude_code_instructions || [
      `Save to ~/.claude/commands/${input.skill_filename}`,
      `Run with: /${input.skill_name}`,
      "Claude Code will execute the skill step by step using available MCP tools",
    ],
  };

  console.log(
    `[parrot:agent2] generated skill: ${result.skill_name} (${result.skill_content.length} chars)`,
  );
  return result;
}
