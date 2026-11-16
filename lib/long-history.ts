import {calendarOffset,chinaNow,cleanDraws,ZODIACS,type RawDraw} from './model.ts';
import {createOmissionTracker,type OmissionScope} from './omissions.ts';
import {scoreOmissionStrategy} from './omission-strategy.ts';
import type {OmissionBet} from './omission-backtest.ts';

export type YearHistory=Record<string,RawDraw[]>;
// Calendar boundaries are known before a draw; old API animal labels can be inconsistent.
const starts:Record<number,string>={2020:'2020-01-25',2021:'2021-02-12',2022:'2022-02-01',2023:'2023-01-22',2024:'2024-02-10'};
function historyOffset(date:string){const year=Number(date.slice(0,4));return starts[year]?(year-(date<starts[year]?1:0)-2020+120)%12:calendarOffset(date);}
export function prepareLongHistory(years:YearHistory,cutoff=chinaNow()){
 const accepted:RawDraw[]=[],excluded:{year:string;issue:string;reason:string}[]=[];let normalizedZodiacRows=0;
 const seen=new Map<string,RawDraw>();
 for(const [year,items] of Object.entries(years).sort())for(const r of items){
  const reject=(reason:string)=>excluded.push({year,issue:String(r?.expect??''),reason});
  if(Number(year)<2021||!r||typeof r.openTime!=='string'||!r.openTime.startsWith(year+'-')){reject('跨年记录');continue;}
  if(r.openTime>cutoff){reject('尚未开奖');continue;}
  if(!/^20\d{2}\d{3}$/.test(String(r.expect))||!String(r.expect).startsWith(year)||!/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.openTime)){reject('期号或日期异常');continue;}
  const numbers=String(r.openCode).split(',').map(Number);
  if(numbers.length!==7||new Set(numbers).size!==7||numbers.some(n=>!Number.isInteger(n)||n<1||n>49)){reject('号码重复或超出范围');continue;}
  const date=r.openTime.slice(0,10),offset=historyOffset(date),zodiac=numbers.map(n=>ZODIACS[(offset-n+121)%12]).join(',');
  const old=seen.get(date);
  if(old){if(old.openCode!==r.openCode)throw new Error(date+'存在冲突开奖记录，请核对数据');reject('重复日期');continue;}
  if(r.zodiac?.replaceAll('龍','龙').replaceAll('馬','马').replaceAll('雞','鸡').replaceAll('豬','猪')!==zodiac)normalizedZodiacRows++;
  const normalized={expect:String(r.expect),openTime:r.openTime,openCode:r.openCode,zodiac};seen.set(date,normalized);accepted.push(normalized);
 }
 const {rows}=cleanDraws(accepted,cutoff);
 if(rows.length<2)throw new Error('长期历史记录不足');
 const spanDays=Math.round((Date.parse(rows.at(-1)!.time.slice(0,10))-Date.parse(rows[0].time.slice(0,10)))/86400000)+1;
 return {rows,audit:{from:rows[0].time,to:rows.at(-1)!.time,total:rows.length,missingDays:spanDays-rows.length,normalizedZodiacRows,excluded,years:Object.keys(years).sort().map(year=>({year,rows:rows.filter(r=>r.time.startsWith(year)).length}))}};
}
export function replayLongHistory(years:YearHistory,cutoff=chinaNow()){
 const {rows,audit}=prepareLongHistory(years,cutoff);
 const replay=(scope:OmissionScope)=>{
  const tracker=createOmissionTracker(scope),rankCounts=Array(49).fill(0) as number[],bets:OmissionBet[]=[];
  for(let i=0;i<rows.length;i++){
   const row=rows[i];
   if(i>0){
    const date=row.time.slice(0,10),prediction=scoreOmissionStrategy(tracker.snapshot(),date,historyOffset(date),scope);
    const ranking=prediction.ranking.map(c=>c.number);
    const frequencyRanks=rankCounts.map((count,j)=>({rank:j+1,count})).sort((a,b)=>b.count-a.count||a.rank-b.rank).slice(0,10).map(r=>r.rank);
    bets.push({issue:row.issue,time:row.time,trainingThroughIssue:prediction.trainingThroughIssue,trainingThroughTime:prediction.trainingThroughTime,ranking,frequencyRanks,numbers:ranking.slice(0,10),scores:prediction.candidates.map(c=>c.score),regularNumbers:row.numbers.slice(0,6),specialNumber:row.numbers[6]});
    for(const number of scope==='all'?row.numbers:[row.numbers[6]])rankCounts[ranking.indexOf(number)]++;
   }
   tracker.observe(row);
  }
  return bets;
 };
 return {audit,scopes:{special:replay('special'),all:replay('all')},cutoff};
}
export type LongHistoryResult=ReturnType<typeof replayLongHistory>;
