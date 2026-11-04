"use client";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { scanReceipt } from '@/app/receipts/actions';
import { resetBrowserFinances } from '../../../shared/finance-reset';
import { BUILTIN_CATEGORIES } from '../../../shared/category-catalog';
import type { ApiBudget, ApiCategory, ApiSavingsGoal } from '@/lib/types';
type Transaction = {
    id: string;
    type: 'expense' | 'income';
    amount: number;
    date: string;
    category: string;
    description: string;
    merchant?: string;
    receiptUri?: string;
};
type Snapshot = {
    transactions: Transaction[];
    budgets: ApiBudget[];
    categories: ApiCategory[];
    goals: ApiSavingsGoal[];
};
const empty = (): Snapshot => ({ transactions: [], budgets: [], categories: [...BUILTIN_CATEGORIES], goals: [] });
const Context = createContext<{
    data: Snapshot;
    ready: boolean;
    error: string;
    save: (next: Snapshot) => boolean;
    owner: string;
} | null>(null);
const money = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function LocalFinanceProvider({ owner, children }: {
    owner: string;
    children: ReactNode;
}) {
    const [data, setData] = useState<Snapshot>(empty);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState('');
    const key = `save-local-finances:v1:${owner}`;
    const storedSnapshot = useRef<string | null>(null);
    useEffect(() => {
        const read = () => {
            try {
                resetBrowserFinances(localStorage);
                const raw = localStorage.getItem(key);
                const snapshot: Snapshot = raw ? JSON.parse(raw) : empty();
                if (!['transactions', 'budgets', 'categories', 'goals'].every(key => Array.isArray(snapshot[key as keyof Snapshot])))
                    throw new Error('Invalid device snapshot');
                storedSnapshot.current = raw;
                setData(snapshot);
                setError('');
                setReady(true);
            }
            catch {
                setReady(false);
                setError('Could not read browser storage. Allow storage and reload to access your records.');
            }
        };
        read();
        const listener = (event: StorageEvent) => { if (event.key === key || event.key === null)
            read(); };
        window.addEventListener('storage', listener);
        return () => window.removeEventListener('storage', listener);
    }, [key]);
    const save = (next: Snapshot) => {
        try {
            if (!ready)
                throw new Error('Storage unavailable');
            if (localStorage.getItem(key) !== storedSnapshot.current) {
                setError('Records changed in another tab. Reload before saving your changes.');
                return false;
            }
            const raw = JSON.stringify(next);
            localStorage.setItem(key, raw);
            storedSnapshot.current = raw;
            setData(next);
            setError('');
            return true;
        }
        catch {
            setError('Could not save on this device. Browser storage may be full or disabled. Your changes have not been saved.');
            return false;
        }
    };
    return <Context.Provider value={{ data, ready, error, save, owner }}>{children}</Context.Provider>;
}
function useLocal() { const value = useContext(Context); if (!value)
    throw new Error('Local finance provider is required.'); return value; }
function download(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function LocalFinance({ view, id }: {
    view: 'overview' | 'transactions' | 'transaction' | 'budgets' | 'categories' | 'savings' | 'reports';
    id?: string;
}) {
    const { data, ready, error, save, owner } = useLocal();
    const [month, setMonth] = useState(() => today().slice(0, 7));
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [photo, setPhoto] = useState<string>();
    const [readingPhoto, setReadingPhoto] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const item = data.transactions.find(row => row.id === (editing ?? id));
    const budget = data.budgets.find(row => row.id === editing);
    const category = data.categories.find(row => row.id === editing);
    const goal = data.goals.find(row => row.id === editing);
    const rows = data.transactions.filter(row => row.date.startsWith(month) && `${row.description} ${row.category} ${row.merchant ?? ''}`.toLowerCase().includes(search.toLowerCase()));
    const income = rows.filter(row => row.type === 'income').reduce((sum, row) => sum + row.amount, 0);
    const expense = rows.filter(row => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0);
    const remove = (key: keyof Snapshot, recordId: string) => {
        if (!window.confirm('Permanently delete this record from this device?'))
            return;
        const next = { ...data, [key]: data[key].filter(row => row.id !== recordId) };
        if (save(next)) {
            setEditing(null);
            setMessage('Deleted from this device.');
        }
    };
    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const text = (name: string) => String(form.get(name) ?? '').trim();
        const amount = Number(text('amount'));
        if (view !== 'categories' && (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001)) {
            setMessage('Enter a positive amount with at most two decimal places.');
            return;
        }
        const recordId = editing ?? (view === 'transaction' && id !== 'new' ? id : undefined) ?? `local_${crypto.randomUUID()}`;
        let next = data;
        if (view === 'transaction' || view === 'transactions') {
            const row: Transaction = { id: recordId, type: text('type') as Transaction['type'], amount, date: text('date'), category: text('category'), description: text('description'), merchant: text('merchant'), receiptUri: photo ?? item?.receiptUri };
            next = { ...data, transactions: [row, ...data.transactions.filter(row => row.id !== recordId)] };
        }
        else if (view === 'budgets') {
            const row: ApiBudget = { id: recordId, userId: owner, category: text('category'), limit: amount, spent: 0, period: 'monthly' };
            next = { ...data, budgets: [row, ...data.budgets.filter(row => row.id !== recordId)] };
        }
        else if (view === 'categories') {
            const row: ApiCategory = { id: recordId, name: text('name'), type: text('type') as 'expense' | 'income', color: text('color') };
            next = { ...data, categories: [row, ...data.categories.filter(row => row.id !== recordId)] };
        }
        else if (view === 'savings') {
            const fundedAmount = Number(text('fundedAmount') || 0);
            if (!Number.isFinite(fundedAmount) || fundedAmount < 0) {
                setMessage('Enter a valid saved amount.');
                return;
            }
            const row: ApiSavingsGoal = { id: recordId, name: text('name'), targetAmount: amount, fundedAmount, asset: 'PHP', targetDate: text('targetDate') || undefined, status: fundedAmount >= amount ? 'completed' : 'draft' };
            next = { ...data, goals: [row, ...data.goals.filter(row => row.id !== recordId)] };
        }
        if (save(next)) {
            setMessage('Saved on this device.');
            setEditing(null);
            setPhoto(undefined);
            event.currentTarget.reset();
        }
    };
    const attach = async (file?: File) => {
        if (!file)
            return;
        setReadingPhoto(true);
        try {
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)
                throw new Error('Choose a JPEG, PNG or WebP photo up to 5 MB.');
            const uri = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
            setPhoto(uri);
            setMessage('Sending photo to the external AI service for reading…');
            const request = new FormData();
            request.append('file', file);
            request.append('categories', JSON.stringify(data.categories.map(category => category.name)));
            const result = await scanReceipt(request);
            if (!result.ok) throw new Error(result.error);
            if (result.data.currency && result.data.currency.toUpperCase() !== 'PHP')
                throw new Error('Receipt uses a different currency. Enter the PHP amount manually.');
            const extracted = result.data;
            const fields = { amount: extracted.amount.toFixed(2), merchant: extracted.merchant, date: extracted.date, category: extracted.category, description: extracted.notes || `Purchase at ${extracted.merchant}` };
            for (const [name, value] of Object.entries(fields)) {
                const input = formRef.current?.elements.namedItem(name);
                if (value && input instanceof HTMLInputElement && (!input.value.trim() || (name === 'date' && input.value === today()))) input.value = value;
            }
            setMessage('AI reading complete. Review the details, then save the photo and record on this device.');
        }
        catch (error) {
            setMessage(`Photo attached locally. ${error instanceof Error ? error.message : 'Could not read photo.'} Enter details manually if needed.`);
        }
        finally {
            setReadingPhoto(false);
        }
    };
    const title = { overview: 'Your overview', transactions: 'Transactions', transaction: id === 'new' ? 'Add transaction' : 'Transaction details', budgets: 'Budgets', categories: 'Categories', savings: 'Savings goals', reports: 'Reports' }[view];
    return <>
    <div className="page-heading"><div><h1>{title}</h1><p>Financial records and receipt photos stay in this browser on this device.</p></div></div>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {!ready ? <p>{error ? 'Device storage unavailable.' : 'Loading device records…'}</p> : <>
      {['overview', 'transactions', 'reports', 'budgets'].includes(view) && <section className="panel"><label>Month <input type="month" value={month} onChange={event => setMonth(event.target.value)}/></label></section>}
      {['overview', 'reports'].includes(view) && <section className="panel"><dl className="report-stats"><div><dt>Income</dt><dd>{money(income)}</dd></div><div><dt>Expenses</dt><dd>{money(expense)}</dd></div><div><dt>Balance</dt><dd>{money(income - expense)}</dd></div></dl></section>}
      {view === 'reports' && <section className="panel"><button className="button" onClick={() => {
                    const cell = (value: unknown) => { const text = String(value ?? ''); return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`; };
                    const fields = ['date', 'type', 'category', 'description', 'merchant', 'amount'] as const;
                    download(`save-${month}.csv`, [fields.join(','), ...rows.map(row => fields.map(key => cell(row[key])).join(','))].join('\r\n'), 'text/csv');
                }}>Export CSV</button> <button className="button" onClick={() => window.print()}>Print / Save PDF</button></section>}
      {['overview', 'reports', 'transactions'].includes(view) && <section className="panel">
        <div className="panel-heading"><h2>Transactions ({rows.length})</h2><Link className="button primary" href="/transactions/new">Add transaction</Link></div>
        <label>Search <input value={search} onChange={event => setSearch(event.target.value)}/></label>
        {rows.length ? rows.map(row => <article className="panel" key={row.id}><Link href={`/transactions/${row.id}`}>{row.description}</Link><p>{row.date} · {row.category} · {row.type} · {money(row.amount)}</p><button onClick={() => remove('transactions', row.id)}>Delete</button></article>) : <p>No transactions for this month.</p>}
      </section>}
      {view === 'transaction' && id !== 'new' && !item ? <p>This transaction is not stored in this browser.</p> : ['transaction', 'budgets', 'categories', 'savings'].includes(view) && <section className="panel form-panel">
        <h2>{editing ? 'Edit record' : view === 'transaction' && item ? 'Edit transaction' : 'Add record'}</h2>
        <form ref={formRef} key={`${editing ?? id ?? 'new'}:${item?.id ?? ''}`} onSubmit={onSubmit} className="record-form">
          {(view === 'transaction' || view === 'categories') && <label>Type<select name="type" defaultValue={item?.type ?? category?.type ?? 'expense'}><option value="expense">Expense</option><option value="income">Income</option></select></label>}
          {(view === 'transaction' || view === 'budgets') && <label>Category<input name="category" list="local-categories" defaultValue={item?.category ?? budget?.category ?? ''} required/><datalist id="local-categories">{data.categories.map(row => <option key={row.id} value={row.name}/>)}</datalist></label>}
          {view === 'categories' && <><label>Name<input name="name" defaultValue={category?.name ?? ''} required/></label><label>Color<input name="color" type="color" defaultValue={category?.color ?? '#6366f1'}/></label></>}
          {view === 'savings' && <><label>Goal name<input name="name" defaultValue={goal?.name ?? ''} required/></label><label>Saved amount (PHP)<input name="fundedAmount" type="number" min="0" step="0.01" defaultValue={goal?.fundedAmount ?? 0}/></label><label>Target date<input type="date" name="targetDate" defaultValue={goal?.targetDate ?? ''}/></label></>}
          {view !== 'categories' && <label>{view === 'budgets' ? 'Monthly limit' : view === 'savings' ? 'Target amount' : 'Amount'} (PHP)<input name="amount" type="number" min="0.01" step="0.01" defaultValue={item?.amount ?? budget?.limit ?? goal?.targetAmount ?? ''} required/></label>}
          {view === 'transaction' && <><label>Date<input name="date" type="date" defaultValue={item?.date ?? today()} required/></label><label>Description<input name="description" defaultValue={item?.description ?? ''} required/></label><label>Merchant / source<input name="merchant" defaultValue={item?.merchant ?? ''}/></label><label>Receipt photo (external AI reading; saved locally)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void attach(event.target.files?.[0])}/></label>
            {(photo ?? item?.receiptUri)?.startsWith('data:image/') && <><Image src={(photo ?? item?.receiptUri)!} alt="Attached receipt" width={480} height={640} unoptimized style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }}/><p>Receipt attached on this device.</p><a href={photo ?? item?.receiptUri} download="receipt">Save photo</a></>}
          </>}
          <button className="button primary" disabled={readingPhoto} type="submit">{readingPhoto ? 'Reading receipt…' : 'Save on this device'}</button>
          {editing && <button type="button" onClick={() => setEditing(null)}>Cancel edit</button>}
        </form>
        {view === 'transaction' && item && <button onClick={() => remove('transactions', item.id)}>Delete transaction</button>}
      </section>}
      {view === 'budgets' && <section className="panel">{data.budgets.length ? data.budgets.map(row => { const spent = rows.filter(item => item.type === 'expense' && (item.category.toLowerCase() === row.category.toLowerCase() || item.category.toLowerCase().startsWith(row.category.toLowerCase() + ' / '))).reduce((sum, item) => sum + item.amount, 0); return <article className="panel" key={row.id}><h3>{row.category}</h3><p>{money(spent)} spent of {money(row.limit)} monthly</p><button onClick={() => setEditing(row.id)}>Edit</button> <button onClick={() => remove('budgets', row.id)}>Delete</button></article>; }) : <p>No budgets on this device yet.</p>}</section>}
      {view === 'categories' && <section className="panel">{data.categories.map(row => <article key={row.id}><p>{row.name} · {row.type}</p>{!row.builtIn && <><button onClick={() => setEditing(row.id)}>Edit</button> <button onClick={() => remove('categories', row.id)}>Delete</button></>}</article>)}</section>}
      {view === 'savings' && <section className="panel">{data.goals.length ? data.goals.map(row => <article className="panel" key={row.id}><h3>{row.name}</h3><p>{money(row.fundedAmount)} of {money(row.targetAmount)} · {row.status}</p><button onClick={() => setEditing(row.id)}>Edit</button> <button onClick={() => remove('goals', row.id)}>Delete</button></article>) : <p>No savings goals on this device yet.</p>}</section>}
    </>}
  </>;
}
