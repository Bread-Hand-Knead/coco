import { getFontFamily } from '../lib/financeUtils';
import { useMemo, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Account, RateHistoryItem, Transaction } from '../types';
import { getLatestExchangeRate } from '../lib/recordUtils';
import { calculateAccountBalance } from '../lib/accountUtils';

export function ExchangeRateModal({
  account,
  accounts = [],
  records,
  isOpen,
  onClose,
  onSaveAccount
}: {
  account: Account;
  accounts?: Account[];
  records: Transaction[];
  isOpen?: boolean;
  onClose: () => void;
  onSaveAccount: (updatedAccount: Account, initialAmount?: number) => void;
}) {
  const currentBalance = useMemo(() => {
    return calculateAccountBalance(account, accounts, records);
  }, [account, accounts, records]);

  const latestRate = useMemo(() => {
    return getLatestExchangeRate(records, accounts, account.currency || 'USD');
  }, [records, accounts, account.currency]);

  const [rateInput, setRateInput] = useState(() => {
    if (account.rateHistory && account.rateHistory.length > 0) {
      const sorted = [...account.rateHistory].sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        return (b.time || '').localeCompare(a.time || '');
      });
      return sorted[0].rate.toString();
    }
    return latestRate.toString();
  });

  const [dateInput, setDateInput] = useState(() => new Date().toISOString().split('T')[0]);
  const [timeInput, setTimeInput] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [noteInput, setNoteInput] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const curName = account.currency || 'USD';

  const historyLogs = useMemo(() => {
    const logs = account.rateHistory || [];
    return [...logs].sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return (b.time || '').localeCompare(a.time || '');
    });
  }, [account.rateHistory]);

  const handleAddOrUpdateLog = () => {
    const rVal = parseFloat(rateInput);
    if (isNaN(rVal) || rVal <= 0) {
      alert('請輸入有效的匯率數值！');
      return;
    }
    if (!dateInput) {
      alert('請選擇日期！');
      return;
    }

    let updatedLogs: RateHistoryItem[] = account.rateHistory ? [...account.rateHistory] : [];

    if (editingLogId) {
      updatedLogs = updatedLogs.map(l => l.id === editingLogId ? {
        ...l,
        date: dateInput,
        time: timeInput,
        rate: rVal,
        note: noteInput.trim() || undefined
      } : l);
      setEditingLogId(null);
    } else {
      const newLog: RateHistoryItem = {
        id: `rate_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        date: dateInput,
        time: timeInput,
        rate: rVal,
        note: noteInput.trim() || undefined
      };
      updatedLogs.push(newLog);
    }

    onSaveAccount({
      ...account,
      rateHistory: updatedLogs
    });

    setNoteInput('');
  };

  const handleDeleteLog = (logId: string) => {
    if (window.confirm('確定要刪除這筆歷史匯率紀錄嗎？')) {
      const updatedLogs = (account.rateHistory || []).filter(l => l.id !== logId);
      onSaveAccount({
        ...account,
        rateHistory: updatedLogs
      });
      if (editingLogId === logId) {
        setEditingLogId(null);
      }
    }
  };

  const handleEditLog = (item: RateHistoryItem) => {
    setEditingLogId(item.id);
    setRateInput(item.rate.toString());
    setDateInput(item.date);
    setTimeInput(item.time || '12:00');
    setNoteInput(item.note || '');
  };

  const currentPreviewTwd = Math.round(currentBalance * (parseFloat(rateInput) || latestRate));

  return (
    <div className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#FFF9E3] w-full max-w-lg rounded-[36px] p-6 shadow-2xl border-2 border-white flex flex-col gap-4 max-h-[85vh] overflow-hidden"
        style={getFontFamily()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#5D4037]/10 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💱</span>
            <div>
              <h3 className="text-lg font-black text-[#5D4037]">
                {account.name} 匯率紀錄與換算
              </h3>
              <p className="text-xs font-bold text-stone-400">
                目前外幣餘額: {currentBalance.toLocaleString()} {curName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400 hover:text-stone-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {/* Rate Entry Form */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/70 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#5D4037]">
                {editingLogId ? '編輯匯率紀錄' : '記錄最新匯率'}
              </span>
              {editingLogId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingLogId(null);
                    setNoteInput('');
                  }}
                  className="text-xs font-bold text-stone-400 hover:underline"
                >
                  取消編輯
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-stone-500">外幣幣別</label>
                <input
                  type="text"
                  value={curName}
                  disabled
                  className="w-full px-3 py-2 bg-stone-100 rounded-xl text-xs font-black text-[#5D4037] border border-stone-200/50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-stone-500">本次匯率 (1 {curName} = ? TWD)</label>
                <input
                  type="number"
                  step="any"
                  value={rateInput}
                  onChange={e => setRateInput(e.target.value)}
                  placeholder="例如: 0.2184"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-black text-[#5D4037] outline-none focus:bg-white focus:border-[#FFD54F]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-stone-500">記錄日期</label>
                <input
                  type="date"
                  value={dateInput}
                  onChange={e => setDateInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-[#5D4037] outline-none focus:bg-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-stone-500">記錄時間</label>
                <input
                  type="time"
                  value={timeInput}
                  onChange={e => setTimeInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-[#5D4037] outline-none focus:bg-white"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-stone-500">備註說明 (選填)</label>
              <input
                type="text"
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="如：台銀現金賣出、網銀換匯"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-[#5D4037] outline-none focus:bg-white"
              />
            </div>

            <div className="pt-1 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs font-bold text-stone-500">
                即時試算折合：<strong className="text-[#5D4037] font-black text-sm">NT$ {currentPreviewTwd.toLocaleString()}</strong>
              </div>
              <button
                type="button"
                onClick={handleAddOrUpdateLog}
                className="px-4 py-2 bg-[#5D4037] hover:bg-[#4E342E] text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all"
              >
                {editingLogId ? '儲存更新' : '新增匯率紀錄'}
              </button>
            </div>
          </div>

          {/* History List */}
          <div className="space-y-2">
            <span className="text-xs font-black text-stone-500 uppercase tracking-widest px-1 block">
              歷史匯率追蹤清單 ({historyLogs.length})
            </span>

            {historyLogs.length === 0 ? (
              <div className="p-8 text-center bg-white/50 rounded-2xl border border-dashed border-stone-200 text-stone-400 text-xs font-bold">
                尚無歷史匯率紀錄，點擊上方按鈕新增紀錄！
              </div>
            ) : (
              historyLogs.map(item => {
                const twdVal = Math.round(currentBalance * item.rate);
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-white rounded-2xl border border-stone-100 flex items-center justify-between shadow-2xs hover:border-amber-200 transition-all gap-3"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs font-black text-[#5D4037] flex-wrap">
                        <span>匯率: {item.rate}</span>
                        <span className="text-stone-300">•</span>
                        <span className="text-emerald-700">(折合 NT$ {twdVal.toLocaleString()})</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-bold text-stone-400 flex-wrap">
                        <span>{item.date.replace(/-/g, '/')} {item.time || ''}</span>
                        {item.note && (
                          <>
                            <span className="text-stone-300">•</span>
                            <span className="text-stone-500 italic truncate">{item.note}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditLog(item)}
                        className="p-1.5 text-stone-400 hover:text-amber-600 rounded-lg hover:bg-stone-50 transition-colors"
                        title="編輯紀錄"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLog(item.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-500 rounded-lg hover:bg-stone-50 transition-colors"
                        title="刪除紀錄"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#5D4037]/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-[#5D4037] text-white rounded-2xl font-black text-sm shadow-md hover:bg-[#4E342E] transition-all"
          >
            完成關閉
          </button>
        </div>
      </motion.div>
    </div>
  );
}
