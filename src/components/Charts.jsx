import { useId } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { money, moneyCompact, fmtDay } from '../lib/format.js';

const axis = { fontSize: 12, fill: '#74738a' };
const shortDay = d => fmtDay(d, { month: '2-digit', day: '2-digit', year: '2-digit' });

function Tip({ active, payload, label, field }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].payload[field];
  return (
    <div className="card" style={{ padding: '8px 12px', fontSize: 12 }}>
      <div className="muted">{fmtDay(label)}</div>
      <div className={v >= 0 ? 'pos' : 'neg'} style={{ fontWeight: 600, fontSize: 14 }}>{money(v)}</div>
    </div>
  );
}

/** Area chart that is green above zero and red below zero. */
export function CumulativeChart({ data, field = 'cumulative', height = 300 }) {
  const id = useId().replace(/:/g, '');
  const vals = data.map(d => d[field]);
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  const off = max - min === 0 ? 0.5 : max / (max - min);
  if (!data.length) return <div className="empty" style={{ height }}>No trades in the selected range</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4fc29b" stopOpacity={0.55} />
            <stop offset={off} stopColor="#4fc29b" stopOpacity={0.08} />
            <stop offset={off} stopColor="#f07c85" stopOpacity={0.08} />
            <stop offset="1" stopColor="#f07c85" stopOpacity={0.55} />
          </linearGradient>
          <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset={off} stopColor="#3fb68e" /><stop offset={off} stopColor="#ec5f6a" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ececf2" />
        <XAxis dataKey="date" tickFormatter={shortDay} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={moneyCompact} tick={axis} axisLine={false} tickLine={false} width={64} />
        <Tooltip content={<Tip field={field} />} />
        <ReferenceLine y={0} stroke="#b9b8c9" strokeDasharray="4 4" />
        <Area type="monotone" dataKey={field} stroke={`url(#s${id})`} strokeWidth={2} fill={`url(#f${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DailyBars({ data, height = 300 }) {
  if (!data.length) return <div className="empty" style={{ height }}>No trades in the selected range</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ececf2" />
        <XAxis dataKey="date" tickFormatter={shortDay} tick={axis} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tickFormatter={moneyCompact} tick={axis} axisLine={false} tickLine={false} width={64} />
        <Tooltip content={<Tip field="net" />} cursor={{ fill: '#f3f2fa' }} />
        <ReferenceLine y={0} stroke="#b9b8c9" />
        <Bar dataKey="net" isAnimationActive={false} maxBarSize={18}>
          {data.map((d, i) => <Cell key={i} fill={d.net >= 0 ? '#4fc29b' : '#f07c85'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ScoreRadar({ parts, height = 280 }) {
  const data = [
    { k: 'Win %', v: parts.winRate },
    { k: 'Profit factor', v: parts.profitFactor },
    { k: 'Avg win/loss', v: parts.avgWinLoss },
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#e3e0f8" />
        <PolarAngleAxis dataKey="k" tick={{ fontSize: 12, fill: '#74738a' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="v" stroke="#6c5dd3" fill="#6c5dd3" fillOpacity={0.25} isAnimationActive={false} dot={{ r: 3, fill: '#6c5dd3' }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function GroupBars({ rows, height = 260, label = 'key' }) {
  if (!rows.length) return <div className="empty">No data</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ececf2" />
        <XAxis dataKey={label} tick={axis} axisLine={false} tickLine={false} interval={0} />
        <YAxis tickFormatter={moneyCompact} tick={axis} axisLine={false} tickLine={false} width={64} />
        <Tooltip formatter={v => money(v)} cursor={{ fill: '#f3f2fa' }} />
        <ReferenceLine y={0} stroke="#b9b8c9" />
        <Bar dataKey="netPnl" name="Net P&L" isAnimationActive={false} maxBarSize={36}>
          {rows.map((d, i) => <Cell key={i} fill={d.netPnl >= 0 ? '#4fc29b' : '#f07c85'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
