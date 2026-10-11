import { getCategoryIcon, getFontFamily } from '../lib/financeUtils';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Account, Category, Project, Transaction } from '../types';
import { getTimestamp } from '../lib/dateUtils';
import { getMergedRecords, getTransactionTitle, getTransferCounterpartName } from '../lib/recordUtils';
import { EditRecordModal } from './EditRecordModal';

export function SearchView({ 
  records, 
  accounts, 
  categories, 
  projects,
  onBack,
  onUpdateRecord,
  onDeleteRecord,
  onReorder,
  onDuplicateRecord
}: { 
  records: Transaction[], 
  accounts: Account[], 
  categories: Category[], 
  projects: Project[],
  onBack: () => void,
  onUpdateRecord: (old: Transaction, updated: Transaction, ...args: any[]) => void,
  onDeleteRecord: (record: Transaction) => void,
  onReorder: (records: Transaction[]) => void,
  onDuplicateRecord?: (record: Transaction) => void
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRecord, setEditingRecord] = useState<Transaction | null>(null);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const raw = records.filter(r => 
      !r.isMergedChild && !r.parentId && !r.parentTransactionId && !r.isChildTransaction &&
      ((r.note || '').toLowerCase().includes(query) || 
      r.category.toLowerCase().includes(query) ||
      r.amount.toString().includes(query))
    );
    const merged = getMergedRecords(raw, accounts);
    return merged.sort((a, b) => {
      const tsA = getTimestamp(a.date, a.time);
      const tsB = getTimestamp(b.date, b.time);
      if (tsB !== tsA) return tsB - tsA;
      return b.amount - a.amount;
    });
  }, [records, searchQuery, accounts]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
      style={getFontFamily()}
    >
      {/* Header */}
      <div className="p-6 pt-2 pb-2">
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" />
          <input 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜尋關鍵字、金額或分類..."
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-white rounded-[25px] shadow-sm text-lg font-bold text-[#5D4037] outline-none focus:border-[#FFD54F] transition-all"
            style={getFontFamily()}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {searchQuery.trim() === '' ? (
          <div className="flex flex-col items-center justify-center h-40 text-stone-300 gap-2 opacity-50">
            <Search size={40} />
            <span className="font-bold">輸入關鍵字開始搜尋</span>
          </div>
        ) : filteredRecords.length > 0 ? (
          <div className="space-y-4">
            <div className="text-xs font-bold text-stone-300 px-1">找到 {filteredRecords.length} 筆符合的紀錄</div>
            {filteredRecords.map((record, idx) => (
              <div 
                key={record.id} 
                className="flex items-center gap-2 py-4 bg-white/60 backdrop-blur-sm rounded-[30px] px-4 shadow-sm border border-white hover:bg-white transition-colors group relative"
              >
                <div 
                  onClick={() => setEditingRecord(record)}
                  className="flex-1 flex items-center gap-4 cursor-pointer"
                >
                  <div className="w-14 h-14 bg-[#FFFDF5] rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-white group-active:scale-95 transition-transform">
                    {getCategoryIcon(record.category, record.type, categories)}
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <span className="font-black text-lg text-[#5D4037] whitespace-pre-wrap break-all leading-tight" style={getFontFamily()}>
                    {getTransactionTitle(record)}
                  </span>
                  {record.type === 'transfer' ? (
                    (() => {
                      const isPos = record.amount > 0;
                      const currentAccName = (Array.isArray(accounts) ? accounts : []).find(a => a.id === record.accountId)?.name || '未知帳戶';
                      const counterpartAccName = getTransferCounterpartName(record, accounts);
                      const firstAccName = isPos ? counterpartAccName : currentAccName;
                      const secondAccName = isPos ? currentAccName : counterpartAccName;
                      const displayDate = record.postingDate || record.date;
                      return (
                        <div className="flex flex-col gap-0.5">
                          {/* Line 2: Account A ➔ Account B */}
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#5D4037]" style={getFontFamily()}>
                            <span className="opacity-80" style={getFontFamily()}>{firstAccName}</span>
                            <span className="text-amber-600 font-bold" style={getFontFamily()}>➔</span>
                            <span className="opacity-80 font-black text-amber-800" style={getFontFamily()}>{secondAccName}</span>
                          </div>
                          {/* Line 3: Date as subtext YYYY-MM-DD */}
                          <span className="text-[11px] font-medium text-stone-400" style={getFontFamily()}>
                            入帳日期: {displayDate}
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-stone-300">
                        {record.date}
                      </span>
                      <span className="text-[10px] font-bold text-stone-300 bg-stone-50 px-2 rounded-full">
                        {(Array.isArray(accounts) ? accounts : []).find(a => a.id === record.accountId)?.name}
                      </span>
                    </div>
                  )}
                </div>
                
                <span className={`font-black text-lg ${
                  (record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? 'text-[#E91E63]' : 'text-[#03A9F4]') :
                  record.type === 'income' ? 'text-[#03A9F4]' : 
                  record.type === 'expense' ? 'text-[#E91E63]' : 'text-stone-400'
                }`} style={getFontFamily()}>
                  {((record.type === 'transfer' || record._isMergedTransfer) ? (record.amount < 0 ? '-' : '+') : record.type === 'income' ? '+' : record.type === 'expense' ? '-' : '')} $ {Math.abs(record.amount).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-stone-300 gap-2 opacity-50">
            <span className="font-bold">找不到符合「{searchQuery}」的紀錄</span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingRecord && (
          <EditRecordModal 
            record={editingRecord}
            records={records}
            accounts={accounts}
            projects={projects}
            categories={categories}
            onClose={() => setEditingRecord(null)}
            onSave={(updated, mergedIdsToDelete, restoredIds) => {
              onUpdateRecord(editingRecord, updated, mergedIdsToDelete, restoredIds);
              setEditingRecord(null);
            }}
            onDelete={() => {
              onDeleteRecord(editingRecord);
              setEditingRecord(null);
            }}
            onDuplicate={(rec) => {
              setEditingRecord(null);
              onDuplicateRecord?.(rec);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
