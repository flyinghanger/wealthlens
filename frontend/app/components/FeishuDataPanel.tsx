'use client';

import { useEffect, useMemo, useState } from 'react';

interface FeishuRecord {
  id: string;
  date: string;
  domestic_usd: number;
  funds_cny: number;
  balance_cny: number;
  provident_fund_cny: number;
  debt_cny: number;
  created_at: number;
  updated_at: number;
}

interface FeishuRecordDraft {
  date: string;
  domestic_usd: string;
  funds_cny: string;
  balance_cny: string;
  provident_fund_cny: string;
  debt_cny: string;
}

const formatCny = (value: number) =>
  `¥${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const emptyDraft: FeishuRecordDraft = {
  date: '',
  domestic_usd: '',
  funds_cny: '',
  balance_cny: '',
  provident_fund_cny: '',
  debt_cny: '',
};

function toDateInputValue(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  const matched = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (matched) {
    const [, year, month, day] = matched;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = String(parsed.getFullYear());
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDraft(record: FeishuRecord): FeishuRecordDraft {
  return {
    date: toDateInputValue(record.date),
    domestic_usd: String(record.domestic_usd ?? 0),
    funds_cny: String(record.funds_cny ?? 0),
    balance_cny: String(record.balance_cny ?? 0),
    provident_fund_cny: String(record.provident_fund_cny ?? 0),
    debt_cny: String(record.debt_cny ?? 0),
  };
}

function toNumber(value: string) {
  const parsed = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function FeishuDataPanel() {
  const [records, setRecords] = useState<FeishuRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, FeishuRecordDraft>>({});
  const [newDraft, setNewDraft] = useState<FeishuRecordDraft>(emptyDraft);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('http://localhost:3001/api/feishu/records');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setRecords(list);
      const nextDrafts: Record<string, FeishuRecordDraft> = {};
      for (const item of list) {
        nextDrafts[item.id] = toDraft(item);
      }
      setDrafts(nextDrafts);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const totalLatestCny = useMemo(() => {
    if (records.length === 0) return 0;
    const latest = records[0];
    return (
      Number(latest.funds_cny || 0) +
      Number(latest.balance_cny || 0) +
      Number(latest.provident_fund_cny || 0) +
      Number(latest.debt_cny || 0)
    );
  }, [records]);

  const handleCreate = async () => {
    try {
      const normalizedDate = toDateInputValue(newDraft.date);
      if (!normalizedDate) {
        setError('Date is required');
        return;
      }

      setCreating(true);
      setError('');
      const payload = {
        date: normalizedDate,
        domestic_usd: toNumber(newDraft.domestic_usd),
        funds_cny: toNumber(newDraft.funds_cny),
        balance_cny: toNumber(newDraft.balance_cny),
        provident_fund_cny: toNumber(newDraft.provident_fund_cny),
        debt_cny: toNumber(newDraft.debt_cny),
      };

      const res = await fetch('http://localhost:3001/api/feishu/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Create failed (${res.status})`);
      }

      setNewDraft(emptyDraft);
      await fetchRecords();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create record');
    } finally {
      setCreating(false);
    }
  };

  const handleSave = async (id: string) => {
    try {
      const draft = drafts[id];
      if (!draft) {
        return;
      }

      const normalizedDate = toDateInputValue(draft.date);
      if (!normalizedDate) {
        setError('Date is required');
        return;
      }

      setSavingId(id);
      setError('');

      const payload = {
        date: normalizedDate,
        domestic_usd: toNumber(draft.domestic_usd),
        funds_cny: toNumber(draft.funds_cny),
        balance_cny: toNumber(draft.balance_cny),
        provident_fund_cny: toNumber(draft.provident_fund_cny),
        debt_cny: toNumber(draft.debt_cny),
      };

      const res = await fetch(`http://localhost:3001/api/feishu/records/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Save failed (${res.status})`);
      }

      await fetchRecords();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save record');
    } finally {
      setSavingId('');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setSavingId(id);
      setError('');
      const res = await fetch(`http://localhost:3001/api/feishu/records/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`Delete failed (${res.status})`);
      }

      await fetchRecords();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete record');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Domestic Data Panel</h2>
            <p className="mt-1 text-sm text-gray-400">
              Local table for manual monthly updates (domestic USD + CNY funds/cash/PF/debt).
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-gray-500">Latest CNY Total</div>
            <div className="text-lg font-semibold text-emerald-300">{formatCny(totalLatestCny)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <div className="mb-3 text-sm font-semibold text-gray-200">Add / Upsert by Date</div>
        <div className="grid gap-2 md:grid-cols-6">
          <input
            type="date"
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
            value={newDraft.date}
            onChange={(event) => setNewDraft((prev) => ({ ...prev, date: event.target.value }))}
          />
          <input
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
            placeholder="Domestic USD (USD)"
            value={newDraft.domestic_usd}
            onChange={(event) => setNewDraft((prev) => ({ ...prev, domestic_usd: event.target.value }))}
          />
          <input
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
            placeholder="Domestic Funds (CNY)"
            value={newDraft.funds_cny}
            onChange={(event) => setNewDraft((prev) => ({ ...prev, funds_cny: event.target.value }))}
          />
          <input
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
            placeholder="Cash Balance (CNY)"
            value={newDraft.balance_cny}
            onChange={(event) => setNewDraft((prev) => ({ ...prev, balance_cny: event.target.value }))}
          />
          <input
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
            placeholder="Provident Fund (CNY)"
            value={newDraft.provident_fund_cny}
            onChange={(event) =>
              setNewDraft((prev) => ({ ...prev, provident_fund_cny: event.target.value }))
            }
          />
          <input
            className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100"
            placeholder="Receivables (Debt, CNY)"
            value={newDraft.debt_cny}
            onChange={(event) => setNewDraft((prev) => ({ ...prev, debt_cny: event.target.value }))}
          />
        </div>
        <div className="mt-3">
          <button
            className="rounded-md border border-emerald-600/40 bg-emerald-900/40 px-3 py-1.5 text-sm text-emerald-300 disabled:opacity-50"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Saving...' : 'Save Record'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
        <div className="border-b border-gray-800 px-5 py-3 text-sm font-semibold text-gray-200">
          Manual Records (Newest First)
        </div>
        {loading ? (
          <div className="px-5 py-8 text-sm text-gray-400">Loading...</div>
        ) : records.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-400">No records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Domestic USD (USD)</th>
                  <th className="px-3 py-2 text-right">Domestic Funds (CNY)</th>
                  <th className="px-3 py-2 text-right">Cash Balance (CNY)</th>
                  <th className="px-3 py-2 text-right">Provident Fund (CNY)</th>
                  <th className="px-3 py-2 text-right">Receivables (Debt, CNY)</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const draft = drafts[record.id] || toDraft(record);
                  return (
                    <tr key={record.id} className="border-t border-gray-800/70">
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          className="w-36 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-sm text-gray-200"
                          value={draft.date}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [record.id]: { ...draft, date: event.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          className="w-32 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-right text-sm text-gray-200"
                          value={draft.domestic_usd}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [record.id]: { ...draft, domestic_usd: event.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          className="w-36 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-right text-sm text-gray-200"
                          value={draft.funds_cny}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [record.id]: { ...draft, funds_cny: event.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          className="w-36 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-right text-sm text-gray-200"
                          value={draft.balance_cny}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [record.id]: { ...draft, balance_cny: event.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          className="w-36 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-right text-sm text-gray-200"
                          value={draft.provident_fund_cny}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [record.id]: {
                                ...draft,
                                provident_fund_cny: event.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          className="w-36 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-right text-sm text-gray-200"
                          value={draft.debt_cny}
                          onChange={(event) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [record.id]: { ...draft, debt_cny: event.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded border border-blue-600/40 bg-blue-900/40 px-2 py-1 text-xs text-blue-300 disabled:opacity-50"
                            onClick={() => handleSave(record.id)}
                            disabled={savingId === record.id}
                          >
                            {savingId === record.id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            className="rounded border border-red-600/40 bg-red-900/40 px-2 py-1 text-xs text-red-300 disabled:opacity-50"
                            onClick={() => handleDelete(record.id)}
                            disabled={savingId === record.id}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-700/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
