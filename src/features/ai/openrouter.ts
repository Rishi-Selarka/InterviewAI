import 'server-only';

// Thin server-side wrapper around the OpenRouter chat API. The API key stays on
// the server and is never sent to the browser. Model is configurable via env.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const KEY = process.env.OPENROUTER_API_KEY ?? '';
const MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

export function aiConfigured(): boolean {
  return Boolean(KEY);
}

/**
 * Send a system + user prompt and return the assistant's text. Requests JSON
 * output from the model; callers parse it.
 */
export async function chatJSON(system: string, user: string): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      // Optional attribution headers OpenRouter recommends.
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'IntelliInterview',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 900,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

/** Parse a JSON object from model output, tolerating stray prose/code fences. */
export function parseJSONObject<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1)) as T;
    }
    throw new Error('AI did not return valid JSON.');
  }
}
