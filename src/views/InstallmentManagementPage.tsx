import { CustomInstallmentItem, generateDefaultCustomSchedule, getCorrectInstallmentDate, getFontFamily } from '../lib/financeUtils';
import { useEffect, useMemo, useState } from 'react';
import { NumberInput } from '../components/NumberInput';
import { CreditCard, Pencil, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Transaction } from '../types';
import { formatLocalDate } from '../lib/dateUtils';

export function InstallmentManagementPage({ records, onDeleteGroup, onEarlySettlement, onUpdateGroup }: { 
  records: Transaction[], 
  onDeleteGroup: (groupId: string) => void,
  onEarlySettlement: (groupId: string, remainingAmount: number, firstRecord: Transaction) => void,
  onUpdateGroup: (groupId: string, newNote: string, newTotalAmount: number, newTotalInstallments: number, customSchedule?: CustomInstallmentItem[]) => void
}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSettleConfirmOpen, setIsSettleConfirmOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [settleInfo, setSettleInfo] = useState<{ amount: number, first: Transaction } | null>(null);

  const [editingGroup, setEditingGroup] = useState<Transaction[] | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editTotalAmount, setEditTotalAmount] = useState('');
  const [editTotalInstallments, setEditTotalInstallments] = useState(12);

  const [isCustomInstallment, setIsCustomInstallment] = useState(false);
  const [customSchedules, setCustomSchedules] = useState<CustomInstallmentItem[]>([]);

  useEffect(() => {
    if (editingGroup && editingGroup.length > 0) {
      const first = editingGroup[0];
      setEditNote(first.note?.split(' (分期')[0] || '');
      const actualTotalAmount = editingGroup.reduce((sum, r) => sum + Math.abs(r.amount), 0);
      setEditTotalAmount(actualTotalAmount.toString());
      const totalTerms = first.totalInstallments || editingGroup.length || 12;
      setEditTotalInstallments(totalTerms);

      const sorted = [...editingGroup].sort((a, b) => (a.currentInstallment || 0) - (b.currentInstallment || 0));

      const hasCustomFlag = sorted.some(r => 
        r.isCustomInstallment || 
        r.isCustomSchedule || 
        (r.customSchedule && r.customSchedule.length > 0) || 
        (r.installmentList && r.installmentList.length > 0)
      );

      const firstCustomSchedule = sorted.find(r => (r.customSchedule && r.customSchedule.length > 0) || (r.installmentList && r.installmentList.length > 0));
      let items: CustomInstallmentItem[] = [];

      if (firstCustomSchedule?.customSchedule && firstCustomSchedule.customSchedule.length > 0) {
        items = firstCustomSchedule.customSchedule;
      } else if (firstCustomSchedule?.installmentList && firstCustomSchedule.installmentList.length > 0) {
        items = firstCustomSchedule.installmentList;
      } else {
        items = sorted.map((r, idx) => ({
          installment: r.currentInstallment || (idx + 1),
          date: r.postingDate || r.date,
          amount: Math.abs(r.amount)
        }));
      }

      setCustomSchedules(items);

      if (hasCustomFlag) {
        setIsCustomInstallment(true);
      } else {
        const startDate = first.date;
        const baseAmt = Math.floor(actualTotalAmount / totalTerms);
        const remainderAmt = actualTotalAmount - (baseAmt * totalTerms);
        const isCustom = sorted.some((r, idx) => {
          const expectedDate = getCorrectInstallmentDate(startDate, r.currentInstallment || (idx + 1));
          const expectedAmt = (idx + 1) <= remainderAmt ? baseAmt + 1 : baseAmt;
          return (r.postingDate && r.postingDate !== expectedDate) || Math.abs(r.amount) !== expectedAmt;
        });
        setIsCustomInstallment(isCustom);
      }
    }
  }, [editingGroup]);

  const handleSaveEdit = () => {
    if (!editingGroup) return;
    const first = editingGroup[0];
    const groupId = first.installmentGroupId!;
    const amt = parseFloat(editTotalAmount) || 0;
    if (amt <= 0) {
      alert('請輸入有效的金額！');
      return;
    }
    const terms = editTotalInstallments;
    if (terms < 1 || terms > 36) {
      alert('期數必須介於 1 到 36 之間！');
      return;
    }
    const trimmedNote = editNote.trim();
    if (!trimmedNote) {
      alert('請輸入名稱！');
      return;
    }

    onUpdateGroup(groupId, trimmedNote, amt, terms, isCustomInstallment ? customSchedules : undefined);
    setEditingGroup(null);
  };

  const installmentGroups = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    records.forEach(r => {
      if (r.isInstallment && r.installmentGroupId) {
        if (!groups[r.installmentGroupId]) groups[r.installmentGroupId] = [];
        groups[r.installmentGroupId].push(r);
      }
    });
    return Object.values(groups).sort((a, b) => b[0].date.localeCompare(a[0].date));
  }, [records]);

  const handleDelete = () => {
    if (selectedGroupId) {
      onDeleteGroup(selectedGroupId);
      setIsConfirmOpen(false);
      setSelectedGroupId(null);
    }
  };

  const handleEarlySettlementAction = () => {
    if (selectedGroupId && settleInfo) {
      onEarlySettlement(selectedGroupId, settleInfo.amount, settleInfo.first);
      setIsSettleConfirmOpen(false);
      setSelectedGroupId(null);
      setSettleInfo(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
    >
      <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-24 pt-4">
        {installmentGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-20 h-20 bg-white rounded-[30px] flex items-center justify-center text-stone-200 shadow-sm">
              <CreditCard size={40} />
            </div>
            <p className="text-stone-300 font-bold">目前沒有進行中的分期項目</p>
          </div>
        ) : (
          installmentGroups.map(group => {
            const first = group[0];
            const isSettled = first.status === 'settled' || group.some(r => r.isCompleted);
            const totalAmount = group.reduce((sum, r) => sum + r.amount, 0);
            const total = first.totalInstallments || 1;
            
            const amounts = group.map(r => r.amount);
            const minAmt = Math.min(...amounts);
            const maxAmt = Math.max(...amounts);
            const perAmountStr = minAmt === maxAmt
              ? `${minAmt < 0 ? '-' : ''}$${Math.abs(minAmt).toLocaleString()}`
              : `${minAmt < 0 ? '-' : ''}$${Math.abs(minAmt).toLocaleString()} ~ ${maxAmt < 0 ? '-' : ''}$${Math.abs(maxAmt).toLocaleString()}`;
            
            const today = new Date().toISOString().split('T')[0];
            const paidCount = isSettled ? total : group.filter(r => (r.postingDate || r.date) <= today).length;
            const progress = (paidCount / total) * 100;

            return (
              <div 
                key={first.installmentGroupId}
                className="bg-white p-6 rounded-[30px] border-2 border-white shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xl font-black text-[#5D4037]">{first.note?.split(' (分期')[0]}</span>
                    <span className="text-[13px] font-bold text-stone-400 mt-1 uppercase tracking-wide">
                      起始日：{first.date.replace(/-/g, '/')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setEditingGroup(group)}
                      className="p-2 text-stone-200 hover:text-[#FFD54F] transition-colors"
                    >
                      <Pencil size={20} />
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedGroupId(first.installmentGroupId!);
                        setIsConfirmOpen(true);
                      }}
                      className="p-2 text-stone-200 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={24} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-stone-300">總金額</span>
                    <span className="text-[18px] font-black text-[#E91E63]">
                      {totalAmount < 0 ? '-' : ''}${Math.abs(totalAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-stone-300">每期金額</span>
                    <span className="text-[18px] font-black text-[#E91E63]">
                      {perAmountStr}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-300">還款進度</span>
                    <span className="text-sm font-black text-[#5D4037]">
                      {isSettled ? `第 ${total} / ${total} 期 (已結清)` : `第 ${paidCount} / ${total} 期`}
                    </span>
                  </div>
                  <div className="h-3 bg-stone-50 rounded-full overflow-hidden border border-stone-100 shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full rounded-full bg-[#FFD54F]"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  {isSettled ? (
                    <div className="w-full py-3 bg-[#FFD54F]/10 text-[#5D4037] rounded-xl font-bold text-sm text-center border border-[#FFD54F]/20">
                      ✅ 已提前結清
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        const unpaidRecords = group.filter(r => r.date > today);
                        const remainingAmount = unpaidRecords.reduce((sum, r) => sum + r.amount, 0);
                        
                        if (remainingAmount <= 0) {
                          alert('此分期已無剩餘未付金額！');
                          return;
                        }

                        setSelectedGroupId(first.installmentGroupId!);
                        setSettleInfo({ amount: remainingAmount, first: first });
                        setIsSettleConfirmOpen(true);
                      }}
                      className="w-full py-3 bg-stone-50 text-[#5D4037] rounded-xl font-bold text-sm hover:bg-[#FFD54F]/20 transition-colors"
                    >
                      提前結清
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {isConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsConfirmOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FFF9E3] w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative z-10 border-2 border-white"
            >
              <h3 className="text-xl font-black text-[#5D4037] text-center mb-4">確定要刪除這筆分期付款嗎？</h3>
              <p className="text-stone-400 font-bold text-center mb-8">刪除後將無法恢復所有相關紀錄。</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsConfirmOpen(false)}
                  className="py-4 bg-white text-stone-400 rounded-2xl font-black shadow-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleDelete}
                  className="py-4 bg-[#5D4037] text-white rounded-2xl font-black shadow-lg shadow-stone-200"
                >
                  確定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettleConfirmOpen && settleInfo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsSettleConfirmOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FFF9E3] w-full max-sm rounded-[40px] p-8 shadow-2xl relative z-10 border-2 border-white"
            >
              <h3 className="text-xl font-black text-[#5D4037] text-center mb-4">提前結清確認</h3>
              <p className="text-stone-400 font-bold text-center mb-8">確定要提前結清剩餘的 ${settleInfo.amount.toLocaleString()} 元嗎？這將會一次性入帳並結束此分期計畫。</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsSettleConfirmOpen(false)}
                  className="py-4 bg-white text-stone-400 rounded-2xl font-black shadow-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleEarlySettlementAction}
                  className="py-4 bg-[#5D4037] text-white rounded-2xl font-black shadow-lg shadow-stone-200"
                >
                  確定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingGroup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setEditingGroup(null)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#FFF9E3] w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative z-10 border-2 border-white flex flex-col gap-5 max-h-[85vh] overflow-y-auto no-scrollbar"
              style={getFontFamily()}
            >
              <h3 className="text-xl font-black text-[#5D4037] text-center">編輯分期付款</h3>
              
              <div className="space-y-2">
                <label className="text-sm font-black text-stone-500 uppercase tracking-widest px-1">名稱</label>
                <input 
                  type="text"
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-black text-lg text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  placeholder="分期名稱"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-stone-500 uppercase tracking-widest px-1">總金額</label>
                <input 
                  type="number"
                  value={editTotalAmount}
                  onChange={e => setEditTotalAmount(e.target.value)}
                  className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-black text-2xl text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  placeholder="總金額"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-stone-500 uppercase tracking-widest px-1">分期期數 (1-36)</label>
                  <input 
                    type="number"
                    min="1"
                    max="36"
                    value={editTotalInstallments}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 1;
                      setEditTotalInstallments(val);
                      if (isCustomInstallment) {
                        setCustomSchedules(prev => {
                          if (prev.length === val) return prev;
                          if (prev.length < val) {
                            const first = editingGroup ? editingGroup[0] : null;
                            const startDateStr = first ? first.date : formatLocalDate(new Date());
                            const totalAmt = parseFloat(editTotalAmount) || 0;
                            const defaultFull = generateDefaultCustomSchedule(totalAmt, val, startDateStr);
                            const extra: CustomInstallmentItem[] = [];
                            for (let i = prev.length + 1; i <= val; i++) {
                              extra.push(defaultFull[i - 1] || { installment: i, date: getCorrectInstallmentDate(startDateStr, i), amount: 0 });
                            }
                            return [...prev, ...extra];
                          } else {
                            return prev.slice(0, val);
                          }
                        });
                      }
                    }}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-black text-lg text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-stone-500 uppercase tracking-widest px-1">每期金額</label>
                  <div className="w-full p-4 bg-stone-50 border border-stone-200/50 rounded-2xl font-black text-sm text-[#5D4037] leading-relaxed">
                    {(() => {
                      const totalAmt = Math.abs(parseFloat(editTotalAmount) || 0);
                      const terms = editTotalInstallments;
                      const base = Math.floor(totalAmt / terms);
                      const remainder = totalAmt - (base * terms);
                      if (remainder === 0) {
                        return `$${base.toLocaleString()}`;
                      } else {
                        return `${remainder} 期 $${(base + 1).toLocaleString()} + ${terms - remainder} 期 $${base.toLocaleString()}`;
                      }
                    })()}
                  </div>
                </div>
              </div>

              {/* 自訂每期明細 (金額與日期) 開關與編輯區塊 */}
              <div className="pt-3 border-t border-stone-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#5D4037]">自訂每期明細 (金額與日期)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !isCustomInstallment;
                      setIsCustomInstallment(nextState);
                      if (nextState && (!customSchedules || customSchedules.length === 0)) {
                        const first = editingGroup ? editingGroup[0] : null;
                        const startDateStr = first ? first.date : formatLocalDate(new Date());
                        setCustomSchedules(generateDefaultCustomSchedule(parseFloat(editTotalAmount) || 0, editTotalInstallments, startDateStr));
                      }
                    }}
                    className={`w-12 h-6 rounded-full transition-all relative ${isCustomInstallment ? 'bg-[#5D4037]' : 'bg-stone-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isCustomInstallment ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {isCustomInstallment && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-1">
                    <div className="text-xs font-bold text-stone-400">
                      分期明細清單 (第 1 期 ～ 第 {editTotalInstallments} 期)
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                      {customSchedules.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white/90 p-2.5 rounded-2xl border border-stone-200/80 shadow-2xs">
                          <span className="text-xs font-black text-[#5D4037] w-14 shrink-0">第 {item.installment} 期</span>
                          <div className="flex-1 space-y-1">
                            <label className="text-[11px] font-bold text-stone-500 block">扣款/入帳日期</label>
                            <input
                              type="date"
                              value={item.date}
                              onChange={e => {
                                const val = e.target.value;
                                setCustomSchedules(prev => prev.map((it, i) => i === idx ? { ...it, date: val } : it));
                                setIsCustomInstallment(true);
                              }}
                              className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-[#5D4037] outline-none focus:border-[#FFD54F]"
                              style={getFontFamily()}
                            />
                          </div>
                          <div className="w-28 shrink-0 space-y-1">
                            <label className="text-[11px] font-bold text-stone-500 block">本期金額</label>
                            <NumberInput
                              min="0"
                              value={item.amount}
                              onValueChange={val => {
                                setCustomSchedules(prev => prev.map((it, i) => i === idx ? { ...it, amount: val } : it));
                                setIsCustomInstallment(true);
                              }}
                              className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-[#5D4037] outline-none focus:border-[#FFD54F]"
                              style={getFontFamily()}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 試算加總與相差提示 */}
                    {(() => {
                      const customSum = customSchedules.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
                      const originalTotal = Math.abs(parseFloat(editTotalAmount) || 0);
                      const diff = Math.abs(customSum - originalTotal);
                      return (
                        <div className="p-3 bg-stone-100/90 rounded-2xl space-y-1 text-xs font-bold">
                          <div className="flex items-center justify-between text-[#5D4037]">
                            <span>自訂加總：${customSum.toLocaleString()}</span>
                            <span>原總金額：${originalTotal.toLocaleString()}</span>
                          </div>
                          {diff !== 0 && (
                            <div className="mt-1.5 p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 font-bold leading-snug">
                              💡 目前自訂加總與原總金額相差 ${diff.toLocaleString()} 元
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </motion.div>
                )}
              </div>

              <div className="flex w-full gap-3 mt-4">
                <button 
                  onClick={() => setEditingGroup(null)}
                  className="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-[#5D4037] rounded-2xl font-bold transition-all text-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="flex-1 py-4 bg-[#5D4037] text-white rounded-2xl font-black shadow-lg hover:bg-[#4E342E] transition-all text-sm"
                >
                  儲存變更
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
