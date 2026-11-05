'use server';
import { requireSession } from '@/lib/supabase';
import type { RemoteSnapshot } from '../../../shared/finance-sync';

async function request(owner: string, method: 'GET' | 'PUT', payload?: RemoteSnapshot & { consent: true }) {
  const { user, token } = await requireSession();
  if (user.id !== owner) throw new Error('Account changed. Reload before syncing.');
  const base = (process.env.SAVE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
  const response = await fetch(`${base}/finance-sync`, {
    method, cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 409) return null;
  if (!response.ok) throw new Error(`Database sync failed (HTTP ${response.status}). Device records are still saved.`);
  return await response.json() as RemoteSnapshot;
}
export async function readDatabaseFinances(owner: string) {
  const result = await request(owner, 'GET');
  if (!result) throw new Error('Could not download database records.');
  return result;
}
export async function writeDatabaseFinances(owner: string, payload: RemoteSnapshot & { consent: true }) {
  return request(owner, 'PUT', payload);
}
