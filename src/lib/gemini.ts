export const MODEL_CASCADE = [
  'gemini-3.8-flash',        // 主力：最新穩定多模態模型
  'gemini-3.5-flash-lite',   // 備援一：輕量高可用
  'gemini-3.1-pro',          // 備援二：高品質兜底
];

export interface GeminiRequestPayload {
  contents: any[];
  generationConfig?: any;
}

/** 單次請求最久等多久；整個流程（換模型、重試）最久等多久。超過就停，不會一直轉圈 */
const REQUEST_TIMEOUT_MS = 30000;
const TOTAL_TIMEOUT_MS = 75000;

export const callGeminiApiWithFallback = async (
  key: string,
  requestBody: GeminiRequestPayload,
  onProgress?: (msg: string) => void
): Promise<any> => {
  let lastErrorMsg = '';
  const startedAt = Date.now();

  for (let mIdx = 0; mIdx < MODEL_CASCADE.length; mIdx++) {
    const model = MODEL_CASCADE[mIdx];
    // 每個模型最多重試 2 次（應對暫時塞車）
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = TOTAL_TIMEOUT_MS - (Date.now() - startedAt);
      if (remaining <= 0) throw new Error('等太久了（超過 75 秒），請稍後再試，或換一張比較清楚的照片');
      onProgress?.(mIdx === 0 && attempt === 0 ? 'AI 辨識中...' : `AI 辨識中（換方式再試 ${mIdx * 2 + attempt}）...`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(REQUEST_TIMEOUT_MS, remaining));
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (res.ok) {
          const resJson = await res.json();
          const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!responseText) throw new Error('Gemini API 未回傳任何文字結果。');
          return resJson;
        }

        const status = res.status;
        const errText = await res.text();
        const lowerErr = errText.toLowerCase();

        // 503 / 500 / 429：暫時性忙碌，同一模型稍後重試
        const isBusy = status === 503 || status === 500 || status === 429 ||
          lowerErr.includes('high demand') || lowerErr.includes('unavailable') || lowerErr.includes('resource_exhausted');

        if (isBusy) {
          console.warn(`[Gemini] 模型 ${model} (嘗試 ${attempt + 1}) 遭遇 ${status}，稍後重試...`);
          lastErrorMsg = `伺服器忙碌 (${status})`;
          await new Promise(r => setTimeout(r, 800));
          continue; // 同模型再試一次
        }

        // 404 / 400：模型不存在或請求格式錯誤 → 跳下一個模型
        console.warn(`[Gemini] 模型 ${model} 回傳 ${status}，跳至備援模型...`);
        lastErrorMsg = `${model} 不可用 (${status})`;
        break; // 跳出 attempt 迴圈，進入下一個模型

      } catch (err: any) {
        lastErrorMsg = err?.name === 'AbortError' ? '連線逾時' : (err?.message || '');
        console.warn(`[Gemini] 模型 ${model} 例外：${lastErrorMsg}`);
        await new Promise(r => setTimeout(r, 800));
        // 例外也繼續嘗試下一個模型
      } finally {
        clearTimeout(timer);
      }
    }
  }

  // 所有模型都失敗
  throw new Error(lastErrorMsg || '所有備援模型皆無法使用，請稍後再試');
};

export const filterTaiwanTerms = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/刷新/g, '更新')
    .replace(/優化/g, '改善')
    .replace(/質量/g, '品質')
    .replace(/屏幕/g, '螢幕')
    .replace(/視頻/g, '影片')
    .replace(/保存/g, '儲存')
    .replace(/開小差/g, '分心')
    .replace(/反饋/g, '回饋');
};
