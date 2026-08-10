import { buildRadarPoints, filterRadarPlaces, importState, resolveRadarRadiusKm, sanitizeExpense, sanitizePlace, totalExpenses, filterAndSortPlaces, haversineMeters } from '../src/core.js';
let seed=0xC0FFEE;
function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/2**32}
function weirdString(){const chars=['a',' ','<','>','&','\u0000','🔥','Đ','"',"'"];let out='';const n=Math.floor(rnd()*800);for(let i=0;i<n;i++)out+=chars[Math.floor(rnd()*chars.length)];return out}
for(let i=0;i<2000;i++){
  const p=sanitizePlace({name:weirdString(),address:weirdString(),note:weirdString(),lat:(rnd()-.5)*1000,lng:(rnd()-.5)*1000,distanceMeters:(rnd()-.2)*1e7,category:weirdString(),priority:weirdString()});
  if(p.name.length>120||p.address.length>300||p.note.length>500)throw new Error(`Monkey bounds failure at ${i}`);
  filterAndSortPlaces([p],{radiusKm:rnd()*100,query:weirdString(),category:'all',sort:'distance'});
  const home={lat:11.94,lng:108.44};
  haversineMeters(p,home);
  const radarRadius=resolveRadarRadiusKm([p],rnd()>0.5?5:9999,home);
  filterRadarPlaces([p],home,{category:'all',radiusKm:rnd()>0.5?5:9999});
  const radar=buildRadarPoints(home,[p],radarRadius);
  if(radar.some((point)=>!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.radialRatio<0||point.radialRatio>1))throw new Error(`Monkey radar invariant failure at ${i}`);
  const expense=sanitizeExpense({payer:weirdString(),category:weirdString(),amountVnd:(rnd()-.15)*1e9,note:weirdString()});
  if(expense.payer.length>80||expense.note.length>300)throw new Error(`Monkey expense bounds failure at ${i}`);
  const total=totalExpenses([expense]);if(!Number.isFinite(total)||total<0)throw new Error(`Monkey expense total failure at ${i}`);
}
const huge={home:{address:'x'.repeat(5000),lat:999,lng:-999},places:Array.from({length:1500},(_,i)=>({id:String(i),name:'n'.repeat(1000),address:'a'.repeat(1000)})),expenses:Array.from({length:6000},(_,i)=>({id:String(i),payer:'p'.repeat(500),amountVnd:i+1,note:'n'.repeat(1000)}))};
const imported=importState(JSON.stringify(huge));
if(imported.places.length!==1000||imported.expenses.length!==5000)throw new Error('Monkey import bound failure');
console.log('monkey: 2,000 randomized place/radar/expense mutations + oversized import survived invariants');
