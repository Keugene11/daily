/**
 * The itinerary writer's model: a cheap, fast OpenRouter model instead of
 * Claude (the Anthropic account ran out of credits and every plan failed).
 *
 * This is deliberately shaped like the slice of the Anthropic SDK that
 * anthropic.ts uses — messages.stream() yielding content_block_delta /
 * message_delta events, and messages.create() returning text content blocks —
 * so the streaming, truncation and continuation logic there is unchanged.
 */
const MODELS = (process.env.LLM_MODELS || 'google/gemini-3.1-flash-lite,deepseek/deepseek-v4.1-flash')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

type Msg = { role: 'user' | 'assistant'; content: unknown };
type Params = { model?: string; system?: string; messages: Msg[]; temperature?: number; max_tokens: number };

export type StreamEvent =
  | { type: 'content_block_delta'; delta: { type: 'text_delta'; text: string } }
  | { type: 'message_delta'; delta: { stop_reason: 'end_turn' | 'max_tokens' } };

function asText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((b) => (b && typeof b === 'object' && 'text' in b ? String((b as { text: unknown }).text) : '')).join('');
  }
  return '';
}

async function request(params: Params, stream: boolean): Promise<Response> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not set');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://getdaily.live',
      'X-Title': 'Daily',
    },
    body: JSON.stringify({
      models: MODELS,
      stream,
      max_tokens: params.max_tokens,
      temperature: params.temperature ?? 0.7,
      reasoning: { enabled: false },
      messages: [
        ...(params.system ? [{ role: 'system', content: params.system }] : []),
        ...params.messages.map((m) => ({ role: m.role, content: asText(m.content) })),
      ],
    }),
    signal: AbortSignal.timeout(65_000),
  });
  if (!res.ok || (stream && !res.body)) {
    throw new Error(`OpenRouter ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  }
  return res;
}

async function* streamEvents(params: Params): AsyncGenerator<StreamEvent> {
  const res = await request(params, true);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let finish: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue; // ": OPENROUTER PROCESSING" keep-alives
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      let event: { error?: { message?: string }; choices?: { delta?: { content?: string }; finish_reason?: string | null }[] };
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }
      if (event.error) throw new Error(`OpenRouter: ${event.error.message ?? 'stream error'}`);
      const choice = event.choices?.[0];
      if (choice?.delta?.content) {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: choice.delta.content } };
      }
      if (choice?.finish_reason) finish = choice.finish_reason;
    }
  }
  yield { type: 'message_delta', delta: { stop_reason: finish === 'length' ? 'max_tokens' : 'end_turn' } };
}

export const openrouter = {
  messages: {
    stream: (params: Params) => streamEvents(params),
    async create(params: Params) {
      const res = await request(params, false);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return { content: [{ type: 'text' as const, text: data.choices?.[0]?.message?.content ?? '' }] };
    },
  },
};
