'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import type {LongHistoryResult} from '@/lib/long-history';
import {RANK_STEP_MODES,type RankStepCount} from '@/lib/omission-backtest';
import {rankStepLedger} from '@/lib/rank-step';
import type {OmissionScope} from '@/lib/omissions';
import {RankStepControls,RankStepNext,RankStepDetails} from '@/components/rank-step-view';

const scopes:[OmissionScope,string][]=[['special','特码评分'],['all','平特码（全部7码）评分']];
const money=(cents:number)=>(cents>0?'+':'')+(cents/100).toLocaleString('zh-CN',{maximumFractionDigits:2});
type State=LongHistoryResult&{fetchedAt:string;warning:string|null};
export default function LongHistoryBacktest(){
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[scope,setScope]=useState<OmissionScope>('special'),[count,setCount]=useState<RankStepCount>(10);
 const load=useCallback(async(force=false)=>{setLoading(true);setError('');try{const r=await fetch('/api/long-history'+(force?'?refresh=1':''),{cache:'no-store'});const data=await r.json() as State&{error?:string};if(!r.ok)throw new Error(data.error||'获取失败');setState(data);}catch(e){setError(e instanceof Error?e.message:'获取失败');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},300000);return()=>clearInterval(timer);},[load]);
 const comparisons=useMemo(()=>state?scopes.flatMap(([scope,label])=>RANK_STEP_MODES.map(mode=>({scope,label,count:mode.count,name:`${mode.label} · 等${mode.missThreshold}期`,...rankStepLedger(state.scopes[scope],scope,mode.count).summary}))).sort((a,b)=>b.profitCents-a.profitCents):[],[state]);
 if(!state)return <section className="panel"><h2>2021年至今 · 长期回测</h2><p className="stats-small-note">{error||'正在载入历年记录并逐期测算…'}</p>{error&&<button className="primary" onClick={()=>load()}>重新加载</button>}</section>;
 const best=comparisons[0],audit=state.audit;
 const chosen=rankStepLedger(state.scopes[scope],scope,count),forecast=state.forecasts[scope],next=chosen.next;
 const annual=audit.years.map(y=>{const rows=chosen.rows.filter(r=>r.time.startsWith(y.year));return {year:y.year,draws:rows.length,bets:rows.filter(r=>r.bought).length,stake:rows.reduce((s,r)=>s+r.stakeCents,0),profit:rows.reduce((s,r)=>s+r.profitCents,0)};});
 return <div className="long-history-page">
  <section className="panel"><div className="panel-heading"><div><h2>2021年至今 · 长期回测</h2><p>独立历史样本 · {audit.from.slice(0,10)} 至 {audit.to.slice(0,10)}</p></div><button className="primary" disabled={loading} onClick={()=>load(true)}>{loading?'同步中…':'同步历年数据'}</button></div>
   <p className="omission-caption">共{audit.total}期有效记录。第一期用于初始化遗漏，随后100个可回测期积累频率，第101个可回测期开始下注。每期先用此前记录计算49码评分，再用此前频率选对应档位的评分名次，开奖后才更新。跨年连续累计，仅展示未命中阶梯跟买，4／6／10码三档使用相同起点。</p>
   <p className="stats-small-note">{audit.years.map(y=>`${y.year}年 ${y.rows}期`).join(' · ')}<br/>数据检查：排除{audit.excluded.length}条异常、跨年或重复记录；生肖标签按各期开奖日期的生肖年统一映射，共{audit.normalizedZodiacRows}条记录与接口原标签不同；覆盖日期内缺{audit.missingDays}天。间隔与连不中按已载入有效期开奖计数。接口最新开奖截至{audit.to}，最后检查{state.fetchedAt}。</p>
   {(error||state.warning)&&<p className="form-error" role="alert">{error||state.warning}</p>}
   <details className="rank-detail"><summary>查看排除记录</summary><div className="rank-range-table"><table><thead><tr><th>来源年份</th><th>期号</th><th>原因</th></tr></thead><tbody>{audit.excluded.map((r,i)=><tr key={i}><td>{r.year}</td><td>{r.issue||'—'}</td><td>{r.reason}</td></tr>)}</tbody></table></div></details>
  </section>
  <section className="panel long-next-picks" aria-label="长期回测下一期跟买清单">
   <div className="panel-heading"><div><h2>未命中阶梯跟买 · 档位与清单</h2><p>切换档位后，号码、金额及收益统计同步更新</p></div><span className="subtle-tag">{next.bought?'本期按规则购买':next.ready?'本期等待，不购买':'积累数据中'}</span></div>
   <RankStepControls scope={scope} count={count} onScope={setScope} onCount={setCount}/>
   <RankStepNext forecast={forecast} next={next} count={count}/>
   {forecast.forecastFor<state.cutoff.slice(0,10)&&<p className="form-error">此清单日期早于当前日期，请先同步最新开奖记录。</p>}
  </section>
  <section className="panel"><div className="panel-heading"><div><h2>阶梯跟买 · 哪档历史净收益最高？</h2><p>全部有效历史 · 按累计净收益降序，金额单位：元</p></div></div>
   {best&&<div className="rank-best"><span>当前样本净收益最高</span><strong>{best.label} · {best.name}</strong><strong className={best.profitCents>=0?'profit-gain':'profit-loss'}>{money(best.profitCents)}元</strong></div>}
   <p className="stats-small-note">每码基础10元，特码命中47倍含本金。平特码仅改变评分与频率来源，两个维度的收益均按特码结算。阶梯方式整组累计未中，任一候选特码命中后整体重置。历史最高只表示这段样本的结果。</p>
   <div className="rank-range-table"><table><thead><tr><th>评分来源 / 买法</th><th>累计投入</th><th>累计返还</th><th>净收益</th><th>收益率</th><th>购买期数</th><th>最高单期总下注</th><th>查看</th></tr></thead><tbody>{comparisons.map(c=><tr key={c.scope+c.count}><td>{c.label}<br/>{c.name}</td><td>{(c.stakeCents/100).toLocaleString('zh-CN')}</td><td>{(c.returnCents/100).toLocaleString('zh-CN')}</td><td className={c.profitCents>=0?'profit-gain':'profit-loss'}>{money(c.profitCents)}</td><td>{(c.roi*100).toFixed(2)}%</td><td>{c.betDraws}</td><td>{(c.maxStakeCents/100).toLocaleString('zh-CN')}元<br/>{c.maxStakeIssue?`${c.maxStakeIssue}期`:'—'}</td><td><button className="text-button" onClick={()=>{setScope(c.scope);setCount(c.count);}}>明细</button></td></tr>)}</tbody></table></div>
  </section>
  <section className="panel">
   <RankStepDetails key={scope+count} rows={state.scopes[scope]} scope={scope} count={count}/>
   <details className="rank-detail"><summary>年度收益 · 前{count}码未命中阶梯跟买</summary><div className="rank-range-table"><table><thead><tr><th>年份</th><th>统计期数</th><th>购买期数</th><th>投入</th><th>年度净收益</th></tr></thead><tbody>{annual.map(y=><tr key={y.year}><td>{y.year}</td><td>{y.draws}</td><td>{y.bets}</td><td>{(y.stake/100).toLocaleString('zh-CN')}</td><td>{money(y.profit)}</td></tr>)}</tbody></table></div></details>
  </section>
 </div>;
}
