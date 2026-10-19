import { Bell, Copy, Database, Download, Snowflake, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, Confirm, Field, Segmented, Sheet, TextInput, Toggle } from '../components/ui';
import { buildBackup, downloadBackup, factoryReset, restoreBackup } from '../repo/backup';
import { loadDemoData } from '../repo/demo';
import { deleteProject } from '../repo/taskRepository';
import { notificationPermission, requestNotificationPermission } from '../lib/notifications';
import { useInstall } from '../lib/useInstall';
import { setUnit, useAppStore, useSetting, useUnit } from '../store/useAppStore';
import { useUIStore } from '../store/useUIStore';
import { getBool, setBool, setSetting } from '../repo/settings';
import type { Unit } from '../lib/units';
import { db } from '../db/database';

type Pending = null | 'reset' | 'demo' | { restore: string };

export function SettingsModal() {
  const close = useUIStore((s) => s.close);
  const toast = useUIStore((s) => s.toast);
  const unit = useUnit();
  const workoutTime = useSetting('workoutTime', '18:00');
  const projects = useAppStore((s) => s.projects);
  const notifOn = useSetting('notifications', '0') === '1';
  const [perm, setPerm] = useState(notificationPermission());
  const [pending, setPending] = useState<Pending>(null);
  const [usage, setUsage] = useState<string>('');
  const file = useRef<HTMLInputElement>(null);
  const install = useInstall();

  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => e.usage != null && setUsage(`${(e.usage / 1024 / 1024).toFixed(2)} MB used`));
  }, []);

  const toggleNotifs = async (on: boolean) => {
    if (on) {
      const r = await requestNotificationPermission();
      setPerm(r);
      if (r !== 'granted') { toast(r === 'unsupported' ? 'Notifications are not supported here' : 'Permission was not granted — enable it in browser settings', { tone: 'warn' }); setBool('notifications', false); return; }
    }
    setBool('notifications', on);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(buildBackup(), null, 2)); toast('Backup copied to clipboard', { tone: 'success' }); }
    catch { toast('Clipboard unavailable — use Download', { tone: 'warn' }); }
  };

  return (
    <Sheet title="Settings" onClose={() => close('settings')} full>
      {!install.installed && (
        <Card screws>
          <div className="col"><strong>Install TaskFlow</strong>
            {install.canInstall ? <Button variant="primary" onClick={install.install}><Download size={16} /> Install app</Button>
              : <span className="small muted">{install.ios ? 'In Safari tap Share → “Add to Home Screen”.' : 'Use your browser menu → “Install app” / “Add to Home screen”.'}</span>}
          </div>
        </Card>
      )}
      <Card className="col">
        <span className="label">Preferences</span>
        <Field label="Weight unit"><Segmented<Unit> value={unit} onChange={setUnit} options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} /></Field>
        <Field label="Default workout time on timeline"><TextInput type="time" value={workoutTime} onChange={(e) => setSetting('workoutTime', e.target.value || '18:00')} /></Field>
        <div className="row between"><span className="row" style={{ gap: 8 }}><Bell size={18} /> Push notifications</span><Toggle label="Push notifications" checked={notifOn && perm === 'granted'} onChange={toggleNotifs} /></div>
        <p className="tiny muted">Reminders for tasks, habit check-ins and rest timers fire while the app is open or installed. Browsers cannot guarantee delivery when fully closed. Permission: <strong>{perm}</strong>.</p>
        <div className="row between"><span className="row" style={{ gap: 8 }}><Snowflake size={18} /> Sounds &amp; haptics</span><Toggle label="Sound and haptics" checked={getBool('feedback', true)} onChange={(v) => setBool('feedback', v)} /></div>
      </Card>

      <Card className="col" screws>
        <span className="label">Backup &amp; privacy</span>
        <p className="small muted">All data lives only on this device{usage ? ` (${usage})` : ''}. Export a deterministic JSON backup any time.</p>
        <div className="grid2">
          <Button onClick={() => { downloadBackup(); toast('Backup downloaded', { tone: 'success' }); }}><Download size={16} /> Download</Button>
          <Button onClick={copy}><Copy size={16} /> Copy</Button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setPending({ restore: await f.text() }); }} />
        <Button onClick={() => file.current?.click()}><Upload size={16} /> Restore from file</Button>
        <Button onClick={() => void navigator.storage?.persist?.().then((ok) => toast(ok ? 'Storage marked persistent' : 'Browser declined persistent storage', { tone: ok ? 'success' : 'warn' }))}><Database size={16} /> Protect from auto-clear</Button>
      </Card>

      <Card className="col">
        <span className="label">Projects</span>
        {projects.length === 0 && <span className="small muted">No projects.</span>}
        {projects.map((p) => (
          <div key={p.id} className="row"><i style={{ width: 12, height: 12, borderRadius: 9, background: p.color }} /><span className="grow">{p.name}</span><button type="button" className="iconbtn sm" aria-label={`Delete project ${p.name}`} onClick={() => deleteProject(p.id)}><Trash2 size={14} /></button></div>
        ))}
      </Card>

      <Card className="col">
        <span className="label">Data tools</span>
        <Button onClick={() => setPending('demo')}>Load 60 days of demo data</Button>
        <Button variant="danger" onClick={() => setPending('reset')}><Trash2 size={16} /> Factory reset</Button>
        <p className="tiny muted">TaskFlow Pro v1.0.0 · schema v1 · {db.all('tasks').length} tasks · {db.all('workout_sessions').length} sessions</p>
      </Card>

      {pending === 'reset' && <Confirm title="Erase everything?" text="This wipes every task, habit, workout and note on this device. Download a backup first if unsure." confirmLabel="Erase all" onConfirm={() => { factoryReset(); toast('All data erased'); }} onClose={() => setPending(null)} />}
      {pending === 'demo' && <Confirm title="Load demo data?" text="Adds a sample routine, habits, tasks and history to your existing data." confirmLabel="Load" onConfirm={() => { loadDemoData(); toast('Demo data loaded', { tone: 'success' }); }} onClose={() => setPending(null)} />}
      {pending && typeof pending === 'object' && (
        <Confirm title="Restore backup?" text="This replaces ALL current data with the backup. The restore is all-or-nothing." confirmLabel="Restore"
          onConfirm={() => { try { restoreBackup(pending.restore); toast('Backup restored', { tone: 'success' }); } catch (e) { toast(e instanceof Error ? e.message : 'Restore failed', { tone: 'warn' }); } }} onClose={() => setPending(null)} />
      )}
    </Sheet>
  );
}
