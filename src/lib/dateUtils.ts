// 規範為 24 小時制 HH:mm (例如: "19:15", "07:15")
export function formatTime24(timeStr?: string): string {
  if (!timeStr || !timeStr.trim()) return '';
  const raw = timeStr.trim();
  
  // 檢查是否含有「下午」、「晚上」、「pm」、「p.m.」
  const isPM = /下午|晚上|pm|p\.m\./i.test(raw);
  const isAM = /上午|早上|清晨|am|a\.m\./i.test(raw);
  
  const match = raw.match(/(\d{1,2})[:：點](\d{1,2})/);
  if (!match) return raw;
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }
  
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

// 友善顯示格式：明確標記 24 小時制與 12 小時制前綴 (例如: "19:15 (下午 07:15)" 或 "07:15 (上午 07:15)")
export function formatTimeDisplay(timeStr?: string): string {
  if (!timeStr || !timeStr.trim()) return '';
  const t24 = formatTime24(timeStr);
  const match = t24.match(/(\d{2}):(\d{2})/);
  if (!match) return t24;
  
  const h = parseInt(match[1], 10);
  const m = match[2];
  
  const period = h >= 12 ? '下午' : '上午';
  const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  const h12Str = String(h12).padStart(2, '0');
  
  return `${t24} (${period} ${h12Str}:${m})`;
}

// Helper to parse date string "YYYY-MM-DD" to local Date object
export const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Helper to format Date object to "YYYY-MM-DD"
export const formatLocalDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getTimestamp = (dateStr: string, timeStr?: string): number => {
  if (!dateStr) return 0;
  const normalizedDate = dateStr.replace(/\//g, '-');
  const partsDate = normalizedDate.split('-').map(Number);
  const year = partsDate[0];
  const month = partsDate[1];
  const day = partsDate[2];

  if (!year || isNaN(year) || !month || isNaN(month) || !day || isNaN(day)) {
    const d = new Date(normalizedDate);
    if (!isNaN(d.getTime())) return d.getTime();
    return 0;
  }

  const time = timeStr && timeStr.trim() ? timeStr : '00:00:00';
  const partsTime = time.split(':').map(Number);
  const hour = partsTime[0] || 0;
  const minute = partsTime[1] || 0;
  const second = partsTime[2] || 0;
  return new Date(year, month - 1, day, hour, minute, second).getTime();
};
