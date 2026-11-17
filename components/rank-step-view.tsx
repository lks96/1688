'use client';
import {useMemo,useState} from 'react';
import {RANK_STEP_MODES,type RankStepCount,type OmissionBet} from '@/lib/omission-backtest';
import {rankStepLedger} from '@/lib/rank-step';
import type {OmissionScope} from '@/lib/omissions';
import type {LongHistoryResult} from '@/lib/long-history';
import {ProfitTrend} from '@/components/statistics-charts';
const money=(v:number)=>(v/100).toLocaleString('zh-CN',{maximumFractionDigits:2});
const signed=(v:number)=>(v>0?'+':v<0?'−':'')+money(Math.abs(v));
const tone=(v:number)=>v>0?'profit-gain':v<0?'profit-loss':'profit-even';
const num=(v:number)=>String(v).padStart(2,'0');
const gap=(v:number|null)=>v===null?'—':Number.isInteger(v)?String(v):v.toFixed(1);
export function RankStepControls({scope,count,onScope,onCount}:{scope:OmissionScope;count:RankStepCount;onScope:(v:OmissionScope)=>void;onCount:(v:RankStepCount)=>void}){
 return <><div className="ledger-tabs" role="group" aria-label="阶梯跟买评分来源">{([['special','特码评分'],['all','平特码（全部7码）评分']] as const).map(([id,label])=><button key={id} type="button" className={scope===id?'active':''} aria-pressed={scope===id} onClick={()=>onScope(id)}>{label}</button>)}</div><div className="ledger-tabs rank-bet-plans" role="group" aria-label="阶梯跟买号码档位">{RANK_STEP_MODES.map(m=><button type="button" key={m.count} className={count===m.count?'active':''} aria-pressed={count===m.count} onClick={()=>onCount(m.count)}>{m.label} · 等{m.missThreshold}期</button>)}</div></>;
}
export function RankStepNext({forecast,next,count}:{forecast:LongHistoryResult['forecasts']['special']|null|undefined;next:ReturnType<typeof rankStepLedger>['next'];count:RankStepCount}){
 const mode=RANK_STEP_MODES.find(m=>m.count===count)!;
 return <div className="long-next-picks"><div className="chart-section-title"><h3>下一期跟买清单{forecast?' · '+forecast.forecastFor:''}</h3><span>{forecast&&next.bought?'按规则购买':'等待，不购买'}</span></div>
  <p className="stats-small-note">{forecast?`输入截至${forecast.trainingThroughIssue}期 · ${forecast.trainingThroughTime}`:'当年记录不足，暂不生成号码。'}{!next.ready?` 仍需积累${next.warmupRemaining}个可回测期。`:!next.bought?` 整组连续未中尚未达到${mode.missThreshold}期，先等待。`:''}</p>
  <div className="rank-current"><span>每码金额 <strong>{forecast?money(next.stakePerNumberCents):'0'}元</strong></span><span>{count}码合计 <strong>{forecast?money(next.stakeCents):'0'}元</strong></span><span>整组当前连续未中（特码） <strong>{next.missStreak}期</strong></span></div>
  {forecast&&<div className={`omission-ledger-numbers rank-step-grid step-${count}`}>{forecast.candidates.slice(0,count).map(c=><span key={c.rank}><b>{num(c.number)}</b><small>{c.zodiac} · 第{c.rank}名</small><small>{next.bought?`买${money(next.stakePerNumberCents)}元`:'不购买'}</small></span>)}</div>}
 </div>;
}
export function RankStepDetails({rows,scope,count,yearly=false}:{rows:OmissionBet[];scope:OmissionScope;count:RankStepCount;yearly?:boolean}){
 const [limit,setLimit]=useState(10),ledger=useMemo(()=>rankStepLedger(rows,scope,count,yearly?99:100),[rows,scope,count,yearly]);
 const s=ledger.summary,p=ledger.presence,threshold=ledger.missThreshold;
 return <section className="rank-frequency-ledger" aria-label={`前${count}码未命中阶梯跟买明细`}>
  <div className="chart-section-title"><h3>未命中阶梯跟买 · 前{count}码</h3><span>{s.draws}期收益记录</span></div>
  <div className="settlement-basis">首个收益期每码10元起买；上期候选特码命中则下一期每码10元继续；连续未中累计{threshold}期后的下一期买10元，再未中每期每码加10元，命中后整体重置。<span>每期按此前频率动态取前{count}个评分名次 · 特码47倍含本金 · {yearly?'每年前100个有效开奖期收集数据，年初全部重置':'前100个可回测期收集数据，之后开始统计收益'}</span></div>
  <div className="ledger-summary"><div><span>累计盈亏</span><strong className={tone(s.profitCents)}>{signed(s.profitCents)}<small>元</small></strong></div><dl><div><dt>累计投入</dt><dd>{money(s.stakeCents)}元</dd></div><div><dt>累计返还</dt><dd>{money(s.returnCents)}元</dd></div><div><dt>特码命中期数</dt><dd>{s.hits}/{s.betDraws}个购买期</dd></div><div><dt>下注号码次数</dt><dd>{s.betCount}次</dd></div><div><dt>盈亏率</dt><dd className={tone(s.profitCents)}>{(s.roi*100).toFixed(2)}%</dd></div></dl></div>
  <div className="rank-current"><span>最高单期总下注 <strong>{money(s.maxStakeCents)}元</strong></span><span>对应期号 <strong>{s.maxStakeIssue?`${s.maxStakeIssue}期 · ${s.maxStakeTime?.slice(0,10)}`:'尚未下注'}</strong></span></div>
  <div className="chart-section-title"><h3>动态前{count}名次 · 出现统计</h3><span>{p.periods}期</span></div>
  <p className="stats-small-note">逐期检查开奖是否落在当时动态选出的{count}个评分名次中；{scope==='all'?'平特码按当期7码至少1个落入计为出现':'特码按最后一个号码落入计为出现'}。范围与本账本收益期相同，等待期也计入；平均值与中位数只取两次出现之间已结束的空缺间隔，连续出现记0期。跟买的未中计数、加注和重置始终核对特码。</p>
  <div className="rank-current"><span>当前连续未出现 <strong>{p.currentAbsent}期</strong></span><span>历史最长未出现 <strong>{p.maxAbsent}期</strong></span><span>最多连续出现 <strong>{p.maxPresent}期</strong></span></div>
  <div className="rank-current"><span>平均不出多少期后出现 <strong>{gap(p.averageGap)}{p.averageGap===null?'':'期'}</strong></span><span>历史中位不出期数 <strong>{gap(p.medianGap)}{p.medianGap===null?'':'期'}</strong></span><span>完整间隔 <strong>{p.completedIntervals}个</strong></span></div>
  <ProfitTrend rows={ledger.rows} title={`前${count}码阶梯跟买累计盈亏曲线`}/>
  <details className="omission-ledger-details"><summary>查看逐期盈利明细<small>共{s.draws}期 · 最新在前</small></summary><div className="omission-ledger-rows">{ledger.rows.slice(0,limit).map(row=><article key={row.issue}>
   <header><div><strong>{row.issue}期</strong><time>{row.time.slice(0,10)}</time></div><span className={row.hit?'omission-ledger-hit':'omission-ledger-miss'}>{row.bought?(row.hit?'本期命中':'本期未中'):row.signalHit?'未买 · 候选特码命中':'等待 · 未购买'}</span></header>
   <div className={`omission-ledger-numbers rank-step-grid step-${count}`}>{row.candidates.map(c=><span key={c.rank} className={c.hit?'hit':''}><b>{num(c.number)}</b><small>第{c.rank}名 · {c.bought?`买${money(c.stakeCents)}元`:'未买'}</small></span>)}</div>
   <div className="omission-ledger-boundary">特码{num(row.specialNumber)} · 输入截至{row.trainingThroughIssue}期 · {row.trainingThroughTime.slice(0,10)}</div>
   <dl><div><dt>投入 / 返还</dt><dd>{money(row.stakeCents)} / {money(row.returnCents)}元</dd></div><div><dt>当期盈亏</dt><dd className={tone(row.profitCents)}>{signed(row.profitCents)}元</dd></div><div><dt>累计盈亏</dt><dd className={tone(row.cumulativeProfitCents)}>{signed(row.cumulativeProfitCents)}元</dd></div></dl>
  </article>)}</div>{limit<ledger.rows.length&&<button type="button" className="load-more" onClick={()=>setLimit(n=>Math.min(n+10,ledger.rows.length))}>再显示10期<span>已显示{Math.min(limit,ledger.rows.length)}/{ledger.rows.length}期</span></button>}{ledger.rows.length>10&&<button type="button" className="show-all-records" onClick={()=>setLimit(limit<ledger.rows.length?ledger.rows.length:10)}>{limit<ledger.rows.length?`显示全部${ledger.rows.length}期`:'收起，仅显示最近10期'}</button>}</details>
 </section>;
}
