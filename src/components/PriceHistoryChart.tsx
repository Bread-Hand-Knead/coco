import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PriceHistoryItem } from '../types';

// 台股習慣：漲紅、跌綠
const UP = '#E0335B';
const DOWN = '#16A34A';
const FLAT = '#8D6E63';

/**
 * 市價歷史折線圖：依日期由舊到新畫出市價（或總市值）的變化。
 * 少於 2 筆記錄時不顯示（畫不出線）。
 */
export function PriceHistoryChart({ history }: { history: PriceHistoryItem[] }) {
  const [metric, setMetric] = useState<'price' | 'marketValue'>('price');

  const points = useMemo(() => {
    // 同一天有多筆時，取最後建立的那一筆
    const byDate = new Map<string, PriceHistoryItem>();
    history.forEach(h => {
      const key = h.date.replace(/\//g, '-');
      const prev = byDate.get(key);
      if (!prev || (h.createdAt || '') >= (prev.createdAt || '')) byDate.set(key, h);
    });
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, h]) => ({ date, price: Number(h.price) || 0, marketValue: Number(h.marketValue) || 0 }));
  }, [history]);

  if (points.length < 2) return null;

  const first = points[0][metric];
  const last = points[points.length - 1][metric];
  const change = first ? (last - first) / first : 0;
  const color = last > first ? UP : last < first ? DOWN : FLAT;
  const spansYears = points[0].date.slice(0, 4) !== points[points.length - 1].date.slice(0, 4);
  const fmtDate = (d: string) => (spansYears ? d.slice(2).replace(/-/g, '/') : d.slice(5).replace('-', '/'));
  const fmtVal = (v: number) => (metric === 'price' ? `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `$${Math.round(v).toLocaleString()}`);

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 p-3 shrink-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex bg-stone-100 rounded-lg p-0.5 text-[11px] font-black">
          {(['price', 'marketValue'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`px-2.5 py-1 rounded-md transition-all ${metric === m ? 'bg-white text-[#5D4037] shadow-sm' : 'text-stone-500'}`}
            >
              {m === 'price' ? '市價' : '總市值'}
            </button>
          ))}
        </div>
        <span className="text-xs font-black" style={{ color }}>
          {change > 0 ? '▲ +' : change < 0 ? '▼ ' : ''}{(change * 100).toFixed(2)}%
        </span>
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#F0EBE3" />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#8D6E63' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis
              domain={['auto', 'auto']}
              width={metric === 'price' ? 44 : 56}
              tick={{ fontSize: 10, fill: '#A8A29E' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => (metric === 'price' ? String(Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 })) : Number(v).toLocaleString())}
            />
            <Tooltip
              formatter={(val: any) => [fmtVal(Number(val)), metric === 'price' ? '市價' : '總市值']}
              labelFormatter={(d: any) => String(d).replace(/-/g, '/')}
              contentStyle={{ borderRadius: '12px', border: '1px solid #E7E5E4', fontSize: '12px', fontWeight: 'bold' }}
            />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={color}
              strokeWidth={2.5}
              fill="url(#priceFill)"
              dot={(props: any) => {
                const isLast = props.index === points.length - 1;
                return <circle key={props.index} cx={props.cx} cy={props.cy} r={isLast ? 4.5 : 2.5} fill={isLast ? color : '#fff'} stroke={color} strokeWidth={2} />;
              }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
