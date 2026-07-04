/**
 * Readability analysis module.
 *
 * Computes Flesch Reading Ease, sentence length, passive voice %,
 * transition words, and complex word density.
 */

import { stripHtml, countSentences, countSyllables } from "./utils";

const TRANSITION_WORDS = [
  "however", "therefore", "moreover", "furthermore", "consequently",
  "nevertheless", "thus", "accordingly", "besides", "indeed",
  "instead", "meanwhile", "next", "otherwise", "similarly",
  "subsequently", "then", "finally", "for example", "for instance",
  "in addition", "in contrast", "in fact", "in other words",
  "in conclusion", "on the other hand", "rather", "still", "yet",
  "first", "second", "third", "last", "also", "additionally",
];

const PASSIVE_INDICATORS = [
  " is ", " are ", " was ", " were ", " be ", " been ", " being ",
];

const COMPLEX_WORD_MIN_SYLLABLES = 3;

/**
 * Analyze readability of HTML content.
 * @param {string} html
 * @returns {{ fleschScore: number, avgSentenceLength: number, passiveVoicePercent: number, transitionWordCount: number, complexWordPercent: number, wordCount: number }}
 */
export function analyzeReadability(html) {
  const text = stripHtml(html);
  if (!text || text.length < 10) {
    return {
      fleschScore: 0,
      avgSentenceLength: 0,
      passiveVoicePercent: 0,
      transitionWordCount: 0,
      complexWordPercent: 0,
      wordCount: 0,
    };
  }

  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentenceCount = Math.max(countSentences(text), 1);

  // Syllables
  let totalSyllables = 0;
  let complexWords = 0;
  for (const word of words) {
    const syl = countSyllables(word);
    totalSyllables += syl;
    if (syl >= COMPLEX_WORD_MIN_SYLLABLES) complexWords++;
  }

  // Flesch Reading Ease
  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = totalSyllables / Math.max(wordCount, 1);
  const fleschScore = Math.max(
    0,
    Math.min(100, 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord)
  );

  // Passive voice (approximation)
  const lowerText = " " + text.toLowerCase() + " ";
  let passiveMatches = 0;
  for (const indicator of PASSIVE_INDICATORS) {
    const regex = new RegExp(indicator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w+\\s+by\\b", "g");
    passiveMatches += (lowerText.match(regex) || []).length;
    // Also count "was/were/been + past participle" without "by"
    const regex2 = new RegExp(indicator + "(?:\\w+ed|written|done|made|taken|given|seen|known|shown|told|said|found|left|put|kept|held|brought|built|bought|caught|sent|spent|brought)", "g");
    passiveMatches += (lowerText.match(regex2) || []).length;
  }
  const passiveVoicePercent = Math.min(100, (passiveMatches / Math.max(sentenceCount, 1)) * 100);

  // Transition words
  const lowerWords = text.toLowerCase();
  let transitionWordCount = 0;
  for (const tw of TRANSITION_WORDS) {
    const regex = new RegExp(`\\b${tw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    transitionWordCount += (lowerWords.match(regex) || []).length;
  }

  // Complex word density
  const complexWordPercent = (complexWords / Math.max(wordCount, 1)) * 100;

  return {
    fleschScore: Math.round(fleschScore * 10) / 10,
    avgSentenceLength: Math.round(wordsPerSentence * 10) / 10,
    passiveVoicePercent: Math.round(passiveVoicePercent * 10) / 10,
    transitionWordCount,
    complexWordPercent: Math.round(complexWordPercent * 10) / 10,
    wordCount,
  };
}

/**
 * Generate issues from readability analysis.
 * @param {Object} metrics - Output of analyzeReadability
 * @returns {Array}
 */
export function readabilityIssues(metrics) {
  const issues = [];

  if (metrics.fleschScore > 0 && metrics.fleschScore < 30) {
    issues.push({
      category: "readability",
      issueType: "low_readability_score",
      severity: "medium",
      title: "Low readability score",
      description: `Flesch Reading Ease is ${metrics.fleschScore} (difficult to read). Aim for 60+ for general audiences.`,
      currentValue: String(metrics.fleschScore),
      recommendedValue: "60+",
    });
  }

  if (metrics.avgSentenceLength > 25) {
    issues.push({
      category: "readability",
      issueType: "long_sentences",
      severity: "low",
      title: "Sentences are too long",
      description: `Average sentence length is ${metrics.avgSentenceLength} words. Aim for under 25 words per sentence.`,
      currentValue: String(metrics.avgSentenceLength),
      recommendedValue: "Under 25 words",
    });
  }

  if (metrics.passiveVoicePercent > 10) {
    issues.push({
      category: "readability",
      issueType: "passive_voice_overuse",
      severity: "low",
      title: "Passive voice overuse",
      description: `Passive voice detected in ~${metrics.passiveVoicePercent}% of sentences. Use active voice for clarity.`,
      currentValue: `${metrics.passiveVoicePercent}%`,
      recommendedValue: "Under 10%",
    });
  }

  if (metrics.transitionWordCount === 0 && metrics.wordCount > 100) {
    issues.push({
      category: "readability",
      issueType: "no_transition_words",
      severity: "low",
      title: "No transition words found",
      description: "Content lacks transition words (however, therefore, moreover). Adding them improves flow and readability.",
      currentValue: "0 transition words",
      recommendedValue: "Add transition words between paragraphs",
    });
  }

  if (metrics.complexWordPercent > 15) {
    issues.push({
      category: "readability",
      issueType: "complex_words",
      severity: "low",
      title: "High complex word density",
      description: `${metrics.complexWordPercent}% of words are complex (3+ syllables). Simplify vocabulary for broader audience.`,
      currentValue: `${metrics.complexWordPercent}%`,
      recommendedValue: "Under 15%",
    });
  }

  return issues;
}
