/**
 * LLM-powered SEO suggestion generator.
 *
 * Takes a specific SEO issue and generates a detailed, ready-to-apply fix
 * using a separate LLM call (using the suggestion model for faster, cheaper
 * generation).
 */

import { callLLM } from "@/lib/llm-providers/index";
import { parseJsonResponse } from "@/lib/llm-providers/json-sanitizer";

const SYSTEM_PROMPT = `You are an SEO content writer. You generate ready-to-apply fixes for SEO issues.
You must respond with valid JSON only — no markdown, no code fences, no commentary.

The response must be a JSON object with this exact structure:
{
  "fixType": "set_field|rewrite|add|remove|restructure",
  "fieldName": "The database field to update",
  "suggestedValue": "The exact value to set",
  "explanation": "Why this fix improves SEO"
}

Rules:
- fieldName must be one of: metaTitle, metaDescription, metaKeywords, openGraphTitle, openGraphDescription, openGraphImage, twitterTitle, twitterDescription, canonicalUrl, robotsMeta, content, thumbnailAlt
- suggestedValue must be concrete and ready to use (not a template)
- For metaTitle: keep between 50-60 characters
- For metaDescription: keep between 150-160 characters
- For content: provide the full rewritten content section
- Keep explanations concise (1-2 sentences)`;

/**
 * Generate a fix suggestion for a specific issue.
 *
 * @param {string} clientId
 * @param {Object} issue - The SEO issue to generate a fix for
 * @param {Object} content - The original content being analyzed
 * @returns {Promise<{ fixType: string, fieldName: string, suggestedValue: string, explanation: string, tokensUsed: number }>}
 */
export async function generateSuggestion(clientId, issue, content) {
  const prompt = `Generate a fix for the following SEO issue.

Issue:
${JSON.stringify(issue, null, 2)}

Content context:
- Type: ${content.type}
- Title: ${content.title}
- Slug: ${content.slug}
- Current metaTitle: ${content.metaTitle || "(not set)"}
- Current metaDescription: ${content.metaDescription || "(not set)"}
- Content length: ${content.content?.length || 0} characters
- Target keywords: ${JSON.stringify(content.targetKeywords || [])}

Provide a concrete, ready-to-apply fix as JSON.`;

  const result = await callLLM(clientId, {
    prompt,
    systemPrompt: SYSTEM_PROMPT,
    callType: "suggestion",
  });

  const parsed = parseJsonResponse(result.content);

  if (!parsed || !parsed.suggestedValue) {
    throw new Error("LLM returned invalid suggestion response");
  }

  const validFixTypes = new Set(["set_field", "rewrite", "add", "remove", "restructure"]);
  const validFieldNames = new Set([
    "metaTitle", "metaDescription", "metaKeywords",
    "openGraphTitle", "openGraphDescription", "openGraphImage",
    "twitterTitle", "twitterDescription",
    "canonicalUrl", "robotsMeta", "content", "thumbnailAlt",
  ]);

  return {
    fixType: validFixTypes.has(parsed.fixType) ? parsed.fixType : "set_field",
    fieldName: validFieldNames.has(parsed.fieldName) ? parsed.fieldName : issue.fieldName || null,
    suggestedValue: String(parsed.suggestedValue).substring(0, 5000),
    explanation: parsed.explanation
      ? String(parsed.explanation).substring(0, 1000)
      : null,
    tokensUsed: result.tokensUsed,
  };
}
