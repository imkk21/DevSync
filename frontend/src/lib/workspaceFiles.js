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
