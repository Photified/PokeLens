/* Conservative OCR matching: never equate a Pokémon name alone with a printing. */
export function normalize(s) { return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
export function cardName(s) { return normalize(String(s).replace(/\s*\([^)]*\)/g, '').replace(/\s*[-–]\s*\d.*$/, '')); }
export function numKey(s) { return normalize(s).replace(/(^|[A-Z])0+(?=\d)/g, '$1'); }
export function prepare(cards) {
  return cards.map(c => {
    const [num, total] = (c.number||'').split('/');
    return {...c, _name: cardName(c.name), _num: numKey(num), _total: numKey(total)};
  });
}
export function distance(a,b) {
  let row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++) { const next=[i]; for(let j=1;j<=b.length;j++) next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1)); row=next; }
  return row[b.length];
}
export function summarizePrices(cards) {
  const rows=cards.flatMap(c=>(c.prices||[]).filter(p=>typeof p.market==='number'&&Number.isFinite(p.market)&&p.market>=0).map(p=>({...p,card:c.name})));
  if(!rows.length) return null;
  return {low:Math.min(...rows.map(x=>x.market)),high:Math.max(...rows.map(x=>x.market)),rows};
}
