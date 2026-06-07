// Supported languages for the editor + runner, in one place. The ids are valid
// Monaco language ids, so they're used directly by the editor for highlighting.

import type { SupportedLanguage } from '@/src/features/room/liveblocks.config';

export const LANGUAGES: { id: SupportedLanguage; label: string }[] = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
];

export function languageLabel(id: SupportedLanguage): string {
  return LANGUAGES.find((l) => l.id === id)?.label ?? id;
}

// Generic, runnable starter for each language — used by the solo pad and as the
// fallback for problems that don't ship a language-specific (buggy) starter.
export const LANGUAGE_TEMPLATES: Record<SupportedLanguage, string> = {
  javascript: `// Write some JavaScript and hit Run.
function greet(name) {
  console.log("Hello, " + name + "!");
  return name.length;
}

greet("world");`,
  python: `# Write some Python and hit Run.
def greet(name):
    print(f"Hello, {name}!")
    return len(name)

greet("world")`,
  java: `// Write some Java and hit Run. Keep the public class named "Main".
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
    }
}`,
  c: `// Write some C and hit Run.
#include <stdio.h>

int main(void) {
    printf("Hello, world!\\n");
    return 0;
}`,
  cpp: `// Write some C++ and hit Run.
#include <iostream>

int main() {
    std::cout << "Hello, world!" << std::endl;
    return 0;
}`,
};
