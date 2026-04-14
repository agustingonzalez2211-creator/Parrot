import Anthropic from '@anthropic-ai/sdk';
import { AnalyzeWorkflowPayload, WorkflowAnalysis, CapturedFrame } from './types';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a workflow analysis expert. You receive screenshots captured at 2-second intervals during a screen recording session. Your job is to understand what workflow the user is performing and return a structured JSON analysis.

Rules:
- Analyze the sequence of screenshots to understand the user's intent and what they are doing over time
- Identify the semantic meaning of each visible action (not pixel positions but 'opened the export menu', 'filled in a form', etc.)
- Generate EXACTLY 3 clarifying questions that would help remove ambiguity about the workflow
- Questions should focus on: edge cases, variable inputs, or decision branches you detected but couldn't confirm
- Return ONLY valid JSON matching the WorkflowAnalysis schema. No markdown, no explanation, just JSON.

The JSON schema you must return:
{
  "workflow_name": "string (max 60 chars)",
  "workflow_description": "string (1-2 sentences)",
  "detected_apps": ["string"],
  "steps": [{"id": number, "action": "string", "description": "string"}],
  "detected_inputs": [{"name": "string", "description": "string"}],
  "clarifying_questions": [{"id": 1, "question": "string", "context": "string"}, {"id": 2, ...}, {"id": 3, ...}]
}`;

function buildUserContent(frames: CapturedFrame[], duration_seconds: number, total_frames: number): Anthropic.MessageParam['content'] {
  const textBlock: Anthropic.TextBlockParam = {
    type: 'text',
    text: `I recorded myself performing a workflow on my computer. Here are ${frames.length} screenshots captured at 2-second intervals, in chronological order.\n\nRecording duration: ${duration_seconds}s\nTotal frames captured (2s interval): ${total_frames}\n\nAnalyze this workflow and return the JSON analysis.`,
  };

  const imageBlocks: Anthropic.ImageBlockParam[] = frames.map((frame) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/jpeg',
      data: frame.image_base64,
    },
  }));

  return [textBlock, ...imageBlocks];
}

function extractJson(text: string): string {
  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  // Try to find the outermost { ... } block
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

function parseAnalysis(text: string): WorkflowAnalysis | null {
  try {
    const parsed = JSON.parse(extractJson(text)) as WorkflowAnalysis;
    if (!Array.isArray(parsed.clarifying_questions) || parsed.clarifying_questions.length !== 3) {
      console.warn('[parrot:agent1] parse ok but clarifying_questions count:', parsed.clarifying_questions?.length);
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('[parrot:agent1] parse failed:', (e as Error).message);
    console.warn('[parrot:agent1] raw response (first 500 chars):', text.slice(0, 500));
    return null;
  }
}

export async function analyzeWorkflow(payload: AnalyzeWorkflowPayload): Promise<WorkflowAnalysis> {
  const { frames, recording_duration_ms, total_frames } = payload;
  const duration_seconds = Math.round(recording_duration_ms / 1000);

  console.log(`[parrot:agent1] sending ${frames.length} frames`);

  const userContent = buildUserContent(frames, duration_seconds, total_frames);

  const firstMessages: Anthropic.MessageParam[] = [
    { role: 'user', content: userContent },
  ];

  const firstResponse = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: firstMessages,
  });

  console.log('[parrot:agent1] received');

  const firstText = firstResponse.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const firstResult = parseAnalysis(firstText);
  if (firstResult !== null) {
    return firstResult;
  }

  // Retry once
  const retryMessages: Anthropic.MessageParam[] = [
    { role: 'user', content: userContent },
    { role: 'assistant', content: firstText },
    { role: 'user', content: 'Your previous response was not valid JSON matching the schema. Return ONLY the JSON object, nothing else.' },
  ];

  const secondResponse = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: retryMessages,
  });

  const secondText = secondResponse.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const secondResult = parseAnalysis(secondText);
  if (secondResult !== null) {
    return secondResult;
  }

  throw new Error('[parrot:agent1] Failed to parse a valid WorkflowAnalysis after two attempts');
}
