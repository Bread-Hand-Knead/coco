<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# 扣扣 記帳 app

## 檔案地圖

想改哪個畫面，就找對應的檔案（請 AI 幫忙時也可以直接告訴它檔名）：

| 檔案 | 內容 |
|---|---|
| `src/App.tsx` | 主程式：資料讀寫、登入、切換畫面 |
| `src/views/HomeView.tsx` | 首頁（日期列、本日／本週／本月／本年） |
| `src/views/RecordModal.tsx` | 記一筆 |
| `src/views/EditRecordModal.tsx` | 修改單筆紀錄 |
| `src/views/AccountsView.tsx` | 帳戶列表 |
| `src/views/AccountDetailView.tsx` | 單一帳戶明細 |
| `src/views/AccountEditModal.tsx` | 新增／編輯帳戶 |
| `src/views/InvestmentSection.tsx` | 投資、股票 |
| `src/views/ExchangeRateModal.tsx` | 匯率 |
| `src/views/ReportsView.tsx` | 報表、分類明細 |
| `src/views/HistoryView.tsx` | 歷史紀錄 |
| `src/views/SearchView.tsx` | 搜尋 |
| `src/views/CalendarView.tsx` | 月曆 |
| `src/views/MoreView.tsx` | 「更多」頁（設定、備份、匯入匯出） |
| `src/views/BudgetManagementPage.tsx` | 預算 |
| `src/views/CategoryPages.tsx` | 分類管理 |
| `src/views/FixedRecordsView.tsx` | 固定收支 |
| `src/views/InstallmentManagementPage.tsx` | 分期付款 |
| `src/views/PrepaymentsView.tsx` | 代墊款 |
| `src/views/ProjectsView.tsx`、`ProjectDetailView.tsx`、`ProjectEditModal.tsx` | 專案 |
| `src/views/SortModals.tsx` | 帳戶／範本／專案排序 |
| `src/views/RecycleBinView.tsx` | 回收桶 |
| `src/views/AiSplitModal.tsx` | AI 智慧解析記帳 |
| `src/components/` | 多個畫面共用的小元件（帳戶圖示、帳戶選單、導覽按鈕等） |
| `src/lib/` | 計算用的函式（帳戶餘額、信用卡帳單、匯率、日期、預設分類、雲端同步、Gemini） |
| `src/types.ts` | 資料格式定義（帳戶、紀錄、股票、專案…） |

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/412d97ca-6a2a-482c-8802-dda92f4881a9

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
