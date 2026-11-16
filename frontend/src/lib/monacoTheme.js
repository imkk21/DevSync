// Editor themes built from the design tokens. Each syntax colour has a distinct
// hue and at least 4.5:1 contrast on its background. The landing page preview
// reuses SYNTAX so it matches the real editor.
export const THEMES = { light: 'devsync-light', dark: 'devsync-dark' };

export const SYNTAX = {
  light: {
    text: '#1F2328',
    keyword: '#0A7A28',
    string: '#0550AE',
    number: '#953800',
    type: '#8250DF',
    comment: '#6E7781',
    punctuation: '#57606A',
  },
  dark: {
    text: '#E6EDE9',
    keyword: '#4AC26B',
    string: '#79C0FF',
    number: '#FFA657',
    type: '#D2A8FF',
    comment: '#8B9792',
    punctuation: '#9AA6A0',
  },
};

// Editor chrome per theme, matching the app's canvas / line / brand tokens
const CHROME = {
  light: {
    bg: '#FFFFFF', subtle: '#F6F8F7', muted: '#EEF1EF', line: '#E5E7EB', lineStrong: '#D2D9D4', emphasis: '#B9C3BD',
    lineNumber: '#8C959F', lineNumberActive: '#000000', cursor: '#08872B', selection: '#C6E6D0',
    selectionInactive: '#E1F0E6', soft: '#EAF5EE', highlight: '#0D6731', findMatch: '#FFDF5D', findMatchSoft: '#FFF4C2',
  },
  dark: {
    bg: '#0D1110', subtle: '#141A18', muted: '#1C2421', line: '#252D2A', lineStrong: '#323D38', emphasis: '#46534D',
    lineNumber: '#5F6C66', lineNumberActive: '#E6EDE9', cursor: '#4AC26B', selection: '#1F4A2D',
    selectionInactive: '#183A24', soft: '#11261A', highlight: '#4AC26B', findMatch: '#9E6A03', findMatchSoft: '#5A4205',
  },
};

const hex = (c) => c.slice(1);

function buildTheme(mode) {
  const s = SYNTAX[mode];
  const c = CHROME[mode];
  return {
    base: mode === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: hex(s.text) },
      { token: 'comment', foreground: hex(s.comment), fontStyle: 'italic' },
      { token: 'keyword', foreground: hex(s.keyword) },
      { token: 'string', foreground: hex(s.string) },
      { token: 'string.escape', foreground: hex(s.type) },
      { token: 'number', foreground: hex(s.number) },
      { token: 'constant', foreground: hex(s.number) },
      { token: 'regexp', foreground: hex(s.number) },
      { token: 'type', foreground: hex(s.type) },
      { token: 'annotation', foreground: hex(s.type) },
      { token: 'predefined', foreground: hex(s.number) },
      { token: 'variable.predefined', foreground: hex(s.number) },
      { token: 'delimiter', foreground: hex(s.punctuation) },
      { token: 'operator', foreground: hex(s.punctuation) },
      { token: 'tag', foreground: hex(s.keyword) },
      { token: 'attribute.name', foreground: hex(s.type) },
      { token: 'attribute.value', foreground: hex(s.string) },
    ],
    colors: {
      'editor.background': c.bg,
      'editor.foreground': s.text,
      'editorGutter.background': c.bg,
      'editorLineNumber.foreground': c.lineNumber,
      'editorLineNumber.activeForeground': c.lineNumberActive,
      'editor.lineHighlightBackground': c.subtle,
      'editor.lineHighlightBorder': c.subtle,
      'editorCursor.foreground': c.cursor,
      'editor.selectionBackground': c.selection,
      'editor.inactiveSelectionBackground': c.selectionInactive,
      'editor.selectionHighlightBackground': c.soft,
      'editor.wordHighlightBackground': c.muted,
      'editor.findMatchBackground': c.findMatch,
      'editor.findMatchHighlightBackground': c.findMatchSoft,
      'editorIndentGuide.background1': c.muted,
      'editorIndentGuide.activeBackground1': c.lineStrong,
      'editorWhitespace.foreground': c.lineStrong,
      'editorBracketMatch.background': c.soft,
      'editorBracketMatch.border': `${c.cursor}59`,
      'editorBracketHighlight.foreground1': s.string,
      'editorBracketHighlight.foreground2': s.type,
      'editorBracketHighlight.foreground3': s.number,
      'editorBracketHighlight.unexpectedBracket.foreground': mode === 'dark' ? '#F85149' : '#D1242F',
      'editorWidget.background': c.bg,
      'editorWidget.border': c.line,
      'editorSuggestWidget.background': c.bg,
      'editorSuggestWidget.border': c.line,
      'editorSuggestWidget.foreground': s.text,
      'editorSuggestWidget.selectedBackground': c.soft,
      'editorSuggestWidget.highlightForeground': c.highlight,
      'editorHoverWidget.background': c.bg,
      'editorHoverWidget.border': c.line,
      'editorOverviewRuler.border': '#00000000',
      'input.background': c.bg,
      'input.border': c.lineStrong,
      focusBorder: c.cursor,
      'scrollbarSlider.background': `${c.lineStrong}80`,
      'scrollbarSlider.hoverBackground': `${c.emphasis}B3`,
      'scrollbarSlider.activeBackground': c.emphasis,
    },
  };
}

export function defineDevSyncThemes(monaco) {
  monaco.editor.defineTheme(THEMES.light, buildTheme('light'));
  monaco.editor.defineTheme(THEMES.dark, buildTheme('dark'));
}
