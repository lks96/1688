import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildPredictionStatistics} from '../lib/prediction-statistics.ts';
import {analyze,cleanDraws} from '../lib/model.ts';
const fixture=[3,0,1,2,3,0,0].map((hits,i)=>({issue:String(i+1),time:`2026-01-0${i+1}`,hits}));
const s=buildPredictionStatistics([...fixture].reverse());
assert.equal(s.allThree.count,2);assert.equal(s.allThree.missing,2);assert.equal(s.allThree.longestMissing,3);assert.equal(s.allThree.last.issue,'5');
assert.equal(s.exactTwo.count,1);assert.equal(s.exactTwo.missing,3);assert.equal(s.exactTwo.last.issue,'4');
assert.equal(s.atLeastTwo.count,3);assert.equal(s.atLeastTwo.missing,2);assert.equal(s.atLeastTwo.longestMissing,2);
assert.equal(s.longestZero,2);assert.equal(s.consecutiveHits,0);assert.deepEqual(s.distribution.map(r=>r.count),[3,1,1,2]);
const none=buildPredictionStatistics(fixture.filter(r=>r.hits<3));assert.equal(none.allThree.censored,true);assert.equal(none.allThree.missing,5);
assert.equal(buildPredictionStatistics(fixture.slice(0,1)).allThree.missing,0);
assert.equal(buildPredictionStatistics([]).allThree.rate,0);
assert.throws(()=>buildPredictionStatistics([...fixture,fixture[0]]),/重复/);
const raw=JSON.parse(fs.readFileSync('lib/seed.json','utf8')),a=analyze(raw),actual=buildPredictionStatistics(a.performance),rows=cleanDraws(raw).rows;
assert.equal(actual.distribution.reduce((s,r)=>s+r.count,0),a.performance.length);
assert.equal(actual.allThree.count,a.performance.filter(r=>r.hits===3).length);
assert.equal(actual.atLeastTwo.count,a.performance.filter(r=>r.hits>=2).length);
assert.equal(actual.allThree.missing,[...a.performance].findIndex(r=>r.hits===3));
let points=0;
for(const [scope,groups] of Object.entries(a.omissions.scopes))for(const group of groups)for(const item of group.items){
 assert.equal(item.trend.length,a.omissions.timeline.length);assert.equal(item.trend.at(-1),item.current);
 for(let i=0;i<item.trend.length;i++){
  const end=rows.length-item.trend.length+i;
  let missing=0;
  for(let j=end;j>=0;j--){const r=rows[j];const ns=scope==='special'?r.numbers.slice(6):r.numbers,zs=scope==='special'?r.animals.slice(6):r.animals;
   if(group.id==='zodiac'?zs.includes(item.label):ns.some(n=>item.numbers.includes(n)))break;
   missing++;
  }
  assert.equal(item.trend[i],missing,`${scope} ${group.id} ${item.key} point ${i}`);points++;
 }
}
assert.deepEqual(analyze([...raw].reverse()).omissions,a.omissions);
console.log(JSON.stringify({passed:true,trendPoints:points,draws:actual.draws,allThree:actual.allThree.count,exactTwo:actual.distribution[2].count,allThreeMissing:actual.allThree.missing}));
