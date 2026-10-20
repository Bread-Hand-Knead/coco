import { getCategoryIcon, getFontFamily } from '../lib/financeUtils';
import { useEffect, useState } from 'react';
import { ArrowRightLeft, Check, ChevronLeft, Repeat, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Account, Category, FixedRecord, Transaction } from '../types';
import { HorizontalScrollArea } from '../components/Common';
import { AccountIcon, AccountSelector } from '../components/AccountWidgets';

export function FixedRecordsView({ fixedRecords, accounts, categories, records, onBack, onSave, onDelete }: { 
  fixedRecords: FixedRecord[], 
  accounts: Account[], 
  categories: Category[],
  records: Transaction[],
  onBack: () => void,
  onSave: (fr: FixedRecord) => void,
  onDelete: (id: string) => void
}) {
  const [editingRecord, setEditingRecord] = useState<FixedRecord | null>(null);

  useEffect(() => {
    const handleAdd = () => {
      setEditingRecord({
        id: `fixed_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: '',
        amount: 0,
        type: 'expense',
        period: 'monthly',
        day: 1,
        accountId: accounts[0]?.id || 'cash',
        toAccountId: accounts[1]?.id || '',
        fee: 0,
        category: '其他',
        autoEntry: true
      });
    };
    window.addEventListener('trigger-add-fixed-record', handleAdd);
    return () => window.removeEventListener('trigger-add-fixed-record', handleAdd);
  }, [accounts]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
      style={getFontFamily()}
    >
      <div className="flex-1 px-4 py-6 overflow-y-auto pb-10">
        <div className="bg-white/80 backdrop-blur-sm rounded-[40px] shadow-sm border-2 border-white p-6 space-y-4">
          {fixedRecords.length > 0 ? fixedRecords.map(record => {
            const isTransfer = record.type === 'transfer';
            const srcAcc = (Array.isArray(accounts) ? accounts : []).find(a => a.id === record.accountId);
            const dstAcc = isTransfer ? (Array.isArray(accounts) ? accounts : []).find(a => a.id === record.toAccountId) : null;

            return (
            <div 
              key={record.id} 
              onClick={() => setEditingRecord(record)}
              className="flex items-center gap-4 py-4 border-b border-stone-50 last:border-0 group cursor-pointer hover:bg-stone-50/50 rounded-xl px-2 -mx-2 transition-colors"
            >
              <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white">
                {isTransfer ? (
                  <ArrowRightLeft size={24} className="text-amber-600" />
                ) : (
                  getCategoryIcon(record.category, record.type, categories)
                )}
              </div>
              
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-lg text-[#5D4037] whitespace-pre-wrap break-all leading-tight">
                    {record.name.replace(/\[固定收支\] /g, '').replace(/\[固定收支\]/g, '').trim() || (isTransfer ? '定期轉帳' : '未命名')}
                  </span>
                  {isTransfer && (
                    <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200/60 rounded-full font-black">
                      轉帳
                    </span>
                  )}
                </div>

                {isTransfer ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-500 truncate">
                    <span className="truncate">{srcAcc?.name || '未知帳戶'}</span>
                    <span className="text-amber-600 font-black">➔</span>
                    <span className="truncate">{dstAcc?.name || '未知帳戶'}</span>
                    {(record.fee || 0) > 0 && (
                      <span className="text-[10px] text-stone-400 font-bold ml-1">(手續費 ${record.fee})</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-bold text-stone-400 truncate">
                    {srcAcc?.name || '未知帳戶'} • {record.category}
                  </span>
                )}

                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-400 rounded-full font-bold uppercase">
                    {record.period === 'monthly' ? `每月 ${record.day} 號` : record.period === 'weekly' ? `每週 ${['日','一','二','三','四','五','六'][record.day]}` : '每年'}
                  </span>
                  {record.autoEntry && (
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-500 rounded-full font-bold">自動入帳</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`font-black text-xl ${isTransfer ? 'text-amber-600' : (record.type === 'income' ? 'text-blue-500' : 'text-rose-500')}`} style={getFontFamily()}>
                    {isTransfer ? '' : (record.type === 'income' ? '+' : '-')} $ {Math.abs(record.amount).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          );}) : (

            <div className="flex flex-col items-center justify-center py-20 text-stone-300 gap-4">
              <Repeat size={48} />
              <span className="font-bold">尚無固定收支</span>
              <p className="text-xs">點擊右上角「＋」新增</p>
            </div>
          )}
        </div>
        <div className="h-[40px]" />
      </div>

      <AnimatePresence>
        {editingRecord && (
          <FixedRecordEditModal 
            record={editingRecord}
            accounts={accounts}
            categories={categories}
            records={records}
            onClose={() => setEditingRecord(null)}
            onSave={(updated) => {
              onSave(updated);
              setEditingRecord(null);
            }}
            onDelete={() => {
              onDelete(editingRecord.id);
              setEditingRecord(null);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FixedRecordEditModal({ record, accounts, categories, records, onClose, onSave, onDelete }: { 
  record: FixedRecord, 
  accounts: Account[], 
  categories: Category[],
  records: Transaction[],
  onClose: () => void, 
  onSave: (fr: FixedRecord) => void,
  onDelete: () => void
}) {
  const [edited, setEdited] = useState<FixedRecord>(() => {
    let toAcc = record.toAccountId;
    if (record.type === 'transfer' && (!toAcc || toAcc === record.accountId)) {
      const other = (Array.isArray(accounts) ? accounts : []).find(a => a.id !== record.accountId);
      toAcc = other?.id || '';
    }
    return {
      ...record,
      toAccountId: toAcc,
      fee: record.fee || 0,
      category: record.type === 'transfer' ? (record.category || '轉帳') : record.category
    };
  });
  const [expandedBanks, setExpandedBanks] = useState<Record<string, boolean>>({});
  const [expandedToBanks, setExpandedToBanks] = useState<Record<string, boolean>>({});
  const [amountStr, setAmountStr] = useState<string>(record.amount === 0 ? '' : record.amount.toString());
  const [feeStr, setFeeStr] = useState<string>(record.fee ? record.fee.toString() : '');

  const handleSave = () => {
    if (edited.type === 'transfer') {
      if (!edited.toAccountId || edited.toAccountId === edited.accountId) {
        alert('轉出帳戶與轉入帳戶不可為同一帳戶，請選擇不同帳戶。');
        return;
      }
    }
    onSave({
      ...edited,
      category: edited.type === 'transfer' ? (edited.category || '轉帳') : edited.category,
      fee: edited.type === 'transfer' ? (edited.fee || 0) : undefined,
      toAccountId: edited.type === 'transfer' ? edited.toAccountId : undefined,
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 backdrop-blur-md z-[80] flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        className="bg-[#FFFDF5] w-full max-w-md rounded-t-[40px] p-6 flex flex-col gap-4 max-h-[90vh] overflow-hidden"
        style={getFontFamily()}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
            <ChevronLeft className="w-6 h-6 text-[#5D4037]" />
          </button>
          <span className="text-lg font-bold text-[#5D4037]">設定固定收支</span>
          <button onClick={onDelete} className="p-2 text-rose-400 hover:bg-rose-50 rounded-full transition-colors">
            <Trash2 size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 px-1">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 uppercase">名稱</label>
                <input 
                  value={edited.name}
                  onChange={e => setEdited({ ...edited, name: e.target.value })}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  placeholder={edited.type === 'transfer' ? '如：定期存款' : '如：房租'}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-500 uppercase">金額</label>
                <input 
                  type="number"
                  placeholder="0"
                  value={amountStr}
                  onChange={e => {
                    const val = e.target.value;
                    setAmountStr(val);
                    setEdited({ ...edited, amount: val === '' ? 0 : parseFloat(val) || 0 });
                  }}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                />
              </div>
            </div>

            {/* 類型三選一：支出 / 收入 / 轉帳 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-500 uppercase">類型</label>
              <div className="flex gap-2">
                {(['expense', 'income', 'transfer'] as const).map(t => (
                  <button 
                    key={t}
                    onClick={() => {
                      let newToAccountId = edited.toAccountId;
                      let newCategory = edited.category;
                      if (t === 'transfer') {
                        newCategory = '轉帳';
                        if (!newToAccountId || newToAccountId === edited.accountId) {
                          const other = (Array.isArray(accounts) ? accounts : []).find(a => a.id !== edited.accountId);
                          newToAccountId = other?.id || '';
                        }
                      } else {
                        newCategory = '';
                      }
                      setEdited({
                        ...edited,
                        type: t,
                        toAccountId: newToAccountId,
                        category: newCategory,
                      });
                    }}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                      edited.type === t 
                        ? 'bg-[#5D4037] text-white border-[#5D4037]' 
                        : 'bg-white text-stone-400 border-white'
                    }`}
                  >
                    {t === 'expense' ? '支出' : t === 'income' ? '收入' : '轉帳'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-500 uppercase">週期</label>
              <div className="flex gap-2">
                {['monthly', 'weekly', 'yearly'].map(p => (
                  <button 
                    key={p}
                    onClick={() => setEdited({ ...edited, period: p as any })}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all ${edited.period === p ? 'bg-[#5D4037] text-white border-[#5D4037]' : 'bg-white text-stone-400 border-white'}`}
                  >
                    {p === 'monthly' ? '每月' : p === 'weekly' ? '每週' : '每年'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-500 uppercase">
                {edited.period === 'monthly' ? '扣款日 (幾號)' : edited.period === 'weekly' ? '扣款日 (星期幾)' : '扣款日'}
              </label>
              {edited.period === 'weekly' ? (
                <div className="grid grid-cols-7 gap-1">
                  {['日','一','二','三','四','五','六'].map((d, i) => (
                    <button 
                      key={i}
                      onClick={() => setEdited({ ...edited, day: i })}
                      className={`h-10 rounded-lg font-bold text-xs border-2 transition-all ${edited.day === i ? 'bg-[#FFD54F] border-[#FFD54F]' : 'bg-white border-white text-stone-400'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              ) : (
                <input 
                  type="number"
                  min="1" max="31"
                  value={edited.day}
                  onChange={e => setEdited({ ...edited, day: parseInt(e.target.value) || 1 })}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                />
              )}
            </div>

            {/* 帳戶選擇區：若是轉帳顯示【轉出帳戶】與【轉入帳戶】，否則顯示【扣款帳戶】 */}
            {edited.type === 'transfer' ? (
              <>
                {edited.accountId && edited.toAccountId && edited.accountId === edited.toAccountId && (
                  <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center gap-2 text-amber-900 text-xs font-black shadow-sm mx-1">
                    <span className="text-base shrink-0">⚠️</span>
                    <span>轉出與轉入不可為同一個帳戶，請選擇不同帳戶</span>
                  </div>
                )}
                {/* 轉出帳戶 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-8">
                    <label className="text-[18px] font-bold text-[#000000] uppercase">轉出帳戶</label>
                    <span className="text-xs font-bold text-stone-400">扣款來源</span>
                  </div>
                  <AccountSelector 
                    accounts={accounts}
                    records={records}
                    currentSelectedId={edited.accountId}
                    onSelect={(id) => {
                      let newToAccountId = edited.toAccountId;
                      if (id === newToAccountId) {
                        const other = (Array.isArray(accounts) ? accounts : []).find(a => a.id !== id);
                        newToAccountId = other?.id || '';
                      }
                      setEdited({ ...edited, accountId: id, toAccountId: newToAccountId });
                    }}
                    expandedState={expandedBanks}
                    setExpandedState={setExpandedBanks}
                    keyPrefix="fixed-record-src"
                    disabledAccountIds={edited.toAccountId ? [edited.toAccountId] : []}
                    disabledBadgeText="(已選為轉入帳戶)"
                  />
                </div>

                {/* 轉入帳戶 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-8">
                    <label className="text-[18px] font-bold text-[#000000] uppercase">轉入帳戶</label>
                    <span className="text-xs font-bold text-stone-400">存款目標</span>
                  </div>
                  <AccountSelector 
                    accounts={accounts}
                    records={records}
                    currentSelectedId={edited.toAccountId || ''}
                    onSelect={(id) => {
                      let newSrcId = edited.accountId;
                      if (id === newSrcId) {
                        const other = (Array.isArray(accounts) ? accounts : []).find(a => a.id !== id);
                        newSrcId = other?.id || '';
                      }
                      setEdited({ ...edited, toAccountId: id, accountId: newSrcId });
                    }}
                    expandedState={expandedToBanks}
                    setExpandedState={setExpandedToBanks}
                    keyPrefix="fixed-record-dst"
                    disabledAccountIds={edited.accountId ? [edited.accountId] : []}
                    disabledBadgeText="(已選為轉出帳戶)"
                  />
                </div>

                {/* 手續費欄位 (選填) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-500 uppercase">手續費 (選填)</label>
                    <span className="text-[10px] text-stone-400 font-bold">由轉出帳戶額外扣除</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number"
                      min="0"
                      placeholder="0"
                      value={feeStr}
                      onChange={e => {
                        const val = e.target.value;
                        setFeeStr(val);
                        setEdited({ ...edited, fee: val === '' ? 0 : parseFloat(val) || 0 });
                      }}
                      className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">元</span>
                  </div>
                </div>
              </>
            ) : (
              /* 原 扣款帳戶 */
              <div className="space-y-2">
                <label className="text-[18px] font-bold text-[#000000] uppercase px-8">扣款帳戶</label>
                <AccountSelector 
                  accounts={accounts}
                  records={records}
                  currentSelectedId={edited.accountId}
                  onSelect={(id) => setEdited({ ...edited, accountId: id })}
                  expandedState={expandedBanks}
                  setExpandedState={setExpandedBanks}
                  keyPrefix="fixed-record"
                />
              </div>
            )}

            {/* 選擇分類：若是轉帳則隱藏 */}
            {edited.type !== 'transfer' && (
              <div className="space-y-2">
                <label className="text-[18px] font-bold text-[#000000] uppercase">選擇分類</label>
                <HorizontalScrollArea className="px-8">
                  {categories.filter(c => c.type === edited.type).map(cat => (
                    <button 
                      key={cat.id}
                      onClick={() => setEdited({ ...edited, category: cat.name })}
                      className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-2 border-2 transition-all ${
                        edited.category.split(' > ')[0] === cat.name ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-md' : 'bg-white text-stone-400 border-white shadow-sm'
                      }`}
                    >
                      <div className={`w-10 h-10 ${edited.category.split(' > ')[0] === cat.name ? 'bg-white/20' : 'bg-stone-50'} rounded-full flex items-center justify-center text-xl overflow-hidden`}>
                        <AccountIcon icon={cat.icon} sizeClassName="w-6 h-6" />
                      </div>
                      <span className="text-[18px] font-bold text-[#000000] text-center px-1 leading-tight">{cat.name}</span>
                    </button>
                  ))}
                </HorizontalScrollArea>
                
                {/* Sub Category Selection */}
                {(Array.isArray(categories) ? categories : []).find(c => c.name === edited.category.split(' > ')[0] && c.type === edited.type) && (
                  <div className="mt-2">
                    <HorizontalScrollArea className="px-8">
                      {(Array.isArray(categories) ? categories : []).find(c => c.name === edited.category.split(' > ')[0] && c.type === edited.type)?.sub?.map(sub => (
                        <button 
                          key={sub}
                          onClick={() => setEdited({ ...edited, category: `${edited.category.split(' > ')[0]} > ${sub}` })}
                          className={`flex-shrink-0 px-6 h-12 rounded-full font-bold border-2 transition-all text-[18px] text-[#000000] ${
                            edited.category.includes(sub) ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md' : 'bg-white border-white shadow-sm text-[#000000]'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </HorizontalScrollArea>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <label className="text-xs font-bold text-stone-500 uppercase">備註</label>
              <textarea 
                value={edited.note || ''}
                onChange={e => setEdited({ ...edited, note: e.target.value })}
                className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F] min-h-[100px] resize-none whitespace-pre-wrap break-all"
                placeholder="輸入備註..."
                style={getFontFamily()}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-white rounded-2xl border-2 border-stone-50 shadow-sm">
              <div className="flex flex-col">
                <span className="font-bold text-sm">自動入帳</span>
                <span className="text-[11px] text-stone-500">日期到了自動新增一筆明細</span>
              </div>
              <button 
                onClick={() => setEdited({ ...edited, autoEntry: !edited.autoEntry })}
                className={`w-12 h-6 rounded-full transition-all relative ${edited.autoEntry ? 'bg-emerald-400' : 'bg-stone-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${edited.autoEntry ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Check size={20} /> 儲存設定
          </button>

          <div className="h-[40px]" />
        </div>
      </motion.div>
    </motion.div>
  );
}
