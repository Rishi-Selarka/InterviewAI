// One role-labeled transcript segment. start/end are seconds from recording
// start. Stored as the `content` jsonb array on the transcripts table.
export interface TranscriptSegment {
  role: 'interviewer' | 'candidate';
  text: string;
  start: number;
  end: number;
}
