import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyze,chinaNow,cleanDraws,forecastFromHistory,METHODS} from '../lib/model.ts';
import {DEFAULT_SETTLEMENT_RULES,settleDraw,settleBacktest} from '../lib/settlement.ts';

const normal={issue:'2026001',time:'2026-01-01 21:35:00',candidates:['牛','羊','鼠'],actualAnimals:['牛','羊','鼠','虎','兔','龙','蛇']};
assert.deepEqual(settleDraw(normal),{specialZodiac:'蛇',hitZodiacs:['牛','羊','鼠'],tripleHit:true,pairBets:[],singleStakeCents:30000,pairStakeCents:0,tripleStakeCents:10000,pairReturnCents:0,singleReturnCents:60000,tripleReturnCents:100000,stakeCents:40000,returnCents:160000,profitCents:120000});
assert.equal(settleDraw({...normal,actualAnimals:['牛','牛','牛','虎','兔','龙','蛇']}).singleReturnCents,20000);
assert.equal(settleDraw({...normal,actualAnimals:['虎','虎','兔','兔','龙','龙','蛇']}).profitCents,-40000);
assert.equal(settleDraw({...normal,actualAnimals:['牛','羊','虎','虎','兔','龙','蛇']}).profitCents,0);
const horse={...normal,time:'2026-02-17 21:35:00',candidates:['马','牛','羊'],actualAnimals:['马','牛','羊','虎','兔','龙','蛇']};
assert.equal(settleDraw(horse).singleReturnCents,58000);
assert.equal(settleDraw(horse).tripleReturnCents,85000);
assert.equal(settleDraw(horse).profitCents,103000);
assert.equal(settleDraw({...horse,actualAnimals:['马','马','虎','虎','兔','龙','蛇']}).profitCents,-22000);
// A drawn but unselected horse does not lower a normal triple's return.
assert.equal(settleDraw({...normal,actualAnimals:['牛','羊','鼠','马','兔','龙','蛇']}).tripleReturnCents,100000);
assert.equal(settleDraw(normal,{...DEFAULT_SETTLEMENT_RULES,singleStake:.01,tripleStake:.01}).returnCents,16);
assert.throws(()=>settleDraw(normal,{...DEFAULT_SETTLEMENT_RULES,singleStake:NaN}),/无效/);
assert.throws(()=>settleDraw(normal,{...DEFAULT_SETTLEMENT_RULES,singleStake:-1}),/无效/);
assert.throws(()=>settleDraw(normal,{...DEFAULT_SETTLEMENT_RULES,tripleStake:1.001}),/无效/);
assert.throws(()=>settleDraw({...normal,candidates:['牛','牛','羊']}),/不完整/);
assert.throws(()=>settleBacktest([normal,normal]),/重复期号/);
const miss={...normal,issue:'2026002',time:'2026-01-02 21:35:00',actualAnimals:['虎','虎','兔','兔','龙','龙','蛇']};
const sequence=settleBacktest([miss,normal]);
assert.equal(sequence.rows[0].cumulativeProfitCents,80000);
assert.equal(sequence.rows[1].cumulativeProfitCents,120000);
assert.equal(sequence.summary.stakeCents,80000);
assert.equal(settleBacktest([normal],{...DEFAULT_SETTLEMENT_RULES,singleStake:0,tripleStake:0}).summary.roi,0);
assert.equal(settleBacktest([]).summary.profitCents,0);
assert.equal(settleBacktest([{...normal,time:'2025-12-31 21:35:00'}]).summary.draws,0);

const extra=process.argv.slice(2);
const seed=JSON.parse(fs.readFileSync(new URL('../lib/seed.json',import.meta.url),'utf8'));
const raw=[...seed,...extra.flatMap(path=>JSON.parse(fs.readFileSync(path,'utf8')).filter(row=>row.openTime?.startsWith('2026-')))];
const cutoff=chinaNow();
const a=analyze(raw,cutoff);
const actualByIssue=new Map(cleanDraws(raw,cutoff).rows.map(row=>[row.issue,row]));
const report={range:a.backtestRange,rules:DEFAULT_SETTLEMENT_RULES,methods:{}};
for(const id of ['rotation']){
  const result=settleBacktest(a.variants[id].performance);
  assert.equal(result.summary.draws,a.backtestRange.draws);
  assert.equal(result.summary.stakeCents,result.summary.draws*40000);
  assert.equal(result.summary.profitCents,result.rows.reduce((sum,row)=>sum+row.profitCents,0));
  assert.equal(result.rows[0].cumulativeProfitCents,result.summary.profitCents);
  assert.equal(result.summary.singleProfitCents+result.summary.tripleProfitCents,result.summary.profitCents);
  for(const row of result.rows){
    assert.deepEqual(row.actualAnimals,actualByIssue.get(row.issue).animals);
    assert.equal(row.hits,row.hitZodiacs.length);
    assert.ok(row.trainingThroughTime<row.time);
  }
  report.methods[id]={label:a.variants[id].label,...result.summary};
}
for(const date of ['2026-01-01','2026-02-17',a.backtestRange.to]){
  const before=raw.filter(row=>row.openTime.slice(0,10)<date);
  const forecast=forecastFromHistory(before,date,cutoff);
  for(const {id} of METHODS)assert.deepEqual(forecast.methods[id].candidates,a.variants[id].performance.find(row=>row.time.startsWith(date)).candidates);
}
console.log(JSON.stringify(report,null,2));
