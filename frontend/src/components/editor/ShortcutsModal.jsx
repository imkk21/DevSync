import Modal from '../ui/Modal';
import Shortcut, { MOD } from '../ui/Shortcut';

export const SHORTCUTS = [
  { group: 'General', items: [
    ['Command palette', [MOD, 'Shift', 'P']],
    ['Go to file', [MOD, 'P']],
    ['Go to line', [MOD, 'G']],
    ['Search in all files', [MOD, 'Shift', 'F']],
    ['Show or hide files', [MOD, 'B']],
    ['Split editor', [MOD, '\\']],
    ['Editor settings', [MOD, ',']],
    ['This list', ['?']],
  ] },
  { group: 'Editing', items: [
    ['Save now', [MOD, 'S']],
    ['Format document', ['Shift', 'Alt', 'F']],
    ['Undo your last change', [MOD, 'Z']],
    ['Redo', [MOD, 'Shift', 'Z']],
    ['Find in file', [MOD, 'F']],
    ['Replace in file', [MOD, 'H']],
    ['Comment line', [MOD, '/']],
    ['Add a cursor below', [MOD, 'Alt', '↓']],
  ] },
  { group: 'Running', items: [
    ['Run', [MOD, 'Enter']],
  ] },
];

export default function ShortcutsModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" size="lg">
      <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
        {SHORTCUTS.map(({ group, items }) => (
          <section key={group}>
            <h3 className="text-label-md text-ink">{group}</h3>
            <dl className="mt-3 space-y-2.5">
              {items.map(([label, keys]) => (
                <div key={label} className="flex items-center justify-between gap-4 text-body-sm">
                  <dt className="text-ink-muted">{label}</dt>
                  <dd><Shortcut keys={keys} /></dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
