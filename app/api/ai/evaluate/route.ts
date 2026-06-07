// AI second-judge: given a problem + the candidate's code, an LLM produces its
// own unbiased rubric score + reasoning + suggested follow-up questions. Runs
// server-side via OpenRouter (key never reaches the browser). No auth/DB needed,
// so it works in the no-login demo too.

import { aiConfigured, chatJSON, parseJSONObject } from '@/src/features/ai/openrouter';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CRITERIA = [
  'problemSolving',
  'codeQuality',
  'debugging',
  'efficiency',
  'communication',
] as const;

interface AIEvaluation {
  problemSolving: number;
  codeQuality: number;
  debugging: number;
  efficiency: number;
  communication: number;
  overall: number;
  summary: string;
  strengths: string[];
  concerns: string[];
  followUpQuestions: string[];
}

const SYSTEM = `You are an expert technical interviewer acting as an unbiased SECOND judge.
You are given a coding problem and a candidate's solution. Evaluate the solution fairly and concisely.
Respond with ONLY a JSON object (no markdown) using EXACTLY this shape:
{
  "problemSolving": <integer 1-5>,
  "codeQuality": <integer 1-5>,
  "debugging": <integer 1-5>,
  "efficiency": <integer 1-5>,
  "communication": <integer 1-5>,
  "overall": <number 1-5, one decimal>,
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<short point>", ...],
  "concerns": ["<short point>", ...],
  "followUpQuestions": ["<adaptive question about their reasoning/bugs/efficiency>", ...]
}
Score communication as 3 if it cannot be judged from code alone. Provide 2-3 strengths, 2-3 concerns, and 2-3 follow-up questions.`;

function clampScore(v: unknown, fallback = 3): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, n));
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && x.trim()).slice(0, 5);
}

export async function POST(request: Request) {
  if (!aiConfigured()) {
    return Response.json(
      { error: 'AI is not configured. Add OPENROUTER_API_KEY to .env.local and restart.' },
      { status: 503 },
    );
  }

  let body: { problemTitle?: unknown; problemDescription?: unknown; language?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const code = typeof body.code === 'string' ? body.code : '';
  if (!code.trim()) {
    return Response.json({ error: 'There is no code to evaluate yet.' }, { status: 400 });
  }
  const title = typeof body.problemTitle === 'string' ? body.problemTitle : 'Coding task';
  const description = typeof body.problemDescription === 'string' ? body.problemDescription : '';
  const language = typeof body.language === 'string' ? body.language : 'unknown';

  const userPrompt = `Problem: ${title}
${description}

Language: ${language}
Candidate's solution:
\`\`\`${language}
${code.slice(0, 12000)}
\`\`\``;

  try {
    const raw = await chatJSON(SYSTEM, userPrompt);
    const parsed = parseJSONObject<Partial<AIEvaluation>>(raw);

    const scores = Object.fromEntries(
      CRITERIA.map((c) => [c, clampScore(parsed[c])]),
    ) as Record<(typeof CRITERIA)[number], number>;

    const overallRaw = Number(parsed.overall);
    const overall = Number.isFinite(overallRaw)
      ? Math.min(5, Math.max(1, Math.round(overallRaw * 10) / 10))
      : Math.round((CRITERIA.reduce((s, c) => s + scores[c], 0) / CRITERIA.length) * 10) / 10;

    const result: AIEvaluation = {
      ...scores,
      overall,
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      strengths: asStringArray(parsed.strengths),
      concerns: asStringArray(parsed.concerns),
      followUpQuestions: asStringArray(parsed.followUpQuestions),
    };

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
