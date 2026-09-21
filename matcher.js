/* Conservative OCR matching: never equate a Pokémon name alone with a printing. */
export function normalize(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
export function cardName(s) { return normalize(String(s).replace(/\s*\([^)]*\)/g, '').replace(/\s*[-–]\s*\d.*$/, '')); }
export function numKey(s) { return normalize(s).replace(/(^|[A-Z])0+(?=\d)/g, '$1'); }
export function prepare(cards) {
  return cards.map(c => {
    const [num, total] = c.number.split('/');
    return {...c, _name: cardName(c.name), _num: numKey(num), _total: numKey(total)};
  });
}
export function distance(a,b) {
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++) { const next=[i]; for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1)); row=next; }
  return row[b.length];
}
export function identify(text,cards) {
  const raw=String(text).toUpperCase();
  const compact=normalize(raw);
  const tokens=raw.split(/[^A-Z0-9]+/).filter(Boolean);
  const fractions=[...raw.matchAll(/\b([A-Z]{0,5}\d{1,4})\s*[/|]\s*([A-Z]{0,5}\d{1,4})\b/g)].map(m=>[numKey(m[1]),numKey(m[2])]);
  const numberTokens=new Set(tokens.filter(t=>/\d/.test(t)).map(numKey));
  const lines=raw.split(/[\n\r]+/).map(normalize).filter(Boolean);
  let candidates=[];
  for (const c of cards) {
    if(!c._num || !c._name) continue;
    const exactName=compact.includes(c._name);
    const fraction=fractions.some(([n,t])=>n===c._num && t===c._total);
    const wrongFraction=fractions.length>0 && c._total && !fraction;
    const number=numberTokens.has(c._num) || fractions.some(([n])=>n===c._num) || (/[A-Z]/.test(c._num)&&compact.includes(c._num));
    if(!number || wrongFraction) continue;
    let name=exactName?1:0;
    if(!name && fraction) {
      for (const line of lines) {
        if(Math.abs(line.length-c._name.length)<=3) name=Math.max(name,1-distance(line,c._name)/Math.max(line.length,c._name.length));
      }
    }
    if(name<.78) continue;
    const set=normalize(c.setCode);
    const setSeen=set.length>=3 && tokens.some(t=>normalize(t)===set);
    candidates.push({card:c,score:(fraction?100:55)+name*40+(setSeen?15:0),fraction,name});
  }
  candidates.sort((a,b)=>b.score-a.score || b.card._name.length-a.card._name.length);
  if(!candidates.length) return {kind:'none',cards:[]};
  const best=candidates[0];
  // A complete longer name wins over an embedded shorter name, e.g. Charizard ex.
  candidates=candidates.filter(x=>!(best.card._name.length>x.card._name.length && best.card._name.includes(x.card._name)));
  const near=candidates.filter(x=>best.score-x.score<12);
  const sameIdentity=near.every(x=>x.card._name===best.card._name && x.card._num===best.card._num && x.card.group===best.card.group);
  if(!sameIdentity) return {kind:'ambiguous',cards:near.map(x=>x.card)};
  // No fraction is acceptable for promos, but not a bare number lifted from an attack on a numbered set card.
  if(!best.fraction && best.card._total && !near.some(x=>tokens.includes(normalize(x.card.setCode)))) return {kind:'none',cards:[]};
  return {kind:'match',cards:near.map(x=>x.card)};
}
export function summarizePrices(cards) {
  const rows=cards.flatMap(c=>(c.prices||[]).filter(p=>typeof p.market==='number'&&Number.isFinite(p.market)&&p.market>=0).map(p=>({...p,card:c.name})));
  if(!rows.length) return null;
  return {low:Math.min(...rows.map(x=>x.market)),high:Math.max(...rows.map(x=>x.market)),rows};
}
export function numberCandidates(text,cards) {
  const fractions=[...String(text).toUpperCase().matchAll(/\b([A-Z]{0,5}\d{1,4})\s*[/|]\s*([A-Z]{0,5}\d{1,4})\b/g)].map(m=>[numKey(m[1]),numKey(m[2])]);
  return cards.filter(c=>fractions.some(([n,t])=>c._num===n&&c._total===t));
}
