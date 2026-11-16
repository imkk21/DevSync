// Run: npm run check (in frontend/)
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { findMatches, replacementFor, resolvePath, zipFiles, toBase64, buildHtmlPreview, looksBinary } from './workspaceFiles.js';
import { CHALLENGES, todaysChallenge } from './templates.js';

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

// Daily challenges are complete
for (const c of CHALLENGES) {
  assert.ok(c.title && c.description && c.tests.length >= 2, c.id);
  for (const lang of ['python', 'javascript']) assert.ok(c.starter[lang], `${c.id} ${lang}`);
}
assert.equal(todaysChallenge(new Date('2026-01-01')).id, todaysChallenge(new Date('2026-01-01T23:00:00')).id);
console.log('ok  daily challenges are complete');

console.log('\nAll frontend checks passed');
