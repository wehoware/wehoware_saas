/**
 * LLM-powered SEO analyzer.
 *
 * Takes content data (blog/service), sends it to the LLM with a structured
 * prompt, and parses the response into a list of SEO issues with
 * actionable suggestions.
 */

import { callLLM } from "@/lib/llm-providers/index";
import { parseJsonResponse } from "@/lib/llm-providers/json-sanitizer";

const SYSTEM_PROMPT = `You are an expert SEO analyst. You analyze web content and identify SEO issues.
You must respond with valid JSON only — no markdown, no code fences, no commentary.

The response must be a JSON object with this exact structure:
{
  "issues": [
    {
      "category": "meta_title|meta_description|content|headings|images|links|schema|social|technical",
      "severity": "critical|warning|info",
      "title": "Short issue title",
      "description": "Detailed explanation of the issue",
      "currentValue": "What the content currently has (or null if missing)",
      "recommendedValue": "What the content should have",
      "suggestion": {
        "fixType": "set_field|rewrite|add|remove|restructure",
        "fieldName": "The database field to update (e.g. metaTitle, metaDescription, content)",
        "suggestedValue": "The exact recommended value",
        "explanation": "Why this change improves SEO"
      }
    }
  ],
  "summary": {
    "totalIssues": 0,
    "criticalCount": 0,
    "warningCount": 0,
    "infoCount": 0,
    "overallAssessment": "Brief summary of SEO health"
  }
}

Rules:
- Only report real issues, don't invent problems
- "critical" = will hurt search rankings (missing meta title, no content, broken canonical)
- "warning" = suboptimal but not fatal (meta title too long/short, thin content)
- "info" = improvements that could help (schema markup, social tags)
- For each issue, provide a concrete, ready-to-use suggestedValue
- fieldName must match the actual database fields: metaTitle, metaDescription, metaKeywords, openGraphTitle, openGraphDescription, openGraphImage, twitterTitle, twitterDescription, canonicalUrl, robotsMeta, content, thumbnailAlt
- Keep suggestedValue concise and practical
- Limit to 10 most important issues`;

/**
 * Build the user prompt for the LLM with content data.
 * @param {Object} content - Normalized content from content-fetcher
 * @returns {string}
 */
function buildAnalysisPrompt(content) {
  const contentPreview = content.content
    ? content.content.substring(0, 3000)
    : content.excerpt || "(no content)";

  const data = {
    type: content.type,
    title: content.title,
    slug: content.slug,
    excerpt: content.excerpt || null,
    contentPreview,
    contentLength: content.content?.length || 0,
    thumbnail: content.thumbnail || null,
    thumbnailAlt: content.thumbnailAlt || null,
    tags: content.tags,
    metaTitle: content.metaTitle || null,
    metaDescription: content.metaDescription || null,
    metaKeywords: content.metaKeywords || null,
    openGraphTitle: content.openGraphTitle || null,
    openGraphDescription: content.openGraphDescription || null,
    openGraphImage: content.openGraphImage || null,
    twitterTitle: content.twitterTitle || null,
    twitterDescription: content.twitterDescription || null,
    canonicalUrl: content.canonicalUrl || null,
    robotsMeta: content.robotsMeta || null,
    schemaType: content.schemaType || null,
    targetKeywords: content.targetKeywords || null,
    currentSeoScore: content.seoScore || 0,
  };

  return `Analyze the following ${content.type} content for SEO issues and return your analysis as JSON.

Content data:
${JSON.stringify(data, null, 2)}

Identify all SEO issues and provide actionable suggestions for each.`;
}

/**
 * Validate and normalize a parsed issue from the LLM response.
 * @param {Object} issue
 * @returns {Object|null}
 */
function normalizeIssue(issue) {
  if (!issue || !issue.category || !issue.severity || !issue.title) {
    return null;
  }

  const validCategories = new Set([
    "meta_title", "meta_description", "content", "headings",
    "images", "links", "schema", "social", "technical",
  ]);
  const validSeverities = new Set(["critical", "warning", "info"]);

  const category = validCategories.has(issue.category) ? issue.category : "technical";
  const severity = validSeverities.has(issue.severity) ? issue.severity : "info";

  const normalized = {
    category,
    severity,
    title: String(issue.title).substring(0, 500),
    description: issue.description ? String(issue.description).substring(0, 2000) : null,
    currentValue: issue.currentValue ? String(issue.currentValue).substring(0, 2000) : null,
    recommendedValue: issue.recommendedValue
      ? String(issue.recommendedValue).substring(0, 2000)
      : null,
  };

  if (issue.suggestion && issue.suggestion.suggestedValue) {
    const validFixTypes = new Set(["set_field", "rewrite", "add", "remove", "restructure"]);
    normalized.suggestion = {
      fixType: validFixTypes.has(issue.suggestion.fixType)
        ? issue.suggestion.fixType
        : "set_field",
      fieldName: issue.suggestion.fieldName || null,
      suggestedValue: String(issue.suggestion.suggestedValue).substring(0, 5000),
      explanation: issue.suggestion.explanation
        ? String(issue.suggestion.explanation).substring(0, 1000)
        : null,
    };
  }

  return normalized;
}

/**
 * Run the SEO analysis on content using the LLM.
 *
 * @param {string} clientId
 * @param {Object} content - Normalized content from content-fetcher
 * @returns {Promise<{ issues: Array, summary: Object, tokensUsed: number, provider: string, model: string }>}
 */
export async function analyzeContent(clientId, content) {
  const prompt = buildAnalysisPrompt(content);

  const result = await callLLM(clientId, {
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    callType: "analysis",
  });

  const parsed = parseJsonResponse(result.content);

  if (!parsed?.valid || !parsed.data || !Array.isArray(parsed.data.issues)) {
    throw new Error(
      `LLM returned invalid analysis response — expected JSON with issues array${
        parsed?.error ? ` (${parsed.error})` : ""
      }`
    );
  }

  const issues = parsed.data.issues
    .map(normalizeIssue)
    .filter(Boolean);

  const summary = parsed.data.summary || {
    totalIssues: issues.length,
    criticalCount: issues.filter((i) => i.severity === "critical").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
    infoCount: issues.filter((i) => i.severity === "info").length,
    overallAssessment: "Analysis complete",
  };

  return {
    issues,
    summary,
    tokensUsed: result.tokensUsed,
    provider: result.provider,
    model: result.model,
  };
}
