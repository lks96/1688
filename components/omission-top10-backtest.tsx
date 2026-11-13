'use client';
import {omissionNumberMark} from '@/lib/omission-markers';
import OmissionPerformancePanel from '@/components/omission-performance';
import {ProfitTrend} from '@/components/statistics-charts';
import {useState} from 'react';
import type {OmissionScope} from '@/lib/omissions';
import type {OmissionBacktest} from '@/lib/omission-backtest';
const money=(cents:number)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(cents/100);
const signed=(cents:number)=>(cents>0?'+':cents<0?'−':'')+money(Math.abs(cents));
const tone=(cents:number)=>cents>0?'profit-gain':cents<0?'profit-loss':'profit-even';
const num=(n:number)=>String(n).padStart(2,'0');

export default function OmissionTop10Backtest({backtest:b,scope='special'}:{backtest:OmissionBacktest;scope?:OmissionScope}){
  const [limit,setLimit]=useState(10);
  const current=b,s=current.summary;
  return <section className="panel omission-top10-ledger" aria-label="遗漏号码前十独立盈亏">
    <div className="panel-heading"><div><h2>{scope==='all'?'全部7码评分 · 前十回测':'号码前十 · 回测盈亏'}</h2><p>{s.from} 至 {s.to} · {s.draws}期</p></div><span className="subtle-tag">特码独立账本</span></div>
    <div className="settlement-basis">每号10元 × 10个号 = 每期100元<span>47倍含本金 · 只核对最后一个号码</span></div>
    <div className="ledger-summary"><div><span>累计盈亏</span><strong className={tone(s.profitCents)}>{signed(s.profitCents)}<small>元</small></strong></div><dl><div><dt>累计投入</dt><dd>{money(s.stakeCents)}元</dd></div><div><dt>累计返还</dt><dd>{money(s.returnCents)}元</dd></div><div><dt>特码命中</dt><dd>{s.hits}/{s.betDraws}期</dd></div><div><dt>盈亏率</dt><dd className={tone(s.profitCents)}>{(s.roi*100).toFixed(2)}%</dd></div></dl></div>
    <OmissionPerformancePanel statistics={scope==='all'?b.allPerformance:b.performance} target={scope}/>
    <ProfitTrend rows={b.rows}/>
    <div className="omission-hit-legend"><span className="special-key">特码命中</span><span className="regular-key">平码命中（前6码）</span><span className="special-zodiac-key">特码同生肖</span><span className="regular-zodiac-key">平码同生肖</span></div>
    <details className="omission-ledger-details"><summary>逐期明细<small>共{s.draws}期 · 最新在前</small></summary>
      <div className="omission-ledger-rows">{current.rows.slice(0,limit).map(row=><article key={row.issue}>
        <header><div><strong>{row.issue}期</strong>{scope==='all'&&<small className="seven-hit-count">前十命中{row.allHitCount}/7码</small>}<time>{row.time.slice(0,10)}</time></div><span className={row.hit?'omission-ledger-hit':'omission-ledger-miss'}>特码{num(row.specialNumber)} · {row.hit?'命中':'未中'}{row.specialRank!==null?` · 第${row.specialRank}名`:''}</span></header>
        <div className="omission-ledger-numbers" aria-label="当期预测的十个号码">{row.numbers.map(n=>{const mark=omissionNumberMark(n,row);return <span key={n} className={mark.className} aria-label={`${num(n)}，${mark.zodiac}，${mark.description}`}><b>{num(n)}</b><small>{mark.zodiac}{mark.badge?' · '+mark.badge:''}</small></span>;})}</div>
        <div className="omission-ledger-boundary">输入截至{row.trainingThroughIssue}期 · {row.trainingThroughTime.slice(0,10)}</div>
        <dl><div><dt>投入 / 返还</dt><dd>{money(row.stakeCents)} / {money(row.returnCents)}元</dd></div><div><dt>当期盈亏</dt><dd className={tone(row.profitCents)}>{signed(row.profitCents)}元</dd></div><div><dt>累计盈亏</dt><dd className={tone(row.cumulativeProfitCents)}>{signed(row.cumulativeProfitCents)}元</dd></div></dl>
      </article>)}</div>
      {limit<current.rows.length&&<button type="button" className="load-more" onClick={()=>setLimit(n=>Math.min(n+10,current.rows.length))}>再显示10期<span>已显示{Math.min(limit,current.rows.length)}/{current.rows.length}期</span></button>}
      {current.rows.length>10&&<button type="button" className="show-all-records" onClick={()=>setLimit(limit<current.rows.length?current.rows.length:10)}>{limit<current.rows.length?`显示全部${current.rows.length}期`:'收起，仅显示最近10期'}</button>}
    </details>
  </section>;
}
