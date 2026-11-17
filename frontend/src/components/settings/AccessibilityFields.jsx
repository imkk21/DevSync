import useSettingsStore from '../../store/settingsStore';
import Switch from '../ui/Switch';
import ToggleGroup from '../ui/ToggleGroup';

// Settings > Accessibility. App applies these to <html>.
export default function AccessibilityFields() {
  const s = useSettingsStore();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-label-md text-ink">Text size</span>
        <ToggleGroup
          label="Text size"
          size="sm"
          value={s.textScale}
          onChange={(textScale) => s.update({ textScale })}
          options={[100, 112, 125].map((n) => ({ id: n, label: `${n}%` }))}
        />
      </div>
      <Switch label="Readable font" hint="Atkinson Hyperlegible, designed to keep similar letters apart." checked={s.readableFont} onChange={(readableFont) => s.update({ readableFont })} />
      <Switch label="High contrast" hint="Darker text and borders, and a high-contrast editor theme." checked={s.highContrast} onChange={(highContrast) => s.update({ highContrast })} />
      <Switch label="Reduce motion" hint="Turns off animations and confetti, even if your system allows them." checked={s.reduceMotion} onChange={(reduceMotion) => s.update({ reduceMotion })} />
      <Switch label="Announce collaborators" hint="Screen readers say when people join or leave, who's driving, and when someone points at a line." checked={s.announce} onChange={(announce) => s.update({ announce })} />
    </div>
  );
}
