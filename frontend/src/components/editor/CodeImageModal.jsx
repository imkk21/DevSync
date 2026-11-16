import { useEffect, useRef, useState } from 'react';
import { loader } from '@monaco-editor/react';
import { GoCopy, GoDownload } from 'react-icons/go';
import { SYNTAX } from '../../lib/monacoTheme';
import useThemeStore from '../../store/themeStore';
import { toast } from '../../store/toastStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import ToggleGroup from '../ui/ToggleGroup';
import Switch from '../ui/Switch';

const FRAME = {
  light: { outer: '#EEF1EF', bg: '#FFFFFF', border: '#E5E7EB', muted: '#8C959F' },
  dark: { outer: '#141A18', bg: '#0D1110', border: '#252D2A', muted: '#5F6C66' },
};
// Monaco token types (e.g. "keyword.js") to syntax colours, most specific first
const TOKEN_COLORS = [
  ['comment', 'comment'], ['string.escape', 'type'], ['string', 'string'], ['attribute.value', 'string'],
  ['number', 'number'], ['regexp', 'number'], ['constant', 'number'], ['predefined', 'number'],
  ['keyword', 'keyword'], ['tag', 'keyword'], ['type', 'type'], ['annotation', 'type'], ['attribute.name', 'type'],
  ['delimiter', 'punctuation'], ['operator', 'punctuation'],
];
const colorFor = (type, palette) => palette[TOKEN_COLORS.find(([prefix]) => type.startsWith(prefix))?.[1] || 'text'];

const MAX_LINES = 80;
const FONT = '14px "Monaspace Neon", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// Draw highlighted code on a canvas: no extra libraries, same colours as the editor
async function draw(canvas, { text, language, mode, title, lineNumbers }) {
  const monaco = await loader.init();
  await document.fonts?.load(FONT).catch(() => {});
  const lines = text.replace(/\t/g, '  ').replace(/\s+$/, '').split('\n').slice(0, MAX_LINES);
  const tokens = monaco.editor.tokenize(lines.join('\n'), language);
  const palette = SYNTAX[mode];
  const frame = FRAME[mode];
  const scale = 2;
  const ctx = canvas.getContext('2d');
  ctx.font = FONT;
  const charW = ctx.measureText('M').width;
  const lineH = 22;
  const pad = 32;
  const inner = 24;
  const gutter = lineNumbers ? String(lines.length).length * charW + 20 : 0;
  const header = title ? 36 : 0;
  const longest = Math.max(20, ...lines.map((l) => l.length));
  const w = Math.min(1600, Math.ceil(pad * 2 + inner * 2 + gutter + longest * charW));
  const h = Math.ceil(pad * 2 + inner * 2 + header + lines.length * lineH);

  canvas.width = w * scale;
  canvas.height = h * scale;
  canvas.style.width = `${w}px`;
  ctx.scale(scale, scale);
  ctx.fillStyle = frame.outer;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = frame.bg;
  ctx.strokeStyle = frame.border;
  ctx.beginPath();
  ctx.roundRect(pad + 0.5, pad + 0.5, w - pad * 2 - 1, h - pad * 2 - 1, 12);
  ctx.fill();
  ctx.stroke();

  ctx.font = FONT;
  ctx.textBaseline = 'middle';
  if (title) {
    ctx.fillStyle = frame.muted;
    ctx.fillText(title, pad + inner, pad + inner / 2 + header / 2);
  }
  const top = pad + inner + header;
  lines.forEach((line, i) => {
    const y = top + i * lineH + lineH / 2;
    if (lineNumbers) {
      ctx.fillStyle = frame.muted;
      ctx.textAlign = 'right';
      ctx.fillText(String(i + 1), pad + inner + gutter - 20, y);
      ctx.textAlign = 'left';
    }
    const x0 = pad + inner + gutter;
    const lineTokens = tokens[i] || [{ offset: 0, type: '' }];
    lineTokens.forEach((t, j) => {
      const end = lineTokens[j + 1]?.offset ?? line.length;
      ctx.fillStyle = colorFor(t.type, palette);
      ctx.fillText(line.slice(t.offset, end), x0 + t.offset * charW, y);
    });
  });
}

// request: { text, language, fileName }
export default function CodeImageModal({ request, onClose }) {
  const resolved = useThemeStore((s) => s.resolved);
  const [mode, setMode] = useState(resolved);
  const [showTitle, setShowTitle] = useState(true);
  const [lineNumbers, setLineNumbers] = useState(true);
  const canvas = useRef(null);
  const truncated = request && request.text.split('\n').length > MAX_LINES;

  useEffect(() => {
    if (!request || !canvas.current) return;
    draw(canvas.current, { ...request, mode, title: showTitle ? request.fileName : '', lineNumbers });
  }, [request, mode, showTitle, lineNumbers]);

  const blob = () => new Promise((resolve) => canvas.current.toBlob(resolve, 'image/png'));
  const download = async () => {
    const url = URL.createObjectURL(await blob());
    Object.assign(document.createElement('a'), { href: url, download: `${request.fileName || 'code'}.png` }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob() })]);
      toast('Image copied', { tone: 'success' });
    } catch {
      toast("Your browser didn't allow copying images. Download it instead.", { tone: 'error' });
    }
  };

  return (
    <Modal
      isOpen={!!request}
      onClose={onClose}
      size="lg"
      title="Share code as image"
      description={truncated ? `Only the first ${MAX_LINES} lines fit. Select fewer lines to choose which.` : 'Select lines in the editor first to share just those.'}
      footer={
        <>
          <Button variant="secondary" onClick={copy}><GoCopy size={16} /> Copy</Button>
          <Button onClick={download}><GoDownload size={16} /> Download PNG</Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ToggleGroup label="Image theme" size="sm" value={mode} onChange={setMode} options={[{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]} />
        <div className="w-40"><Switch label="File name" checked={showTitle} onChange={setShowTitle} /></div>
        <div className="w-40"><Switch label="Line numbers" checked={lineNumbers} onChange={setLineNumbers} /></div>
      </div>
      <div className="mt-4 overflow-auto rounded-md border border-line">
        <canvas ref={canvas} className="block max-w-full" style={{ height: 'auto' }} />
      </div>
    </Modal>
  );
}
