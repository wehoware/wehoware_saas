/**
 * TF-IDF computation module.
 *
 * Builds a term-document matrix from client content and calculates
 * TF-IDF scores to identify items with low topical coverage.
 */

import { stripHtml } from "./utils";

const MAX_VOCABULARY = 10000;

/**
 * Tokenize text into terms.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  const clean = stripHtml(text).toLowerCase();
  return clean
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && w.length < 30);
}

/**
 * Build term frequency map for a document.
 * @param {string[]} tokens
 * @returns {Map<string, number>}
 */
function termFrequency(tokens) {
  const tf = new Map();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  // Normalize by total tokens
  const total = tokens.length || 1;
  for (const [term, count] of tf) {
    tf.set(term, count / total);
  }
  return tf;
}

/**
 * Compute TF-IDF for all documents.
 * @param {Array<{id: string, content: string, targetKeywords?: string[]}>} documents
 * @returns {{ tfidf: Map<string, Map<string, number>>, vocabulary: string[], lowScoringItems: Array }}
 */
export function computeTfidf(documents) {
  if (!documents || documents.length === 0) {
    return { tfidf: new Map(), vocabulary: [], lowScoringItems: [] };
  }

  // Tokenize all documents
  const tokenized = documents.map((doc) => ({
    id: doc.id,
    tokens: tokenize(doc.content || ""),
    targetKeywords: doc.targetKeywords || [],
  }));

  // Build document frequency (df) — how many docs contain each term
  const df = new Map();
  for (const doc of tokenized) {
    const uniqueTerms = new Set(doc.tokens);
    for (const term of uniqueTerms) {
      df.set(term, (df.get(term) || 0) + 1);
    }
  }

  // Cap vocabulary to top MAX_VOCABULARY terms by frequency
  const sortedVocab = [...df.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_VOCABULARY);
  const vocabulary = sortedVocab.map(([term]) => term);
  const vocabSet = new Set(vocabulary);

  // Compute IDF
  const N = documents.length;
  const idf = new Map();
  for (const [term, freq] of sortedVocab) {
    idf.set(term, Math.log((N + 1) / (freq + 1)) + 1);
  }

  // Compute TF-IDF for each document
  const tfidf = new Map();
  const lowScoringItems = [];
  const threshold = parseFloat(process.env.SEO_ANALYSER_TFIDF_LOW_THRESHOLD || "0.01");

  for (const doc of tokenized) {
    const tf = termFrequency(doc.tokens);
    const docTfidf = new Map();

    for (const [term, tfVal] of tf) {
      if (!vocabSet.has(term)) continue;
      const idfVal = idf.get(term) || 0;
      docTfidf.set(term, tfVal * idfVal);
    }

    tfidf.set(doc.id, docTfidf);

    // Check if target keywords have low TF-IDF
    if (doc.targetKeywords.length > 0) {
      let lowCount = 0;
      for (const keyword of doc.targetKeywords) {
        const kwLower = keyword.toLowerCase();
        const score = docTfidf.get(kwLower) || 0;
        if (score < threshold) {
          lowCount++;
        }
      }
      if (lowCount > 0) {
        lowScoringItems.push({
          id: doc.id,
          lowKeywordCount: lowCount,
          totalKeywords: doc.targetKeywords.length,
        });
      }
    }
  }

  return { tfidf, vocabulary, lowScoringItems };
}

/**
 * Generate issues from TF-IDF analysis.
 * @param {Array} lowScoringItems
 * @param {Array} documents
 * @returns {Array}
 */
export function tfidfIssues(lowScoringItems, documents) {
  const issues = [];
  const docMap = new Map(documents.map((d) => [d.id, d]));

  for (const item of lowScoringItems) {
    const doc = docMap.get(item.id);
    if (!doc) continue;
    issues.push({
      category: "tfidf",
      issueType: "low_tfidf_score",
      severity: "medium",
      title: "Low TF-IDF score for target keywords",
      description: `${item.lowKeywordCount} of ${item.totalKeywords} target keyword(s) have low TF-IDF scores, indicating insufficient topical coverage.`,
      currentValue: `${item.lowKeywordCount}/${item.totalKeywords} keywords with low TF-IDF`,
      recommendedValue: "Increase keyword usage in content body naturally, add related terms and subtopics",
    });
  }

  return issues;
}
