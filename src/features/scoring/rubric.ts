// The 5-point evaluation rubric the interviewer fills in after/while observing
// the candidate. Persisting submissions is a later pass (see src/features/auth);
// for now the summary is computed and shown on screen.

export interface RubricCriterion {
  key: string;
  label: string;
  hint: string;
}

export const RUBRIC: RubricCriterion[] = [
  {
    key: 'problemSolving',
    label: 'Problem Solving',
    hint: 'Breaks the problem down; sound approach and reasoning.',
  },
  {
    key: 'codeQuality',
    label: 'Code Quality & Readability',
    hint: 'Clear, well-structured, maintainable code.',
  },
  {
    key: 'debugging',
    label: 'Debugging Skill',
    hint: 'Locates and fixes defects methodically.',
  },
  {
    key: 'efficiency',
    label: 'Efficiency / Optimization',
    hint: 'Considers complexity and improves performance.',
  },
  {
    key: 'communication',
    label: 'Communication',
    hint: 'Explains thinking clearly; collaborates well.',
  },
];

export type RubricScores = Record<string, number>;
