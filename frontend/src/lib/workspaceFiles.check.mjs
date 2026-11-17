// Run: npm run check (in frontend/)
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { findMatches, replacementFor, resolvePath, zipFiles, toBase64, buildHtmlPreview, looksBinary, enclosingBlock, definitions, callGraph } from './workspaceFiles.js';
import { CHALLENGES, todaysChallenge } from './templates.js';
import { parseBoard, boardEdits, applyEdits } from './board.js';
import { nextReview } from './flashcards.js';

// Search
const text = 'const a = 1;\nconst b = A + a;\n';
assert.deepEqual(findMatches(text, 'a').map((m) => [m.line, m.column]), [[1, 7], [2, 11], [2, 15]]);
assert.equal(findMatches(text, 'a', { caseSensitive: true }).length, 2);
assert.equal(findMatches(text, 'const', { wholeWord: true }).length, 2);
assert.equal(findMatches(text, 'cons', { wholeWord: true }).length, 0);
assert.equal(findMatches(text, '(', { regex: true }).error !== undefined, true);
assert.equal(findMatches(text, '^', { regex: true }).length, 0, 'empty matches are skipped, not looped on');
assert.equal(findMatches(text, '.', { regex: false }).length, 0);
assert.equal(findMatches(text, 'b')[0].preview, 'const b = A + a;');
const [m] = findMatches('foo(bar)', '(\\w+)\\((\\w+)\\)', { regex: true });
assert.equal(replacementFor(m, '(\\w+)\\((\\w+)\\)', '$2.$1()', { regex: true }), 'bar.foo()');
assert.equal(replacementFor(m, 'x', '$1', { regex: false }), '$1');
console.log('ok  search finds, filters and replaces');

// Paths
assert.equal(resolvePath('/src/app/index.html', '../style.css'), '/src/style.css');
assert.equal(resolvePath('/index.html', './js/app.js?v=2'), '/js/app.js');
assert.equal(resolvePath('/a/index.html', '/root.css'), '/root.css');
assert.equal(resolvePath('/index.html', 'https://cdn.example.com/x.js'), null);
console.log('ok  relative paths resolve like a browser');

// Zip
const zip = zipFiles({ '/main.py': 'print(1)\n', '/pkg/util.py': 'X = 1\n' });
const back = unzipSync(zip);
assert.deepEqual(Object.keys(back).sort(), ['main.py', 'pkg/util.py']);
assert.equal(strFromU8(back['pkg/util.py']), 'X = 1\n');
assert.equal(Buffer.from(toBase64(zip), 'base64').equals(Buffer.from(zip)), true);
assert.equal(looksBinary('abc\0def'), true);
console.log('ok  zips round-trip with folders');

// HTML preview inlines local CSS/JS, keeps external ones
const files = { '/css/site.css': 'body{color:red}', '/app.js': 'console.log("</script>")' };
const html = buildHtmlPreview('/index.html', '<html><head><link rel="stylesheet" href="css/site.css"><link rel="icon" href="x.ico"></head><body><script src="app.js"></script><script src="https://x.dev/a.js"></script></body></html>', (p) => files[p]);
assert.match(html, /<style>\nbody\{color:red\}\n<\/style>/);
assert.match(html, /<link rel="icon" href="x.ico">/);
assert.match(html, /console\.log\("<\\\/script>"\)/);
assert.match(html, /<script src="https:\/\/x.dev\/a.js"><\/script>/);
assert.match(html, /<head><script>\(function\(\)\{/, 'console bridge goes first in <head>');
console.log('ok  HTML preview inlines local files');

// Which function a line is in
const py = ['import os', '', 'class Greeter:', '    def greet(self, name):', '        if name:', '            return name', '', 'def main():', '    x = 1', '', 'print(1)'];
assert.equal(enclosingBlock(py, 5).name, 'greet');
assert.equal(enclosingBlock(py, 3).name, 'greet', 'the definition line itself');
assert.equal(enclosingBlock(py, 8).name, 'main');
assert.equal(enclosingBlock(py, 10), null, 'top-level code');
const js = ['function add(a, b) {', '  if (a) {', '    return a + b;', '  }', '}', '', 'const mul = (a, b) => {', '  return a * b;', '};', 'class Box {', '  open() {', '    this.x = 1;', '  }', '}'];
assert.equal(enclosingBlock(js, 2).name, 'add', 'if blocks are not functions');
assert.equal(enclosingBlock(js, 7).name, 'mul');
assert.equal(enclosingBlock(js, 11).name, 'open');
assert.equal(enclosingBlock(js, 5), null);
const java = ['public class Main {', '    public static int sum(int[] xs) {', '        int t = 0;', '        return t;', '    }', '}'];
assert.equal(enclosingBlock(java, 3).name, 'sum');
assert.equal(enclosingBlock(['fn main() {', '    let x = 1;', '}'], 1).name, 'main');
assert.equal(enclosingBlock(['func (s *Server) Start() error {', '	return nil', '}'], 1).name, 'Start');
assert.deepEqual(definitions(py).map((d) => d.name), ['Greeter', 'greet', 'main']);
console.log('ok  finds the function around a line');

// Call graph
const src = ['def load(path):', '    return parse(read(path))', '', 'def parse(text):', '    return text.split()', '', 'def main():', '    data = load("x")', '    print(len(data))'].join('\n');
const g = callGraph('f1', src, [{ name: 'read', fileId: 'f2', file: 'io.py', line: 0 }]);
assert.match(g.code, /n0\["load\(\)"\]/);
assert.ok(g.code.includes(' --> '), 'has edges');
const edgesOf = (code) => code.split('\n').filter((l) => l.includes('-->')).map((l) => l.trim());
const names = Object.fromEntries(Object.entries(g.targets).map(([id, t]) => [id, t]));
assert.equal(edgesOf(g.code).length, 3, 'load->parse, load->read, main->load');
assert.ok(g.code.includes('read() · io.py'), 'functions from other files are labelled');
assert.deepEqual(g.targets[Object.keys(g.targets).find((k) => k.startsWith('x'))], { fileId: 'f2', line: 1 });
assert.equal(names.n0.line, 1);
assert.equal(callGraph('f', 'x = 1').empty, true);
console.log('ok  call graph links functions to what they call');

// Whiteboard files
const r1 = { id: 'r1', type: 'rectangle', version: 1 };
const t1 = { id: 't1', type: 'text', version: 1 };
let board = applyEdits('', boardEdits('', [r1, t1]));
assert.deepEqual(parseBoard(board).map((e) => e.id).sort(), ['r1', 't1']);
board = applyEdits(board, boardEdits(board, [{ ...r1, version: 2, x: 5 }]));
assert.equal(board.split('\n').filter((l) => l.startsWith('r1\t')).length, 1, 'an update replaces its line');
assert.equal(parseBoard(board).find((e) => e.id === 'r1').x, 5);
const merged = `${board}r1\t${JSON.stringify({ ...r1, version: 9, x: 99 })}\nbroken\t{"id":\n`;
assert.equal(parseBoard(merged).find((e) => e.id === 'r1').x, 99, 'the newest version wins after a merge');
assert.equal(parseBoard(merged).length, 2, 'half-merged lines are skipped');
assert.equal(parseBoard(applyEdits('r1\t{"id":"r1","version":1}', boardEdits('r1\t{"id":"r1","version":1}', [t1]))).length, 2, 'works without a trailing newline');
console.log('ok  whiteboard files merge shape by shape');

// Flashcard scheduling
const now = Date.parse('2026-11-17T10:00:00Z');
let card = { interval_days: 0, ease: 2.5, reps: 0 };
const missed = nextReview(card, 'again', now);
assert.equal(Date.parse(missed.due_at) - now, 10 * 60_000, 'a missed card comes back in 10 minutes');
card = { ...card, ...nextReview(card, 'good', now) };
assert.equal(card.interval_days, 1);
card = { ...card, ...nextReview(card, 'good', now) };
assert.equal(card.interval_days, 3);
card = { ...card, ...nextReview(card, 'good', now) };
assert.equal(card.interval_days, 8, '3 days x ease 2.5, rounded');
const harder = nextReview(card, 'hard', now);
const easier = nextReview(card, 'easy', now);
assert.ok(harder.interval_days < easier.interval_days && harder.ease < easier.ease);
assert.equal(nextReview({ interval_days: 40, ease: 1.3, reps: 9 }, 'again', now).reps, 0);
assert.equal(nextReview({ interval_days: 1, ease: 1.3, reps: 5 }, 'hard', now).ease, 1.3, 'ease never drops below 1.3');
console.log('ok  flashcards come back later when you know them');

// Daily challenges are complete
for (const c of CHALLENGES) {
  assert.ok(c.title && c.description && c.tests.length >= 2, c.id);
  for (const lang of ['python', 'javascript']) assert.ok(c.starter[lang], `${c.id} ${lang}`);
}
assert.equal(todaysChallenge(new Date('2026-01-01')).id, todaysChallenge(new Date('2026-01-01T23:00:00')).id);
console.log('ok  daily challenges are complete');

console.log('\nAll frontend checks passed');
