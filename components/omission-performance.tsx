'use client';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ReferenceLine} from 'recharts';
import type {OmissionScope} from '@/lib/omissions';
import type {OmissionPerformance,SevenNumberPerformance} from '@/lib/omission-performance';
const pct=(v:number)=>(v*100).toFixed(2)+'%';
const unit=(v:number|null)=>v===null?'—':Number.isInteger(v)?String(v):v.toFixed(1);
export default function OmissionPerformancePanel({statistics:s,target='special'}:{statistics:OmissionPerformance|SevenNumberPerformance;target?:OmissionScope}){
 const all=target==='all',seven='meanHits' in s?s:null,label=all?'全部7码':'特码';
 const chart=s.ranks.map(r=>({...r,percent:r.rate*100}));
 const top5=s.coverage.find(r=>r.top===5)!,top20=s.coverage.find(r=>r.top===20)!;
 return <div className="omission-performance">
  <div className="chart-section-title"><h3>前十号码 · {label}命中统计</h3><span>历史{s.draws}期</span></div>
  <div className="omission-hit-rate"><div><span>{all?'至少中1码的历史频率':'历史命中率'}</span><strong>{pct(s.hitRate)}</strong><small>{s.hits}中 / {s.draws}期</small></div><div><span>均匀随机基准</span><strong>{pct(seven?.hitBaseline??10/49)}</strong><small>{all?'前十至少命中全部7码中的1个':'每期10个不同号码'}</small></div></div>
  <div className="stats-mini-grid"><div><span>最长连续未中</span><strong>{s.maxMisses}<small>期</small></strong></div><div><span>最长连续命中</span><strong>{s.maxHits}<small>期</small></strong></div><div><span>命中间隔中位数</span><strong>{unit(s.medianHitInterval)}<small>期</small></strong></div><div><span>间隔内未中期数中位数</span><strong>{unit(s.medianMissesBetweenHits)}<small>期</small></strong></div></div>
  {seven&&<div className="rank-current"><span>平均每期命中 <strong>{seven.meanHits.toFixed(2)}个</strong></span><span>累计命中 <strong>{seven.totalHits}个开奖号</strong></span></div>}
  <p className="stats-small-note">{all?'每期至少中1个开奖号记为命中。':''}中位数取{s.completedIntervals}个完整命中间隔；连续两期命中的间隔为1期，中间未中0期。历史命中率是回测频率。</p>
  {seven&&<div className="seven-hit-distribution" aria-label="每期命中个数分布">{seven.hitDistribution.map(r=><div key={r.hits}><span>中{r.hits}个</span><strong>{r.count}期</strong></div>)}</div>}
  <div className="rank-current"><span>当前连续未中 <strong>{s.currentMisses}期</strong></span><span>上次命中 <strong>{s.lastHit?s.lastHit.issue+'期':'尚无'}</strong></span></div>
  <div className="chart-section-title"><h3>{label}在评分排序中的历史频率</h3><span>第1—49名</span></div>
  <p className="stats-small-note">每期先按此前数据排出49码，再记录当期{label}的名次；同分沿用号码升序。{all?`频率以${s.rankedDraws}个开奖号为分母，合计100%。`:''}图表可左右滑动。</p>
  <div className="rank-frequency-scroll"><div className="rank-frequency-chart" role="img" aria-label={`${label}第1至49名历史频率折线图，统计${s.rankedDraws}个开奖号`}><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{top:15,right:15,left:0,bottom:5}}><CartesianGrid vertical={false} stroke="#e8ede2"/><XAxis dataKey="rank" type="number" domain={[1,49]} ticks={[1,5,10,15,20,25,30,35,40,45,49]} tick={{fontSize:11,fill:'#7c8d72'}} tickFormatter={v=>`${v}名`} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:'#7c8d72'}} tickFormatter={v=>`${v}%`} width={48} axisLine={false} tickLine={false}/><ReferenceLine y={100/49} stroke="#b8964b" strokeDasharray="4 4"/><Tooltip content={({active,payload})=>{const r=payload?.[0]?.payload;return active&&r?<div className="rank-frequency-tooltip"><strong>第{r.rank}名</strong><span>{r.count}次 / {s.rankedDraws}个开奖号</span><span>历史频率 {r.percent.toFixed(2)}%</span></div>:null;}}/><Line dataKey="percent" type="linear" stroke="#527945" strokeWidth={2} dot={{r:3}} activeDot={{r:6}} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></div>
  <div className="omission-hit-legend"><span className="special-key">历史频率</span><span className="baseline-key">单名次均匀基准 {pct(1/49)}</span></div>
  <div className="rank-best"><span>出现最多的区间</span><strong>{s.bestRanges.length?s.bestRanges.map(r=>r.label).join('、'):'暂无记录'}</strong><small>{s.bestRanges[0]?`${s.bestRanges[0].count}次 · ${pct(s.bestRanges[0].rate)}`:''}</small></div>
  <div className="rank-range-table"><table><thead><tr><th>当期排名区间</th><th>次数</th><th>历史频率</th><th>均匀基准</th></tr></thead><tbody>{s.ranges.map(r=><tr key={r.start}><td>{r.label}</td><td>{r.count}</td><td>{pct(r.rate)}</td><td>{pct(r.baseline)}</td></tr>)}</tbody></table></div>
  <div className="rank-current"><span>前5名覆盖率 <strong>{pct(top5.rate)}</strong></span><span>前20名覆盖率 <strong>{pct(top20.rate)}</strong></span></div>
  <details className="rank-detail"><summary>查看第1—49名的次数与频率</summary><div className="rank-exact-list">{s.ranks.map(r=><div key={r.rank}><strong>第{r.rank}名</strong><span>{r.count}次</span><span>{pct(r.rate)}</span></div>)}</div></details>
 </div>;
}
