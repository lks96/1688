'use client';
import {useMemo,useState} from 'react';
import {ResponsiveContainer,LineChart,Line,BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,ReferenceLine,Cell} from 'recharts';
import type {OmissionStatistics} from '@/lib/omissions';
import type {OmissionBacktest} from '@/lib/omission-backtest';
const green='#527945',gold='#b8964b',grid='#e8ede2';
const axis={fontSize:11,fill:'#7c8d72'};
const tooltipStyle={border:'1px solid #dce7d4',borderRadius:10,fontSize:12};
export function PeriodButtons({value,onChange,all=false}:{value:number;onChange:(n:number)=>void;all?:boolean}){return <div className="chart-periods" role="group" aria-label="图表期数">{[30,60,90,...(all?[0]:[])].map(n=><button type="button" key={n} aria-pressed={value===n} className={value===n?'active':''} onClick={()=>onChange(n)}>{n?`近${n}期`:'全部'}</button>)}</div>;}
export function OmissionCharts({group,timeline,selectedKey,onSelect}:{group:OmissionStatistics['scopes']['special'][number];timeline:OmissionStatistics['timeline'];selectedKey:string;onSelect:(key:string)=>void}){
 const [period,setPeriod]=useState(30);
 const ordered=[...group.items].sort((a,b)=>b.current-a.current);
 const selected=group.items.find(r=>r.key===selectedKey)??ordered[0];
 const bars=ordered.slice(0,15).map(item=>({key:item.key,label:item.label,omission:item.current}));
 const series=timeline.map((row,i)=>({issue:row.issue,date:row.time.slice(5,10),omission:selected.trend[i]})).slice(-period);
 return <div className="omission-chart-grid">
  <section className="panel chart-panel"><div className="panel-heading"><div><h2>{group.label} · 当前遗漏</h2><p>{group.items.length>15?'遗漏最多的15项':'按遗漏从多到少'} · 单位：期</p></div></div>
   <div className="stats-chart" role="img" aria-label={`${group.label}当前遗漏柱状图，${bars.map(r=>r.label+' '+r.omission+'期').join('，')}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={bars} margin={{top:12,right:8,left:-25,bottom:2}}><CartesianGrid stroke={grid} vertical={false}/><XAxis dataKey="label" tick={axis} interval={0} tickLine={false} axisLine={false}/><YAxis tick={axis} allowDecimals={false} tickLine={false} axisLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={v=>[`${v}期`,'当前遗漏']}/><Bar dataKey="omission" radius={[4,4,0,0]} maxBarSize={45}>{bars.map(r=><Cell key={r.key} fill={r.key===selected.key?gold:green} onClick={()=>onSelect(r.key)} cursor="pointer"/>)}</Bar></BarChart></ResponsiveContainer></div>
  </section>
  <section className="panel chart-panel" id="omission-trend-chart"><div className="panel-heading"><div><h2>{selected.label} · 遗漏走势</h2><p>横轴为开奖日期 · 出现归零</p></div><label className="chart-select-label"><span className="sr-only">选择走势项目</span><select aria-label="选择走势项目" value={selected.key} onChange={e=>onSelect(e.target.value)}>{group.items.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div>
   <PeriodButtons value={period} onChange={setPeriod}/><div className="stats-chart" role="img" aria-label={`${selected.label}最近${series.length}期遗漏折线图，当前${selected.current}期未出`}><ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{top:12,right:12,left:-25,bottom:2}}><CartesianGrid stroke={grid} vertical={false}/><XAxis dataKey="date" tick={axis} minTickGap={25} tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false}/><Tooltip contentStyle={tooltipStyle} labelFormatter={(_,p)=>p[0]?.payload?.issue+'期'} formatter={v=>[`${v}期`,'遗漏']}/><Line type="linear" dataKey="omission" stroke={green} strokeWidth={2} dot={false} activeDot={{r:4}} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>
  </section>
 </div>;
}
export function ProfitTrend({rows}:{rows:OmissionBacktest['rows']}){
 const [period,setPeriod]=useState(0);
 const full=useMemo(()=>[...rows].reverse().map(r=>({date:r.time.slice(5,10),issue:r.issue,profit:r.cumulativeProfitCents/100})),[rows]);
 const series=period?full.slice(-period):full;
 let peak=0,drawdown=0,worst=0,misses=0,longestMiss=0;
 for(const r of full){peak=Math.max(peak,r.profit);drawdown=Math.max(drawdown,peak-r.profit);worst=Math.min(worst,r.profit);}
 for(const row of [...rows].reverse()){misses=row.hit?0:misses+1;longestMiss=Math.max(longestMiss,misses);}
 return <div className="profit-trend"><div className="chart-section-title"><h3>累计盈亏曲线</h3><span>单位：元</span></div><PeriodButtons value={period} onChange={setPeriod} all/>
  <div className="stats-chart" role="img" aria-label="号码前十累计盈亏折线图"><ResponsiveContainer width="100%" height="100%"><LineChart data={series} margin={{top:12,right:12,left:0,bottom:2}}><CartesianGrid stroke={grid} vertical={false}/><XAxis dataKey="date" tick={axis} minTickGap={30} tickLine={false} axisLine={false}/><YAxis tick={axis} tickFormatter={v=>Math.abs(v)>=1000?(v/1000)+'千':String(v)} width={50} tickLine={false} axisLine={false}/><ReferenceLine y={0} stroke={gold} strokeDasharray="4 4"/><Tooltip contentStyle={tooltipStyle} labelFormatter={(_,p)=>p[0]?.payload?.issue+'期'} formatter={v=>[`${Number(v).toLocaleString('zh-CN')}元`,'累计盈亏']}/><Line dataKey="profit" stroke={green} strokeWidth={2} dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>
  <div className="stats-mini-grid"><div><span>历史最大回撤</span><strong>{drawdown.toLocaleString('zh-CN')}<small>元</small></strong></div><div><span>累计最低盈亏</span><strong>{worst.toLocaleString('zh-CN')}<small>元</small></strong></div><div><span>最长连续未中</span><strong>{longestMiss}<small>期</small></strong></div><div><span>当前连续未中</span><strong>{misses}<small>期</small></strong></div></div>
 </div>;
}
