const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has", "have", "how",
  "in", "into", "is", "it", "its", "of", "on", "or", "that", "the", "then", "there", "these",
  "this", "to", "was", "were", "what", "when", "which", "why", "with", "you", "your",
]);

const K1 = 1.5;
const B = 0.75;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export type RankableDoc = {
  id: string;
  title: string;
  body: string;
  tags?: string[];
};

type Indexed = {
  id: string;
  length: number;
  freq: Map<string, number>;
};

/**
 * Okapi BM25. Title and tag terms are counted three times so a query matching a
 * heading outranks the same word buried in a long body.
 */
export function buildIndex(docs: readonly RankableDoc[]) {
  const indexed: Indexed[] = docs.map((doc) => {
    const terms = [
      ...tokenize(doc.title),
      ...tokenize(doc.title),
      ...tokenize(doc.title),
      ...tokenize((doc.tags ?? []).join(" ")),
      ...tokenize((doc.tags ?? []).join(" ")),
      ...tokenize((doc.tags ?? []).join(" ")),
      ...tokenize(doc.body),
    ];
    const freq = new Map<string, number>();
    for (const term of terms) freq.set(term, (freq.get(term) ?? 0) + 1);
    return { id: doc.id, length: terms.length, freq };
  });

  const docFreq = new Map<string, number>();
  for (const doc of indexed) {
    for (const term of doc.freq.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
  }

  const totalLength = indexed.reduce((sum, doc) => sum + doc.length, 0);
  const avgLength = indexed.length > 0 ? totalLength / indexed.length : 0;

  return { indexed, docFreq, avgLength, count: indexed.length };
}

/**
 * Scores every document against the query. Returns raw BM25 scores keyed by id;
 * an empty query yields an empty map so callers can skip relevance entirely.
 */
export function bm25(docs: readonly RankableDoc[], query: string): Map<string, number> {
  const scores = new Map<string, number>();
  const terms = tokenize(query);
  if (terms.length === 0 || docs.length === 0) return scores;

  const { indexed, docFreq, avgLength, count } = buildIndex(docs);

  for (const doc of indexed) {
    let score = 0;
    for (const term of terms) {
      const tf = doc.freq.get(term);
      if (!tf) continue;
      const df = docFreq.get(term) ?? 0;
      const idf = Math.log(1 + (count - df + 0.5) / (df + 0.5));
      const norm = avgLength > 0 ? doc.length / avgLength : 1;
      score += idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + B * norm)));
    }
    if (score > 0) scores.set(doc.id, score);
  }

  return scores;
}

/** Rescales scores to 0..1 so relevance can be blended with fixed priority weights. */
export function normalize(scores: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  let max = 0;
  for (const value of scores.values()) if (value > max) max = value;
  if (max <= 0) return out;
  for (const [id, value] of scores) out.set(id, value / max);
  return out;
}
