import {calendarOffset,ZODIACS} from './model.ts';
type DrawResult={time:string;specialNumber:number;regularNumbers?:number[]};
export function omissionNumberMark(number:number,row:DrawResult){
 const offset=calendarOffset(row.time.slice(0,10));
 const zodiac=(n:number)=>ZODIACS[(offset-n+121)%12];
 const animal=zodiac(number);
 // Exact drawn numbers take precedence, then special-zodiac matches.
 // A zodiac-only match is a visual annotation, never a special-number payout.
 if(number===row.specialNumber)return {className:'hit',badge:'特',description:'特码命中',zodiac:animal};
 if(row.regularNumbers?.includes(number))return {className:'regular-hit',badge:'平',description:'平码命中',zodiac:animal};
 if(animal===zodiac(row.specialNumber))return {className:'special-zodiac-hit',badge:'特肖',description:'与特码同生肖',zodiac:animal};
 if(row.regularNumbers?.some(n=>zodiac(n)===animal))return {className:'regular-zodiac-hit',badge:'平肖',description:'与平码同生肖',zodiac:animal};
 return {className:'',badge:'',description:'未开出且生肖未匹配',zodiac:animal};
}
