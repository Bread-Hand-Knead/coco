import { getFontFamily } from '../lib/financeUtils';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Category } from '../types';
import { AccountIcon } from '../components/AccountWidgets';

export function CategoryManagementPage({ categories, selectedCategoryIdProp, onSelectCategory, onSave, onBack }: { 
  categories: Category[], 
  selectedCategoryIdProp?: string | null,
  onSelectCategory?: (id: string | null) => void,
  onSave: (cats: Category[]) => void,
  onBack: () => void 
}) {
  const [tab, setTab] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [internalSelectedCategoryId, setInternalSelectedCategoryId] = useState<string | null>(null);
  
  const selectedCategoryId = selectedCategoryIdProp !== undefined ? selectedCategoryIdProp : internalSelectedCategoryId;
  const setSelectedCategoryId = (id: string | null) => {
    setInternalSelectedCategoryId(id);
    if (onSelectCategory) onSelectCategory(id);
  };
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newCat, setNewCat] = useState<Partial<Category>>({ name: '', icon: '✨', type: 'expense', sub: [] });
  
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  

  const filtered = useMemo(() => {
    return categories
      .filter(c => c.type === tab)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [categories, tab]);

  const selectedCategory = useMemo(() => 
    (Array.isArray(categories) ? categories : []).find(c => c.id === selectedCategoryId)
  , [categories, selectedCategoryId]);

  useEffect(() => {
    const handleAdd = () => {
      if (selectedCategoryId) {
        setNewSubName('');
        setEditingSubIndex(null);
        setIsSubModalOpen(true);
      } else {
        setNewCat({ name: '', icon: '✨', type: tab, sub: [] });
        setEditingCat(null);
        setIsAddModalOpen(true);
      }
    };
    window.addEventListener('trigger-add-category', handleAdd);
    return () => window.removeEventListener('trigger-add-category', handleAdd);
  }, [tab, selectedCategoryId]);

  const handleSaveMainCategory = () => {
    if (!newCat.name) return;
    const catToSave = {
      id: editingCat?.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newCat.name,
      icon: newCat.icon || '✨',
      type: tab,
      sub: newCat.sub || [],
      order: editingCat?.order || (filtered.length + 1)
    } as Category;

    if (editingCat) {
      onSave(categories.map(c => c.id === editingCat.id ? catToSave : c));
    } else {
      onSave([...categories, catToSave]);
    }
    setIsAddModalOpen(false);
    setEditingCat(null);
    setNewCat({ name: '', icon: '✨', type: tab, sub: [] });
  };

  const handleSaveSubCategory = () => {
    if (!newSubName || !selectedCategoryId) return;
    const cat = (Array.isArray(categories) ? categories : []).find(c => c.id === selectedCategoryId);
    if (!cat) return;

    const currentSub = cat.sub || [];
    let updatedSub = [...currentSub];
    if (editingSubIndex !== null) {
      updatedSub[editingSubIndex] = newSubName;
    } else {
      updatedSub.push(newSubName);
    }
    
    onSave(categories.map(c => c.id === selectedCategoryId ? { ...c, sub: updatedSub } : c));
    setNewSubName('');
    setEditingSubIndex(null);
    setIsSubModalOpen(false);
  };

  const removeSubByIndex = (catId: string, index: number) => {
    const cat = (Array.isArray(categories) ? categories : []).find(c => c.id === catId);
    if (!cat) return;
    if (window.confirm(`確定要刪除子分類「${cat.sub[index]}」嗎？`)) {
      onSave(categories.map(c => c.id === catId ? {
        ...c,
        sub: c.sub.filter((_, i) => i !== index)
      } : c));
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
      style={getFontFamily()}
    >
      {/* Header */}
      {!selectedCategoryId ? (
        <div className="p-6 pb-0 flex flex-col gap-6">
          <div className="flex bg-white/50 p-1.5 rounded-2xl border-2 border-white shadow-sm">
            {(['expense', 'income', 'transfer'] as const).map(t => (
              <button 
                key={t}
                onClick={() => { setTab(t); setSelectedCategoryId(null); }}
                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${tab === t ? 'bg-[#5D4037] text-white shadow-md' : 'text-stone-400'}`}
              >
                {t === 'expense' ? '支出分類' : (t === 'income' ? '收入分類' : '轉帳分類')}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-6 py-4 flex items-center gap-4">
          <button 
            onClick={() => setSelectedCategoryId(null)}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-2xl shadow-sm border border-stone-100 text-[#5D4037]"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-[#5D4037] flex items-center gap-2">
              <span className="text-2xl w-8 h-8 flex items-center justify-center overflow-hidden shrink-0">
                {selectedCategory && <AccountIcon icon={selectedCategory.icon} sizeClassName="w-7 h-7" />}
              </span>
              {selectedCategory?.name}
            </h2>
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mt-0.5">管理子分類</span>
          </div>
        </div>
      )}

      {/* List Content */}
      <div className="flex-1 overflow-y-auto px-6 space-y-3 pb-24 pt-4">
        {!selectedCategoryId ? (
          <>
            {filtered.length === 0 ? (
              <div className="text-center py-12 bg-white/30 rounded-[30px] border-2 border-dashed border-white">
                <span className="text-stone-400 font-bold">目前無{tab === 'expense' ? '支出' : (tab === 'income' ? '收入' : '轉帳')}分類</span>
              </div>
            ) : (
              filtered.map(cat => (
                <div 
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className="bg-white p-4 rounded-[25px] border-2 border-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between group gap-4 md:gap-0 cursor-pointer hover:border-[#FFD54F] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#FFFDF5] rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-stone-50 shrink-0 overflow-hidden">
                      <AccountIcon icon={cat.icon} sizeClassName="w-8 h-8" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-black text-[#5D4037] text-lg md:text-base truncate break-all leading-tight">{cat.name}</span>
                      <span className="text-xs md:text-[10px] font-bold text-stone-400 md:text-stone-300 uppercase tracking-widest truncate mt-0.5">
                        {cat.sub.length} 個子分類
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-auto" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation();
                        setEditingCat(cat); 
                        setNewCat(cat); 
                        setIsAddModalOpen(true); 
                      }}
                      className="p-2 hover:bg-stone-50 rounded-xl text-stone-300 hover:text-[#5D4037] transition-all"
                      title="編輯分類"
                    >
                      <Pencil size={18} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`確定要刪除主分類「${cat.name}」嗎？這將會同時刪除其所有子分類。`)) {
                          onSave(categories.filter(c => c.id !== cat.id));
                        }
                      }}
                      className="p-2 hover:bg-rose-50 rounded-xl text-stone-200 hover:text-rose-400 transition-all"
                      title="刪除分類"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
            <button 
              onClick={() => {
                setNewCat({ name: '', icon: '✨', type: tab, sub: [] });
                setEditingCat(null);
                setIsAddModalOpen(true);
              }}
              className="w-full py-4 border-2 border-dashed border-stone-200 rounded-[25px] text-stone-400 font-bold hover:bg-white transition-all flex items-center justify-center gap-2 mt-2"
            >
              <Plus size={20} /> 新增{tab === 'expense' ? '支出' : (tab === 'income' ? '收入' : '轉帳')}主分類
            </button>
          </>
        ) : (
          selectedCategory?.sub?.map((sub, idx) => (
            <div 
              key={`${selectedCategoryId}-${idx}`}
              className="flex items-center justify-between bg-white p-4 md:p-3 rounded-[25px] border-2 border-white shadow-sm group"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-black text-[#5D4037] text-lg md:text-sm truncate break-all leading-tight">{sub}</span>
                <span className="text-xs md:text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">歸類於 {selectedCategory.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => { setNewSubName(sub); setEditingSubIndex(idx); setIsSubModalOpen(true); }}
                  className="p-2 hover:bg-stone-50 rounded-xl text-stone-300 hover:text-[#5D4037] transition-all"
                  title="編輯子分類"
                >
                  <Pencil size={18} />
                </button>
                <button 
                  onClick={() => removeSubByIndex(selectedCategoryId!, idx)}
                  className="p-2 hover:bg-rose-50 rounded-xl text-stone-200 hover:text-rose-400 transition-all"
                  title="刪除子分類"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
        {(selectedCategoryId && (!selectedCategory?.sub || selectedCategory.sub.length === 0)) && (
          <div className="text-center py-12 bg-white/30 rounded-[30px] border-2 border-dashed border-white">
            <span className="text-stone-400 font-bold">目前無子分類</span>
          </div>
        )}
      </div>

      {/* Floating Add Button for Detail View */}
      {selectedCategoryId && (
        <div className="fixed bottom-24 right-6 left-6 flex justify-center z-40">
          <button 
            onClick={() => { setNewSubName(''); setEditingSubIndex(null); setIsSubModalOpen(true); }}
            className="w-full max-w-sm py-4 bg-[#FFD54F] text-[#5D4037] rounded-[25px] font-black shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Plus size={24} /> 新增子分類
          </button>
        </div>
      )}

      {/* Main Category Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md"
              onClick={() => setIsAddModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="relative bg-[#FFFDF5] w-full max-w-sm rounded-[40px] shadow-2xl border-2 border-white overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 pb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-[#5D4037]">{editingCat ? '編輯主分類' : (tab === 'transfer' ? '新增轉帳主分類' : (tab === 'income' ? '新增收入主分類' : '新增支出主分類'))}</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={20} className="text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-2 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">主分類名稱</label>
                  <input 
                    value={newCat.name}
                    onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                    className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]"
                    placeholder="輸入主分類名稱"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">主分類圖示</label>
                  
                  {/* 自訂 Emoji 輸入框 */}
                  <div className="mb-4">
                    <input 
                      type="text"
                      placeholder="自訂輸入 Emoji..."
                      value={newCat.icon && !(newCat.icon.startsWith('http') || newCat.icon.startsWith('data:image/') || newCat.icon.startsWith('/')) ? newCat.icon : ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          setNewCat(prev => ({ ...prev, icon: '' }));
                        } else {
                          setNewCat(prev => ({ ...prev, icon: val.slice(-2).trim() }));
                        }
                      }}
                      className="w-full p-3 bg-white border border-stone-200 rounded-xl font-bold text-sm text-[#5D4037] outline-none focus:border-[#FFD54F]"
                      maxLength={2}
                    />
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {/* 上傳圖片按鈕 */}
                    <div className="relative">
                      <label className="w-10 h-10 rounded-xl border border-dashed bg-white border-stone-300 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-stone-50 transition-all active:scale-95">
                        <Upload size={14} className="text-stone-400" />
                        <span className="text-[8px] font-bold text-stone-400 mt-0.5" style={getFontFamily()}>上傳</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 500 * 1024) {
                              alert("上傳圖片大小不能超過 500KB！");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = event.target?.result as string;
                              if (base64) {
                                setNewCat(prev => ({ ...prev, icon: base64 }));
                              }
                            };
                            reader.readAsDataURL(file);
                          }} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    {/* 自訂圖片預覽 */}
                    {newCat.icon && (newCat.icon.startsWith('data:image/') || newCat.icon.startsWith('http') || newCat.icon.startsWith('/')) && (
                      <div className="relative w-10 h-10 rounded-xl border-2 border-[#FFD54F] bg-white shadow-md flex items-center justify-center overflow-hidden">
                        <img src={newCat.icon} className="w-full h-full object-contain p-0.5 select-none pointer-events-none" alt="custom-icon" />
                        <button 
                          type="button"
                          onClick={() => setNewCat(prev => ({ ...prev, icon: '✨' }))}
                          className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-sm"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {['🍱', '🚗', '🛍️', '🎮', '🏠', '🏥', '✨', '💼', '📈', '🍔', '☕', '🎬', '💊', '🎁', '💡', '📚', '⚽'].map(icon => (
                      <button 
                        key={icon}
                        onClick={() => setNewCat(prev => ({ ...prev, icon }))}
                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xl transition-all ${newCat.icon === icon ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md scale-110' : 'bg-white border-stone-50 shadow-sm'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 pt-4">
                <button 
                  onClick={handleSaveMainCategory}
                  className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={20} /> 儲存設定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sub-category Detail/Name Modal */}
      

      <AnimatePresence>
        {isSubModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#5D4037]/20 backdrop-blur-sm"
              onClick={() => setIsSubModalOpen(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-[280px] rounded-[30px] shadow-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-black text-[#5D4037]">{editingSubIndex !== null ? '編輯子分類' : '新增子分類'}</h4>
                <button onClick={() => { setIsSubModalOpen(false); setEditingSubIndex(null); }} className="p-1 hover:bg-stone-50 rounded-full transition-colors">
                  <X size={18} className="text-stone-400" />
                </button>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">名稱</label>
                <input 
                  autoFocus
                  value={newSubName}
                  onChange={e => setNewSubName(e.target.value)}
                  className="w-full p-3 bg-stone-50 rounded-xl font-bold text-[#5D4037] outline-none border-2 border-transparent focus:border-[#FFD54F] text-sm"
                  placeholder="輸入名稱..."
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsSubModalOpen(false)}
                  className="flex-1 py-3 bg-stone-100 text-stone-400 rounded-xl font-black text-sm"
                >
                  取消
                </button>
                <button 
                  onClick={handleSaveSubCategory}
                  className="flex-1 py-3 bg-[#5D4037] text-white rounded-xl font-black text-sm shadow-lg active:scale-95"
                >
                  確定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function CategoryManagePage({ categories, onSave, onBack, onMoveSubCategory }: { 
  categories: Category[], 
  onSave: (cats: Category[]) => void,
  onBack: () => void,
  onMoveSubCategory: (subName: string, fromCatName: string, toCatName: string) => Promise<void>
}) {
  const [tab, setTab] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [newCat, setNewCat] = useState<Partial<Category>>({ name: '', icon: '✨', type: 'expense', sub: [] });
  
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [editingSubIndex, setEditingSubIndex] = useState<number | null>(null);
  const [movingSub, setMovingSub] = useState<{ catId: string; subName: string; index: number } | null>(null);

  const filtered = useMemo(() => {
    return categories
      .filter(c => c.type === tab)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [categories, tab]);

  const selectedCategory = useMemo(() => 
    (Array.isArray(categories) ? categories : []).find(c => c.id === selectedCategoryId)
  , [categories, selectedCategoryId]);

  const moveCategory = (id: string, direction: 'up' | 'down') => {
    const idx = filtered.findIndex(c => c.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === filtered.length - 1) return;

    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    const catA = filtered[idx];
    const catB = filtered[otherIdx];

    const updatedCategories = categories.map(c => {
      if (c.id === catA.id) return { ...c, order: otherIdx + 1 };
      if (c.id === catB.id) return { ...c, order: idx + 1 };
      return c;
    });

    onSave(updatedCategories);
  };

  const moveSubByIndex = (catId: string, idx: number, direction: 'up' | 'down') => {
    const cat = (Array.isArray(categories) ? categories : []).find(c => c.id === catId);
    if (!cat || !cat.sub) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === cat.sub.length - 1) return;

    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newSub = [...cat.sub];
    [newSub[idx], newSub[otherIdx]] = [newSub[otherIdx], newSub[idx]];
    
    onSave(categories.map(c => c.id === catId ? { ...c, sub: newSub } : c));
  };

  const handleSaveMainCategory = () => {
    if (!newCat.name) return;
    const catToSave = {
      id: editingCat?.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newCat.name,
      icon: newCat.icon || '✨',
      type: tab,
      sub: newCat.sub || [],
      order: editingCat?.order || (filtered.length + 1)
    } as Category;

    if (editingCat) {
      onSave(categories.map(c => c.id === editingCat.id ? catToSave : c));
    } else {
      onSave([...categories, catToSave]);
    }
    setIsAddModalOpen(false);
    setEditingCat(null);
  };

  const handleSaveSubCategory = () => {
    if (!newSubName || !selectedCategoryId) return;
    const currentSub = selectedCategory?.sub || [];
    let updatedSub = [...currentSub];
    if (editingSubIndex !== null) {
      updatedSub[editingSubIndex] = newSubName;
    } else {
      updatedSub.push(newSubName);
    }
    
    onSave(categories.map(c => c.id === selectedCategoryId ? { ...c, sub: updatedSub } : c));
    setIsSubModalOpen(false);
  };

  const removeSubByIndex = (catId: string, index: number) => {
    const cat = (Array.isArray(categories) ? categories : []).find(c => c.id === catId);
    if (!cat) return;
    if (window.confirm(`確定要刪除子分類「${cat.sub[index]}」嗎？`)) {
      onSave(categories.map(c => c.id === catId ? {
        ...c,
        sub: c.sub.filter((_, i) => i !== index)
      } : c));
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#FFF9E3]"
      style={getFontFamily()}
    >
      <div className="p-6 pb-0 flex flex-col gap-6">
        <div className="flex bg-white/50 p-1.5 rounded-2xl border-2 border-white shadow-sm">
          {(['expense', 'income', 'transfer'] as const).map(t => (
            <button 
              key={t}
              onClick={() => { setTab(t); setSelectedCategoryId(null); }}
              className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${tab === t ? 'bg-[#5D4037] text-white shadow-md' : 'text-stone-400'}`}
            >
              {t === 'expense' ? '支出管理' : (t === 'income' ? '收入管理' : '轉帳管理')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-3 pb-24 pt-4">
        {!selectedCategoryId ? (
          filtered.map(cat => (
            <div 
              key={cat.id}
              className="bg-white p-4 rounded-[25px] border-2 border-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between group gap-4 md:gap-0"
            >
              <div className="flex items-center gap-4 cursor-pointer" onClick={() => setSelectedCategoryId(cat.id)}>
                <div className="w-12 h-12 bg-[#FFFDF5] rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-stone-50 shrink-0 overflow-hidden">
                  <AccountIcon icon={cat.icon} sizeClassName="w-8 h-8" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-[#5D4037] text-lg md:text-base truncate break-all leading-tight">{cat.name}</span>
                  <span className="text-xs md:text-[10px] font-bold text-stone-400 md:text-stone-300 uppercase tracking-widest truncate mt-0.5">
                    {cat.sub.length} 個子分類 (點擊管理)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 md:gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-stone-50 justify-between md:justify-end">
                <div className="flex items-center bg-stone-50 rounded-xl p-1">
                  <button 
                    onClick={() => moveCategory(cat.id, 'up')}
                    disabled={filtered.indexOf(cat) === 0}
                    className="p-2 md:p-1 hover:bg-white rounded-md text-stone-300 hover:text-[#5D4037] disabled:opacity-30"
                  >
                    <ChevronUp size={20} className="md:w-3.5 md:h-3.5" />
                  </button>
                  <button 
                    onClick={() => moveCategory(cat.id, 'down')}
                    disabled={filtered.indexOf(cat) === filtered.length - 1}
                    className="p-2 md:p-1 hover:bg-white rounded-md text-stone-300 hover:text-[#5D4037] disabled:opacity-30"
                  >
                    <ChevronDown size={20} className="md:w-3.5 md:h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setEditingCat(cat); setNewCat(cat); setIsAddModalOpen(true); }}
                    className="p-3 md:p-2 hover:bg-stone-50 rounded-xl text-stone-300 hover:text-[#5D4037] transition-all"
                  >
                    <Pencil size={20} className="md:w-[18px] md:h-[18px]" />
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm(`刪除主分類「${cat.name}」將同時刪除其下的所有子分類，是否確認？`)) {
                        onSave(categories.filter(c => c.id !== cat.id));
                      }
                    }}
                    className="p-3 md:p-2 hover:bg-rose-50 rounded-xl text-stone-200 hover:text-rose-400 transition-all"
                  >
                    <Trash2 size={20} className="md:w-[18px] md:h-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-3">
             <button onClick={() => setSelectedCategoryId(null)} className="flex items-center gap-2 text-[#5D4037] font-bold text-sm mb-4">
                <ChevronLeft size={16} /> 返回主分類列表
             </button>
             <h3 className="font-black text-xl text-[#5D4037] mb-4 flex items-center gap-2">
                <span>{selectedCategory?.icon}</span>
                {selectedCategory?.name} - 子分類管理
             </h3>
             {selectedCategory?.sub?.map((sub, idx) => (
               <div 
                 key={`${selectedCategoryId}-${idx}`}
                 className="flex items-center justify-between bg-white p-4 md:p-3 rounded-[25px] border-2 border-white shadow-sm"
               >
                 <div className="flex flex-col min-w-0">
                   <span className="font-black text-[#5D4037] text-lg md:text-sm truncate break-all leading-tight">{sub}</span>
                 </div>
                 <div className="flex items-center gap-4 md:gap-1">
                   <div className="flex items-center bg-stone-50 rounded-xl p-1">
                     <button 
                       onClick={() => moveSubByIndex(selectedCategoryId, idx, 'up')}
                       disabled={idx === 0}
                       className="p-2 md:p-1 hover:bg-white rounded text-stone-300 hover:text-[#5D4037] disabled:opacity-30"
                     >
                       <ChevronUp size={20} className="md:w-3.5 md:h-3.5" />
                     </button>
                     <button 
                       onClick={() => moveSubByIndex(selectedCategoryId, idx, 'down')}
                       disabled={idx === (selectedCategory.sub?.length || 0) - 1}
                       className="p-2 md:p-1 hover:bg-white rounded text-stone-300 hover:text-[#5D4037] disabled:opacity-30"
                     >
                       <ChevronDown size={20} className="md:w-3.5 md:h-3.5" />
                     </button>
                   </div>
                   <button 
                     onClick={() => setMovingSub({ catId: selectedCategoryId, subName: sub, index: idx })}
                     className="p-3 md:p-2 hover:bg-stone-50 rounded-xl text-stone-300 hover:text-[#5D4037] transition-all"
                     title="搬移子分類"
                   >
                     <ArrowRightLeft size={20} className="md:w-[18px] md:h-[18px]" />
                   </button>
                   <button 
                     onClick={() => { setNewSubName(sub); setEditingSubIndex(idx); setIsSubModalOpen(true); }}
                     className="p-3 md:p-2 hover:bg-stone-50 rounded-xl text-stone-300 hover:text-[#5D4037]"
                   >
                     <Pencil size={20} className="md:w-[18px] md:h-[18px]" />
                   </button>
                   <button 
                     onClick={() => removeSubByIndex(selectedCategoryId, idx)}
                     className="p-3 md:p-2 hover:bg-rose-50 rounded-xl text-stone-200 hover:text-rose-400"
                   >
                     <Trash2 size={20} className="md:w-[18px] md:h-[18px]" />
                   </button>
                 </div>
               </div>
             ))}
             <button 
               onClick={() => { setNewSubName(''); setEditingSubIndex(null); setIsSubModalOpen(true); }}
               className="w-full py-4 border-2 border-dashed border-stone-200 rounded-[25px] text-stone-400 font-bold hover:bg-white transition-all flex items-center justify-center gap-2"
             >
               <Plus size={20} /> 新增子分類
             </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md" onClick={() => setIsAddModalOpen(false)} />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} 
              className="relative bg-[#FFFDF5] w-full max-w-sm rounded-[40px] shadow-2xl border-2 border-white overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 pb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-[#5D4037]">{editingCat ? '編輯主分類' : (tab === 'transfer' ? '新增轉帳主分類' : (tab === 'income' ? '新增收入主分類' : '新增支出主分類'))}</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={20} className="text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-2 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">名稱</label>
                  <input value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm focus:border-[#FFD54F]" placeholder="輸入主分類名稱" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-stone-300 uppercase tracking-widest px-1">主分類圖示</label>
                  
                  {/* 自訂 Emoji 輸入框 */}
                  <div className="mb-4">
                    <input 
                      type="text"
                      placeholder="自訂輸入 Emoji..."
                      value={newCat.icon && !(newCat.icon.startsWith('http') || newCat.icon.startsWith('data:image/') || newCat.icon.startsWith('/')) ? newCat.icon : ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '') {
                          setNewCat(prev => ({ ...prev, icon: '' }));
                        } else {
                          setNewCat(prev => ({ ...prev, icon: val.slice(-2).trim() }));
                        }
                      }}
                      className="w-full p-3 bg-white border border-stone-200 rounded-xl font-bold text-sm text-[#5D4037] outline-none focus:border-[#FFD54F]"
                      maxLength={2}
                    />
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {/* 上傳圖片按鈕 */}
                    <div className="relative">
                      <label className="w-10 h-10 rounded-xl border border-dashed bg-white border-stone-300 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-stone-50 transition-all active:scale-95">
                        <Upload size={14} className="text-stone-400" />
                        <span className="text-[8px] font-bold text-stone-400 mt-0.5" style={getFontFamily()}>上傳</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 500 * 1024) {
                              alert("上傳圖片大小不能超過 500KB！");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = event.target?.result as string;
                              if (base64) {
                                setNewCat(prev => ({ ...prev, icon: base64 }));
                              }
                            };
                            reader.readAsDataURL(file);
                          }} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    {/* 自訂圖片預覽 */}
                    {newCat.icon && (newCat.icon.startsWith('data:image/') || newCat.icon.startsWith('http') || newCat.icon.startsWith('/')) && (
                      <div className="relative w-10 h-10 rounded-xl border-2 border-[#FFD54F] bg-white shadow-md flex items-center justify-center overflow-hidden">
                        <img src={newCat.icon} className="w-full h-full object-contain p-0.5 select-none pointer-events-none" alt="custom-icon" />
                        <button 
                          type="button"
                          onClick={() => setNewCat(prev => ({ ...prev, icon: '✨' }))}
                          className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[8px] font-black shadow-sm"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {['🍱', '🚗', '🛍️', '🎮', '🏠', '🏥', '✨', '💼', '📈', '🍔', '☕', '🎬', '💊', '🎁', '💡', '📚', '⚽'].map(icon => (
                      <button 
                        key={icon}
                        onClick={() => setNewCat(prev => ({ ...prev, icon }))}
                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xl transition-all ${newCat.icon === icon ? 'bg-[#FFD54F] border-[#FFD54F] shadow-md scale-110' : 'bg-white border-stone-50 shadow-sm'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-8 pt-4">
                <button onClick={handleSaveMainCategory} className="w-full py-5 bg-[#5D4037] text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Check size={20} /> 儲存設定
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

            {/* Move Sub-category Modal */}
      <AnimatePresence>
        {movingSub && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-[#5D4037]/40 backdrop-blur-md" 
              onClick={() => setMovingSub(null)} 
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} 
              className="relative bg-[#FFFDF5] w-full max-w-sm rounded-[40px] shadow-2xl border-2 border-white overflow-hidden flex flex-col max-h-[70vh]"
            >
              <div className="p-6 pb-2 flex items-center justify-between border-b border-stone-100">
                <div className="flex flex-col">
                  <h3 className="text-lg font-black text-[#5D4037]" style={getFontFamily()}>搬移子分類</h3>
                  <span className="text-[11px] font-bold text-stone-400 mt-0.5">移動「{movingSub.subName}」至其他主分類</span>
                </div>
                <button onClick={() => setMovingSub(null)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X size={18} className="text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-2">
                {categories
                  .filter(c => c.type === tab && c.id !== movingSub.catId)
                  .map(targetCat => (
                    <button
                      key={targetCat.id}
                      onClick={async () => {
                        const targetHasSub = targetCat.sub && targetCat.sub.includes(movingSub.subName);
                        if (targetHasSub) {
                          alert(`主分類「${targetCat.name}」下已存在名為「${movingSub.subName}」的子分類！`);
                          return;
                        }
                        
                        const confirmMove = window.confirm(`確認將「${movingSub.subName}」搬移到「${targetCat.name}」下嗎？這將會自動更新所有相關記帳明細。`);
                        if (!confirmMove) return;
                        
                        try {
                          await onMoveSubCategory(movingSub.subName, selectedCategory!.name, targetCat.name);
                          setMovingSub(null);
                        } catch (err) {
                          alert("子分類搬移失敗，請重試。");
                        }
                      }}
                      className="w-full p-4 bg-white border-2 border-stone-50 rounded-2xl font-bold text-[#5D4037] outline-none shadow-sm hover:border-[#FFD54F] transition-all flex items-center gap-3 active:scale-98 text-left"
                    >
                      <div className="w-8 h-8 bg-stone-50 rounded-lg flex items-center justify-center text-lg overflow-hidden shrink-0">
                        <AccountIcon icon={targetCat.icon} sizeClassName="w-5 h-5" />
                      </div>
                      <span className="font-black text-sm text-[#5D4037]" style={getFontFamily()}>{targetCat.name}</span>
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSubModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#5D4037]/20 backdrop-blur-sm" onClick={() => setIsSubModalOpen(false)} />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white w-full max-w-[280px] rounded-[30px] shadow-2xl p-6 space-y-6">
              <h4 className="font-black text-[#5D4037]">{editingSubIndex !== null ? '編輯子分類' : '新增子分類'}</h4>
              <input autoFocus value={newSubName} onChange={e => setNewSubName(e.target.value)} className="w-full p-3 bg-stone-50 rounded-xl font-bold text-[#5D4037] outline-none border-2 border-transparent focus:border-[#FFD54F] text-sm" placeholder="輸入名稱..." />
              <div className="flex gap-3">
                <button onClick={() => setIsSubModalOpen(false)} className="flex-1 py-3 bg-stone-100 text-stone-400 rounded-xl font-black text-sm">取消</button>
                <button onClick={handleSaveSubCategory} className="flex-1 py-3 bg-[#5D4037] text-white rounded-xl font-black text-sm shadow-lg">確定</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
