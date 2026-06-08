// Continuous single-stream audio recorder for ONE speaker (role).
//
// We record a persistent Web Audio destination node, NOT the participant track
// directly. The participant's mic track can end (mute) or be replaced (rejoin);
// by piping whatever the current track is into a stable MediaStreamDestination,
// the MediaRecorder keeps producing ONE continuous file (silence during mutes),
// which avoids stitching multiple incompatible WebM blobs together.

// User-gesture events that are allowed to resume a suspended AudioContext.
const GESTURE_EVENTS = ['pointerdown', 'keydown', 'click', 'touchstart'] as const;

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
    // and on ANY subsequent user gesture until it's actually running, so the
    // destination reliably produces audio (otherwise the recording is empty/null).
    this.resume();
    this.gestureResume = () => {
      this.resume();
      if (this.ctx && this.ctx.state === 'running') this.removeGestureListeners();
    };
    for (const ev of GESTURE_EVENTS) {
      window.addEventListener(ev, this.gestureResume);
    }
  }

  private gestureResume: (() => void) | null = null;

  private removeGestureListeners(): void {
    if (!this.gestureResume) return;
    for (const ev of GESTURE_EVENTS) {
      window.removeEventListener(ev, this.gestureResume);
    }
    this.gestureResume = null;
  }

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
    this.removeGestureListeners();
    const rec = this.recorder;
    if (rec.state !== 'inactive') {
      // Make sure any buffered audio is flushed into a final chunk before stopping.
      this.resume();
      try {
        rec.requestData();
      } catch {
        /* not all browsers support requestData mid-stream */
      }
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
