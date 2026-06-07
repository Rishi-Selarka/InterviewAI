// Built-in "smart" problem bank for IntelliInterview.
//
// Per differentiator #3, these focus on DEBUGGING, OPTIMIZING, and SECURING
// existing code rather than writing a function from scratch. Each problem ships
// with runnable starter code (already containing the bug / slow path / flaw) for
// both supported languages, so the interviewer can load it into the shared editor.

import type { SupportedLanguage } from '@/src/features/room/liveblocks.config';
import { LANGUAGE_TEMPLATES } from '@/src/features/editor/languages';

export type ProblemCategory = 'Debug' | 'Optimize' | 'Secure' | 'Solve';

export interface InterviewerGuide {
  /** What a correct, complete answer should demonstrate. */
  whatToCheck: string[];
  /** Mistakes candidates commonly make when solving this problem. */
  commonMistakes: string[];
  /** Sharp follow-up questions to probe deeper understanding. */
  crossQuestions: string[];
}

export interface Problem {
  id: string;
  title: string;
  category: ProblemCategory;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  /** Short framing of the task. */
  description: string;
  /** Concrete, checkable expectations shown under the description. */
  examples: { label: string; value: string }[];
  /** Searchable topic tags, e.g. ['arrays', 'math'], ['strings'], ['security']. */
  topics: string[];
  /** Interviewer-only reference guide — NEVER shown to candidates. */
  guide: InterviewerGuide;
  /**
   * Buggy / slow / insecure starting code per language. Not every language needs
   * an entry — languages without one fall back to a generic template (see
   * starterFor). The built-in smart problems ship JS + Python versions.
   */
  starter: Partial<Record<SupportedLanguage, string>>;
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
    topics: ['arrays', 'math', 'loops', 'off-by-one'],
    guide: {
      whatToCheck: [
        'Spots the off-by-one: loop runs `i <= numbers.length` so it reads one past the end (undefined in JS, IndexError in Python).',
        'Fixes the loop condition to `i < numbers.length`.',
        'Recognises that NaN/undefined taints the sum silently in JS; Python raises an exception immediately.',
        'Considers the empty-array edge case — division by zero — and handles it (return 0, return null, or throw).',
      ],
      commonMistakes: [
        'Fixing the crash (off-by-one) without noticing the result is still wrong because undefined added to a number is NaN.',
        'Only testing the happy path and missing the edge cases (empty array, single element).',
        'Rewriting the whole function from scratch rather than identifying the minimal fix.',
      ],
      crossQuestions: [
        'Why does JavaScript silently give you NaN instead of crashing when you read past the array end?',
        'What would you return for an empty array, and why? Is there a standard convention?',
        'How would you write a test that would have caught this bug before code review?',
        'If the list could contain very large numbers, what numerical issue might still arise even after your fix?',
      ],
    },
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
    topics: ['arrays', 'hashmap', 'set', 'time-complexity'],
    guide: {
      whatToCheck: [
        'Correctly identifies the O(n²) nested-loop pattern and names it.',
        'Replaces it with a single-pass using a Set or object map — O(n) time, O(n) space.',
        'Returns the correct element: the first one encountered that was already seen, not the first by value.',
        'Handles the all-unique case (returns -1) and a single-element array.',
      ],
      commonMistakes: [
        'Confusing "first duplicate by position in the array" with "smallest duplicate value" — they can differ.',
        'Using indexOf() inside the loop, which is still O(n) per call → O(n²) overall.',
        'Forgetting to handle the empty-array or single-element edge case.',
        'Over-engineering with a Map when a Set is sufficient.',
      ],
      crossQuestions: [
        'What is the trade-off between your O(n) solution and the original? (time vs. space)',
        'If memory were extremely constrained and O(n) space was unacceptable, what would you do?',
        'How does your solution behave if the array contains objects instead of primitives?',
        'Can you extend this to return ALL duplicates, not just the first?',
      ],
    },
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
    topics: ['security', 'command-injection', 'input-validation', 'shell'],
    guide: {
      whatToCheck: [
        'Names the vulnerability correctly: OS command injection / shell injection.',
        'Uses an allowlist regex (e.g. /^[\\w.-]+$/) rather than trying to blacklist bad characters.',
        'Throws or returns an error for invalid input — does NOT silently sanitise a malicious filename.',
        'Understands that the fix lives at the boundary where untrusted input enters the system.',
        'Ideally notes that the real solution is to avoid shell interpolation entirely (use execFile with an args array).',
      ],
      commonMistakes: [
        'Blacklisting a handful of special characters (;, &, |) — easy to bypass with $(), backticks, newlines, etc.',
        'HTML-escaping the input — irrelevant for a shell context.',
        'Silently stripping bad characters instead of rejecting the input — can still produce unexpected filenames.',
        'Not considering path traversal (../../../etc/passwd).',
      ],
      crossQuestions: [
        'Why is a blacklist approach weaker than an allowlist here? Give a concrete bypass example.',
        'How does Node\'s child_process.execFile() prevent injection vs. exec()? When would you use each?',
        'Name two other injection attack classes that follow the same root cause (untrusted data in a structured context).',
        'Where else in a web app might filenames provided by users cause security issues?',
      ],
    },
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
    topics: ['recursion', 'dp', 'memoization', 'time-complexity'],
    guide: {
      whatToCheck: [
        'Correctly names the complexity: O(2ⁿ) due to repeated sub-problem recomputation.',
        'Provides either top-down memoization (cache object/map + recursive) or bottom-up iteration — both acceptable.',
        'Reduces to O(n) time; ideally notes the iterative approach is also O(1) space.',
        'Handles base cases correctly (fib(0)=0, fib(1)=1) and negative input (at minimum: doesn\'t crash).',
      ],
      commonMistakes: [
        'Memoizing but using a closure-scoped cache that resets on each call — cache must persist across calls.',
        'Confusing the Fibonacci sequence definition (0-indexed vs 1-indexed); double-check fib(0) and fib(1).',
        'Reaching for `lru_cache` / memoize libraries without explaining the underlying principle.',
        'Not recognising that the iterative version uses O(1) space, which is strictly better for large n.',
      ],
      crossQuestions: [
        'Walk me through why the naive version is O(2ⁿ) — draw the recursion tree for fib(5).',
        'Your memoized version is O(n) time. Can you reduce space to O(1) as well? Show me.',
        'What is dynamic programming? Is memoization top-down or bottom-up DP?',
        'For very large n (e.g. fib(10000)), what language-level issue appears even in the optimised version?',
      ],
    },
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

  // ── NEW PROBLEMS ────────────────────────────────────────────────────────────

  {
    id: 'debug-anagram-check',
    title: 'Debug: broken anagram check',
    category: 'Debug',
    difficulty: 'Easy',
    description:
      'isAnagram() should return true if two strings are anagrams of each other ' +
      '(same characters, same counts, order irrelevant). The current implementation ' +
      'has a subtle bug that produces wrong results for certain inputs. ' +
      'Find it, fix it, and handle case-insensitive comparison.',
    examples: [
      { label: 'isAnagram("listen", "silent")', value: 'true' },
      { label: 'isAnagram("hello", "world")', value: 'false' },
      { label: 'isAnagram("Astronomer", "Moon starer")', value: 'true (spaces/case ignored)' },
    ],
    topics: ['strings', 'hashmap', 'sorting', 'anagram'],
    guide: {
      whatToCheck: [
        'Identifies the bug: the code sorts and compares, but forgets to normalise case and strip spaces before sorting.',
        'Adds .toLowerCase() and removes spaces/non-alpha characters before comparing.',
        'Understands both the sort-based O(n log n) and frequency-map O(n) approaches.',
        'Checks the early-out: if lengths differ after normalisation, return false immediately.',
      ],
      commonMistakes: [
        'Stripping spaces but not lowercasing (or vice versa) — fails on mixed-case inputs.',
        'Comparing the sorted arrays by reference (===) instead of converting to a string first.',
        'Not handling non-letter characters (punctuation, digits) when the problem says "ignore spaces".',
        'Missing the empty-string edge case.',
      ],
      crossQuestions: [
        'What is the time and space complexity of the sort approach vs. the character-frequency map approach?',
        'How would you scale this to check anagrams across a dictionary of a million words efficiently?',
        'How does Unicode (accented characters, emoji) affect your solution?',
        'Could you detect anagrams without sorting or a hash map? What would the trade-off be?',
      ],
    },
    starter: {
      javascript: `// BUG: isAnagram() gives wrong results for some inputs.
// Fix it so it correctly handles case and spaces (see examples).
function isAnagram(a, b) {
  return a.split('').sort().join('') === b.split('').sort().join('');
}

console.log(isAnagram("listen", "silent"));          // expected true
console.log(isAnagram("hello", "world"));            // expected false
console.log(isAnagram("Astronomer", "Moon starer")); // expected true
`,
      python: `# BUG: is_anagram() gives wrong results for some inputs.
# Fix it so it correctly handles case and spaces (see examples).
def is_anagram(a, b):
    return sorted(a) == sorted(b)

print(is_anagram("listen", "silent"))          # expected True
print(is_anagram("hello", "world"))            # expected False
print(is_anagram("Astronomer", "Moon starer")) # expected True
`,
    },
  },

  {
    id: 'optimize-two-sum',
    title: 'Optimize: two-sum lookup',
    category: 'Optimize',
    difficulty: 'Medium',
    description:
      'twoSum() finds the indices of the two numbers that add up to the target. ' +
      'The current brute-force solution is O(n²). Optimize it to a single pass ' +
      'using a hash map so it runs in O(n) time.',
    examples: [
      { label: 'twoSum([2, 7, 11, 15], 9)', value: '[0, 1]' },
      { label: 'twoSum([3, 2, 4], 6)', value: '[1, 2]' },
      { label: 'twoSum([3, 3], 6)', value: '[0, 1]' },
    ],
    topics: ['arrays', 'hashmap', 'time-complexity', 'two-sum'],
    guide: {
      whatToCheck: [
        'Replaces the nested loop with a single pass: store each value\'s index in a map, then look up complement = target - nums[i].',
        'Checks the map BEFORE inserting the current element (handles the [3,3] case without using the same index twice).',
        'Achieves O(n) time and O(n) space — can articulate the trade-off.',
        'Returns indices (not values) as specified.',
      ],
      commonMistakes: [
        'Pre-populating the entire map before the loop — breaks the [3,3] case if they look up before inserting.',
        'Returning values instead of indices.',
        'Not considering that the same element cannot be used twice.',
        'Using indexOf() inside the loop — still O(n) per call → O(n²) overall.',
      ],
      crossQuestions: [
        'Why does the order of "check map → insert" matter? Show a case where reversing it gives the wrong answer.',
        'How would you extend this to three-sum (three numbers that add to target)?',
        'What if the array is sorted — could you solve it in O(1) extra space?',
        'What if there are multiple valid pairs? How would you return all of them?',
      ],
    },
    starter: {
      javascript: `// SLOW: O(n^2) brute force. Optimize to O(n) using a Map.
function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) return [i, j];
    }
  }
  return [];
}

console.log(twoSum([2, 7, 11, 15], 9)); // expected [0, 1]
console.log(twoSum([3, 2, 4], 6));      // expected [1, 2]
console.log(twoSum([3, 3], 6));         // expected [0, 1]
`,
      python: `# SLOW: O(n^2) brute force. Optimize to O(n) using a dict.
def two_sum(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []

print(two_sum([2, 7, 11, 15], 9))  # expected [0, 1]
print(two_sum([3, 2, 4], 6))       # expected [1, 2]
print(two_sum([3, 3], 6))          # expected [0, 1]
`,
    },
  },

  {
    id: 'secure-sql-injection',
    title: 'Secure: SQL injection',
    category: 'Secure',
    difficulty: 'Hard',
    description:
      'getUserByEmail() builds a SQL query by interpolating a user-supplied email ' +
      'directly into the query string. This allows SQL injection — an attacker can ' +
      'pass a crafted email to dump the entire users table or bypass authentication. ' +
      'Fix it using parameterised queries and add basic input validation.',
    examples: [
      { label: 'A normal email: "alice@example.com"', value: 'runs a safe parameterised query' },
      {
        label: '" OR 1=1 --',
        value: 'must be rejected or safely parameterised — never executed as SQL',
      },
    ],
    topics: ['security', 'sql-injection', 'input-validation', 'database'],
    guide: {
      whatToCheck: [
        'Names the vulnerability: SQL injection — user input is interpolated directly into the query string.',
        'Replaces string interpolation with parameterised queries / prepared statements (? or $1 placeholders).',
        'Adds an allowlist/format validation for the email (e.g. basic regex or email library) as a defence-in-depth layer.',
        'Understands that parameterisation is the PRIMARY fix; input validation is secondary — not the other way around.',
        'Notes that an ORM (Sequelize, Prisma, SQLAlchemy) also prevents injection when used correctly.',
      ],
      commonMistakes: [
        'Escaping quotes with a replace/regex — incomplete, bypass-able, and the wrong mental model.',
        'Treating input validation alone as sufficient — a valid-looking email can still contain SQL fragments.',
        'Not realising that the driver\'s "escape" utility only helps if used correctly with the right API.',
        'Confusing parameterised queries with stored procedures — both help, but differently.',
      ],
      crossQuestions: [
        'Explain exactly why parameterised queries prevent injection — what does the DB driver do differently?',
        'Give two more examples of SQL payloads this code is vulnerable to beyond OR 1=1.',
        'What is second-order SQL injection, and would your fix prevent it?',
        'How would a WAF (web application firewall) fare against SQL injection vs. parameterised queries?',
      ],
    },
    starter: {
      javascript: `// SECURITY FLAW: user email is interpolated directly into SQL.
// An attacker can pass  ' OR '1'='1  to dump all users, or worse.
// Fix it with parameterised queries and add input validation.

// Simulated DB driver (do NOT change this stub).
const db = {
  query(sql, params) {
    console.log('SQL:', sql);
    console.log('Params:', params ?? '(none — direct interpolation!)');
  }
};

function getUserByEmail(email) {
  // UNSAFE: direct interpolation
  db.query(\`SELECT * FROM users WHERE email = '\${email}'\`);
}

getUserByEmail("alice@example.com");
getUserByEmail("' OR '1'='1");  // should NOT expose all users
`,
      python: `# SECURITY FLAW: user email is interpolated directly into SQL.
# An attacker can pass  ' OR '1'='1  to dump all users, or worse.
# Fix it with parameterised queries and add input validation.

# Simulated DB cursor (do NOT change this stub).
class FakeCursor:
    def execute(self, sql, params=None):
        print("SQL:", sql)
        print("Params:", params if params else "(none — direct interpolation!)")

cursor = FakeCursor()

def get_user_by_email(email):
    # UNSAFE: direct interpolation
    cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")

get_user_by_email("alice@example.com")
get_user_by_email("' OR '1'='1")  # should NOT expose all users
`,
    },
  },

  // ── DSA CLASSIC PROBLEMS ─────────────────────────────────────────────────────

  // ── EASY ────────────────────────────────────────────────────────────────────

  {
    id: 'solve-reverse-string',
    title: 'Reverse a String',
    category: 'Solve',
    difficulty: 'Easy',
    description:
      'Given a string, return it reversed. Do not use a built-in reverse method — ' +
      'implement the reversal yourself using a loop or two-pointer technique.',
    examples: [
      { label: 'reverse("hello")', value: '"olleh"' },
      { label: 'reverse("abcde")', value: '"edcba"' },
    ],
    topics: ['strings', 'two-pointers', 'in-place'],
    guide: {
      whatToCheck: [
        'Uses a two-pointer swap (left, right converging) or builds a new string in one pass — O(n) time.',
        'Handles edge cases: empty string, single character, palindrome.',
        'Does not use language built-ins like Array.prototype.reverse() or Python slicing [::-1] unless asked.',
      ],
      commonMistakes: [
        'Off-by-one in the loop boundary when swapping in-place.',
        'Mutating a string directly in a language where strings are immutable (Java, Python) without converting to an array/list first.',
        'Reversing bytes instead of characters, which breaks multi-byte Unicode code-points.',
      ],
      crossQuestions: [
        'How does your approach handle Unicode characters that are more than one byte (e.g. emoji)?',
        'Can you do it in O(1) extra space? What does that require?',
        'What is the time complexity of joining a list of characters back into a string in Python?',
      ],
    },
    starter: {
      javascript: `// Implement reverse() WITHOUT using .reverse().
function reverse(s) {
  // TODO: use a two-pointer or loop approach
}

console.log(reverse("hello")); // expected "olleh"
console.log(reverse("abcde")); // expected "edcba"
`,
      python: `# Implement reverse() WITHOUT using slicing [::-1] or reversed().
def reverse(s):
    # TODO: use a two-pointer or loop approach
    pass

print(reverse("hello"))  # expected "olleh"
print(reverse("abcde"))  # expected "edcba"
`,
    },
  },

  {
    id: 'solve-valid-parentheses',
    title: 'Valid Parentheses',
    category: 'Solve',
    difficulty: 'Easy',
    description:
      'Given a string containing only the characters ( ) [ ] { }, return true if the ' +
      'brackets are valid: every opening bracket has a corresponding closing bracket in ' +
      'the correct order, and no bracket is left unmatched.',
    examples: [
      { label: 'isValid("()[]{}")', value: 'true' },
      { label: 'isValid("([)]")', value: 'false' },
      { label: 'isValid("{[]}")', value: 'true' },
    ],
    topics: ['strings', 'stack', 'bracket-matching'],
    guide: {
      whatToCheck: [
        'Uses a stack: push on open bracket, pop on close bracket and verify the popped char is the matching opener.',
        'Returns false if the stack is non-empty at the end (unmatched opens) or if a pop reveals a mismatch.',
        'Handles empty string (should return true) and single-character strings.',
      ],
      commonMistakes: [
        'Forgetting to check whether the stack is empty before popping — causes an index/runtime error.',
        'Counting opens and closes without tracking order — passes simple cases but fails "([)]".',
        'Not returning false when the stack is non-empty at the end.',
      ],
      crossQuestions: [
        'What is the time and space complexity of your stack approach?',
        'How would you extend this to also validate angle brackets < > ?',
        'Could you solve this without a stack? What would the trade-off be?',
      ],
    },
    starter: {
      javascript: `// Return true if every bracket is correctly matched and ordered.
function isValid(s) {
  // TODO: use a stack
}

console.log(isValid("()[]{}")); // expected true
console.log(isValid("([)]"));   // expected false
console.log(isValid("{[]}"));   // expected true
`,
      python: `# Return True if every bracket is correctly matched and ordered.
def is_valid(s):
    # TODO: use a stack (list in Python)
    pass

print(is_valid("()[]{}"))  # expected True
print(is_valid("([)]"))    # expected False
print(is_valid("{[]}"))    # expected True
`,
    },
  },

  {
    id: 'solve-binary-search',
    title: 'Binary Search',
    category: 'Solve',
    difficulty: 'Easy',
    description:
      'Given a sorted array of distinct integers and a target, return the index of ' +
      'the target using binary search. Return -1 if the target is not present. ' +
      'Your solution must run in O(log n) time.',
    examples: [
      { label: 'binarySearch([1, 3, 5, 7, 9], 7)', value: '3' },
      { label: 'binarySearch([1, 3, 5, 7, 9], 6)', value: '-1' },
    ],
    topics: ['arrays', 'binary-search', 'divide-and-conquer'],
    guide: {
      whatToCheck: [
        'Maintains left/right pointers and computes mid = Math.floor((left + right) / 2) — avoids integer overflow with the safe form.',
        'Correctly narrows the window: left = mid + 1 or right = mid - 1 (never includes mid again).',
        'Returns -1 when left > right (target not found).',
      ],
      commonMistakes: [
        'Using mid = (left + right) / 2 without flooring — can lead to infinite loops in some languages.',
        'Setting right = mid (not mid - 1) causing an infinite loop when the target is between two adjacent elements.',
        'Off-by-one: using right < nums.length - 1 initially.',
      ],
      crossQuestions: [
        'Why is mid = left + Math.floor((right - left) / 2) safer than (left + right) / 2 in languages with fixed-size integers?',
        'How would you adapt binary search to find the first occurrence of a target in an array with duplicates?',
        'What is the recurrence relation for binary search, and how does it resolve to O(log n)?',
      ],
    },
    starter: {
      javascript: `// Implement binary search — must be O(log n), no indexOf/includes.
function binarySearch(nums, target) {
  // TODO: two-pointer binary search
}

console.log(binarySearch([1, 3, 5, 7, 9], 7)); // expected 3
console.log(binarySearch([1, 3, 5, 7, 9], 6)); // expected -1
`,
      python: `# Implement binary search — must be O(log n), no 'in' operator or bisect.
def binary_search(nums, target):
    # TODO: two-pointer binary search
    pass

print(binary_search([1, 3, 5, 7, 9], 7))  # expected 3
print(binary_search([1, 3, 5, 7, 9], 6))  # expected -1
`,
    },
  },

  {
    id: 'solve-contains-duplicate',
    title: 'Contains Duplicate',
    category: 'Solve',
    difficulty: 'Easy',
    description:
      'Given an array of integers, return true if any value appears more than once, ' +
      'or false if every element is distinct. Aim for O(n) time.',
    examples: [
      { label: 'containsDuplicate([1, 2, 3, 1])', value: 'true' },
      { label: 'containsDuplicate([1, 2, 3, 4])', value: 'false' },
    ],
    topics: ['arrays', 'hashset', 'time-complexity'],
    guide: {
      whatToCheck: [
        'Uses a Set to track seen elements — single pass, O(n) time and O(n) space.',
        'Returns true as soon as the first duplicate is encountered (early exit).',
        'Recognises the sorting-based alternative (O(n log n) time, O(1) space) and can compare the trade-offs.',
      ],
      commonMistakes: [
        'Nested loop approach — correct but O(n²) and does not meet the intent.',
        'Using Set.size === array.length after the fact — correct but misses the opportunity to exit early.',
        'Not considering the empty array edge case (should return false).',
      ],
      crossQuestions: [
        'What are the time and space complexities of the Set approach vs. the sort approach?',
        'How would you solve this if extra memory was forbidden (O(1) space)?',
        'How would you adapt this to return all duplicate values, not just a boolean?',
      ],
    },
    starter: {
      javascript: `// Return true if any number appears more than once.
function containsDuplicate(nums) {
  // TODO: use a Set for O(n) time
}

console.log(containsDuplicate([1, 2, 3, 1])); // expected true
console.log(containsDuplicate([1, 2, 3, 4])); // expected false
`,
      python: `# Return True if any number appears more than once.
def contains_duplicate(nums):
    # TODO: use a set for O(n) time
    pass

print(contains_duplicate([1, 2, 3, 1]))  # expected True
print(contains_duplicate([1, 2, 3, 4]))  # expected False
`,
    },
  },

  {
    id: 'solve-fizzbuzz',
    title: 'FizzBuzz',
    category: 'Solve',
    difficulty: 'Easy',
    description:
      'Write a function that takes a positive integer n and returns a list of strings ' +
      'from 1 to n: "Fizz" for multiples of 3, "Buzz" for multiples of 5, "FizzBuzz" ' +
      'for multiples of both, and the number as a string otherwise.',
    examples: [
      { label: 'fizzBuzz(5)', value: '["1","2","Fizz","4","Buzz"]' },
      { label: 'fizzBuzz(15)[14]', value: '"FizzBuzz"' },
    ],
    topics: ['math', 'strings', 'conditionals', 'modulo'],
    guide: {
      whatToCheck: [
        'Checks divisibility by 15 (or both 3 and 5) BEFORE checking 3 or 5 alone — order matters.',
        'Returns strings (not numbers) for all entries including the number-only positions.',
        'Handles n = 1 and n = 0 gracefully.',
      ],
      commonMistakes: [
        'Checking % 3 before % 15 — "FizzBuzz" entries become just "Fizz".',
        'Returning a number type for non-Fizz/Buzz entries instead of a string.',
        'Using a concatenation approach (build "Fizz" + "Buzz") but forgetting to fall back to the number string when the concatenated result is empty.',
      ],
      crossQuestions: [
        'How does the string-concatenation approach (append "Fizz" if % 3, append "Buzz" if % 5) compare to the if/else-if chain?',
        'How would you extend this to support arbitrary additional rules (e.g. multiples of 7 → "Jazz")?',
        'What is the time and space complexity of your solution?',
      ],
    },
    starter: {
      javascript: `// Return an array of strings from 1 to n following the FizzBuzz rules.
function fizzBuzz(n) {
  // TODO
}

console.log(fizzBuzz(5));     // expected ["1","2","Fizz","4","Buzz"]
console.log(fizzBuzz(15)[14]); // expected "FizzBuzz"
`,
      python: `# Return a list of strings from 1 to n following the FizzBuzz rules.
def fizz_buzz(n):
    # TODO
    pass

print(fizz_buzz(5))       # expected ['1', '2', 'Fizz', '4', 'Buzz']
print(fizz_buzz(15)[14])  # expected 'FizzBuzz'
`,
    },
  },

  // ── MEDIUM ───────────────────────────────────────────────────────────────────

  {
    id: 'solve-maximum-subarray',
    title: 'Maximum Subarray (Kadane\'s)',
    category: 'Solve',
    difficulty: 'Medium',
    description:
      'Given an integer array, find the contiguous subarray with the largest sum and ' +
      'return that sum. The array may contain negative numbers. Your solution should ' +
      'run in O(n) time using Kadane\'s algorithm.',
    examples: [
      { label: 'maxSubArray([-2,1,-3,4,-1,2,1,-5,4])', value: '6 (subarray [4,-1,2,1])' },
      { label: 'maxSubArray([1])', value: '1' },
      { label: 'maxSubArray([-1,-2,-3])', value: '-1' },
    ],
    topics: ['arrays', 'dynamic-programming', 'kadane', 'subarray'],
    guide: {
      whatToCheck: [
        'Correctly implements Kadane\'s: currentMax = max(num, currentMax + num); globalMax = max(globalMax, currentMax).',
        'Initialises both currentMax and globalMax to nums[0] (not 0) so all-negative arrays work.',
        'Returns the correct sum, not the subarray itself (unless asked to extend).',
      ],
      commonMistakes: [
        'Initialising max to 0 — fails when all numbers are negative.',
        'Resetting currentMax to 0 instead of to the current element when currentMax + num < num.',
        'Confusing "maximum subarray sum" with "maximum element".',
      ],
      crossQuestions: [
        'Walk through Kadane\'s on [-2,1,-3,4,-1,2,1,-5,4] step by step.',
        'How would you modify the algorithm to also return the start and end indices of the subarray?',
        'How is Kadane\'s algorithm an example of dynamic programming?',
      ],
    },
    starter: {
      javascript: `// Find the contiguous subarray with the largest sum (Kadane's algorithm).
function maxSubArray(nums) {
  // TODO: O(n) — initialise from nums[0], not 0
}

console.log(maxSubArray([-2,1,-3,4,-1,2,1,-5,4])); // expected 6
console.log(maxSubArray([1]));                      // expected 1
console.log(maxSubArray([-1,-2,-3]));               // expected -1
`,
      python: `# Find the contiguous subarray with the largest sum (Kadane's algorithm).
def max_sub_array(nums):
    # TODO: O(n) — initialise from nums[0], not 0
    pass

print(max_sub_array([-2,1,-3,4,-1,2,1,-5,4]))  # expected 6
print(max_sub_array([1]))                       # expected 1
print(max_sub_array([-1,-2,-3]))                # expected -1
`,
    },
  },

  {
    id: 'solve-group-anagrams',
    title: 'Group Anagrams',
    category: 'Solve',
    difficulty: 'Medium',
    description:
      'Given an array of strings, group the strings that are anagrams of each other. ' +
      'Return a list of groups; order within groups and order of groups do not matter.',
    examples: [
      {
        label: 'groupAnagrams(["eat","tea","tan","ate","nat","bat"])',
        value: '[["eat","tea","ate"],["tan","nat"],["bat"]]',
      },
      { label: 'groupAnagrams([""])', value: '[[""]]' },
    ],
    topics: ['strings', 'hashmap', 'sorting', 'anagram'],
    guide: {
      whatToCheck: [
        'Uses a hash map keyed by the sorted characters of each word — O(n · k log k) time where k is max word length.',
        'Correctly groups all anagrams under the same key.',
        'Handles single-letter words, empty strings, and groups of size 1.',
      ],
      commonMistakes: [
        'Sorting the entire input array instead of sorting each word\'s characters.',
        'Using a character-frequency tuple as the key (valid but more complex than sorted string).',
        'Nested loop comparison — O(n²) and does not scale.',
      ],
      crossQuestions: [
        'What is the time complexity? Can you do better than O(k log k) per word?',
        'How would you use a character-count array (length 26) as the map key instead of sorting?',
        'How would memory usage change if the input contains very long strings?',
      ],
    },
    starter: {
      javascript: `// Group strings that are anagrams of each other.
function groupAnagrams(strs) {
  // TODO: use a Map keyed by sorted characters
}

console.log(groupAnagrams(["eat","tea","tan","ate","nat","bat"]));
// expected [["eat","tea","ate"],["tan","nat"],["bat"]] (any order)
console.log(groupAnagrams([""]));
// expected [[""]]
`,
      python: `# Group strings that are anagrams of each other.
def group_anagrams(strs):
    # TODO: use a dict keyed by sorted characters
    pass

print(group_anagrams(["eat","tea","tan","ate","nat","bat"]))
# expected [['eat','tea','ate'],['tan','nat'],['bat']] (any order)
print(group_anagrams([""]))
# expected [['']]
`,
    },
  },

  {
    id: 'solve-longest-substring-no-repeat',
    title: 'Longest Substring Without Repeating Characters',
    category: 'Solve',
    difficulty: 'Medium',
    description:
      'Given a string, return the length of the longest substring that contains no ' +
      'repeating characters. Your solution should run in O(n) time using a sliding window.',
    examples: [
      { label: 'lengthOfLongestSubstring("abcabcbb")', value: '3 ("abc")' },
      { label: 'lengthOfLongestSubstring("bbbbb")', value: '1 ("b")' },
      { label: 'lengthOfLongestSubstring("pwwkew")', value: '3 ("wke")' },
    ],
    topics: ['strings', 'sliding-window', 'hashmap', 'two-pointers'],
    guide: {
      whatToCheck: [
        'Uses a sliding window (left/right pointers) + a Set or Map to track characters in the current window.',
        'Advances left past the duplicate when a repeated character is found, updating the Set/Map accordingly.',
        'Updates the max length after each step, achieving O(n) time.',
      ],
      commonMistakes: [
        'Not moving the left pointer far enough — must move it to one past the previous occurrence of the duplicate.',
        'Using a Set without storing indices — forces a slow shrink loop instead of a direct jump.',
        'Not resetting or updating the data structure when shrinking the window.',
      ],
      crossQuestions: [
        'Why is a Map (character → last-seen index) more efficient than a Set for advancing the left pointer?',
        'How would you modify this to return the actual substring, not just its length?',
        'What changes if the input can contain Unicode characters beyond ASCII?',
      ],
    },
    starter: {
      javascript: `// Return the length of the longest substring with all unique characters.
function lengthOfLongestSubstring(s) {
  // TODO: sliding window + Set/Map
}

console.log(lengthOfLongestSubstring("abcabcbb")); // expected 3
console.log(lengthOfLongestSubstring("bbbbb"));    // expected 1
console.log(lengthOfLongestSubstring("pwwkew"));   // expected 3
`,
      python: `# Return the length of the longest substring with all unique characters.
def length_of_longest_substring(s):
    # TODO: sliding window + set/dict
    pass

print(length_of_longest_substring("abcabcbb"))  # expected 3
print(length_of_longest_substring("bbbbb"))     # expected 1
print(length_of_longest_substring("pwwkew"))    # expected 3
`,
    },
  },

  {
    id: 'solve-number-of-islands',
    title: 'Number of Islands',
    category: 'Solve',
    difficulty: 'Medium',
    description:
      'Given an m×n grid of "1" (land) and "0" (water) characters, count the number ' +
      'of islands. An island is a group of adjacent land cells connected horizontally ' +
      'or vertically. Use DFS or BFS to mark visited cells.',
    examples: [
      {
        label: 'Grid with one large island',
        value: 'numIslands([["1","1","1"],["0","1","0"],["0","0","0"]]) → 1',
      },
      {
        label: 'Grid with three separate islands',
        value: 'numIslands([["1","1","0"],["0","0","0"],["0","0","1"]]) → 2',
      },
    ],
    topics: ['graphs', 'dfs', 'bfs', 'matrix', 'flood-fill'],
    guide: {
      whatToCheck: [
        'Iterates every cell; when a "1" is found, increments count and runs DFS/BFS to mark the whole island as visited (flip to "0" or use a visited set).',
        'Correctly handles grid boundaries without index-out-of-bounds errors.',
        'Time complexity O(m·n), space O(m·n) worst case for the DFS call stack.',
      ],
      commonMistakes: [
        'Not marking cells as visited before recursing, causing infinite loops on cycles.',
        'Only checking right/down neighbors instead of all four directions.',
        'Using a separate visited matrix but forgetting to check it before pushing to the BFS queue.',
      ],
      crossQuestions: [
        'When would you prefer BFS over DFS here (or vice versa)?',
        'What is the worst-case stack depth for the recursive DFS? How would you avoid a stack overflow?',
        'How would you adapt this to also return the size (number of cells) of the largest island?',
      ],
    },
    starter: {
      javascript: `// Count islands in an m×n grid of "1" (land) and "0" (water).
function numIslands(grid) {
  // TODO: DFS or BFS — mark visited land as "0"
}

const grid1 = [["1","1","1"],["0","1","0"],["0","0","0"]];
console.log(numIslands(grid1)); // expected 1

const grid2 = [["1","1","0"],["0","0","0"],["0","0","1"]];
console.log(numIslands(grid2)); // expected 2
`,
      python: `# Count islands in an m×n grid of '1' (land) and '0' (water).
def num_islands(grid):
    # TODO: DFS or BFS — mark visited land as '0'
    pass

grid1 = [["1","1","1"],["0","1","0"],["0","0","0"]]
print(num_islands(grid1))  # expected 1

grid2 = [["1","1","0"],["0","0","0"],["0","0","1"]]
print(num_islands(grid2))  # expected 2
`,
    },
  },

  {
    id: 'solve-coin-change',
    title: 'Coin Change',
    category: 'Solve',
    difficulty: 'Medium',
    description:
      'Given an array of coin denominations and a target amount, return the minimum ' +
      'number of coins needed to make up that amount. Return -1 if it is impossible. ' +
      'You have an unlimited supply of each coin denomination.',
    examples: [
      { label: 'coinChange([1,5,10,25], 36)', value: '3 (25+10+1)' },
      { label: 'coinChange([2], 3)', value: '-1 (impossible)' },
      { label: 'coinChange([1], 0)', value: '0' },
    ],
    topics: ['dynamic-programming', 'arrays', 'bottom-up-dp', 'greedy'],
    guide: {
      whatToCheck: [
        'Uses bottom-up DP: dp[0] = 0, dp[i] = min(dp[i - coin] + 1) for each coin ≤ i.',
        'Initialises dp array to amount + 1 (or Infinity) as a sentinel; returns -1 if dp[amount] is still a sentinel.',
        'Correctly handles amount = 0 (return 0) and impossible cases.',
      ],
      commonMistakes: [
        'Using a greedy approach (always pick the largest coin first) — fails for non-canonical coin sets like [1,3,4] with amount 6.',
        'Initialising dp to 0 instead of Infinity — corrupts the min operation.',
        'Not checking that coin ≤ i before using dp[i - coin].',
      ],
      crossQuestions: [
        'Why does greedy fail for coin sets like [1,3,4] with target 6? Walk through it.',
        'What is the time and space complexity of the DP solution?',
        'How would you modify this to count the total number of ways to make the amount (combination sum)?',
      ],
    },
    starter: {
      javascript: `// Return the fewest coins needed to reach amount, or -1 if impossible.
function coinChange(coins, amount) {
  // TODO: bottom-up DP
}

console.log(coinChange([1,5,10,25], 36)); // expected 3
console.log(coinChange([2], 3));          // expected -1
console.log(coinChange([1], 0));          // expected 0
`,
      python: `# Return the fewest coins needed to reach amount, or -1 if impossible.
def coin_change(coins, amount):
    # TODO: bottom-up DP
    pass

print(coin_change([1,5,10,25], 36))  # expected 3
print(coin_change([2], 3))           # expected -1
print(coin_change([1], 0))           # expected 0
`,
    },
  },

  {
    id: 'solve-product-except-self',
    title: 'Product of Array Except Self',
    category: 'Solve',
    difficulty: 'Medium',
    description:
      'Given an integer array, return an array where output[i] is the product of ' +
      'every element in the input except nums[i]. You must not use division and must ' +
      'run in O(n) time.',
    examples: [
      { label: 'productExceptSelf([1,2,3,4])', value: '[24,12,8,6]' },
      { label: 'productExceptSelf([-1,1,0,-3,3])', value: '[0,0,9,0,0]' },
    ],
    topics: ['arrays', 'prefix-product', 'suffix-product', 'time-complexity'],
    guide: {
      whatToCheck: [
        'Builds a prefix-product array (left pass) and multiplies by a running suffix product (right pass) — O(n) time, O(1) extra space beyond the output.',
        'Does NOT use division (would break on zeros).',
        'Correctly handles zeros in the input array.',
      ],
      commonMistakes: [
        'Dividing the total product by each element — breaks when any element is 0.',
        'Using two separate O(n) arrays for prefix and suffix but failing to combine them correctly.',
        'Off-by-one: prefix[i] should be the product of all elements strictly before index i.',
      ],
      crossQuestions: [
        'Why does division fail when the array contains a zero?',
        'How does the two-pass (prefix then suffix) approach achieve O(1) extra space?',
        'How would you handle two zeros in the input?',
      ],
    },
    starter: {
      javascript: `// Return output[i] = product of all elements except nums[i]. No division.
function productExceptSelf(nums) {
  // TODO: prefix-product left pass, then suffix-product right pass
}

console.log(productExceptSelf([1,2,3,4]));       // expected [24,12,8,6]
console.log(productExceptSelf([-1,1,0,-3,3]));   // expected [0,0,9,0,0]
`,
      python: `# Return output[i] = product of all elements except nums[i]. No division.
def product_except_self(nums):
    # TODO: prefix-product left pass, then suffix-product right pass
    pass

print(product_except_self([1,2,3,4]))       # expected [24,12,8,6]
print(product_except_self([-1,1,0,-3,3]))   # expected [0,0,9,0,0]
`,
    },
  },

  // ── HARD ─────────────────────────────────────────────────────────────────────

  {
    id: 'solve-trapping-rain-water',
    title: 'Trapping Rain Water',
    category: 'Solve',
    difficulty: 'Hard',
    description:
      'Given an array of non-negative integers representing the height of bars in a ' +
      'histogram, compute how much water can be trapped between the bars after raining. ' +
      'Aim for O(n) time and O(1) space using a two-pointer approach.',
    examples: [
      { label: 'trap([0,1,0,2,1,0,1,3,2,1,2,1])', value: '6' },
      { label: 'trap([4,2,0,3,2,5])', value: '9' },
    ],
    topics: ['arrays', 'two-pointers', 'stack', 'water-trapping'],
    guide: {
      whatToCheck: [
        'Two-pointer approach: maintain leftMax and rightMax; the pointer with the smaller max moves inward and contributes min(leftMax, rightMax) - height[i] water.',
        'Achieves O(n) time and O(1) space; can also explain the O(n) space prefix/suffix array approach.',
        'Correctly handles flat sections and bars of height 0.',
      ],
      commonMistakes: [
        'Using the O(n) prefix/suffix array approach but claiming it is O(1) space.',
        'Moving both pointers simultaneously instead of only the smaller-max pointer.',
        'Not initialising leftMax/rightMax correctly, causing negative water contributions.',
      ],
      crossQuestions: [
        'Explain why moving the smaller-max pointer is always correct — why can\'t you miss more water?',
        'What is the stack-based approach, and when might you prefer it over two pointers?',
        'How does this problem relate to the "container with most water" problem? What is different?',
      ],
    },
    starter: {
      javascript: `// Compute total water trapped. Aim for O(n) time, O(1) space.
function trap(height) {
  // TODO: two-pointer approach with leftMax and rightMax
}

console.log(trap([0,1,0,2,1,0,1,3,2,1,2,1])); // expected 6
console.log(trap([4,2,0,3,2,5]));              // expected 9
`,
      python: `# Compute total water trapped. Aim for O(n) time, O(1) space.
def trap(height):
    # TODO: two-pointer approach with left_max and right_max
    pass

print(trap([0,1,0,2,1,0,1,3,2,1,2,1]))  # expected 6
print(trap([4,2,0,3,2,5]))               # expected 9
`,
    },
  },

  {
    id: 'solve-lru-cache',
    title: 'LRU Cache',
    category: 'Solve',
    difficulty: 'Hard',
    description:
      'Design a data structure that implements a Least Recently Used (LRU) cache. ' +
      'It must support get(key) and put(key, value), both in O(1) average time. ' +
      'When the cache reaches capacity, evict the least recently used key before inserting.',
    examples: [
      {
        label: 'capacity=2: put(1,1), put(2,2), get(1)→1, put(3,3), get(2)→-1, get(3)→3',
        value: 'After put(3,3) key 2 is evicted (least recently used)',
      },
    ],
    topics: ['design', 'hashmap', 'doubly-linked-list', 'cache'],
    guide: {
      whatToCheck: [
        'Combines a HashMap (O(1) lookup) with a doubly-linked list (O(1) insertion/deletion at head and tail).',
        'On get: moves the node to the head (most recently used).',
        'On put: inserts at head; if capacity exceeded, removes the tail node and its map entry.',
        'Uses sentinel head/tail nodes to avoid null checks.',
      ],
      commonMistakes: [
        'Using only an array or a singly-linked list — O(n) removal.',
        'Forgetting to update the HashMap when a node is evicted.',
        'Moving the node on get but not on put (when key already exists).',
      ],
      crossQuestions: [
        'Why is a doubly-linked list necessary? Would a singly-linked list work? At what cost?',
        'Python\'s OrderedDict gives you this almost for free — explain how it works under the hood.',
        'How would you extend this to an LFU (Least Frequently Used) cache?',
      ],
    },
    starter: {
      javascript: `// Implement an LRU cache with O(1) get and put.
class LRUCache {
  constructor(capacity) {
    // TODO: HashMap + doubly-linked list
  }

  get(key) {
    // TODO: return value or -1; move to most-recently-used
  }

  put(key, value) {
    // TODO: insert/update; evict LRU if over capacity
  }
}

const cache = new LRUCache(2);
cache.put(1, 1); cache.put(2, 2);
console.log(cache.get(1));   // expected 1
cache.put(3, 3);             // evicts key 2
console.log(cache.get(2));   // expected -1
console.log(cache.get(3));   // expected 3
`,
      python: `# Implement an LRU cache with O(1) get and put.
class LRUCache:
    def __init__(self, capacity: int):
        # TODO: dict + doubly-linked list (or collections.OrderedDict)
        pass

    def get(self, key: int) -> int:
        # TODO: return value or -1; move to most-recently-used
        pass

    def put(self, key: int, value: int) -> None:
        # TODO: insert/update; evict LRU if over capacity
        pass

cache = LRUCache(2)
cache.put(1, 1); cache.put(2, 2)
print(cache.get(1))   # expected 1
cache.put(3, 3)       # evicts key 2
print(cache.get(2))   # expected -1
print(cache.get(3))   # expected 3
`,
    },
  },

  {
    id: 'solve-word-ladder',
    title: 'Word Ladder',
    category: 'Solve',
    difficulty: 'Hard',
    description:
      'Given a beginWord, an endWord, and a wordList, return the length of the ' +
      'shortest transformation sequence from beginWord to endWord where each step ' +
      'changes exactly one letter and every intermediate word must be in wordList. ' +
      'Return 0 if no such sequence exists. Use BFS for the shortest path.',
    examples: [
      {
        label: 'wordLadder("hit","cog",["hot","dot","dog","lot","log","cog"])',
        value: '5 (hit→hot→dot→dog→cog)',
      },
      {
        label: 'wordLadder("hit","cog",["hot","dot","dog","lot","log"])',
        value: '0 (endWord not in list)',
      },
    ],
    topics: ['graphs', 'bfs', 'strings', 'shortest-path'],
    guide: {
      whatToCheck: [
        'Uses BFS (not DFS) to guarantee the shortest path; each BFS level corresponds to one transformation.',
        'Converts wordList to a Set for O(1) membership checks; removes words as they are visited to avoid revisiting.',
        'Generates neighbors by trying every letter a-z at every position — O(26·L) per word where L is word length.',
      ],
      commonMistakes: [
        'Using DFS — finds a path but not necessarily the shortest.',
        'Not removing visited words from the set, leading to infinite loops or TLE.',
        'Forgetting to check whether endWord is in wordList before starting.',
      ],
      crossQuestions: [
        'Why does BFS guarantee the shortest transformation sequence here?',
        'What is the time complexity in terms of word count N and word length L?',
        'How would bidirectional BFS improve performance? When is it worth the added code complexity?',
      ],
    },
    starter: {
      javascript: `// Return shortest transformation chain length, or 0 if none exists.
function wordLadder(beginWord, endWord, wordList) {
  // TODO: BFS — try all single-letter swaps at each level
}

console.log(wordLadder("hit","cog",["hot","dot","dog","lot","log","cog"])); // expected 5
console.log(wordLadder("hit","cog",["hot","dot","dog","lot","log"]));       // expected 0
`,
      python: `# Return shortest transformation chain length, or 0 if none exists.
def word_ladder(begin_word, end_word, word_list):
    # TODO: BFS — try all single-letter swaps at each level
    pass

print(word_ladder("hit","cog",["hot","dot","dog","lot","log","cog"]))  # expected 5
print(word_ladder("hit","cog",["hot","dot","dog","lot","log"]))        # expected 0
`,
    },
  },
];

export const DEFAULT_PROBLEM_ID = PROBLEMS[0].id;

export function getProblem(id: string): Problem {
  return PROBLEMS.find((p) => p.id === id) ?? PROBLEMS[0];
}

/**
 * Starter code for a problem in a given language. Uses the problem's own buggy
 * starter when it has one (JS/Python for the built-ins), otherwise a generic
 * runnable template so Java/C/C++ still get a sensible starting point.
 */
export function starterFor(problem: Problem, language: SupportedLanguage): string {
  return problem.starter[language] ?? LANGUAGE_TEMPLATES[language];
}
