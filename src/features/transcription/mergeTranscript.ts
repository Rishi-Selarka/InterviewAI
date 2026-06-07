// Merge the two role-labeled segment lists into one transcript ordered by start
// time. With ties, the interviewer is listed first (deterministic).

import type { TranscriptSegment } from './types';

export function mergeSegments(
  interviewer: TranscriptSegment[],
  candidate: TranscriptSegment[],
): TranscriptSegment[] {
  return [...interviewer, ...candidate].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.role === b.role) return 0;
    return a.role === 'interviewer' ? -1 : 1;
  });
}

export function toFullText(segments: TranscriptSegment[]): string {
  return segments.map((s) => `${s.role}: ${s.text}`).join('\n');
}
