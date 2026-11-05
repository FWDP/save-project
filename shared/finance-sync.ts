// Sync metadata only. Receipt bytes and device file paths never leave the device.
export const SYNC_KEYS = ['transactions', 'budgets', 'categories', 'goals'] as const;
export type SyncKey = typeof SYNC_KEYS[number];
export type SyncRow = { id: string; [key: string]: unknown };
export type SyncSnapshot = Record<SyncKey, SyncRow[]>;
export type FinanceData = Record<SyncKey, readonly { id: string }[]>;
export type SyncSettings = { enabled: boolean; base?: SyncSnapshot; lastSyncedAt?: string };
export type RemoteSnapshot = { revision: number; snapshot: SyncSnapshot };
export type ConflictChoice = 'device' | 'database';
export const emptySyncSnapshot = (): SyncSnapshot => ({ transactions: [], budgets: [], categories: [], goals: [] });
export const syncSettingsKey = (owner: string) => `save-finance-sync:v1:${owner}`;

export function projectSnapshot(data: FinanceData): SyncSnapshot {
  const output = emptySyncSnapshot();
  for (const key of SYNC_KEYS) {
    for (const item of data[key]) {
      const row = item as SyncRow;
      if (key === 'categories' && row.builtIn) continue;
      const { receiptUri: _receipt, userId: _owner, syncState: _state, revision: _revision, ...fields } = row;
      output[key].push(fields as SyncRow);
    }
  }
  return output;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
export class FinanceSyncConflict extends Error {
  constructor(public readonly records: string[]) {
    super(`${records.length} record(s) changed on both devices. Choose which conflicting versions to keep. Other changes will still be merged.`);
    this.name = 'FinanceSyncConflict';
  }
}
export function mergeSnapshots(base: SyncSnapshot, device: SyncSnapshot, database: SyncSnapshot, choice?: ConflictChoice): SyncSnapshot {
  const result = emptySyncSnapshot();
  const conflicts: string[] = [];
  for (const key of SYNC_KEYS) {
    const prior = new Map(base[key].map(row => [row.id, row]));
    const local = new Map(device[key].map(row => [row.id, row]));
    const remote = new Map(database[key].map(row => [row.id, row]));
    for (const id of new Set([...prior.keys(), ...local.keys(), ...remote.keys()])) {
      const b = prior.get(id), l = local.get(id), r = remote.get(id);
      let row: SyncRow | undefined;
      if (canonical(l) === canonical(r)) row = l;
      else if (canonical(l) === canonical(b)) row = r;
      else if (canonical(r) === canonical(b)) row = l;
      else {
        conflicts.push(`${key}:${id}`);
        row = choice === 'database' ? r : l;
      }
      if (row) result[key].push(row);
    }
  }
  if (conflicts.length && !choice) throw new FinanceSyncConflict(conflicts);
  return result;
}
export function restoreSnapshot<T extends FinanceData>(snapshot: SyncSnapshot, local: T, owner: string, builtIns: readonly { id: string; name: string; type: string }[]): T {
  const photos = new Map(local.transactions.map(row => [row.id, (row as SyncRow).receiptUri]));
  const replaced = new Set(snapshot.categories.map(row => row.replacesBuiltInId));
  const customNames = new Set(snapshot.categories.map(row => `${row.type}:${String(row.name).toLowerCase()}`));
  return {
    transactions: snapshot.transactions.map(row => ({ ...row, userId: owner, ...(photos.get(row.id) ? { receiptUri: photos.get(row.id) } : {}) })),
    budgets: snapshot.budgets.map(row => ({ ...row, userId: owner })),
    categories: [...builtIns.filter(row => !replaced.has(row.id) && !customNames.has(`${row.type}:${row.name.toLowerCase()}`)), ...snapshot.categories],
    goals: snapshot.goals,
  } as unknown as T;
}
export async function exchangeFinances(options: {
  local: FinanceData;
  settings: SyncSettings;
  fetchRemote: () => Promise<RemoteSnapshot>;
  pushRemote: (data: RemoteSnapshot & { consent: true }) => Promise<RemoteSnapshot | null>;
  assertActive: () => Promise<void>;
}, choice?: ConflictChoice): Promise<{ snapshot: SyncSnapshot; settings: SyncSettings } | null> {
  if (!options.settings.enabled) return null;
  const device = projectSnapshot(options.local);
  for (let attempt = 0; attempt < 3; attempt++) {
    await options.assertActive();
    const remote = await options.fetchRemote();
    const snapshot = mergeSnapshots(options.settings.base ?? emptySyncSnapshot(), device, remote.snapshot, choice);
    await options.assertActive();
    // Revision checks make retries safe, including a response lost after commit.
    const saved = await options.pushRemote({ revision: remote.revision, snapshot, consent: true });
    if (!saved) continue;
    await options.assertActive();
    return { snapshot: saved.snapshot, settings: { enabled: true, base: saved.snapshot, lastSyncedAt: new Date().toISOString() } };
  }
  throw new Error('Database records changed during sync. Nothing was overwritten; try again.');
}
