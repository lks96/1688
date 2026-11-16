'use client';
import {useState} from 'react';
import {backtestFrequentRankNumbers,type FrequentRankBetPlan,type OmissionBet} from '@/lib/omission-backtest';
import {ProfitTrend} from '@/components/statistics-charts';
const money=(cents:number)=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(cents/100);
const signed=(cents:number)=>(cents>0?'+':cents<0?'−':'')+money(Math.abs(cents));
const tone=(cents:number)=>cents>0?'profit-gain':cents<0?'profit-loss':'profit-even';
const num=(n:number)=>String(n).padStart(2,'0');

export default function RankFrequencyBacktest({rows,initialPlan='alternate-fixed',onPlanChange,yearly=false}:{rows:OmissionBet[];initialPlan?:FrequentRankBetPlan;onPlanChange?:(plan:FrequentRankBetPlan)=>void;yearly?:boolean}){
 const [limit,setLimit]=useState(10),[plan,setPlan]=useState<FrequentRankBetPlan>(initialPlan),ledger=backtestFrequentRankNumbers(rows,plan,yearly?99:100),s=ledger.summary;
 const plans:[FrequentRankBetPlan,string][]=[['alternate-fixed','连买两期停一期'],['miss-streak-step','未中阶梯跟买'],['every-period-fixed','每期固定10']];
 const rule=plan==='alternate-fixed'?'第101个历史期起买，每期按此前频率重选十个名次。买中后停1期；未中最多连续买2期（含起买期），随后停1期，再重新起买，每码固定10元。':plan==='every-period-fixed'?'第101个历史期开始，每期按此前频率重新选十个名次并购买对应号码。':'第101个历史期整组每码10元起买，每期按此前频率重选十个名次。任一动态号码命中后，下一期整组每码10元继续；未中累计1—2期先等待，累计3期后的下一期买10元，继续未中每期每码加10元，命中后整体重置。';
 return <section className="rank-frequency-ledger" aria-label="频率前十评分名次盈利回测">
  <div className="chart-section-title"><h3>频率前十名次 · 盈利明细</h3><span>{s.draws}期收益记录</span></div>
  <p className="stats-small-note">{yearly?'每年独立：第1期初始化遗漏，第2—100期积累评分名次频率，第101期起下注，跟买状态从零开始。':'前100个历史期只积累排名频率，第101期开始下注、统计盈亏和未中期数。'}{yearly?'积累进度以本年有效记录为准':`已积累${s.warmupDraws}/100期`}{s.from?` · 收益统计 ${s.from} 至 ${s.to}`:' · 尚未达到下注起点'}。</p>
  <div className="ledger-tabs rank-bet-plans" role="group" aria-label="频率名次跟买方式">{plans.map(([id,label])=><button type="button" key={id} className={plan===id?'active':''} aria-pressed={plan===id} onClick={()=>{setPlan(id);setLimit(10);onPlanChange?.(id);}}>{label}</button>)}</div>
  <div className="settlement-basis">{yearly?rule.replaceAll('第101个历史期','当年第101个有效开奖期'):rule}<span>每名次基础10元 · 特码47倍含本金 · 连中当期返还后续期按规则继续</span></div>
  <div className="ledger-summary"><div><span>累计盈亏</span><strong className={tone(s.profitCents)}>{signed(s.profitCents)}<small>元</small></strong></div><dl><div><dt>累计投入</dt><dd>{money(s.stakeCents)}元</dd></div><div><dt>累计返还</dt><dd>{money(s.returnCents)}元</dd></div><div><dt>命中期数</dt><dd>{s.hits}/{s.betDraws}个购买期</dd></div><div><dt>下注名次次数</dt><dd>{s.betCount}次</dd></div><div><dt>盈亏率</dt><dd className={tone(s.profitCents)}>{(s.roi*100).toFixed(2)}%</dd></div></dl></div>
  <div className="rank-current"><span>最高单期总下注 <strong>{money(s.maxStakeCents)}元</strong></span><span>对应期号 <strong>{s.maxStakeIssue?`${s.maxStakeIssue}期 · ${s.maxStakeTime?.slice(0,10)}`:'尚未下注'}</strong></span></div>
  <ProfitTrend rows={ledger.rows} title="动态评分名次跟买累计盈亏曲线"/>
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
