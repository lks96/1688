import {Check,ChevronRight} from 'lucide-react';
import type {Analysis} from '@/lib/model';

const pct=(n:number)=>(n*100).toFixed(1)+'%';
const num=(n:number)=>String(n).padStart(2,'0');

export function CandidateDetails({analysis}:{analysis:Analysis}){
  return <details className="mobile-candidate-details"><summary><span>查看对应号码与近期频次</span><ChevronRight size={17}/></summary><div className="candidate-detail-list">{analysis.candidates.map(r=><div className="candidate-detail" key={r.zodiac}><span className="detail-zodiac">{r.zodiac}</span><div className="detail-numbers"><span>对应号码</span><p>{r.numbers.map(n=><b key={n}>{num(n)}</b>)}</p></div><div className="detail-frequency"><span>近30期</span><strong>{r.last30}<small>/30</small></strong></div></div>)}</div></details>;
}

export function MobileRanking({analysis}:{analysis:Analysis}){
  return <div className="ranking-cards">{analysis.ranking.map((r,i)=><article className="ranking-card" key={r.zodiac}><header><div><span className="ranking-index">{num(i+1)}</span><strong>{r.zodiac}</strong></div><div className="ranking-score"><span>{r.strategyScore===null?'模型估计':r.selected?'策略分 · 入选':'策略分'}</span><b>{r.strategyScore===null?pct(r.score):r.strategyScore.toFixed(1)+'分'}</b></div></header><dl><div><dt>理论概率</dt><dd>{pct(r.base)}</dd></div><div><dt>近30期出现</dt><dd>{r.last30}<span>/30期</span></dd></div><div><dt>近90期出现</dt><dd>{r.last90}<span>/90期</span></dd></div></dl></article>)}</div>;
}

export function MobilePerformance({rows}: {rows:Analysis['performance']}){
  return <div className="mobile-performance-list">{rows.map(r=><article className="mobile-performance-row" key={r.issue}><header><strong>{r.issue}期</strong><time>{r.time.slice(0,10).replaceAll('-','.')}</time></header><div className="mobile-performance-result"><div><span className="mobile-field-label">历史模拟候选</span><div className="candidate-pills">{r.candidates.map(z=><span key={z}>{z}</span>)}</div></div><span className={'hit-badge '+(r.hits===3?'all':'')}>{r.hits===3&&<Check size={15}/>}命中 {r.hits}/3</span></div></article>)}</div>;
}
