import { useEffect, useState } from 'react';
import { toast } from '../../store/toastStore';
import { deviceSubscription, installPrompt, onInstallPrompt, pushOff, pushOn, pushSupported } from '../../lib/push';
import Switch from '../ui/Switch';
import Button from '../ui/Button';

const installed = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// Settings > App: install DevSync, and notifications on this device
export default function AppFields() {
  const [on, setOn] = useState(null); // null while checking
  const [busy, setBusy] = useState(false);
  const [canInstall, setCanInstall] = useState(!!installPrompt());

  useEffect(() => {
    deviceSubscription().then((s) => setOn(!!s)).catch(() => setOn(false));
    return onInstallPrompt((e) => setCanInstall(!!e));
  }, []);

  const toggle = async (want) => {
    setBusy(true);
    try {
      if (want) await pushOn();
      else await pushOff();
      setOn(want);
      if (want) toast("Notifications are on. You'll hear about mentions, replies, invites and events here.", { tone: 'success' });
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
    setBusy(false);
  };

  const install = async () => {
    const e = installPrompt();
    if (!e) return;
    await e.prompt();
    setCanInstall(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-label-md text-ink">Install DevSync</p>
          <p className="mt-1 text-body-sm text-ink-muted">
            {installed()
              ? 'Installed. You are using the app right now.'
              : isIos()
                ? 'In Safari, tap Share, then Add to Home Screen.'
                : canInstall
                  ? 'Opens in its own window, with an icon on your desktop or home screen.'
                  : "Use your browser's menu: Install DevSync, or Add to Home Screen."}
          </p>
        </div>
        {canInstall && !installed() && <Button variant="secondary" size="sm" onClick={install}>Install</Button>}
      </div>
      {pushSupported() ? (
        <Switch
          label="Notifications on this device"
          hint="Mentions, replies, invites and event reminders, even when DevSync is closed."
          checked={!!on}
          disabled={on === null || busy}
          onChange={toggle}
        />
      ) : (
        <p className="text-body-sm text-ink-muted">
          {isIos() ? 'To get notifications on iPhone or iPad, add DevSync to your Home Screen first and open it from there.' : "This browser can't show notifications."}
        </p>
      )}
    </div>
  );
}
