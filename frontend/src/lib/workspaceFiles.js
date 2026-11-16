// Pure helpers over the workspace's files: search, zip, path resolution, HTML preview.
// No Vite or React imports, so `npm run check` can test them under Node.
import { zipSync, strToU8 } from 'fflate';

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every match of `query` in `text`: [{ index, length, line, column, preview }].
// Returns { error } for an invalid regular expression.
export function findMatches(text, query, { caseSensitive = false, regex = false, wholeWord = false, limit = 1000 } = {}) {
  if (!query) return [];
  let re;
  try {
    const source = regex ? query : escapeRegExp(query);
    re = new RegExp(wholeWord ? `\\b(?:${source})\\b` : source, caseSensitive ? 'g' : 'gi');
  } catch (err) {
    return { error: err.message };
  }
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1);

  const out = [];
  let line = 0;
  for (let m = re.exec(text); m && out.length < limit; m = re.exec(text)) {
    if (m[0].length === 0) {
      re.lastIndex++; // empty matches (e.g. /^/) would loop forever
      continue;
    }
    while (line + 1 < lineStarts.length && lineStarts[line + 1] <= m.index) line++;
    const start = lineStarts[line];
    const end = text.indexOf('\n', start);
    out.push({
      index: m.index,
      length: m[0].length,
      text: m[0],
      line: line + 1,
      column: m.index - start + 1,
      preview: text.slice(start, end === -1 ? undefined : end),
    });
  }
  return out;
}

// What a match becomes; with regex on, $1 etc. refer to its groups
export function replacementFor(match, query, replace, options) {
  if (!options.regex) return replace;
  const re = new RegExp(options.wholeWord ? `\\b(?:${query})\\b` : query, options.caseSensitive ? '' : 'i');
  return match.text.replace(re, replace);
}

// "/src/app/index.html" + "../style.css" -> "/src/style.css"
export function resolvePath(fromFile, href) {
  if (/^[a-z]+:|^\/\//i.test(href)) return null; // external URL
  const clean = href.split(/[?#]/)[0];
  const parts = clean.startsWith('/') ? [] : fromFile.split('/').slice(1, -1);
  for (const part of clean.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return `/${parts.join('/')}`;
}

// A zip of the files: { "/path": content }. Folders come from the paths.
export function zipFiles(byPath) {
  const entries = {};
  for (const [path, content] of Object.entries(byPath)) entries[path.replace(/^\/+/, '')] = strToU8(content ?? '');
  return zipSync(entries, { level: 6 });
}

export function toBase64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
}

// Text files only: a NUL byte in the first 8 KB means binary
export const looksBinary = (text) => text.slice(0, 8192).includes('\0');

// Forwards console output and errors from the preview frame to the page
const CONSOLE_BRIDGE = `<script>(function(){
var send=function(level,args){try{parent.postMessage({devsync:'console',level:level,text:Array.prototype.map.call(args,function(a){if(typeof a==='string')return a;try{return JSON.stringify(a)}catch(e){return String(a)}}).join(' ')},'*')}catch(e){}};
['log','info','warn','error'].forEach(function(l){var o=console[l];console[l]=function(){send(l,arguments);o.apply(console,arguments)}});
addEventListener('error',function(e){send('error',[e.message+(e.lineno?' (line '+e.lineno+')':'')])});
addEventListener('unhandledrejection',function(e){send('error',['Unhandled promise rejection: '+(e.reason&&e.reason.message||e.reason)])});
})();</script>`;

// The HTML file with its local stylesheets and scripts inlined, ready for a sandboxed iframe.
// `contentAt(path)` returns a workspace file's text, or undefined.
export function buildHtmlPreview(htmlPath, html, contentAt) {
  const local = (url) => contentAt(resolvePath(htmlPath, url));
  const out = html
    .replace(/<link\b([^>]*?)\bhref=["']([^"']+)["']([^>]*)>/gi, (m, before, url, after) => {
      const css = /\brel=["']?stylesheet/i.test(before + after) ? local(url) : undefined;
      return css === undefined ? m : `<style>\n${css}\n</style>`;
    })
    .replace(/<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (m, before, url, after) => {
      const js = local(url);
      return js === undefined ? m : `<script${before}${after}>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`;
    });
  return /<head[^>]*>/i.test(out) ? out.replace(/<head[^>]*>/i, (h) => `${h}${CONSOLE_BRIDGE}`) : CONSOLE_BRIDGE + out;
}

// ---------- Which function a line is in (overlap warning, call graph) ----------
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'else', 'new', 'do', 'try', 'with', 'elif', 'except', 'match', 'when', 'foreach']);
const DEFINITIONS = [
  /^\s*(?:async\s+)?def\s+(\w+)/, // Python
  /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/,
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)/, // JS/TS
  /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/, // arrow functions
  /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+(\w+)/, // Rust
  /^\s*func\s+(?:\([^)]*\)\s*)?(\w+)/, // Go
  /^\s*(?:(?:public|private|protected|static|final|override|virtual|async|inline|const)\s+)*[\w:<>[\],*&]+\s+\**(\w+)\s*\([^;]*\)\s*(?:const\s*)?\{?\s*$/, // Java, C, C++, C#
  /^\s*(?:(?:public|private|protected|static|async|get|set)\s+)*(\w+)\s*\([^;]*\)\s*\{\s*$/, // JS/TS methods
  /^\s*def\s+(?:self\.)?(\w+[?!]?)/, // Ruby
];

function definitionName(line) {
  for (const re of DEFINITIONS) {
    const name = re.exec(line)?.[1];
    if (name && !KEYWORDS.has(name)) return name;
  }
  return null;
}

// The innermost function or class around `index` (0-based line): { name, line } or null.
// ponytail: indentation-based heuristic; swap in a real parser (tree-sitter) if it misjudges often.
export function enclosingBlock(lines, index) {
  let limit = Infinity;
  for (let i = Math.min(index, lines.length - 1); i >= 0; i--) {
    const text = lines[i];
    if (!text.trim()) continue;
    const indent = text.match(/^\s*/)[0].length;
    if (i !== index && indent >= limit) continue;
    const name = definitionName(text);
    if (name) return { name, line: i };
    limit = indent;
    if (indent === 0 && i !== index) return null;
  }
  return null;
}

// Every definition in the text: [{ name, line }]
export function definitions(lines) {
  const out = [];
  lines.forEach((text, line) => {
    const name = definitionName(text);
    if (name) out.push({ name, line });
  });
  return out;
}

// ---------- Call graph ----------
const indentOf = (line) => line.match(/^\s*/)[0].length;
const escapeLabel = (s) => s.replace(/["\\]/g, "'");

// A Mermaid flowchart of which functions in `text` call which, including functions defined in
// other files (`elsewhere`: [{ name, fileId, file, line }]). Returns { code, targets } where
// targets maps node ids to { fileId, line } so clicking a node can jump to the definition.
// ponytail: name matching, not real resolution; same-named functions in two files pick the local one.
export function callGraph(fileId, text, elsewhere = [], maxNodes = 60) {
  const lines = text.split('\n');
  const local = definitions(lines);
  const known = new Map(elsewhere.filter((d) => d.fileId !== fileId).map((d) => [d.name, d]));
  for (const d of local) known.set(d.name, { ...d, fileId, local: true });

  const ids = new Map(); // name -> node id
  const targets = {};
  const nodes = [];
  const node = (name) => {
    if (!ids.has(name)) {
      const d = known.get(name);
      const id = `${d.local ? 'n' : 'x'}${ids.size}`;
      ids.set(name, id);
      targets[id] = { fileId: d.fileId, line: d.line + 1 };
      nodes.push(d.local ? `  ${id}["${escapeLabel(name)}()"]` : `  ${id}["${escapeLabel(name)}() · ${escapeLabel(d.file || '')}"]:::ext`);
    }
    return ids.get(name);
  };

  const edges = new Set();
  local.forEach((d, i) => {
    const indent = indentOf(lines[d.line]);
    let end = lines.length;
    for (const next of local.slice(i + 1)) {
      if (indentOf(lines[next.line]) <= indent) { end = next.line; break; }
    }
    const body = lines.slice(d.line + 1, end).join('\n');
    node(d.name);
    for (const name of known.keys()) {
      if (name === d.name || ids.size >= maxNodes) continue;
      if (new RegExp(`(^|[^\\w.])${name.replace(/[$]/g, '\\$&')}\\s*\\(`).test(body)) edges.add(`  ${node(d.name)} --> ${node(name)}`);
    }
  });
  const code = ['flowchart LR', ...nodes, ...edges, '  classDef ext stroke-dasharray: 4 3'].join('\n');
  return { code, targets, empty: local.length === 0 };
}
