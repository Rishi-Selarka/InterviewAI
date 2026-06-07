# transcription (STUB)

Post-interview recording + transcription pipeline.

Records room audio, stores it (Supabase Storage), and transcribes it later with
**Whisper or Deepgram** to produce a timestamped transcript. The transcript feeds
the AI transcript-judge and the post-interview voice check (a SOFT, never-verdict
flag for possibly AI-generated spoken answers).

TODO: capture audio in `src/features/room`/`src/features/video`; expose the
transcript to `src/features/ai`.
