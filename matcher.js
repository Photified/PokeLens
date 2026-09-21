/* Robust Pokémon card text matcher */
export function normalize(s) { 
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ''); 
}

export function cardName(s) { 
  return normalize(String(s).replace(/\b(EX|GX|V|VMAX|VSTAR|TAG\s*TEAM)\b/gi, '').replace(/\s*\([^)]*\)/g, '').replace(/\s*[-–]\s*\d.*$/, '')); 
}

export function numKey(s) { 
  if(!s) return '';
  let clean = String(s).toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^A-Z0-9]/g, '');
  return clean.replace(/(^|[A-Z])0+(?=\d)/g, '$1'); 
}

export function prepare(cards) {
  return cards.map(c => {
    const parts = (c.number || '').split('/');
    return {
      ...c, 
      _name: cardName(c.name), 
      _num: numKey(parts[0]), 
      _total: numKey(parts[1] || '')
    };
  });
}

export function distance(a, b) {
  let row = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}

export function identify(text, cards) {
  const raw = String(text).toUpperCase();
  const compact = normalize(raw);
  const lines = raw.split(/[\n\r]+/).map(normalize).filter(Boolean);
  
  const fractions = [...raw.matchAll(/\b([A-Z]{0,5}[0-9OIl]{1,4})\s*[\/\\|!]\s*([A-Z]{0,5}[0-9OIl]{1,4})\b/g)]
    .map(m => [numKey(m[1]), numKey(m[2])]);

  const rawTokens = raw.split(/[^A-Z0-9]+/).filter(Boolean);
  const numberTokens = new Set(rawTokens.filter(t => /\d/.test(t)).map(numKey));

  let candidates = [];

  for (const c of cards) {
    if (!c._num || !c._name) continue;

    let nameScore = compact.includes(c._name) ? 1 : 0;
    if (!nameScore) {
      for (const line of lines) {
        if (Math.abs(line.length - c._name.length) <= 3) {
          const sim = 1 - (distance(line, c._name) / Math.max(line.length, c._name.length));
          if (sim > nameScore) nameScore = sim;
        }
      }
    }
    if (nameScore < 0.68) continue;

    const exactFraction = fractions.some(([n, t]) => n === c._num && (!c._total || t === c._total));
    const hasNumber = exactFraction || numberTokens.has(c._num) || fractions.some(([n]) => n === c._num);

    let score = (nameScore * 60);
    if (exactFraction) score += 40;
    else if (hasNumber) score += 20;

    candidates.push({ card: c, score, nameScore, exactFraction, hasNumber });
  }

  if (!candidates.length) return { kind: 'none', cards: [] };

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  const near = candidates.filter(x => best.score - x.score < 10);
  const sameIdentity = near.every(x => x.card._name === best.card._name);

  if (sameIdentity) {
    return { kind: 'match', cards: near.map(x => x.card) };
  }

  return { kind: 'ambiguous', cards: near.map(x => x.card) };
}

export function summarizePrices(cards) {
  const rows = cards.flatMap(c => (c.prices || [])
    .filter(p => typeof p.market === 'number' && Number.isFinite(p.market) && p.market >= 0)
    .map(p => ({ ...p, card: c.name }))
  );
  if (!rows.length) return null;
  return { low: Math.min(...rows.map(x => x.market)), high: Math.max(...rows.map(x => x.market)), rows };
}

export function numberCandidates(text, cards) {
  const fractions = [...String(text).toUpperCase().matchAll(/\b([A-Z]{0,5}[0-9OIl]{1,4})\s*[\/\\|!]\s*([A-Z]{0,5}[0-9OIl]{1,4})\b/g)]
    .map(m => [numKey(m[1]), numKey(m[2])]);
  return cards.filter(c => fractions.some(([n, t]) => c._num === n && (!c._total || c._total === t)));
}