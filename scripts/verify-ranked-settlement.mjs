import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyze,forecastFromHistory,ZODIACS} from '../lib/model.ts';
import {DEFAULT_RANKED_SETTLEMENT_RULES as defaults,settleDraw,settleBacktest,restoreSettlementRules,specialZodiacForDate} from '../lib/settlement.ts';
const method='ranked-combination';
const settle=(row,rules=defaults)=>settleDraw(row,rules,method);
const row={issue:'2026100',time:'2026-04-10 21:35:00',candidates:['牛','羊','鼠'],actualAnimals:['牛','羊','鼠','虎','兔','龙','蛇']};
const full=settle(row);
assert.equal(full.stakeCents,150000);
assert.equal(full.singleReturnCents,160000);
assert.equal(full.pairReturnCents,160000);
assert.equal(full.tripleReturnCents,300000);
assert.equal(full.profitCents,470000);
assert.deepEqual(full.pairBets.map(p=>p.zodiacs),[['羊','鼠']]);
// Only the first animal is a single; the other two must both appear to pay the pair.
assert.equal(settle({...row,actualAnimals:['羊','羊','虎','兔','龙','蛇','鸡']}).returnCents,0);
assert.equal(settle({...row,actualAnimals:['牛','牛','虎','兔','龙','蛇','鸡']}).returnCents,160000);
assert.equal(settle({...row,actualAnimals:['羊','鼠','虎','兔','龙','蛇','鸡']}).returnCents,160000);
assert.equal(settle({...row,candidates:['羊','牛','鼠'],actualAnimals:['羊','羊','虎','兔','龙','蛇','鸡']}).returnCents,160000);
let checks=0;
for(const time of ['2026-02-16','2026-02-17','2027-02-05','2027-02-06']){
 const special=specialZodiacForDate(time),normal=ZODIACS.filter(z=>z!==special);
 for(let specialPosition=-1;specialPosition<3;specialPosition++){
  const candidates=normal.slice(0,3);if(specialPosition>=0)candidates[specialPosition]=special;
  const filler=ZODIACS.find(z=>!candidates.includes(z));
  for(let hitMask=0;hitMask<8;hitMask++)for(let enabled=0;enabled<8;enabled++){
   const hits=candidates.filter((_,i)=>hitMask&(1<<i));
   const actualAnimals=[...hits,...Array(7-hits.length).fill(filler)];
   const rules={...defaults,singleEnabled:!!(enabled&1),pairEnabled:!!(enabled&2),tripleEnabled:!!(enabled&4),singleStake:12.35,pairStake:40.25,tripleStake:7.5};
   const r=settle({...row,time,candidates,actualAnimals},rules);
   const single=rules.singleEnabled&&(hitMask&1)?Math.round(1235*(specialPosition===0?1.8:2)):0;
   const pair=rules.pairEnabled&&(hitMask&6)===6?Math.round(4025*(specialPosition>0?3.5:4)):0;
   const triple=rules.tripleEnabled&&hitMask===7?Math.round(750*(specialPosition>=0?8.5:10)):0;
   const stake=(rules.singleEnabled?1235:0)+(rules.pairEnabled?4025:0)+(rules.tripleEnabled?750:0);
   assert.equal(r.singleReturnCents,single);assert.equal(r.pairReturnCents,pair);assert.equal(r.tripleReturnCents,triple);
   assert.equal(r.stakeCents,stake);assert.equal(r.profitCents,single+pair+triple-stake);checks++;
  }
 }
}
assert.deepEqual(restoreSettlementRules({...defaults,singleStake:123.45}),{...defaults,singleStake:123.45});
assert.equal(settle(row,{...defaults,singleStake:0,pairStake:0,tripleStake:0}).profitCents,0);
assert.throws(()=>settle(row,{...defaults,pairStake:-1}),/无效/);
assert.throws(()=>settle(row,{...defaults,singleStake:1.001}),/无效/);
assert.throws(()=>settleBacktest([row,row],defaults,method),/重复/);
assert.throws(()=>settleDraw(row,defaults,'unknown'),/方式/);
const seed=JSON.parse(fs.readFileSync(new URL('../lib/seed.json',import.meta.url),'utf8'));
const analysis=analyze(seed);
const replay=settleBacktest(analysis.performance,defaults,method);
let cumulative=0;
for(const r of [...replay.rows].reverse()){
 const s=settle(r);cumulative+=s.profitCents;
 assert.equal(r.cumulativeProfitCents,cumulative);assert.equal(r.stakeCents,150000);
 assert.deepEqual(r.pairBets[0].zodiacs,r.candidates.slice(1));
 assert.ok(r.trainingThroughTime<r.time);
}
assert.equal(replay.summary.profitCents,cumulative);
assert.equal(replay.summary.stakeCents,replay.rows.length*150000);
assert.equal(replay.summary.singleProfitCents+replay.summary.pairProfitCents+replay.summary.tripleProfitCents,cumulative);
// A prefix-only homepage must reproduce historical candidate order, not just its set.
for(const target of ['2026-01-02','2026-02-17',analysis.backtestRange.to]){
 const prefix=seed.filter(r=>r.openTime.slice(0,10)<target);
 const firstPage=analyze(prefix);
 const historical=analysis.performance.find(r=>r.time.startsWith(target));
 assert.deepEqual(firstPage.candidates.map(r=>r.zodiac),historical.candidates);
 assert.deepEqual(forecastFromHistory(prefix,target).methods.rotation.candidates,historical.candidates);
 assert.deepEqual(settle({...historical,candidates:firstPage.candidates.map(r=>r.zodiac)}),settle(historical));
}
console.log(JSON.stringify({passed:true,manualCases:checks,historicalDraws:replay.rows.length,orderedPrefixChecks:3,defaultStakeYuan:1500}));
