import { useEffect, useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | string | null | undefined;
  /** 收到的一定是數字；框框清空時是 0（有設定 minValue 時，低於最小值不會送出） */
  onValueChange: (value: number) => void;
  /** 只接受整數 */
  integer?: boolean;
  /** 最小值：清空或低於最小值時先不更新，離開框框時恢復原本的數字（例如期數至少 1） */
  minValue?: number;
  /** 最大值：超過時以最大值計算（例如期數最多 36） */
  maxValue?: number;
};

/**
 * 數字輸入框。和一般 <input type="number"> 不同的是，框框可以整個刪空再重新輸入，
 * 不會一清空就被補回 0。點進框框時會自動全選，直接打字就能取代原本的數字。
 */
export function NumberInput({ value, onValueChange, integer = false, minValue, maxValue, onFocus, onBlur, ...rest }: Props) {
  const toText = (v: Props['value']) => (v === null || v === undefined || v === '' ? '' : String(v));
  const [text, setText] = useState(() => toText(value));

  // 外部數值改變時（例如切換期數重新計算），同步顯示；
  // 但如果只是使用者把框框清空（顯示空白、數值是 0），保持空白。
  useEffect(() => {
    const shown = text === '' || text === '-' ? 0 : Number(text);
    if (shown !== Number(value || 0)) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      {...rest}
      type="number"
      inputMode={integer ? 'numeric' : 'decimal'}
      min={minValue}
      max={maxValue}
      value={text}
      onFocus={e => {
        e.target.select();
        onFocus?.(e);
      }}
      onBlur={e => {
        // 離開框框時，如果留空或數字不合規定，恢復顯示目前的數值
        const n = Number(text);
        if (text === '' ? minValue !== undefined : (!Number.isFinite(n) || n !== Number(value || 0))) {
          setText(toText(value));
        }
        onBlur?.(e);
      }}
      onChange={e => {
        const raw = e.target.value;
        setText(raw);
        let n = integer ? parseInt(raw, 10) : parseFloat(raw);
        if (!Number.isFinite(n)) n = 0;
        if (minValue !== undefined && n < minValue) return; // 先不更新，等使用者打完
        if (maxValue !== undefined && n > maxValue) n = maxValue;
        onValueChange(n);
      }}
    />
  );
}
