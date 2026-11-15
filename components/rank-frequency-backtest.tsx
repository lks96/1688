'use client';
import {useState} from 'react';
import {backtestFrequentRankNumbers,type FrequentRankBetPlan,type OmissionBacktest} from '@/lib/omission-backtest';
const money=(cents:number)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(cents/100);
const signed=(cents:number)=>(cents>0?'+':cents<0?'−':'')+money(Math.abs(cents));
const tone=(cents:number)=>cents>0?'profit-gain':cents<0?'profit-loss':'profit-even';
const num=(n:number)=>String(n).padStart(2,'0');

export default function RankFrequencyBacktest({rows}:{rows:OmissionBacktest['rows']}){
 const [limit,setLimit]=useState(10),[plan,setPlan]=useState<FrequentRankBetPlan>('alternate-fixed'),ledger=backtestFrequentRankNumbers(rows,plan),s=ledger.summary;
 const plans:[FrequentRankBetPlan,string][]=[['alternate-fixed','隔期固定10'],['miss-streak-step','未中阶梯跟买'],['every-period-fixed','每期固定10']];
 const rule=plan==='alternate-fixed'?'首个可回测期开始，每期按此前频率重新选十个名次，每隔一期买一次；未中也继续。':plan==='every-period-fixed'?'首个可回测期开始，每期按此前频率重新选十个名次并购买对应号码。':'每期按此前频率重新选十个名次；任一动态号码命中后，下一期整组按每名次10元继续。未中累计1—2期先等待，累计3期后的下一期开始买10元，继续未中每期每名次加10元；命中后未中期数整体重置。';
 return <section className="rank-frequency-ledger" aria-label="频率前十评分名次盈利回测">
  <div className="chart-section-title"><h3>频率前十名次 · 盈利明细</h3><span>{s.draws}期历史</span></div>
  <div className="ledger-tabs rank-bet-plans" role="group" aria-label="频率名次跟买方式">{plans.map(([id,label])=><button type="button" key={id} className={plan===id?'active':''} aria-pressed={plan===id} onClick={()=>{setPlan(id);setLimit(10);}}>{label}</button>)}</div>
  <div className="settlement-basis">{rule}<span>每名次基础10元 · 特码47倍含本金 · 连中当期返还后续期按规则继续</span></div>
  <div className="ledger-summary"><div><span>累计盈亏</span><strong className={tone(s.profitCents)}>{signed(s.profitCents)}<small>元</small></strong></div><dl><div><dt>累计投入</dt><dd>{money(s.stakeCents)}元</dd></div><div><dt>累计返还</dt><dd>{money(s.returnCents)}元</dd></div><div><dt>命中期数</dt><dd>{s.hits}/{s.betDraws}个购买期</dd></div><div><dt>下注名次次数</dt><dd>{s.betCount}次</dd></div><div><dt>盈亏率</dt><dd className={tone(s.profitCents)}>{(s.roi*100).toFixed(2)}%</dd></div></dl></div>
  <details className="omission-ledger-details"><summary>查看逐期盈利明细<small>共{s.draws}期 · 最新在前</small></summary>
   <div className="omission-ledger-rows">{ledger.rows.slice(0,limit).map(row=><article key={row.issue}>
    <header><div><strong>{row.issue}期</strong><time>{row.time.slice(0,10)}</time></div><span className={row.hit?'omission-ledger-hit':'omission-ledger-miss'}>{row.bought?(row.hit?'本期命中':'本期未中'):row.signalHit?'未买 · 动态号码命中':'本期未购买'}</span></header>
    <div className="omission-ledger-numbers" aria-label="频率前十名次本期对应号码">{row.candidates.map(candidate=><span key={candidate.rank} className={candidate.hit?'hit':''}><b>{num(candidate.number)}</b><small>第{candidate.rank}名 · {candidate.bought?`买${money(candidate.stakeCents)}元`:'未买'}</small></span>)}</div>
    <div className="omission-ledger-boundary">特码{num(row.specialNumber)} · 按历史评分名次逐期对应号码</div>
    <dl><div><dt>投入 / 返还</dt><dd>{money(row.stakeCents)} / {money(row.returnCents)}元</dd></div><div><dt>当期盈亏</dt><dd className={tone(row.profitCents)}>{signed(row.profitCents)}元</dd></div><div><dt>累计盈亏</dt><dd className={tone(row.cumulativeProfitCents)}>{signed(row.cumulativeProfitCents)}元</dd></div></dl>
   </article>)}</div>
   {limit<ledger.rows.length&&<button type="button" className="load-more" onClick={()=>setLimit(n=>Math.min(n+10,ledger.rows.length))}>再显示10期<span>已显示{Math.min(limit,ledger.rows.length)}/{ledger.rows.length}期</span></button>}
   {ledger.rows.length>10&&<button type="button" className="show-all-records" onClick={()=>setLimit(limit<ledger.rows.length?ledger.rows.length:10)}>{limit<ledger.rows.length?`显示全部${ledger.rows.length}期`:`收起，仅显示最近10期`}</button>}
  </details>
 </section>;
}
