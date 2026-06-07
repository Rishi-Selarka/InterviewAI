# ai (STUB)

The AI layer, powered by the **Anthropic Claude API** (server-side only).

Planned capabilities:
- **AI interviewer mode** — an AI conducts the live interview and asks adaptive
  follow-up questions about the candidate's reasoning, bugs, and efficiency.
- **AI as an unbiased second judge** — after the interview, an AI reads the
  transcript and produces its own fair score; HR compares it against the human
  interviewer's score (from `src/features/scoring`) to catch large gaps or bias.
- **Soft AI-content flag** — marks possibly AI-generated spoken/written answers as
  a signal only, never a verdict.

All calls run in server-side API routes; the Claude key stays in `.env.local`.

TODO: add `app/api/ai/*` routes; build the HR score-comparison view.
