import { z } from 'zod';
const text = z.string().max(2000);
const id = z.string().min(1).max(200);
const money = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER / 100).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const d = new Date(`${value}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value; });
const direction = z.enum(['income', 'expense']);
// Strict allowlists reject photos, device paths and client-selected account IDs.
const transaction = z.object({
  id, type: direction, amount: money.refine(n => n > 0), date,
  category: text.min(1), description: text.min(1), merchant: text.optional(),
  clientMutationId: id.optional(), status: z.enum(['pending', 'approved', 'rejected']).optional(),
  tags: z.array(text).max(100).optional(), recurring: z.boolean().optional(),
  customFields: z.record(z.string().max(100), text).optional(),
}).strict();
const budget = z.object({ id, category: text.min(1), limit: money.refine(n => n > 0), spent: money, period: z.enum(['monthly', 'weekly']) }).strict();
const category = z.object({ id, name: text.min(1), type: direction, color: z.string().max(100), builtIn: z.literal(false).optional(), parentCategory: text.optional(), subcategory: text.optional(), replacesBuiltInId: id.optional() }).strict();
const goal = z.object({ id, name: text.min(1), targetAmount: money.refine(n => n > 0), fundedAmount: money, targetDate: date.optional(), asset: z.string().min(1).max(40), status: z.enum(['draft', 'pending', 'active', 'completed', 'withdrawn', 'cancelled']), network: text.optional(), ownerAddress: text.optional(), contractId: text.optional(), vaultGoalId: text.optional(), transactionHash: text.optional() }).strict();
const unique = <T extends z.ZodType<{ id: string }>>(schema: T) => z.array(schema).max(20000).refine(rows => new Set(rows.map(row => row.id)).size === rows.length, 'Duplicate record IDs');
export const syncSnapshotSchema = z.object({ transactions: unique(transaction), budgets: unique(budget), categories: unique(category), goals: unique(goal) }).strict();
export const syncRequestSchema = z.object({ consent: z.literal(true), revision: z.number().int().nonnegative().max(2147483646), snapshot: syncSnapshotSchema }).strict();
export type SyncRequest = z.infer<typeof syncRequestSchema>;
