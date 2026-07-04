/**
 * JSON sanitizer for LLM responses.
 *
 * Some providers (Gemini, Mistral, Nemotron) wrap JSON in markdown code fences,
 * emit reasoning/thinking tokens, or add extra text around the JSON body.
 * This module strips those artifacts and validates the parsed result.
 */

const FENCE_RE = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
const THINK_RE = /<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi;

/**
 * Find the first occurrence of either { or [ in a string.
 * @param {string} text
 * @returns {number} Index of first JSON start char, or -1
 */
function findJsonStart(text) {
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");
  if (objStart < 0) return arrStart;
  if (arrStart < 0) return objStart;
  return Math.min(objStart, arrStart);
}

/**
 * Find the last occurrence of either } or ] in a string.
 * @param {string} text
 * @returns {number} Index of last JSON end char, or -1
 */
function findJsonEnd(text) {
  const objEnd = text.lastIndexOf("}");
  const arrEnd = text.lastIndexOf("]");
  return Math.max(objEnd, arrEnd);
}

/**
 * Strip markdown code fences and surrounding text from an LLM response
 * to extract a clean JSON string.
 *
 * @param {string} raw - Raw LLM response text
 * @returns {string} Cleaned JSON string
 */
export function stripJsonFences(raw) {
  if (!raw || typeof raw !== "string") return "";

  let text = raw.trim();

  // Remove <think>...</think> or <thinking>...</thinking> blocks (reasoning models)
  text = text.replace(THINK_RE, "").trim();

  // Remove ```json ... ``` or ``` ... ``` fences
  const fenceMatch = FENCE_RE.exec(text);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // If there's still leading/trailing non-JSON text, try to extract
  // the outermost JSON object or array
  if (!text.startsWith("{") && !text.startsWith("[")) {
    const start = findJsonStart(text);
    if (start >= 0) {
      const end = findJsonEnd(text);
      if (end > start) {
        text = text.substring(start, end + 1);
      }
    }
  }

  return text.trim();
}

/**
 * Parse an LLM response as JSON, stripping fences first.
 *
 * @param {string} raw - Raw LLM response text
 * @returns {{ valid: boolean, data: object|null, error: string|null }}
 */
export function parseJsonResponse(raw) {
  if (!raw || typeof raw !== "string") {
    return { valid: false, data: null, error: "Empty response" };
  }

  const cleaned = stripJsonFences(raw);

  try {
    const data = JSON.parse(cleaned);
    return { valid: true, data, error: null };
  } catch (err) {
    // Fallback: remove trailing commas before } or ] (common LLM artifact)
    const repaired = cleaned.replace(/,\s*([}\]])/g, "$1");
    if (repaired !== cleaned) {
      try {
        const data = JSON.parse(repaired);
        return { valid: true, data, error: null };
      } catch {
        // fall through to error
      }
    }
    return {
      valid: false,
      data: null,
      error: `JSON parse failed: ${err.message}`,
    };
  }
}
