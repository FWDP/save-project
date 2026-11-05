import { resetDeviceFinancesOnce } from './finance-reset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { getAuthUser, accessToken } from './auth';
import { exchangeFinances, restoreSnapshot, syncSettingsKey, type SyncSettings, type ConflictChoice, type RemoteSnapshot } from '../../shared/finance-sync';
import type { ApiBudget, ApiCategory, ApiSavingsGoal, ApiTransaction } from './api';
import { BUILTIN_CATEGORIES } from '../../shared/category-catalog';
import { validDate, validMoney } from './finance';
export type LocalFinances = {
    transactions: ApiTransaction[];
    budgets: ApiBudget[];
    categories: ApiCategory[];
    goals: ApiSavingsGoal[];
};
const prefix = 'save-local-finances:v1:';
let tail: Promise<unknown> = Promise.resolve();
function serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = tail.then(operation);
    tail = next.catch(() => { });
    return next;
}
export async function financeOwner() {
    const user = await getAuthUser();
    if (!user)
        throw new Error('Sign in to access finances on this device.');
    return user.id;
}
async function read(owner: string): Promise<LocalFinances> {
    await resetDeviceFinancesOnce();
    const raw = await AsyncStorage.getItem(prefix + owner);
    if (raw !== null)
        return JSON.parse(raw);
    // Import only data already on this device. Never download financial records.
    const legacy = await import('./sqlite');
    legacy.initializeDatabase();
    const cached = legacy.loadAccountCache(owner);
    const pending = legacy.pendingTransactions(owner);
    const rows = new Map((cached?.transactions ?? []).filter(row => row.userId === owner).map(row => [row.clientMutationId ?? row.id, row]));
    for (const row of pending) {
        const identity = row.clientMutationId ?? row.id;
        if (row.userId === owner && !rows.has(identity)) rows.set(identity, row);
    }
    const snapshot: LocalFinances = {
        transactions: [...rows.values()].map(({ syncState: _syncState, ...row }) => row),
        budgets: cached?.budgets ?? [],
        categories: cached?.categories.length ? cached.categories : [...BUILTIN_CATEGORIES],
        goals: [],
    };
    await AsyncStorage.setItem(prefix + owner, JSON.stringify(snapshot));
    return snapshot;
}
export function loadLocalFinances(owner: string) {
    return serial(() => read(owner));
}
export async function localRecords<K extends keyof LocalFinances>(key: K): Promise<LocalFinances[K]> {
    const owner = await financeOwner();
    return (await loadLocalFinances(owner))[key];
}
export async function mutateLocal<T>(operation: (data: LocalFinances, owner: string) => T): Promise<T> {
    const owner = await financeOwner();
    return serial(async () => {
        const data = await read(owner);
        if (await financeOwner() !== owner)
            throw new Error('Account changed. Please retry.');
        const result = operation(data, owner);
        await AsyncStorage.setItem(prefix + owner, JSON.stringify(data));
        return result;
    });
}
function validateRecord(key: keyof LocalFinances, row: LocalFinances[keyof LocalFinances][number]) {
    if (key === 'transactions') {
        const transaction = row as ApiTransaction;
        if (!validDate(transaction.date) || !validMoney(transaction.amount) || !transaction.category.trim() || !transaction.description.trim())
            throw new Error('Enter a valid date, category, description and positive amount with at most two decimal places.');
        if (transaction.receiptUri && !/^(file:|content:|data:image\/)/.test(transaction.receiptUri))
            throw new Error('Attach a photo stored on this device.');
    }
    else if (key === 'budgets') {
        const budget = row as ApiBudget;
        if (!budget.category.trim() || !validMoney(budget.limit) || !['monthly', 'weekly'].includes(budget.period))
            throw new Error('Enter a category, valid period and positive budget limit.');
    }
    else if (key === 'goals') {
        const goal = row as ApiSavingsGoal;
        if (!goal.name.trim() || !validMoney(goal.targetAmount) || !Number.isFinite(goal.fundedAmount) || goal.fundedAmount < 0 || (goal.targetDate && !validDate(goal.targetDate)))
            throw new Error('Enter a name, valid amounts and target date.');
    }
    else {
        const category = row as ApiCategory;
        if (!category.name.trim() || !['income', 'expense'].includes(category.type))
            throw new Error('Enter a category name and type.');
    }
}
export async function addLocal<K extends keyof LocalFinances>(key: K, payload: Omit<LocalFinances[K][number], 'id'>) {
    return mutateLocal((data, owner) => {
        const row = { ...payload, id: `local_${randomUUID()}`, ...(key === 'transactions' || key === 'budgets' ? { userId: owner } : {}) } as LocalFinances[K][number];
        validateRecord(key, row);
        if (key === 'transactions') {
            const transaction = row as ApiTransaction;
            delete transaction.syncState;
            const existing = data.transactions.find(item => transaction.clientMutationId && item.clientMutationId === transaction.clientMutationId);
            if (existing)
                return existing as LocalFinances[K][number];
        }
        if (key === 'categories') {
            const category = row as ApiCategory;
            data.categories = data.categories.filter(item => item.id !== category.replacesBuiltInId);
        }
        (data[key] as LocalFinances[K][number][]).unshift(row);
        return row;
    });
}
export async function updateLocal<K extends keyof LocalFinances>(key: K, id: string, payload: Partial<LocalFinances[K][number]>) {
    return mutateLocal((data) => {
        const list = data[key] as LocalFinances[K][number][];
        const index = list.findIndex(row => row.id === id);
        if (index < 0)
            throw new Error('Record not found on this device.');
        const updated = { ...list[index], ...payload, id };
        validateRecord(key, updated);
        list[index] = updated;
        return list[index];
    });
}
export async function deleteLocal(key: keyof LocalFinances, id: string) {
    return mutateLocal(data => {
        const list = data[key];
        const index = list.findIndex(row => row.id === id);
        if (index < 0)
            throw new Error('Record not found on this device.');
        const removed = list.splice(index, 1)[0];
        if (key === 'categories') {
            const replaced = (removed as ApiCategory).replacesBuiltInId;
            const builtIn = BUILTIN_CATEGORIES.find(row => row.id === replaced);
            if (builtIn)
                data.categories.push(builtIn);
        }
        return { deleted: true };
    });
}

export async function getDatabaseSyncSettings() {
    const owner = await financeOwner();
    return serial(async () => {
        await read(owner);
        const raw = await AsyncStorage.getItem(syncSettingsKey(owner));
        return raw ? JSON.parse(raw) as SyncSettings : { enabled: false };
    });
}
export async function setDatabaseSyncEnabled(enabled: boolean) {
    const owner = await financeOwner();
    return serial(async () => {
        await read(owner);
        const raw = await AsyncStorage.getItem(syncSettingsKey(owner));
        const settings: SyncSettings = { ...(raw ? JSON.parse(raw) : {}), enabled };
        if (await financeOwner() !== owner) throw new Error('Account changed.');
        await AsyncStorage.setItem(syncSettingsKey(owner), JSON.stringify(settings));
        return settings;
    });
}
export async function syncLocalFinances(choice?: ConflictChoice) {
    const owner = await financeOwner();
    return serial(async () => {
        const local = await read(owner);
        const key = syncSettingsKey(owner);
        const raw = await AsyncStorage.getItem(key);
        const settings: SyncSettings = raw ? JSON.parse(raw) : { enabled: false };
        const assertActive = async () => {
            if (await financeOwner() !== owner) throw new Error('Account changed. Your device records were not replaced.');
            const current = await AsyncStorage.getItem(key);
            if (!current || !JSON.parse(current).enabled) throw new Error('Database sync is off.');
        };
        const request = async (method: 'GET' | 'PUT', payload?: RemoteSnapshot & { consent: true }) => {
            const { getApiBaseUrl } = await import('./api');
            const token = await accessToken(owner);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30_000);
            try {
                const response = await fetch(`${getApiBaseUrl()}/finance-sync`, {
                    method,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: payload ? JSON.stringify(payload) : undefined,
                    signal: controller.signal,
                });
                if (response.status === 409) return null;
                if (!response.ok) throw new Error(`Database sync failed (HTTP ${response.status}). Your local records are still saved.`);
                return await response.json() as RemoteSnapshot;
            } finally { clearTimeout(timer); }
        };
        const result = await exchangeFinances({ local, settings, assertActive,
            fetchRemote: async () => { const remote = await request('GET'); if (!remote) throw new Error('Could not load database records.'); return remote; },
            pushRemote: payload => request('PUT', payload),
        }, choice);
        if (!result) return settings;
        await assertActive();
        const merged = restoreSnapshot<LocalFinances>(result.snapshot, local, owner, BUILTIN_CATEGORIES);
        await AsyncStorage.setItem(prefix + owner, JSON.stringify(merged));
        await AsyncStorage.setItem(key, JSON.stringify(result.settings));
        return result.settings;
    });
}
