import Anthropic from '@anthropic-ai/sdk';
import { AnalyzeWorkflowPayload, WorkflowAnalysis, CapturedFrame } from './types';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a workflow analysis expert. You receive screenshots captured at click events during a screen recording session. Your job is to understand what workflow the user is performing and return a structured JSON analysis.

Rules:
- Analyze the sequence of screenshots to understand the user's intent, not just the individual clicks
- Identify the semantic meaning of each action (not 'clicked at x,y' but 'opened the export menu')
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

function buildUserContent(frames: CapturedFrame[], duration_seconds: number, total_clicks: number): Anthropic.MessageParam['content'] {
  const textBlock: Anthropic.TextBlockParam = {
    type: 'text',
    text: `I recorded myself performing a workflow on my computer. Here are ${frames.length} screenshots captured at click events, in chronological order.\n\nRecording duration: ${duration_seconds}s\nTotal clicks captured: ${total_clicks}\n\nAnalyze this workflow and return the JSON analysis.`,
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

function parseAnalysis(text: string): WorkflowAnalysis | null {
  try {
    const parsed = JSON.parse(text) as WorkflowAnalysis;
    if (!Array.isArray(parsed.clarifying_questions) || parsed.clarifying_questions.length !== 3) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function analyzeWorkflow(payload: AnalyzeWorkflowPayload): Promise<WorkflowAnalysis> {
  const { frames, recording_duration_ms, total_clicks } = payload;
  const duration_seconds = Math.round(recording_duration_ms / 1000);

  console.log(`[parrot:agent1] sending ${frames.length} frames`);

  const userContent = buildUserContent(frames, duration_seconds, total_clicks);

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
