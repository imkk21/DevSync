// Mermaid diagrams, loaded only when one is shown
let mermaidPromise;
let seq = 0;

// Monaco's script loader puts an AMD `define` on window. Some of Mermaid's bundled libraries see it
// and try to register as AMD modules, which throws. Hide it while Mermaid loads and draws.
async function withoutAmd(fn) {
  const define = window.define;
  window.define = undefined;
  try {
    return await fn();
  } finally {
    window.define = define;
  }
}

export function renderMermaid(code, theme) {
  return withoutAmd(async () => {
    mermaidPromise ??= import('mermaid').then((m) => m.default);
    const mermaid = await mermaidPromise;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict', // no scripts or click handlers from the diagram text
      theme: theme === 'dark' ? 'dark' : 'neutral',
      fontFamily: '"Mona Sans", system-ui, sans-serif',
    });
    const { svg } = await mermaid.render(`mermaid-${seq++}`, code);
    return svg;
  });
}

// Markdown with ```mermaid blocks drawn as diagrams (as inline SVG, before the page is sandboxed)
export async function inlineMermaid(markdown, theme) {
  const blocks = [...markdown.matchAll(/```mermaid[^\n]*\n([\s\S]*?)```/g)];
  let out = markdown;
  for (const [whole, code] of blocks) {
    let svg;
    try {
      svg = await renderMermaid(code, theme);
    } catch (err) {
      svg = `<pre>Diagram error: ${String(err.message || err).replace(/[<>&]/g, '')}</pre>`;
    }
    out = out.replace(whole, `\n<div class="mermaid-diagram">${svg}</div>\n`);
  }
  return out;
}
