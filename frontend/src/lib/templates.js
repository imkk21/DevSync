// Starter templates for new workspaces, and the daily coding challenges.
// Files: [{ path, content, language }]; tests: [{ path, input, expected_output }].

export const TEMPLATES = [
  {
    id: 'web',
    label: 'Web page',
    description: 'HTML, CSS and JavaScript with a live preview',
    language: 'html',
    files: [
      {
        path: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My page</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main>
      <h1>Hello from DevSync</h1>
      <p>Edit the files and watch the preview update.</p>
      <button id="count">Clicked 0 times</button>
    </main>
    <script src="script.js"></script>
  </body>
</html>
`,
      },
      {
        path: 'style.css',
        language: 'css',
        content: `body {
  font-family: system-ui, sans-serif;
  margin: 0;
  display: grid;
  place-items: center;
  min-height: 100vh;
}

button {
  font: inherit;
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #d2d9d4;
  background: #08872b;
  color: white;
  cursor: pointer;
}
`,
      },
      {
        path: 'script.js',
        language: 'javascript',
        content: `const button = document.getElementById('count');
let clicks = 0;

button.addEventListener('click', () => {
  clicks += 1;
  button.textContent = \`Clicked \${clicks} \${clicks === 1 ? 'time' : 'times'}\`;
  console.log('clicks:', clicks);
});
`,
      },
    ],
  },
  {
    id: 'python-tests',
    label: 'Python with tests',
    description: 'Reads input, prints an answer, comes with test cases',
    language: 'python',
    files: [
      {
        path: 'main.py',
        language: 'python',
        content: `import sys

from helpers import parse_numbers


def main():
    numbers = parse_numbers(sys.stdin.read())
    print(sum(numbers))


if __name__ == "__main__":
    main()
`,
      },
      {
        path: 'helpers.py',
        language: 'python',
        content: `def parse_numbers(text):
    """Every whitespace-separated number in the input."""
    return [int(n) for n in text.split()]
`,
      },
    ],
    tests: [
      { path: 'main.py', input: '1 2 3', expected_output: '6' },
      { path: 'main.py', input: '10\n-4', expected_output: '6' },
    ],
  },
  {
    id: 'node-modules',
    label: 'Node.js modules',
    description: 'Two files that require each other',
    language: 'javascript',
    files: [
      {
        path: 'index.js',
        language: 'javascript',
        content: `const { average } = require('./lib/stats');

const scores = [72, 88, 95, 64];
console.log('Average score:', average(scores));
`,
      },
      {
        path: 'lib/stats.js',
        language: 'javascript',
        content: `function average(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

module.exports = { average };
`,
      },
    ],
  },
];

// ---------- Daily challenge ----------

const starter = {
  python: (fn, hint) => `import sys


def ${fn}(data):
    # ${hint}
    return ""


print(${fn}(sys.stdin.read()))
`,
  javascript: (fn, hint) => `const input = require('fs').readFileSync(0, 'utf8');

function ${fn}(data) {
  // ${hint}
  return '';
}

console.log(${fn}(input));
`,
};

function challenge(id, title, difficulty, description, fn, hint, tests) {
  return {
    id,
    title,
    difficulty,
    description,
    starter: { python: starter.python(fn, hint), javascript: starter.javascript(fn, hint) },
    tests: tests.map(([input, expected_output]) => ({ input, expected_output })),
  };
}

export const CHALLENGES = [
  challenge('reverse-words', 'Reverse the words', 'Easy',
    'Print the words of the input line in reverse order, separated by single spaces.',
    'reverse_words', 'data is one line of words', [['hello world', 'world hello'], ['one', 'one'], ['a  b   c', 'c b a']]),
  challenge('fizzbuzz', 'FizzBuzz', 'Easy',
    'Given n, print the numbers 1 to n, one per line. For multiples of 3 print Fizz, of 5 print Buzz, of both print FizzBuzz.',
    'fizzbuzz', 'data is a number n; return the lines joined with newlines', [['5', '1\n2\nFizz\n4\nBuzz'], ['15', '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz']]),
  challenge('digit-sum', 'Sum of digits', 'Easy',
    'Print the sum of the digits of a non-negative integer.',
    'digit_sum', 'data is a non-negative integer, possibly very long', [['1234', '10'], ['0', '0'], ['99999999999999999999', '180']]),
  challenge('palindrome', 'Palindrome', 'Easy',
    'Print yes if the line reads the same backwards (ignoring case, spaces and punctuation), otherwise no.',
    'is_palindrome', 'data is one line of text', [['Racecar', 'yes'], ['A man, a plan, a canal: Panama', 'yes'], ['DevSync', 'no']]),
  challenge('vowels', 'Count the vowels', 'Easy',
    'Print how many vowels (a, e, i, o, u, either case) the input contains.',
    'count_vowels', 'data is some text', [['Hello World', '3'], ['rhythm', '0'], ['AEIOU aeiou', '10']]),
  challenge('two-sum', 'Two sum', 'Medium',
    'The first line has numbers, the second a target. Print the 0-based indexes i j (i < j) of the first pair that adds up to the target, judged by smallest j then smallest i.',
    'two_sum', 'data has two lines: the numbers, then the target', [['2 7 11 15\n9', '0 1'], ['3 2 4\n6', '1 2'], ['1 5 1 5\n10', '1 3']]),
  challenge('anagram', 'Anagrams', 'Easy',
    'Given two lines, print yes if they are anagrams of each other (ignoring case and spaces), otherwise no.',
    'is_anagram', 'data has two lines of text', [['listen\nsilent', 'yes'], ['Dormitory\nDirty room', 'yes'], ['abc\nabd', 'no']]),
  challenge('fibonacci', 'Fibonacci', 'Easy',
    'Print the nth Fibonacci number, where F(0) = 0 and F(1) = 1.',
    'fibonacci', 'data is n (0 to 90)', [['0', '0'], ['10', '55'], ['90', '2880067194370816120']]),
  challenge('max-subarray', 'Largest sum', 'Medium',
    'Print the largest sum of any non-empty run of consecutive numbers.',
    'max_subarray', 'data is space-separated integers', [['-2 1 -3 4 -1 2 1 -5 4', '6'], ['-3 -1 -2', '-1'], ['5 4 -1 7 8', '23']]),
  challenge('brackets', 'Balanced brackets', 'Medium',
    'Print yes if every (, [ and { is closed in the right order, otherwise no.',
    'is_balanced', 'data is a line of brackets', [['([]{})', 'yes'], ['([)]', 'no'], ['((', 'no']]),
  challenge('rle', 'Run-length encoding', 'Easy',
    'Replace each run of the same character with the character and the run length.',
    'encode', 'data is one line of letters', [['aaabcc', 'a3b1c2'], ['x', 'x1'], ['zzzzzzzzzzzz', 'z12']]),
  challenge('second-largest', 'Second largest', 'Easy',
    'Print the second largest distinct number, or none if there isn\'t one.',
    'second_largest', 'data is space-separated integers', [['4 1 4 3', '3'], ['7 7 7', 'none'], ['-1 -5', '-5']]),
];

// Same challenge all day (local time), a new one each day
export function todaysChallenge(now = new Date()) {
  const day = Math.floor((now.getTime() - now.getTimezoneOffset() * 60_000) / 86_400_000);
  return CHALLENGES[day % CHALLENGES.length];
}

// The files and tests a challenge workspace starts with
export function challengeWorkspace(c, language) {
  const file = language === 'python' ? 'solution.py' : 'solution.js';
  return {
    name: `${c.title} (daily)`.slice(0, 50),
    description: c.description.slice(0, 200),
    default_language: language,
    files: [
      { path: 'README.md', language: 'markdown', content: `# ${c.title}\n\n**${c.difficulty}**\n\n${c.description}\n\nOpen the **Tests** tab under the editor and press **Run tests** to check your answer.\n` },
      { path: file, language, content: c.starter[language] },
    ],
    tests: c.tests.map((t) => ({ path: file, ...t })),
  };
}
