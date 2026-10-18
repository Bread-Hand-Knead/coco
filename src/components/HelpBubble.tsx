import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { getFontFamily } from '../lib/financeUtils';

// 每一頁的使用說明。key 對應 App.tsx 裡的 currentView（專案明細另外用 projectDetail）。
// 之後要改說明文字，直接改這裡就好。
export const HELP_CONTENT: Record<string, { title: string; tips: string[] }> = {
  home: {
    title: '首頁',
    tips: [
      '上方日期列：點某一天切換日期，左右箭頭可以往前、往後一天。',
      '「記一筆」：新增一筆支出、收入或轉帳。',
      '「帳戶」：查看所有帳戶的餘額和淨資產。',
      '本月收入、支出、可用預算：可用預算 = 本月預算 − 本月支出，預算在左上 ☰ 的「預算管理」設定。',
      '點「本日／本週／本月／本年」卡片，可以看那段期間的每一筆明細。',
      '左上 ☰：固定收支、專案、預算、分類、分期付款、代墊款、設定。右上 ⋮：日曆模式、搜尋明細、帳戶排序、新增帳戶。',
    ],
  },
  accounts: {
    title: '帳戶列表',
    tips: [
      '上方切換「台幣」「外幣」「投資」三種帳戶。',
      '淨資產 = 資產 − 負債，信用卡欠款算在負債。標示「不計入資產」的帳戶不會算進去。',
      '點任一個帳戶，可以看它的往來明細。',
      '右上 ⋮ →「新增帳戶」可以加帳戶，「帳戶排序」可以調整顯示順序。',
      '只用來裝子帳戶的帳戶（例如實體戶），可以在編輯帳戶打開「記帳時不顯示」，記一筆時就不會出現在選單裡。',
    ],
  },
  accountDetail: {
    title: '帳戶往來明細',
    tips: [
      '列出這個帳戶的每一筆交易和當時的餘額。',
      '點一筆交易可以展開，看分類、日期、備註，並且「編輯」或「再記一筆」。',
      '信用卡：可以切換「本期帳單明細（依結帳日）」，看每一期應繳多少，左右箭頭切換帳單期間。',
      '「轉帳狀態」：繳完款後按「標記為已轉帳」，或選擇轉帳日期；按 ✕ 可以清除。分期付款每一期要分開標記。',
      '右上 ⋮ 有日曆模式、搜尋明細等功能。',
    ],
  },
  history: {
    title: '明細清單',
    tips: [
      '列出這段期間的所有明細，上方可以篩選「支出」「收入」「轉帳」。',
      '下方會算出實質總支出、總收入和結餘。',
      '點一筆明細可以修改或刪除，刪除的資料會先放到垃圾桶。',
      '右上「＋」可以直接新增一筆。',
    ],
  },
  reports: {
    title: '收支報表',
    tips: [
      '看一段期間的總支出、總收入，以及每個分類花了多少。',
      '點分類卡片可以看那個分類的交易明細，點箭頭可以展開子分類。',
      '下方的「交易明細清單」會列出目前篩選到的每一筆。',
    ],
  },
  more: {
    title: '更多設定',
    tips: [
      '登入後資料會同步到雲端，換手機也看得到。',
      '「備份與還原」：可以下載備份檔（JSON），或用備份檔、Excel 還原。雲端會保留最近 5 次備份。',
      '「匯出資料（Excel）」：選帳戶和日期區間，匯出成 Excel。',
      '「顯示設定」：深色模式、隱藏金額。',
      '「危險區域」的刪除操作無法復原，執行前請先備份。',
      '「垃圾桶」：刪掉的明細會先放這裡，可以還原。',
    ],
  },
  calendar: {
    title: '日曆明細',
    tips: [
      '用月曆看每天的收入、支出和代墊，左右箭頭切換月份。',
      '點某一天，可以看那天的明細和結餘。',
    ],
  },
  search: {
    title: '搜尋明細',
    tips: [
      '輸入關鍵字、金額或分類名稱，就會找出所有符合的明細。',
      '點搜尋結果可以修改那一筆。',
    ],
  },
  fixedRecords: {
    title: '固定收支',
    tips: [
      '設定每個月固定的收入或支出，例如房租、薪水、訂閱費，也可以設定固定轉帳或存款目標。',
      '右上「＋」新增，填好名稱、金額、分類、扣款帳戶和週期。',
      '打開「自動入帳」，日期到了會自動幫你新增一筆明細。',
    ],
  },
  projects: {
    title: '專案管理',
    tips: [
      '把相關的花費歸在同一個專案，例如旅行、裝潢、婚禮。',
      '記帳時選擇專案，這裡就會自動統計。',
      '點專案卡片看專案明細，可以用上方搜尋專案名稱。',
      '專案也可以有子專案。',
    ],
  },
  projectDetail: {
    title: '專案明細',
    tips: [
      '上方儀表板顯示這個專案的總支出、結餘和預算達成率。',
      '可以看類別圓餅圖、收支長條圖和每日趨勢。',
      '右下角的按鈕可以為這個專案新增一筆明細。',
      '每一筆可以「快速修改」備註，或複製、編輯、刪除。',
      '按「匯出」可以下載 Excel 檔，選擇只匯出這個月，或匯出整個專案的全部明細（最後有支出、收入、代墊合計）。',
    ],
  },
  budget: {
    title: '預算管理',
    tips: [
      '設定每個月的總預算，以及每個分類的預算。',
      '點預算金額就能快速調整。',
      '超過預算時會提醒你，首頁的「可用預算」也會跟著更新。',
    ],
  },
  categories: {
    title: '分類管理',
    tips: [
      '上方切換支出、收入、轉帳分類。',
      '點主分類可以看和管理它的子分類，下方按鈕「新增子分類」。',
      '右上「＋」：新增分類，或進入「管理與排序」調整順序、搬移子分類。',
      '分類圖示可以用 Emoji 或上傳圖片。',
    ],
  },
  categoryManage: {
    title: '管理與排序',
    tips: [
      '調整分類和子分類的順序。',
      '可以把子分類搬到另一個主分類底下。',
    ],
  },
  installments: {
    title: '分期付款管理',
    tips: [
      '列出所有進行中的分期，以及還款進度。',
      '可以編輯分期名稱、總金額、期數（1–36 期），或自訂每一期的金額和日期。',
      '「提前結清」：一次付清剩下的期數。',
      '右上「＋」可以新增一筆明細，在記帳畫面打開「分期」就會出現在這裡。',
    ],
  },
  prepayments: {
    title: '代墊／待收款',
    tips: [
      '記帳時標記為「代墊」的明細會出現在這裡，例如幫家人或朋友先付的錢。',
      '方便你追蹤還有哪些錢還沒收回來。',
      '收到錢之後，按明細右邊的「待收」按鈕，那筆明細就會變成灰色，表示已經拿到錢了。',
    ],
  },
  recycleBin: {
    title: '垃圾桶',
    tips: [
      '刪除的明細和股票會先放在這裡。',
      '按「還原」可以救回來，按「永久刪除」就無法復原。',
      '「清空垃圾桶」會一次永久刪除全部。',
    ],
  },
};

export function HelpBubble({ view, raised = false }: { view: string; raised?: boolean }) {
  const [open, setOpen] = useState(false);
  const help = HELP_CONTENT[view];
  if (!help) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${help.title}使用說明`}
        className={`absolute right-4 ${raised ? 'bottom-44' : 'bottom-24'} z-30 w-11 h-11 rounded-full bg-white/95 border-2 border-[#FFD54F] text-[#5D4037] shadow-lg flex items-center justify-center text-xl font-black active:scale-90 transition-transform`}
        style={getFontFamily()}
      >
        ?
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[150] bg-black/40 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`${help.title}使用說明`}
              className="w-full max-w-md bg-[#FFF9E3] rounded-t-[32px] px-6 pt-5 pb-8 shadow-2xl max-h-[80vh] overflow-y-auto"
              style={getFontFamily()}
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-[#5D4037]">{help.title}怎麼用？</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="關閉"
                  className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-stone-400 shadow-sm"
                >
                  <X size={18} />
                </button>
              </div>
              <ul className="space-y-3">
                {help.tips.map((tip, i) => (
                  <li key={i} className="flex gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFD54F] text-[#5D4037] text-xs font-black flex items-center justify-center">{i + 1}</span>
                    <span className="text-[15px] leading-relaxed font-bold text-[#5D4037]">{tip}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-5 w-full py-3.5 bg-[#5D4037] text-white rounded-2xl font-black active:scale-95 transition-transform"
              >
                知道了
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
