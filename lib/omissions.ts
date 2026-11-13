import type {Draw} from './model';

export type OmissionScope='special'|'all';
export type OmissionItem={key:string;label:string;numbers:number[];current:number;censored:boolean;longest:number;longestCensored:boolean;lastIssue:string|null;lastTime:string|null;recent30:number;appearances:number;trend:number[]};
type Rule={key:string;label:string;numbers?:number[];animal?:string};
const numbers=Array.from({length:49},(_,i)=>i+1);
const group=(key:string,label:string,test:(n:number)=>boolean):Rule=>({key,label,numbers:numbers.filter(test)});
const animals=[...'鼠牛虎兔龙蛇马羊猴鸡狗猪'];

// One occurrence per draw, even if several numbers satisfy the same rule.
export function summarizeOmission(hits:boolean[]){
  let streak=0,longest=0,last=-1,first=-1,appearances=0;
  for(let i=0;i<hits.length;i++){
    if(hits[i]){if(first<0)first=i;last=i;appearances++;streak=0;}
    else {streak++;longest=Math.max(longest,streak);}
  }
  return {current:streak,censored:last<0,longest,longestCensored:first<0||first===longest&&longest>0,last,appearances,recent30:hits.slice(-30).filter(Boolean).length};
}

const definitions=[
    {id:'head',label:'头数',rules:Array.from({length:5},(_,i)=>group('h'+i,i+'头',n=>Math.floor(n/10)===i))},
    {id:'tail',label:'尾数',rules:Array.from({length:10},(_,i)=>group('t'+i,i+'尾',n=>n%10===i))},
    {id:'zodiac',label:'生肖',rules:animals.map(animal=>({key:animal,label:animal,animal})) as Rule[]},
    {id:'parity',label:'单双',rules:[group('odd','单',n=>n%2===1),group('even','双',n=>n%2===0)]},
    {id:'size-parity',label:'大小单双',rules:[group('small-odd','小单',n=>n<=24&&n%2===1),group('small-even','小双',n=>n<=24&&n%2===0),group('big-odd','大单',n=>n>=25&&n%2===1),group('big-even','大双',n=>n>=25&&n%2===0)]},
    {id:'number',label:'单个号码',rules:numbers.map(n=>group('n'+n,String(n).padStart(2,'0'),v=>v===n))},
  ];

export function buildOmissions(rows:Draw[]){
  const latest=rows.at(-1)!;

  const forScope=(scope:OmissionScope)=>{
    const start=scope==='special'?6:0,end=7;
    return definitions.map(category=>({id:category.id,label:category.label,items:category.rules.map(rule=>{
      const hits=rows.map(row=>rule.animal?row.animals.slice(start,end).includes(rule.animal):row.numbers.slice(start,end).some(n=>rule.numbers!.includes(n)));
      let missing=0;
      const trend=hits.map(hit=>missing=hit?0:missing+1).slice(-90);
      const stats=summarizeOmission(hits),last=stats.last<0?null:rows[stats.last];
      // Zodiac numbers are for the latest draw's mapping; each historical hit
      // is checked against that draw's own published animal, including New Year.
      const pool=rule.animal?numbers.filter(n=>animals[(latest.offset-n+121)%12]===rule.animal):rule.numbers!;
      return {key:rule.key,label:rule.label,numbers:pool,trend,...stats,lastIssue:last?.issue??null,lastTime:last?.time??null} satisfies OmissionItem;
    })}));
  };
  const scopes={special:forScope('special'),all:forScope('all')};
  return {from:rows[0].time,to:latest.time,latestIssue:latest.issue,draws:rows.length,recentDraws:Math.min(30,rows.length),timeline:rows.slice(-90).map(row=>({issue:row.issue,time:row.time})),scopes};
}
export type OmissionStatistics=ReturnType<typeof buildOmissions>;

// Incremental scope-specific snapshot for walk-forward replay. A draw is observed
// only after its prediction has been saved and settled.
export function createOmissionTracker(scope:OmissionScope='special'){
  let count=0,latest:Draw|null=null;
  const lastSeen=definitions.map(category=>category.rules.map(()=>-1));
  return {
    snapshot(){
      if(!latest)throw new Error('缺少此前开奖记录');
      const saved=latest;
      return {to:saved.time,latestIssue:saved.issue,scopes:{[scope]:definitions.map((category,c)=>({id:category.id,label:category.label,items:category.rules.map((rule,r)=>({
        key:rule.key,label:rule.label,numbers:rule.numbers??numbers.filter(n=>animals[(saved.offset-n+121)%12]===rule.animal),
        current:count-1-lastSeen[c][r],censored:lastSeen[c][r]<0,
      }))}))}};
    },
    observe(row:Draw){
      if(latest&&row.time<=latest.time)throw new Error('遗漏统计必须按开奖时间依次更新');
      definitions.forEach((category,c)=>category.rules.forEach((rule,r)=>{
        if(rule.animal?row.animals.slice(scope==='special'?6:0).includes(rule.animal):row.numbers.slice(scope==='special'?6:0).some(n=>rule.numbers!.includes(n)))lastSeen[c][r]=count;
      }));
      latest=row;count++;
    },
  };
}

export const createSpecialOmissionTracker=()=>createOmissionTracker('special');
