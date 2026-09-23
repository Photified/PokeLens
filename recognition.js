import {normalize,cardName,numKey,distance} from './matcher.js';
const suffix=/\s+(?:EX|GX|VMAX|VSTAR|V|BREAK)$/;
function words(s){return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();}
function family(c){return cardName(c.name);}
function primary(c){return words(c.name.replace(/\s*\([^)]*\)/g,'').replace(/\s*[-–]\s*\d.*$/,'')).replace(suffix,'').split(' ').at(-1);}
function attackName(a){return normalize(a.replace(/^\[[^\]]*\]\s*/,'').replace(/\([^)]*\)/g,''));}
export function makeRecognizer(cards){
 const byID=new Map(cards.map(c=>[c.id,c]));
 const metadata=cards.map(card=>({card,family:family(card),primary:primary(card),attacks:(card.attacks||[]).map(attackName).filter(a=>a.length>=6)}));
 const attackCounts=new Map();for(const item of metadata)for(const attack of new Set(item.attacks))attackCounts.set(attack,(attackCounts.get(attack)||0)+1);
 return function rank(frames){
  const prepared=frames.map(frame=>{
   const title=words(frame.title),bottom=String(frame.bottom||'').toUpperCase();
   return {...frame,title,titleCompact:normalize(title),titleTokens:title.split(' '),body:normalize(frame.text),
    fractions:[...bottom.matchAll(/\b([A-Z]{0,4}\d{1,4})\s*[/|]\s*([A-Z]{0,4}\d{1,4})\b/g)].map(m=>[numKey(m[1]),numKey(m[2])]),
    hp:[...String(frame.title||'').toUpperCase().matchAll(/(?:HP\s*(\d{2,3})|(\d{2,3})\s*HP)/g)].map(m=>+(m[1]||m[2]))};
  });
  const rows=[];
  for(const item of metadata){
   let strongest=null,hits=0;
   for(const frame of prepared){
    const {title,titleCompact,titleTokens,body,fractions,hp}=frame;
    const vision=frame.visual.get(item.card.id),visual=vision?.similarity||0;
    const exactName=item.family.length>=3&&titleCompact.includes(item.family)&&titleTokens.some(t=>t===item.primary);
    // Fuzzy text is confined to the title; attack descriptions never become names.
    const primarySeen=item.primary?.length>=3&&titleTokens.some(t=>t===item.primary||(item.primary.length>=5&&t.length>=5&&Math.abs(t.length-item.primary.length)<=1&&distance(t,item.primary)<=1));
    const name=exactName?1:primarySeen ? .8 : 0;
    const number=fractions.some(([a,b])=>a===item.card._num&&b===item.card._total)||(!item.card._total&&item.card._num&&String(frame.bottom||'').toUpperCase().split(/[^A-Z0-9]+/).some(n=>numKey(n)===item.card._num)&&(name||visual>=.76));
    const wrongNumber=fractions.length>0&&item.card._total&&!number;
    const hpMatch=hp.includes(+item.card.hp)&&!!item.card.hp;
    const hpConflict=hp.length>0&&!!item.card.hp&&!hpMatch;
    const seen=item.attacks.filter(a=>body.includes(a)),distinct=seen.filter(a=>(attackCounts.get(a)||0)<60);
    const textStrong=(name&&number)||(name&&distinct.length)||(distinct.length>=2)||(number&&hpMatch);
    const evidence=[];if(visual>=.72)evidence.push('Image');if(name)evidence.push('Title');if(number)evidence.push('Number');if(hpMatch)evidence.push('HP');if(seen.length)evidence.push('Moves');
    // A strong text identity can recover a difficult foil. Image-only results need a clear similarity margin below.
    const eligible=textStrong||(visual>=.72&&name)||(visual>=.76&&!hpConflict&&!wrongNumber);
    if(!eligible||hpConflict&&name===0||wrongNumber&&!textStrong&&visual<.92)continue;
    const score=Math.max(0,(visual-.60)*240)+name*12+(number?40:0)+(hpMatch?5:0)+Math.min(30,distinct.length*15)-(hpConflict?22:0)-(wrongNumber?18:0);
    const row={card:item.card,family:item.family,score,evidence,visual,textStrong,view:vision?.view??0,number};
    if(!strongest||score>strongest.score)strongest=row;
    if(textStrong||visual>=.76)hits++;
   }
   if(strongest){strongest.score+=Math.min(6,Math.max(0,hits-1)*6);rows.push(strongest);}
  }
  rows.sort((a,b)=>b.score-a.score||a.card.id-b.card.id);
  if(!rows.length)return [];
  const best=rows[0];
  const imageAlternatives=frames.flatMap(f=>[...f.visual.values()]).filter(v=>family(byID.get(v.id)||{name:''})!==best.family);
  const different=imageAlternatives.sort((a,b)=>b.similarity-a.similarity)[0];
  if(!best.textStrong&&!best.evidence.includes('Title')&&(best.visual<.76||different&&best.visual-different.similarity<.045))return [];
  // Printing ambiguity is useful; unrelated identities are not printing alternatives.
  return rows.filter(r=>r.family===best.family&&r.score>=best.score-32&&(r.visual>=best.visual-.075||r.number||r.textStrong)).slice(0,24);
 };
}
export function visualMap(result){return new Map(result.matches.map(x=>[x.id,x]));}
