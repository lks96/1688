'use client';
import {useEffect,useState} from 'react';
import type {OmissionStatistics,OmissionScope} from '@/lib/omissions';
import {OmissionCharts} from '@/components/statistics-charts';
import OmissionTop10Backtest from '@/components/omission-top10-backtest';
import type {OmissionBacktest} from '@/lib/omission-backtest';
import type {OmissionStrategy} from '@/lib/omission-strategy';

export default function OmissionStatisticsPage({statistics:s,modes}:{statistics:OmissionStatistics;modes:Record<OmissionScope,{strategy:OmissionStrategy;backtest:OmissionBacktest}>}){
  const [scope,setScope]=useState<OmissionScope>('all');
  useEffect(()=>{try{const saved=localStorage.getItem('omission-scope-v1');if(saved==='special'||saved==='all')setScope(saved);}catch{}},[]);
  function selectScope(next:OmissionScope){setScope(next);try{localStorage.setItem('omission-scope-v1',next);}catch{}}
  const {strategy,backtest}=modes[scope];
  const [category,setCategory]=useState('head');
  const [sort,setSort]=useState('missing');
  const [trendKey,setTrendKey]=useState('');
  const groups=s.scopes[scope],selected=groups.find(g=>g.id===category)!;
  const items=[...selected.items];
  if(sort==='missing')items.sort((a,b)=>b.current-a.current);
  const highest=Math.max(...items.map(r=>r.current));
  return <div className="omissions-page">
    <div className="ledger-tabs omission-scopes" role="group" aria-label="统计号码范围">{([{id:'special',label:'仅特码'},{id:'all',label:'平特码（全部7码）'}] as const).map(t=><button type="button" key={t.id} aria-pressed={scope===t.id} className={scope===t.id?'active':''} onClick={()=>selectScope(t.id)}>{t.label}</button>)}</div>
    <OmissionStrategyPanel key={scope} strategy={strategy}/>
    <OmissionTop10Backtest key={scope} backtest={backtest} scope={scope}/>

    <section className="panel omission-overview"><div className="panel-heading"><div><h2>遗漏统计</h2><p>已统计{s.draws}期 · 截至{s.latestIssue}期</p></div><span className="subtle-tag">{s.to.slice(0,10)}</span></div><p className="omission-caption">本期出现记0期；未出现则累计。统计{ s.from.slice(0,10)}起的已载入记录。</p></section>
    <nav className="omission-categories" aria-label="统计分类">{groups.map(g=><button type="button" key={g.id} className={g.id===category?'active':''} aria-pressed={g.id===category} onClick={()=>setCategory(g.id)}>{g.label}</button>)}</nav>
    <div className="omission-section-heading"><h2>{selected.label}<small>{items.length}项</small></h2><label>排序<select aria-label="遗漏排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="missing">遗漏从多到少</option><option value="natural">默认顺序</option></select></label></div>
    <OmissionCharts key={scope+category} group={selected} timeline={s.timeline} selectedKey={trendKey} onSelect={setTrendKey}/>
    <div className="omission-grid">{items.map(item=><article className={'omission-card '+(item.current>0&&item.current===highest?'is-highest':'')} key={item.key}>
      <div className="omission-card-title"><h3>{item.label}</h3><span>{item.current===0?'本期已出':'连续未出'}</span></div>
      <div className="omission-value"><strong>{item.censored?'≥':''}{item.current}</strong><span>期未出</span></div>
      <dl><div><dt>历史最长</dt><dd>{item.longestCensored?'≥':''}{item.longest}期</dd></div><div><dt>近{s.recentDraws}期出现</dt><dd>{item.recent30}期</dd></div></dl>
      <div className="omission-last"><span>上次出现</span>{item.lastIssue?<><strong>{item.lastIssue}期</strong><time>{item.lastTime!.slice(0,10)}</time></>:<strong>所载入记录内未出现</strong>}</div>
      <button className="omission-trend-button" type="button" onClick={()=>{setTrendKey(item.key);document.getElementById('omission-trend-chart')?.scrollIntoView({behavior:'smooth',block:'center'});}}>查看遗漏走势</button>
      {category!=='number'&&<details className="omission-numbers"><summary>对应号码 · {item.numbers.length}个</summary><p>{item.numbers.map(n=>String(n).padStart(2,'0')).join('、')}</p></details>}
    </article>)}</div>
    <p className="omission-caption omission-footnote">同一期多次出现只计1期；≥表示记录起点之前的遗漏未知。生肖按各期开奖时的映射统计，对应号码按最新一期展示。</p>
  </div>;
}

function OmissionStrategyPanel({strategy:s}:{strategy:OmissionStrategy}){
  const [selected,setSelected]=useState<number|null>(null);
  const item=s.ranking.find(item=>item.number===selected)??s.ranking[0];
  const number=(n:number)=>String(n).padStart(2,'0');
  const candidateButton=(candidate:OmissionStrategy['ranking'][number])=><button type="button" key={candidate.number} className={item.number===candidate.number?'active':''} aria-pressed={item.number===candidate.number} aria-label={number(candidate.number)+'号，'+candidate.score.toFixed(1)+'分'} onClick={()=>setSelected(candidate.number)}><strong>{number(candidate.number)}</strong><span>{candidate.zodiac}</span><small>{candidate.score.toFixed(1)}分</small></button>;
  return <section className="panel omission-strategy">
    <div className="panel-heading"><div><h2>{s.source==='all'?'平特码（全部7码）':'特码'} · 多维遗漏</h2><p>下一期 {s.forecastFor} · 输入截至{s.trainingThroughIssue}期</p></div><span className="subtle-tag">{s.dimensionCount}维等权</span></div>
    <h3 className="omission-strategy-title">生肖前三<small>按对应号码平均分排序</small></h3>
    <div className="omission-zodiac-picks">{s.zodiacCandidates.map(candidate=><article key={candidate.zodiac}><div><strong>{candidate.zodiac}</strong><span>{candidate.score.toFixed(1)}<small>策略分</small></span></div><p>{candidate.numbers.map(number).join(' · ')}</p></article>)}</div>
    <h3 className="omission-strategy-title">号码前十<small>按各号码综合评分排序</small></h3>
    <div className="omission-number-picks">{s.candidates.map(candidateButton)}</div>
    <details className="omission-full-ranking"><summary>查看49个号码完整排序</summary><div className="omission-number-picks">{s.ranking.map(candidateButton)}</div></details>
    <div className="omission-score-detail"><h3>{number(item.number)}号 · {item.zodiac}<span>{item.score.toFixed(1)}策略分</span></h3><div>{item.factors.map(factor=><div key={factor.id}><span>{factor.dimension}</span><strong>{factor.label}</strong><small>{factor.censored?'≥':''}{factor.omission}期未出</small></div>)}</div></div>
    <p className="omission-caption">仅用此前{s.source==='all'?'全部7码':'特码'}记录，遗漏越久评分越高；策略分不代表中奖概率。</p>
  </section>;
}
