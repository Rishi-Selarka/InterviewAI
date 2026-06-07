// Imperative bridge so InterviewerControls (the "End interview" button) can stop
// the recorders that live inside the video panel and collect their audio blobs.

export interface RecorderApi {
  stop: () => Promise<{ interviewer: Blob | null; candidate: Blob | null }>;
  isRecording: () => boolean;
}
