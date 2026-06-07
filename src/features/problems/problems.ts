// Built-in "smart" problem bank for IntelliInterview.
//
// Per differentiator #3, these focus on DEBUGGING, OPTIMIZING, and SECURING
// existing code rather than writing a function from scratch. Each problem ships
// with runnable starter code (already containing the bug / slow path / flaw) for
// both supported languages, so the interviewer can load it into the shared editor.

import type { SupportedLanguage } from '@/src/features/room/liveblocks.config';

export type ProblemCategory = 'Debug' | 'Optimize' | 'Secure';

export interface Problem {
  id: string;
  title: string;
  category: ProblemCategory;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  /** Short framing of the task. */
  description: string;
  /** Concrete, checkable expectations shown under the description. */
  examples: { label: string; value: string }[];
  /** Buggy / slow / insecure starting code, per language. */
  starter: Record<SupportedLanguage, string>;
}

export const PROBLEMS: Problem[] = [
  {
    id: 'debug-average',
    title: 'Debug: broken average',
    category: 'Debug',
    difficulty: 'Easy',
    description:
      'The average() function is meant to return the mean of a list of numbers, ' +
      'but it produces wrong results (and crashes on some inputs). Find and fix ' +
      'the bug, and make sure it behaves sensibly for a single-element list.',
    examples: [
      { label: 'average([10, 20, 30])', value: '20' },
      { label: 'average([5])', value: '5' },
    ],
    starter: {
      javascript: `// BUG: average() should return the mean, but it's off — and it can crash.
// Find the bug, fix it, then Run to confirm the expected outputs below.
function average(numbers) {
  let total = 0;
  for (let i = 0; i <= numbers.length; i++) {
    total += numbers[i];
  }
  return total / numbers.length;
}

console.log(average([10, 20, 30])); // expected 20
console.log(average([5]));          // expected 5
`,
      python: `# BUG: average() should return the mean, but it's off — and it can crash.
# Find the bug, fix it, then Run to confirm the expected outputs below.
def average(numbers):
    total = 0
    for i in range(len(numbers) + 1):
        total += numbers[i]
    return total / len(numbers)

print(average([10, 20, 30]))  # expected 20
print(average([5]))           # expected 5
`,
    },
  },
  {
    id: 'optimize-first-duplicate',
    title: 'Optimize: first duplicate',
    category: 'Optimize',
    difficulty: 'Medium',
    description:
      'firstDuplicate() returns the first value that appears more than once. The ' +
      'current solution is correct but runs in O(n^2) time. Optimize it to O(n) ' +
      'time while keeping the same result.',
    examples: [
      { label: 'firstDuplicate([3, 1, 4, 1, 5, 9, 4])', value: '1' },
      { label: 'firstDuplicate([7, 8, 9])', value: '-1 (no duplicate)' },
    ],
    starter: {
      javascript: `// SLOW: this is O(n^2). Optimize it to O(n) time (hint: a Set).
function firstDuplicate(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j]) return arr[i];
    }
  }
  return -1;
}

console.log(firstDuplicate([3, 1, 4, 1, 5, 9, 4])); // expected 1
console.log(firstDuplicate([7, 8, 9]));             // expected -1
`,
      python: `# SLOW: this is O(n^2). Optimize it to O(n) time (hint: a set).
def first_duplicate(arr):
    for i in range(len(arr)):
        for j in range(i + 1, len(arr)):
            if arr[i] == arr[j]:
                return arr[i]
    return -1

print(first_duplicate([3, 1, 4, 1, 5, 9, 4]))  # expected 1
print(first_duplicate([7, 8, 9]))              # expected -1
`,
    },
  },
  {
    id: 'secure-backup-command',
    title: 'Secure: command injection',
    category: 'Secure',
    difficulty: 'Medium',
    description:
      'buildBackupCommand() interpolates a user-supplied filename straight into a ' +
      'shell command, which allows command injection (e.g. "data.txt; rm -rf ~"). ' +
      'Make it safe: validate or escape the input so only a legitimate filename is ' +
      'ever used, and reject anything dangerous.',
    examples: [
      { label: 'A normal filename like "report.txt"', value: 'is accepted' },
      {
        label: '"report.txt; rm -rf ~"',
        value: 'must be rejected or neutralised — never executed',
      },
    ],
    starter: {
      javascript: `// SECURITY FLAW: the filename is concatenated straight into a shell command,
// so input like "report.txt; rm -rf ~" would inject extra commands.
// Make buildBackupCommand() safe (validate/escape) and reject dangerous input.
function buildBackupCommand(filename) {
  return \`cp \${filename} /backups/\${filename}\`;
}

console.log(buildBackupCommand("report.txt"));
console.log(buildBackupCommand("report.txt; rm -rf ~")); // must NOT be allowed
`,
      python: `# SECURITY FLAW: the filename is concatenated straight into a shell command,
# so input like "report.txt; rm -rf ~" would inject extra commands.
# Make build_backup_command() safe (validate/escape) and reject dangerous input.
def build_backup_command(filename):
    return f"cp {filename} /backups/{filename}"

print(build_backup_command("report.txt"))
print(build_backup_command("report.txt; rm -rf ~"))  # must NOT be allowed
`,
    },
  },
  {
    id: 'optimize-fibonacci',
    title: 'Optimize: slow Fibonacci',
    category: 'Optimize',
    difficulty: 'Medium',
    description:
      'This recursive Fibonacci is exponential time and becomes unusably slow for ' +
      'larger n. Optimize it (memoization or iteration) so fib(40) returns ' +
      'instantly, keeping the same results.',
    examples: [
      { label: 'fib(10)', value: '55' },
      { label: 'fib(40)', value: '102334155 (must be fast)' },
    ],
    starter: {
      javascript: `// SLOW: exponential-time recursion. Optimize so fib(40) is instant.
function fib(n) {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}

console.log(fib(10)); // expected 55
console.log(fib(40)); // expected 102334155 (currently very slow)
`,
      python: `# SLOW: exponential-time recursion. Optimize so fib(40) is instant.
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print(fib(10))  # expected 55
print(fib(40))  # expected 102334155 (currently very slow)
`,
    },
  },
];

export const DEFAULT_PROBLEM_ID = PROBLEMS[0].id;

export function getProblem(id: string): Problem {
  return PROBLEMS.find((p) => p.id === id) ?? PROBLEMS[0];
}
