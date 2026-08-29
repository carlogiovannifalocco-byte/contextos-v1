import { describe, expect, it } from "vitest";
import { bm25, normalize, tokenize } from "../src/lib/rank.js";

const DOCS = [
  {
    id: "ignore",
    title: "Ignore file syntax",
    body: "The .contextosignore file uses gitignore syntax including negation.",
    tags: ["scanner"],
  },
  {
    id: "postgres",
    title: "Postgres is the only datastore",
    body: "SQLite is out of scope so the team can use real migrations.",
    tags: ["db"],
  },
  {
    id: "passing",
    title: "Scanner is heuristic",
    body: "The scanner reads package.json and README headings. It does not parse ignore rules.",
    tags: [],
  },
];

describe("tokenize", () => {
  it("drops stopwords and single characters", () => {
    expect(tokenize("The scanner is a heuristic")).toEqual(["scanner", "heuristic"]);
  });

  it("keeps path-like and dotted terms intact", () => {
    expect(tokenize("reads package.json in src/lib")).toContain("package.json");
    expect(tokenize("reads package.json in src/lib")).toContain("src/lib");
  });
});

describe("bm25", () => {
  it("returns no scores for an empty query", () => {
    expect(bm25(DOCS, "   ").size).toBe(0);
  });

  it("ranks a title match above a passing mention in a body", () => {
    const scores = bm25(DOCS, "ignore syntax");
    expect(scores.get("ignore")!).toBeGreaterThan(scores.get("passing") ?? 0);
  });

  it("omits documents that match nothing", () => {
    const scores = bm25(DOCS, "kubernetes");
    expect(scores.size).toBe(0);
  });

  it("scores a matching document above an unrelated one", () => {
    const scores = bm25(DOCS, "datastore migrations");
    expect(scores.has("postgres")).toBe(true);
    expect(scores.has("ignore")).toBe(false);
  });
});

describe("normalize", () => {
  it("scales the top score to 1", () => {
    const scaled = normalize(new Map([["a", 4], ["b", 2]]));
    expect(scaled.get("a")).toBe(1);
    expect(scaled.get("b")).toBe(0.5);
  });

  it("returns an empty map when there is nothing to scale", () => {
    expect(normalize(new Map()).size).toBe(0);
  });
});
