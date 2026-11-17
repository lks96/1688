'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {annualPlanComparison,ANNUAL_BET_WARMUP,type AnnualHistoryResult} from '@/lib/annual-history';
import {RANK_STEP_MODES,type RankStepCount} from '@/lib/omission-backtest';
import {rankStepLedger} from '@/lib/rank-step';
import type {OmissionScope} from '@/lib/omissions';
import {RankStepControls,RankStepNext,RankStepDetails} from '@/components/rank-step-view';

const scopes:[OmissionScope,string][]=[['special','特码评分'],['all','平特码（全部7码）评分']];
const amount=(cents:number)=>(cents/100).toLocaleString('zh-CN',{maximumFractionDigits:2});
const signed=(cents:number)=>(cents>0?'+':'')+amount(cents);
type State=AnnualHistoryResult&{fetchedAt:string;warning:string|null};
export default function AnnualHistoryBacktest(){
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[year,setYear]=useState(''),[scope,setScope]=useState<OmissionScope>('special'),[count,setCount]=useState<RankStepCount>(10);
 const load=useCallback(async(force=false)=>{setLoading(true);setError('');try{const response=await fetch('/api/annual-history'+(force?'?refresh=1':''),{cache:'no-store'});const result=await response.json() as State&{error?:string};if(!response.ok)throw new Error(result.error||'获取失败');setState(result);}catch(e){setError(e instanceof Error?e.message:'获取失败');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},300000);return()=>clearInterval(timer);},[load]);
 const comparisons=useMemo(()=>state?scopes.flatMap(([scope,label])=>RANK_STEP_MODES.map(mode=>({label,name:`${mode.label} · 等${mode.missThreshold}期`,...annualPlanComparison(state.years,scope,'miss-streak-step',mode.count)}))).sort((a,b)=>b.profitCents-a.profitCents):[],[state]);
 if(!state)return <section className="panel"><h2>逐年独立回测</h2><p className="stats-small-note">{error||'正在逐年独立测算…'}</p>{error&&<button className="primary" onClick={()=>load()}>重新加载</button>}</section>;
 const selected=state.years.find(y=>y.year===(year||state.activeYear))??state.years.at(-1)!;
 const chosen=rankStepLedger(selected.scopes[scope],scope,count,ANNUAL_BET_WARMUP),next=chosen.next;
 const selectedComparison=comparisons.find(c=>c.scope===scope&&c.count===count)!,best=comparisons[0];
 const forecast=selected.forecasts?.[scope],isCurrentYear=selected.year===state.activeYear;
 return <div className="long-history-page">
  <section className="panel"><div className="panel-heading"><div><h2>逐年独立回测 · 2021年至今</h2><p>{state.audit.from.slice(0,10)} 至 {state.audit.to.slice(0,10)} · {state.audit.total}期有效记录</p></div><button className="primary" disabled={loading} onClick={()=>load(true)}>{loading?'同步中…':'同步历年数据'}</button></div>
   <p className="omission-caption">每年从零开始：第1期初始化遗漏，第2—100期只收集数据，第101个有效开奖期开始下注。遗漏评分、名次出现频率、连不中计数和购买／等待状态全部按年重置，不使用其他年份的记录。同一年内只用当期之前的数据生成号码，开奖后更新。</p>
   <p className="stats-small-note">每码基础10元，特码47倍含本金；平特码维度只改变评分和排名频率来源，收益仍按特码结算。汇总收益仅把各年独立账本相加。排除{state.audit.excluded.length}条异常或跨年记录，覆盖期内缺{state.audit.missingDays}天；期数按有效记录计，数据检查沿用长期回测口径。最新检查：{state.fetchedAt}。</p>
   {(error||state.warning)&&<p className="form-error" role="alert">{error||state.warning}</p>}
  </section>
  <section className="panel"><div className="panel-heading"><div><h2>逐年重置后的收益比较</h2><p>仅未命中阶梯跟买 · 4／6／10码 × 两个评分来源 · 按各年净收益合计排序</p></div></div>
   {best&&<div className="rank-best"><span>当前样本净收益最高</span><strong>{best.label} · {best.name}</strong><strong>{signed(best.profitCents)}元</strong></div>}
   <div className="rank-range-table"><table><thead><tr><th>评分来源 / 买法</th><th>累计投入</th><th>累计返还</th><th>净收益</th><th>收益率</th><th>最高单期总下注</th><th>查看</th></tr></thead><tbody>{comparisons.map(c=><tr key={c.scope+c.count}><td>{c.label}<br/>{c.name}</td><td>{amount(c.stakeCents)}</td><td>{amount(c.returnCents)}</td><td className={c.profitCents>=0?'profit-gain':'profit-loss'}>{signed(c.profitCents)}</td><td>{(c.roi*100).toFixed(2)}%</td><td>{amount(c.maxStakeCents)}元<br/>{c.maxStakeIssue?`${c.maxStakeIssue}期`:'—'}</td><td><button className="text-button" onClick={()=>{setScope(c.scope);setCount(c.count);}}>明细</button></td></tr>)}</tbody></table></div>
   <p className="stats-small-note">历史最高表示这段样本的结果。</p>
  </section>
  <section className="panel"><div className="panel-heading"><div><h2>按年查看</h2><p>{selected.year}年 · 有效记录{selected.draws}期 · 已积累{Math.min(100,selected.draws)}/100期</p></div><label className="chart-select-label">年份 <select aria-label="独立回测年份" value={selected.year} onChange={e=>setYear(e.target.value)}>{state.years.map(y=><option key={y.year} value={y.year}>{y.year}年</option>)}</select></label></div>
   <RankStepControls scope={scope} count={count} onScope={setScope} onCount={setCount}/>
   {isCurrentYear?<RankStepNext forecast={forecast} next={next} count={count}/>:<p className="stats-small-note">正在查看已结束年份的独立历史账本。下一年重新从零积累数据。</p>}
   {forecast&&isCurrentYear&&forecast.forecastFor<state.cutoff.slice(0,10)&&<p className="form-error">清单日期早于当前日期，请先同步最新开奖。</p>}
   <RankStepDetails key={selected.year+scope+count} rows={selected.scopes[scope]} scope={scope} count={count} yearly/>
  </section>
  <section className="panel"><div className="chart-section-title"><h3>年度收益 · {scopes.find(s=>s[0]===scope)?.[1]} · 前{count}码未命中阶梯跟买</h3></div><div className="rank-range-table"><table><thead><tr><th>年份</th><th>有效记录</th><th>下注起点</th><th>购买期数</th><th>投入</th><th>年度净收益</th><th>最高单期总下注</th></tr></thead><tbody>{selectedComparison.annual.map(y=><tr key={y.year}><td><button className="text-button" onClick={()=>setYear(y.year)}>{y.year}年</button></td><td>{y.historyDraws}期</td><td>{y.from||'未满100期'}</td><td>{y.betDraws}</td><td>{amount(y.stakeCents)}</td><td>{signed(y.profitCents)}</td><td>{amount(y.maxStakeCents)}元</td></tr>)}</tbody></table></div></section>
 </div>;
}
