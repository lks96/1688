import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyze} from '../lib/model.ts';
import {settleDraw,settleBacktest,DEFAULT_SETTLEMENT_RULES as defaults,validateSettlementRules,specialZodiacForDate,restoreSettlementRules} from '../lib/settlement.ts';
const row={issue:'2026001',time:'2026-02-17 21:35:00',candidates:['马','牛','羊'],actualAnimals:['马','牛','羊','兔','龙','蛇','虎']};
const pairs={...defaults,singleEnabled:false,pairEnabled:true,tripleEnabled:false};
const normal={...row,candidates:['牛','羊','鼠'],actualAnimals:['牛','羊','鼠','兔','龙','蛇','虎']};
let s=settleDraw(row,pairs);
assert.equal(s.stakeCents,30000);assert.equal(s.pairReturnCents,110000);assert.equal(s.profitCents,80000);
assert.deepEqual(s.pairBets.map(p=>p.returnCents),[35000,35000,40000]);
assert.equal(settleDraw(normal,pairs).pairReturnCents,120000);
assert.equal(settleDraw({...row,actualAnimals:['马','牛','牛','兔','龙','蛇','虎']},pairs).pairReturnCents,35000);
assert.equal(settleDraw({...row,actualAnimals:['牛','羊','羊','兔','龙','蛇','虎']},pairs).pairReturnCents,40000);
assert.equal(settleDraw({...row,actualAnimals:['马','马','马','兔','龙','蛇','虎']},pairs).pairReturnCents,0);
assert.equal(settleDraw({...normal,actualAnimals:['牛','羊','鼠','马','龙','蛇','虎']},pairs).pairReturnCents,120000);
assert.equal(settleDraw(row,{...pairs,pairStake:12.5}).pairReturnCents,13750);
assert.equal(settleDraw(row,{...pairs,pairStake:.01}).pairReturnCents,12);
assert.equal(settleDraw(row,{...defaults,pairEnabled:true}).stakeCents,70000);
assert.equal(settleDraw(row,{...defaults,pairEnabled:true}).returnCents,253000);
assert.throws(()=>validateSettlementRules({...defaults,pairEnabled:1}),/开关/);
assert.throws(()=>validateSettlementRules({...defaults,pairStake:4.001}),/无效/);
const a=analyze(JSON.parse(fs.readFileSync('lib/seed.json','utf8')));
let checks=0;
for(let mask=0;mask<8;mask++){
 const rules={...defaults,singleEnabled:!!(mask&1),pairEnabled:!!(mask&2),tripleEnabled:!!(mask&4),singleStake:17.25,pairStake:12.5,tripleStake:8};
 const result=settleBacktest(a.performance,rules);let total=0;
 for(const r of [...result.rows].reverse()){
  const hit=r.candidates.filter(z=>r.actualAnimals.includes(z)),special=specialZodiacForDate(r.time),horse=hit.includes(special),h=hit.length;
  const stake=(rules.singleEnabled?5175:0)+(rules.pairEnabled?3750:0)+(rules.tripleEnabled?800:0);
  const singles=rules.singleEnabled?hit.reduce((n,z)=>n+Math.round(1725*(z===special?1.8:2)),0):0;
  const hitPairs=h*(h-1)/2,horsePairs=horse?h-1:0;
  const pairReturns=rules.pairEnabled?(hitPairs-horsePairs)*5000+horsePairs*4375:0;
  const triple=rules.tripleEnabled&&h===3?(r.candidates.includes(special)?6800:8000):0;
  assert.equal(r.stakeCents,stake);assert.equal(r.returnCents,singles+pairReturns+triple);
  total+=singles+pairReturns+triple-stake;assert.equal(r.cumulativeProfitCents,total);checks++;
 }
 assert.equal(result.summary.profitCents,total);
 assert.equal(result.summary.singleProfitCents+result.summary.pairProfitCents+result.summary.tripleProfitCents,total);
}
console.log(JSON.stringify({passed:true,settlementChecks:checks,bettingCombinations:8,draws:a.performance.length}));

assert.equal(specialZodiacForDate('2026-01-01'),'蛇');
assert.equal(specialZodiacForDate('2026-02-16'),'蛇');
assert.equal(specialZodiacForDate('2026-02-17'),'马');
assert.equal(specialZodiacForDate('2027-01-01'),'马');
assert.equal(specialZodiacForDate('2027-02-05'),'马');
assert.equal(specialZodiacForDate('2027-02-06'),'羊');
assert.equal(settleDraw({...row,time:'2027-02-06 21:35:00',candidates:['羊','牛','鼠'],actualAnimals:['羊','牛','鼠','马','兔','龙','蛇']},{...defaults,pairEnabled:true}).returnCents,253000);
assert.equal(settleDraw({...row,time:'2026-02-16 21:35:00',candidates:['蛇','牛','羊'],actualAnimals:['蛇','牛','羊','马','兔','龙','鼠']},{...defaults,pairEnabled:true}).returnCents,253000);
const legacy={...defaults,singleStake:23,pairEnabled:true,singleMultiplier:999,horseSingleMultiplier:999,pairMultiplier:999,tripleMultiplier:999};
assert.deepEqual(restoreSettlementRules(legacy),{...defaults,singleStake:23,pairEnabled:true});
assert.equal(settleDraw(row,legacy).returnCents,settleDraw(row,{...defaults,singleStake:23,pairEnabled:true}).returnCents);
console.log('PASS: fixed odds, legacy settings migration, snake/horse/goat rollover including lunar New Year');
