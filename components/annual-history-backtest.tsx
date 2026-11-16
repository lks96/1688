'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {annualPlanComparison,ANNUAL_BET_WARMUP,type AnnualHistoryResult} from '@/lib/annual-history';
import {backtestFrequentRankNumbers,type FrequentRankBetPlan} from '@/lib/omission-backtest';
import type {OmissionScope} from '@/lib/omissions';
import RankFrequencyBacktest from '@/components/rank-frequency-backtest';
const plans:[FrequentRankBetPlan,string][]=[['alternate-fixed','连买两期停一期'],['miss-streak-step','未中阶梯跟买'],['every-period-fixed','每期固定10元']];
const scopes:[OmissionScope,string][]=[['special','特码评分'],['all','平特码（全部7码）评分']];
const amount=(cents:number)=>(cents/100).toLocaleString('zh-CN',{maximumFractionDigits:2});
const signed=(cents:number)=>(cents>0?'+':'')+amount(cents);
type State=AnnualHistoryResult&{fetchedAt:string;warning:string|null};
export default function AnnualHistoryBacktest(){
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[year,setYear]=useState(''),[scope,setScope]=useState<OmissionScope>('special'),[plan,setPlan]=useState<FrequentRankBetPlan>('alternate-fixed');
 const load=useCallback(async(force=false)=>{setLoading(true);setError('');try{const response=await fetch('/api/annual-history'+(force?'?refresh=1':''),{cache:'no-store'});const result=await response.json() as State&{error?:string};if(!response.ok)throw new Error(result.error||'获取失败');setState(result);}catch(e){setError(e instanceof Error?e.message:'获取失败');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},300000);return()=>clearInterval(timer);},[load]);
 const comparisons=useMemo(()=>state?scopes.flatMap(([scope,label])=>plans.map(([plan,name])=>({label,name,...annualPlanComparison(state.years,scope,plan)}))).sort((a,b)=>b.profitCents-a.profitCents):[],[state]);
 if(!state)return <section className="panel"><h2>逐年独立回测</h2><p className="stats-small-note">{error||'正在逐年独立测算…'}</p>{error&&<button className="primary" onClick={()=>load()}>重新加载</button>}</section>;
 const selected=state.years.find(y=>y.year===(year||state.activeYear))??state.years.at(-1)!;
 const chosen=backtestFrequentRankNumbers(selected.scopes[scope],plan,ANNUAL_BET_WARMUP),next=chosen.next;
 const selectedComparison=comparisons.find(c=>c.scope===scope&&c.plan===plan)!,best=comparisons[0];
 const forecast=selected.forecasts?.[scope],isCurrentYear=selected.year===state.activeYear;
 return <div className="long-history-page">
  <section className="panel"><div className="panel-heading"><div><h2>逐年独立回测 · 2021年至今</h2><p>{state.audit.from.slice(0,10)} 至 {state.audit.to.slice(0,10)} · {state.audit.total}期有效记录</p></div><button className="primary" disabled={loading} onClick={()=>load(true)}>{loading?'同步中…':'同步历年数据'}</button></div>
   <p className="omission-caption">每年从零开始：第1期初始化遗漏，第2—100期只收集数据，第101个有效开奖期开始下注。遗漏评分、名次出现频率、连不中计数和购买／等待状态全部按年重置，不使用其他年份的记录。同一年内只用当期之前的数据生成号码，开奖后更新。</p>
   <p className="stats-small-note">每码基础10元，特码47倍含本金；平特码维度只改变评分和排名频率来源，收益仍按特码结算。汇总收益仅把各年独立账本相加。排除{state.audit.excluded.length}条异常或跨年记录，覆盖期内缺{state.audit.missingDays}天；期数按有效记录计，数据检查沿用长期回测口径。最新检查：{state.fetchedAt}。</p>
   {(error||state.warning)&&<p className="form-error" role="alert">{error||state.warning}</p>}
  </section>
  <section className="panel"><div className="panel-heading"><div><h2>逐年重置后的收益比较</h2><p>六组组合 · 按各年累计净收益合计排序</p></div></div>
   {best&&<div className="rank-best"><span>当前样本净收益最高</span><strong>{best.label} · {best.name}</strong><strong>{signed(best.profitCents)}元</strong></div>}
   <div className="rank-range-table"><table><thead><tr><th>评分来源 / 买法</th><th>累计投入</th><th>累计返还</th><th>净收益</th><th>收益率</th><th>最高单期总下注</th><th>查看</th></tr></thead><tbody>{comparisons.map(c=><tr key={c.scope+c.plan}><td>{c.label}<br/>{c.name}</td><td>{amount(c.stakeCents)}</td><td>{amount(c.returnCents)}</td><td className={c.profitCents>=0?'profit-gain':'profit-loss'}>{signed(c.profitCents)}</td><td>{(c.roi*100).toFixed(2)}%</td><td>{amount(c.maxStakeCents)}元<br/>{c.maxStakeIssue?`${c.maxStakeIssue}期`:'—'}</td><td><button className="text-button" onClick={()=>{setScope(c.scope);setPlan(c.plan);}}>明细</button></td></tr>)}</tbody></table></div>
   <p className="stats-small-note">历史最高表示这段样本的结果。</p>
  </section>
  <section className="panel"><div className="panel-heading"><div><h2>按年查看</h2><p>{selected.year}年 · 有效记录{selected.draws}期 · 已积累{Math.min(100,selected.draws)}/100期</p></div><label className="chart-select-label">年份 <select aria-label="独立回测年份" value={selected.year} onChange={e=>setYear(e.target.value)}>{state.years.map(y=><option key={y.year} value={y.year}>{y.year}年</option>)}</select></label></div>
   <div className="ledger-tabs" role="group" aria-label="逐年独立评分来源">{scopes.map(([id,label])=><button key={id} type="button" className={scope===id?'active':''} aria-pressed={scope===id} onClick={()=>setScope(id)}>{label}</button>)}</div>
   <div className="ledger-tabs rank-bet-plans" role="group" aria-label="逐年独立买法">{plans.map(([id,label])=><button key={id} type="button" className={plan===id?'active':''} aria-pressed={plan===id} onClick={()=>setPlan(id)}>{label}</button>)}</div>
   {isCurrentYear?<div className="long-next-picks"><div className="chart-section-title"><h3>当年下一期跟买清单{forecast?' · '+forecast.forecastFor:''}</h3><span>{next.bought&&forecast?'按规则购买':'等待，不购买'}</span></div>
    <p className="stats-small-note">{forecast?`输入截至${forecast.trainingThroughIssue}期 · ${forecast.trainingThroughTime}`:'当年数据尚不足以生成清单。'}{selected.draws<100?` 本年还需积累${100-selected.draws}期，期间不下注。`:next.bought?'':' 根据当前买法，本期暂停购买。'}</p>
    <div className="rank-current"><span>每码金额 <strong>{forecast?amount(next.stakePerNumberCents):'0'}元</strong></span><span>十码合计 <strong>{forecast?amount(next.stakeCents):'0'}元</strong></span><span>本年连续未中 <strong>{next.missStreak}期</strong></span></div>
    {forecast&&<div className="omission-ledger-numbers">{forecast.candidates.map(c=><span key={c.rank}><b>{String(c.number).padStart(2,'0')}</b><small>{c.zodiac} · 第{c.rank}名</small><small>{next.bought?`买${amount(next.stakePerNumberCents)}元`:'不购买'}</small></span>)}</div>}
    {forecast&&forecast.forecastFor<state.cutoff.slice(0,10)&&<p className="form-error">清单日期早于当前日期，请先同步最新开奖。</p>}
   </div>:<p className="stats-small-note">正在查看已结束年份的独立历史账本。下一年重新从零积累数据。</p>}
   <RankFrequencyBacktest key={selected.year+scope+plan} rows={selected.scopes[scope]} initialPlan={plan} onPlanChange={setPlan} yearly/>
  </section>
  <section className="panel"><div className="chart-section-title"><h3>年度收益 · {scopes.find(s=>s[0]===scope)?.[1]} · {plans.find(p=>p[0]===plan)?.[1]}</h3></div><div className="rank-range-table"><table><thead><tr><th>年份</th><th>有效记录</th><th>下注起点</th><th>购买期数</th><th>投入</th><th>年度净收益</th><th>最高单期总下注</th></tr></thead><tbody>{selectedComparison.annual.map(y=><tr key={y.year}><td><button className="text-button" onClick={()=>setYear(y.year)}>{y.year}年</button></td><td>{y.historyDraws}期</td><td>{y.from||'未满100期'}</td><td>{y.betDraws}</td><td>{amount(y.stakeCents)}</td><td>{signed(y.profitCents)}</td><td>{amount(y.maxStakeCents)}元</td></tr>)}</tbody></table></div></section>
 </div>;
}
