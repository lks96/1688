'use client';

import {useEffect,useMemo,useState,type FormEvent,type ReactNode} from 'react';
import {Check} from 'lucide-react';
import {type Analysis} from '@/lib/model';
import {DEFAULT_SETTLEMENT_RULES,DEFAULT_RANKED_SETTLEMENT_RULES,SETTLEMENT_MULTIPLIERS,specialZodiacForDate,restoreSettlementRules,settleBacktest,validateSettlementRules,type SettlementRules,type SettlementMethod,type SettledPerformance} from '@/lib/settlement';

const amount = (cents:number) => new Intl.NumberFormat('zh-CN',{minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2}).format(cents/100);
const signed = (cents:number) => (cents>0?'+':cents<0?'−':'')+amount(Math.abs(cents));
const tone = (cents:number) => cents>0?'profit-gain':cents<0?'profit-loss':'profit-even';
const date = (value:string) => value.slice(0,10).replaceAll('-','.');

function RuleSettings({rules,onChange,specialZodiac,method}:{rules:SettlementRules;specialZodiac:string;method:SettlementMethod;onChange:(rules:SettlementRules)=>void}){
  const [draft,setDraft]=useState({...rules}),[error,setError]=useState('');
  useEffect(()=>setDraft({...rules}),[rules]);
  const kinds=[
    {name:'单肖',enabled:'singleEnabled',stake:'singleStake',normal:SETTLEMENT_MULTIPLIERS.single,special:SETTLEMENT_MULTIPLIERS.specialSingle,amount:'每个生肖金额',basis:method==='ranked-combination'?'第1个生肖买单肖，共1注':'3个生肖分别买，共3注'},
    {name:'二连肖',enabled:'pairEnabled',stake:'pairStake',normal:SETTLEMENT_MULTIPLIERS.pair,special:SETTLEMENT_MULTIPLIERS.specialPair,amount:'每个组合金额',basis:method==='ranked-combination'?'第2、3个生肖组成二连肖，共1注':'三个生肖两两组合，共3注'},
    {name:'三连肖',enabled:'tripleEnabled',stake:'tripleStake',normal:SETTLEMENT_MULTIPLIERS.triple,special:SETTLEMENT_MULTIPLIERS.specialTriple,amount:'每个组合金额',basis:'三个生肖组成1注'},
  ] as const;
  const defaults=method==='ranked-combination'?DEFAULT_RANKED_SETTLEMENT_RULES:DEFAULT_SETTLEMENT_RULES;
  function apply(e:FormEvent<HTMLFormElement>){e.preventDefault();try{validateSettlementRules(draft);onChange({...draft});setError('');}catch(e){setError(e instanceof Error?e.message:'参数无效');}}
  return <form className="bet-settings" onSubmit={apply} aria-label="修改下注方式">
    <div className="bet-settings-title"><h3>下注方式与金额</h3><span>固定倍数 · 含本金</span></div>
    <div className="bet-kind-grid">{kinds.map(kind=><section className={'bet-kind '+(draft[kind.enabled]?'enabled':'')} key={kind.enabled}>
      <label className="bet-kind-toggle"><span>{kind.name}</span><input type="checkbox" aria-label={'启用'+kind.name} checked={draft[kind.enabled]} onChange={e=>setDraft({...draft,[kind.enabled]:e.target.checked})}/></label>
      <p>{kind.basis}</p><div className="bet-fixed-rates"><span>普通 <strong>{kind.normal}倍</strong></span><span>{kind.name==='单肖'?'生肖1':'含生肖1'} <strong>{kind.special}倍</strong></span></div>
      <div className="bet-kind-fields"><label><span>{kind.amount}</span><div><input aria-label={kind.name+kind.amount} type="number" min="0" max="1000000" step="0.01" inputMode="decimal" value={Number.isNaN(draft[kind.stake])?'':draft[kind.stake]} onChange={e=>setDraft({...draft,[kind.stake]:e.target.value===''?NaN:Number(e.target.value)})} disabled={!draft[kind.enabled]} required/><span>元</span></div></label></div>
    </section>)}</div>
    <p className="bet-special-note">当前生肖1：{specialZodiac}；历史按各期生肖年自动切换。</p>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="settlement-actions"><button type="submit" className="primary">应用并重新计算</button><button type="button" className="text-button" onClick={()=>{setDraft({...defaults});onChange({...defaults});setError('');}}>恢复默认</button></div>
  </form>;
}

export default function ProfitBacktest({analysis,children}:{analysis:Analysis;children?:ReactNode}){
  const [method,setMethod]=useState<SettlementMethod>('ranked-combination');
  const [standardRules,setStandardRules]=useState<SettlementRules>({...DEFAULT_SETTLEMENT_RULES});
  const [rankedRules,setRankedRules]=useState<SettlementRules>({...DEFAULT_RANKED_SETTLEMENT_RULES});
  const rules=method==='ranked-combination'?rankedRules:standardRules;
  const ranked=method==='ranked-combination';
  useEffect(()=>{try{const saved=localStorage.getItem('zodiac-settlement-v2');if(saved){const next=restoreSettlementRules(JSON.parse(saved));setStandardRules(next);localStorage.setItem('zodiac-settlement-v2',JSON.stringify(next));}}catch{}},[]);
  useEffect(()=>{try{const saved=localStorage.getItem('zodiac-ranked-settlement-v1');if(saved)setRankedRules(restoreSettlementRules(JSON.parse(saved)));const savedMethod=localStorage.getItem('zodiac-settlement-method-v1');if(savedMethod==='standard'||savedMethod==='ranked-combination')setMethod(savedMethod);}catch{}},[]);
  function changeRules(next:SettlementRules){if(ranked)setRankedRules(next);else setStandardRules(next);try{localStorage.setItem(ranked?'zodiac-ranked-settlement-v1':'zodiac-settlement-v2',JSON.stringify(next));}catch{}}
  function changeMethod(next:SettlementMethod){setMethod(next);setLimit(10);try{localStorage.setItem('zodiac-settlement-method-v1',next);}catch{}}
  const [limit,setLimit]=useState(10);
  const selected='rotation' as const;
  const current=useMemo(()=>settleBacktest(analysis.variants.rotation.performance,rules,method),[analysis,rules,method]),summary=current.summary;
  const rows=current.rows.slice(0,limit);
  const singleCount=ranked?1:3,pairCount=ranked?1:3;
  const forecastCandidates=analysis.candidates.map(z=>z.zodiac);
  return <>
    <section className="panel profit-panel" aria-label="动态轮换平码盈亏">
      <div className="chart-periods" role="group" aria-label="选择回测买法">{([{id:'standard',label:'原有买法'},{id:'ranked-combination',label:'顺序组合 · 单肖＋二连＋三连'}] as const).map(item=><button type="button" key={item.id} aria-pressed={method===item.id} className={method===item.id?'active':''} onClick={()=>changeMethod(item.id)}>{item.label}</button>)}</div>
      <div className="panel-heading"><div><h2>平码盈亏 · {ranked?'顺序组合':'动态轮换'}</h2><p>{date(summary.from)} 至 {date(summary.to)} · {summary.draws}期历史模拟</p></div><span className="subtle-tag">每期 {amount(Math.round(((rules.singleEnabled?singleCount*rules.singleStake:0)+(rules.pairEnabled?pairCount*rules.pairStake:0)+(rules.tripleEnabled?rules.tripleStake:0))*100))} 元</span></div>
      <div className="settlement-basis">{[rules.singleEnabled?(ranked?`第1个生肖单肖${rules.singleStake}元`:`3个单肖各${rules.singleStake}元`):null,rules.pairEnabled?(ranked?`第2、3个生肖二连肖${rules.pairStake}元`:`3组二连肖各${rules.pairStake}元`):null,rules.tripleEnabled?`三连肖${rules.tripleStake}元`:null].filter(Boolean).join(' + ')||'未启用下注'}<span>倍数含本金 · 同肖计1次</span></div>
      <RuleSettings key={method} method={method} rules={rules} onChange={changeRules} specialZodiac={specialZodiacForDate(analysis.forecastFor)}/>
      {ranked&&<div className="ranked-forecast"><h3>下一期购买组合 · {date(analysis.forecastFor)}</h3><p>使用首页三个候选的展示顺序；历史各期使用当时预测的候选与顺序。</p><PurchaseBreakdown candidates={forecastCandidates} rules={rules}/></div>}
      <div className="ledger-summary"><div><span>累计盈亏</span><strong className={tone(summary.profitCents)}>{signed(summary.profitCents)}<small>元</small></strong></div><dl><div><dt>累计投入</dt><dd>{amount(summary.stakeCents)} 元</dd></div><div><dt>累计返还</dt><dd>{amount(summary.returnCents)} 元</dd></div><div><dt>盈亏率</dt><dd className={tone(summary.profitCents)}>{(summary.roi*100).toFixed(2)}%</dd></div></dl></div>
      <div className="settlement-breakdown"><div className="settlement-breakdown-head"><span>{analysis.variants[selected].label}</span><span>投入</span><span>返还</span><span>盈亏</span></div>{[
        {label:ranked?'第1个生肖单肖':'三个单肖',stake:summary.singleStakeCents,returned:summary.singleReturnCents,profit:summary.singleProfitCents},
        {label:ranked?'第2、3个生肖二连肖':'三组二连肖',stake:summary.pairStakeCents,returned:summary.pairReturnCents,profit:summary.pairProfitCents},
        {label:'三连肖',stake:summary.tripleStakeCents,returned:summary.tripleReturnCents,profit:summary.tripleProfitCents},
        {label:'合计',stake:summary.stakeCents,returned:summary.returnCents,profit:summary.profitCents},
      ].map(item=><div key={item.label}><span>{item.label}</span><span>{amount(item.stake)}</span><span>{amount(item.returned)}</span><strong className={tone(item.profit)}>{signed(item.profit)}</strong></div>)}</div>
    </section>
    {children}
    <section className="panel profit-detail-panel"><div className="panel-heading"><div><h2>{analysis.variants[selected].label} · 全部{current.rows.length}期明细</h2><p>{date(summary.from)} 至 {date(summary.to)}</p></div><span className="subtle-tag">最新在前</span></div><div className="backtest-coverage">已显示 {rows.length} / {current.rows.length} 期</div>
      <div className="mobile-performance-list">{rows.map(row=><MobileSettlement row={row} key={row.issue} rankedRules={ranked?rules:undefined}/>)}</div>
      <div className="table-scroll desktop-performance"><table className="performance-table settlement-table"><thead><tr><th>期号 / 日期</th><th>历史模拟候选</th><th>实际开奖生肖</th><th>命中</th><th>投入</th><th>单肖返还</th><th>二连返还</th><th>三连返还</th><th>当期盈亏</th><th>累计盈亏</th></tr></thead><tbody>{rows.map(row=><tr key={row.issue}><td>{row.issue}<small className="settlement-row-date">{date(row.time)} · 生肖1：{row.specialZodiac}</small></td><td><CandidatePills row={row}/>{ranked&&<PurchaseBreakdown candidates={row.candidates} rules={rules}/>}</td><td>{row.actualAnimals.join('、')}</td><td>{row.hitZodiacs.length}/3{row.tripleHit&&<span className="settlement-all-hit">全中</span>}</td><td>{amount(row.stakeCents)}</td><td>{amount(row.singleReturnCents)}</td><td>{amount(row.pairReturnCents)}</td><td>{amount(row.tripleReturnCents)}</td><td className={tone(row.profitCents)}>{signed(row.profitCents)}</td><td className={tone(row.cumulativeProfitCents)}>{signed(row.cumulativeProfitCents)}</td></tr>)}</tbody></table></div>
      {limit<current.rows.length&&<button className="load-more" onClick={()=>setLimit(n=>Math.min(n+10,current.rows.length))}>再显示10期<span>已显示 {rows.length}/{current.rows.length}期</span></button>}
      <button className="show-all-records" onClick={()=>setLimit(limit<current.rows.length?current.rows.length:10)}>{limit<current.rows.length?`显示全部${current.rows.length}期明细`:'收起，仅显示最近10期'}</button>
    </section>
  </>;
}

function CandidatePills({row}:{row:SettledPerformance}){
  return <div className="candidate-pills">{row.candidates.map(z=><span key={z} className={row.hitZodiacs.includes(z)?'settlement-hit':''}>{z}</span>)}</div>;
}

function MobileSettlement({row,rankedRules}:{row:SettledPerformance;rankedRules?:SettlementRules}){
  return <article className="mobile-performance-row mobile-settlement-row"><header><strong>{row.issue}期</strong><time>{date(row.time)}</time></header><div className="mobile-performance-result"><div><span className="mobile-field-label">历史模拟候选</span><CandidatePills row={row}/></div><span className={'hit-badge '+(row.tripleHit?'all':'')}>{row.tripleHit&&<Check size={15}/>}命中 {row.hitZodiacs.length}/3</span></div><div className="settlement-row-totals"><div><span>当期盈亏</span><strong className={tone(row.profitCents)}>{signed(row.profitCents)}</strong></div><div><span>累计盈亏</span><strong className={tone(row.cumulativeProfitCents)}>{signed(row.cumulativeProfitCents)}</strong></div></div><details className="settlement-row-details"><summary>开奖与结算明细</summary><p>当期生肖1：{row.specialZodiac}</p>{rankedRules&&<PurchaseBreakdown candidates={row.candidates} rules={rankedRules}/>}<p>开奖生肖：{row.actualAnimals.join('、')}</p><dl><div><dt>当期投入</dt><dd>{amount(row.stakeCents)} 元</dd></div><div><dt>单肖返还</dt><dd>{amount(row.singleReturnCents)} 元</dd></div><div><dt>二连肖返还</dt><dd>{amount(row.pairReturnCents)} 元</dd></div><div><dt>三连肖返还</dt><dd>{amount(row.tripleReturnCents)} 元</dd></div><div><dt>合计返还</dt><dd>{amount(row.returnCents)} 元</dd></div></dl>{row.pairBets.length>0&&<div className="pair-settlement-list"><h4>二连肖组合</h4>{row.pairBets.map(pair=><p key={pair.zodiacs.join('')}><span>{pair.zodiacs.join('＋')} · {pair.hit?'命中':'未中'}</span><span>投入{amount(pair.stakeCents)} / 返还{amount(pair.returnCents)}元</span></p>)}</div>}</details></article>;
}

function PurchaseBreakdown({candidates,rules}:{candidates:string[];rules:SettlementRules}){
  return <div className="ranked-purchase-list">
    {rules.singleEnabled&&<p>单肖：{candidates[0]} · {amount(Math.round(rules.singleStake*100))}元</p>}
    {rules.pairEnabled&&<p>二连肖：{candidates.slice(1).join('＋')} · {amount(Math.round(rules.pairStake*100))}元</p>}
    {rules.tripleEnabled&&<p>三连肖：{candidates.join('＋')} · {amount(Math.round(rules.tripleStake*100))}元</p>}
  </div>;
}
