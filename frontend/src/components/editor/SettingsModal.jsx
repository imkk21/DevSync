import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Switch from '../ui/Switch';
import ToggleGroup from '../ui/ToggleGroup';
import useSettingsStore from '../../store/settingsStore';
import { ThemeSwitcher } from '../ui/ThemeMenu';

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];

// The fields, shared by this dialog and the account settings page
export function EditorSettingsFields() {
  const s = useSettingsStore();
  return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-label-md text-ink">Theme</span>
          <ThemeSwitcher className="w-full max-w-[260px]" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="font-size" className="text-label-md text-ink">Font size</label>
          <select
            id="font-size"
            value={s.fontSize}
            onChange={(e) => s.update({ fontSize: Number(e.target.value) })}
            className="h-8 cursor-pointer rounded-md border border-line-strong bg-canvas pl-2 pr-7 text-label-md text-ink hover:border-line-emphasis"
          >
            {FONT_SIZES.map((n) => <option key={n} value={n}>{n}px</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-label-md text-ink">Tab size</span>
          <ToggleGroup
            label="Tab size"
            size="sm"
            value={s.tabSize}
            onChange={(tabSize) => s.update({ tabSize })}
            options={[2, 4, 8].map((n) => ({ id: n, label: `${n} spaces` }))}
          />
        </div>
        <div className="space-y-4 border-t border-line pt-5">
          <Switch label="Word wrap" hint="Wrap long lines instead of scrolling sideways." checked={s.wordWrap} onChange={(wordWrap) => s.update({ wordWrap })} />
          <Switch label="Line numbers" checked={s.lineNumbers} onChange={(lineNumbers) => s.update({ lineNumbers })} />
          <Switch label="Minimap" hint="A zoomed-out view of the file along the right edge." checked={s.minimap} onChange={(minimap) => s.update({ minimap })} />
          <Switch label="Format on save" hint="Tidy JavaScript, TypeScript, JSON, CSS and HTML when you press Save." checked={s.formatOnSave} onChange={(formatOnSave) => s.update({ formatOnSave })} />
          <Switch label="Vim keys" hint="Modal editing with Vim keybindings. The mode shows under the editor." checked={s.vim} onChange={(vim) => s.update({ vim })} />
        </div>
      </div>
  );
}

export default function SettingsModal({ isOpen, onClose }) {
  const resetEditor = useSettingsStore((s) => s.resetEditor);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editor settings"
      description="Saved in this browser."
      footer={
        <>
          <Button variant="ghost" onClick={resetEditor} className="mr-auto">Reset to defaults</Button>
          <Button variant="secondary" onClick={onClose}>Done</Button>
        </>
      }
    >
      <EditorSettingsFields />
    </Modal>
  );
}
