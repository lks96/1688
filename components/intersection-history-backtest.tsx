'use client';
import {useCallback,useEffect,useState} from 'react';
import type {IntersectionHistoryResult,IntersectionCandidate} from '@/lib/intersection-history';
import type {OmissionScope} from '@/lib/omissions';
import {ProfitTrend} from '@/components/statistics-charts';
const amount=(v:number)=>(v/100).toLocaleString('zh-CN',{maximumFractionDigits:2});
const signed=(v:number)=>(v>0?'+':v<0?'−':'')+amount(Math.abs(v));
const tone=(v:number)=>v>0?'profit-gain':v<0?'profit-loss':'profit-even';
const num=(n:number)=>String(n).padStart(2,'0');
const scopes:[OmissionScope,string][]=[['special','特码评分'],['all','平特码（全部7码）评分']];
type State=IntersectionHistoryResult&{fetchedAt:string;warning:string|null};
function Candidates({items,unit,hit}:{items:IntersectionCandidate[];unit:number;hit?:number}){
 return <div className="omission-ledger-numbers intersection-grid">{items.map(c=><span key={c.number} className={c.number===hit?'hit':''}><b>{num(c.number)}</b><small>长期{c.longRank}名 · 年内{c.annualRank}名</small><small>{unit?`买${amount(unit)}元`:'不购买'}</small></span>)}</div>;
}
export default function IntersectionHistoryBacktest(){
 const [state,setState]=useState<State|null>(null),[scope,setScope]=useState<OmissionScope>('special'),[error,setError]=useState(''),[loading,setLoading]=useState(false),[limit,setLimit]=useState(10);
 const load=useCallback(async(force=false)=>{setLoading(true);setError('');try{const response=await fetch('/api/intersection-history'+(force?'?refresh=1':''),{cache:'no-store'});const result=await response.json() as State&{error?:string};if(!response.ok)throw new Error(result.error||'获取失败');setState(result);}catch(e){setError(e instanceof Error?e.message:'获取失败');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},300000);return()=>clearInterval(timer);},[load]);
 if(!state)return <section className="panel"><h2>长期 × 逐年独立 · 交集回测</h2><p className="stats-small-note">{error||'正在逐期计算两套前10候选的交集…'}</p>{error&&<button className="primary" onClick={()=>load()}>重新加载</button>}</section>;
 const ledger=state.scopes[scope],s=ledger.summary,f=ledger.forecast;
 const annual=state.audit.years.map(y=>{const rows=ledger.rows.filter(r=>r.time.startsWith(y.year));return {year:y.year,bets:rows.filter(r=>r.bought).length,stake:rows.reduce((n,r)=>n+r.stakeCents,0),profit:rows.reduce((n,r)=>n+r.profitCents,0)};});
 return <div className="long-history-page">
  <section className="panel"><div className="panel-heading"><div><h2>长期 × 逐年独立 · 前10码交集</h2><p>{state.audit.from.slice(0,10)} 至 {state.audit.to.slice(0,10)} · 数据截至{state.audit.to}</p></div><button type="button" className="primary" disabled={loading} onClick={()=>load(true)}>{loading?'同步中…':'同步历年数据'}</button></div>
   <p className="omission-caption">每天分别用当期之前的数据生成长期回测、逐年独立的前10码候选，取相同号码购买，交集为0—10个号码。两边完成数据积累后才开始：长期前100个可回测期积累数据，逐年独立每年前100个有效开奖期积累数据。</p>
   <div className="settlement-basis">每次有交集就全部购买；每码初始10元，整组买入后未中则下一次每码加10元，命中后整组恢复10元。无交集时不下注、不加注，也不重置金额。<span>特码47倍含本金 · 平特码维度仅改变评分来源，结算仍核对特码 · 本页加注状态跨年延续，年初积累期暂停下注</span></div>
   {(error||state.warning)&&<p className="form-error" role="alert">{error||state.warning}</p>}
   <p className="stats-small-note">有效记录{state.audit.total}期；排除{state.audit.excluded.length}条异常或跨年记录；覆盖期内缺{state.audit.missingDays}天。最新检查：{state.fetchedAt}。</p>
  </section>
  <section className="panel"><div className="ledger-tabs" role="group" aria-label="交集回测评分来源">{scopes.map(([id,label])=><button key={id} type="button" className={scope===id?'active':''} aria-pressed={scope===id} onClick={()=>{setScope(id);setLimit(10);}}>{label}</button>)}</div>
   <div className="panel-heading"><div><h2>下一期交集清单 · {f.forecastFor}</h2><p>输入截至{f.trainingThroughIssue}期 · {f.trainingThroughTime}</p></div><span className="subtle-tag">{!f.ready?'积累数据中':f.bought?'有交集，购买':'无交集，不购买'}</span></div>
   <div className="rank-current"><span>交集号码 <strong>{f.candidates.length}个</strong></span><span>本期每码 <strong>{amount(f.stakePerNumberCents)}元</strong></span><span>本期合计 <strong>{amount(f.stakeCents)}元</strong></span><span>下次购买每码金额 <strong>{amount(ledger.nextUnitCents)}元</strong></span></div>
   {!f.ready?<p className="stats-small-note">两套预测尚未同时完成数据积累；年内还需积累{f.warmupRemaining}期，暂不下注。</p>:f.bought?<Candidates items={f.candidates} unit={f.stakePerNumberCents}/>:<p className="stats-small-note">本期两组号码没有交集，跳过购买并保留当前每码金额。</p>}
   <div className="intersection-source-pools"><div><span>长期回测 · 前10码</span><p>{f.longNumbers.map(num).join(' · ')}</p></div><div><span>逐年独立 · 前10码</span><p>{f.annualNumbers.length?f.annualNumbers.map(num).join(' · '):'当前年度尚无候选'}</p></div></div>
   {f.forecastFor<state.cutoff.slice(0,10)&&<p className="form-error">清单日期早于当前日期，请先同步最新开奖记录。</p>}
  </section>
  <section className="panel"><div className="chart-section-title"><h3>两种评分来源的交集收益</h3><span>金额单位：元</span></div><div className="rank-range-table"><table><thead><tr><th>评分来源</th><th>投入</th><th>返还</th><th>净收益</th><th>收益率</th><th>最高单期总下注</th></tr></thead><tbody>{scopes.map(([id,label])=>{const x=state.scopes[id].summary;return <tr key={id}><td><button type="button" className="text-button" onClick={()=>{setScope(id);setLimit(10);}}>{label}</button></td><td>{amount(x.stakeCents)}</td><td>{amount(x.returnCents)}</td><td className={tone(x.profitCents)}>{signed(x.profitCents)}</td><td>{(x.roi*100).toFixed(2)}%</td><td>{amount(x.maxStakeCents)}元<br/>{x.maxStakeIssue?`${x.maxStakeIssue}期`:'—'}</td></tr>;})}</tbody></table></div></section>
  <section className="panel"><div className="panel-heading"><div><h2>交集购买 · 收益与明细</h2><p>{s.from||'尚无收益记录'}{s.to?' 至 '+s.to:''} · 有效比较{s.draws}期</p></div></div>
   <div className="ledger-summary"><div><span>累计盈亏</span><strong className={tone(s.profitCents)}>{signed(s.profitCents)}<small>元</small></strong></div><dl><div><dt>累计投入</dt><dd>{amount(s.stakeCents)}元</dd></div><div><dt>累计返还</dt><dd>{amount(s.returnCents)}元</dd></div><div><dt>购买／命中</dt><dd>{s.betDraws}／{s.hits}期</dd></div><div><dt>无交集跳过</dt><dd>{s.emptyDraws}期</dd></div><div><dt>平均交集</dt><dd>{s.meanIntersection.toFixed(2)}个</dd></div><div><dt>最高单期总下注</dt><dd>{amount(s.maxStakeCents)}元</dd></div></dl></div>
   <ProfitTrend key={scope} rows={ledger.rows} title="交集跟买累计盈亏曲线" purchasedOnly/>
   <p className="stats-small-note">连续未中按实际购买次数统计；无交集和热身期不增加连续购买未中次数。</p>
   <details className="omission-ledger-details"><summary>查看逐期盈利明细<small>共{s.draws}期 · 最新在前</small></summary><div className="omission-ledger-rows">{ledger.rows.slice(0,limit).map(row=><article key={row.issue}>
    <header><div><strong>{row.issue}期</strong><time>{row.time.slice(0,10)}</time></div><span className={row.hit?'omission-ledger-hit':'omission-ledger-miss'}>{row.bought?(row.hit?'交集命中':'交集未中'):'无交集 · 跳过'}</span></header>
    {row.bought?<Candidates items={row.candidates} unit={row.stakePerNumberCents} hit={row.specialNumber}/>:<p className="stats-small-note">本期交集为空，不下注，保留每码金额。</p>}
    <div className="omission-ledger-boundary">特码{num(row.specialNumber)} · 交集{row.candidates.length}码 · 下一次每码{amount(row.nextUnitCents)}元</div>
    <details className="rank-detail"><summary>查看两边的前10码候选</summary><p className="stats-small-note">长期：{row.longNumbers.map(num).join('、')}<br/>逐年：{row.annualNumbers.map(num).join('、')}<br/>输入截至{row.trainingThroughIssue}期 · {row.trainingThroughTime}</p></details>
    <dl><div><dt>投入／返还</dt><dd>{amount(row.stakeCents)}／{amount(row.returnCents)}元</dd></div><div><dt>当期盈亏</dt><dd className={tone(row.profitCents)}>{signed(row.profitCents)}元</dd></div><div><dt>累计盈亏</dt><dd className={tone(row.cumulativeProfitCents)}>{signed(row.cumulativeProfitCents)}元</dd></div></dl>
   </article>)}</div>{limit<ledger.rows.length&&<button type="button" className="load-more" onClick={()=>setLimit(n=>Math.min(n+10,ledger.rows.length))}>再显示10期<span>已显示{Math.min(limit,ledger.rows.length)}/{ledger.rows.length}期</span></button>}{ledger.rows.length>10&&<button type="button" className="show-all-records" onClick={()=>setLimit(limit<ledger.rows.length?ledger.rows.length:10)}>{limit<ledger.rows.length?`显示全部${ledger.rows.length}期`:'收起，仅显示最近10期'}</button>}</details>
  </section>
  <section className="panel"><div className="chart-section-title"><h3>年度交集收益 · {scopes.find(([id])=>id===scope)?.[1]}</h3></div><div className="rank-range-table"><table><thead><tr><th>年份</th><th>购买期数</th><th>投入</th><th>净收益</th></tr></thead><tbody>{annual.map(y=><tr key={y.year}><td>{y.year}</td><td>{y.bets}</td><td>{amount(y.stake)}</td><td className={tone(y.profit)}>{signed(y.profit)}</td></tr>)}</tbody></table></div></section>
 </div>;
}
