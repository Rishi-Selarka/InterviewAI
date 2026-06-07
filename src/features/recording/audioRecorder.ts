// Continuous single-stream audio recorder for ONE speaker (role).
//
// We record a persistent Web Audio destination node, NOT the participant track
// directly. The participant's mic track can end (mute) or be replaced (rejoin);
// by piping whatever the current track is into a stable MediaStreamDestination,
// the MediaRecorder keeps producing ONE continuous file (silence during mutes),
// which avoids stitching multiple incompatible WebM blobs together.

function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

export class AudioRoleRecorder {
  private ctx: AudioContext | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private source: MediaStreamAudioSourceNode | null = null;
  private track: MediaStreamTrack | null = null;
  private mime = '';
  started = false;

  start(): void {
    if (this.started) return;
    const Ctx: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    // A silent constant source keeps the graph "alive" so the destination always
    // emits audio even when no mic is connected (true silence, not a stall).
    const silence = this.ctx.createConstantSource();
    silence.offset.value = 0;
    this.dest = this.ctx.createMediaStreamDestination();
    silence.connect(this.dest);
    silence.start();

    this.mime = pickMimeType();
    this.recorder = new MediaRecorder(
      this.dest.stream,
      this.mime ? { mimeType: this.mime } : undefined,
    );
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(2000); // emit a chunk every 2s
    this.started = true;

    // The AudioContext may start suspended under the autoplay policy. Resume now,
    // and also on the next user gesture in case the immediate resume is blocked,
    // so the destination actually produces audio.
    this.resume();
    this.gestureResume = () => this.resume();
    window.addEventListener('pointerdown', this.gestureResume, { once: true });
    window.addEventListener('keydown', this.gestureResume, { once: true });
  }

  private gestureResume: (() => void) | null = null;

  private resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  /** Connect (or disconnect) the speaker's current mic track. */
  setTrack(track: MediaStreamTrack | null): void {
    if (!this.ctx || !this.dest) return;
    if (track === this.track) return;

    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        /* already gone */
      }
      this.source = null;
    }
    this.track = track;

    if (track) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this.source = this.ctx.createMediaStreamSource(new MediaStream([track]));
      this.source.connect(this.dest);
    }
  }

  /** Stop recording and return the full blob (or null if nothing captured). */
  async stop(): Promise<Blob | null> {
    if (!this.recorder || !this.started) return null;
    if (this.gestureResume) {
      window.removeEventListener('pointerdown', this.gestureResume);
      window.removeEventListener('keydown', this.gestureResume);
      this.gestureResume = null;
    }
    const rec = this.recorder;
    if (rec.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        try {
          rec.stop();
        } catch {
          resolve();
        }
      });
    }

    try {
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      await this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.started = false;

    if (this.chunks.length === 0) return null;
    return new Blob(this.chunks, { type: this.mime || 'audio/webm' });
  }
}
