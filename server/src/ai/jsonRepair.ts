/**
 * Robust JSON extraction and repair engine designed to handle erratic outputs
 * from smaller or budget LLMs (e.g. Llama-3-8B, Mistral, Ollama, Phi-3, Claude Haiku).
 */

export interface JsonRepairResult<T = unknown> {
  data: T;
  wasRepaired: boolean;
  extractedThinking?: string;
  rawText: string;
}

/**
 * Extracts and cleans thinking tags (<think>, <thinking>) from raw LLM text.
 */
export function extractThinking(text: string): { cleanText: string; thinking?: string } {
  let thinking: string | undefined;

  const thinkMatch = text.match(/<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/i);
  if (thinkMatch) {
    thinking = thinkMatch[1].trim();
  }

  const cleanText = text.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').trim();
  return { cleanText, thinking };
}

/**
 * Cleans smart quotes, control chars, and sanitizes common syntax blunders.
 */
function sanitizeJsonString(str: string): string {
  return str
    // Normalize smart/curly quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    // Remove comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^\\:])\/\/.*$/gm, '$1')
    // Remove trailing commas before closing braces/brackets
    .replace(/,(\s*[\]}])/g, '$1');
}

/**
 * Attempts to repair truncated or unclosed JSON by balancing brackets and quotes.
 */
function closeTruncatedJson(str: string): string {
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') stack.push('}');
      else if (char === '[') stack.push(']');
      else if (char === '}' || char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === char) {
          stack.pop();
        }
      }
    }
  }

  let repaired = str;
  if (inString) {
    repaired += '"';
  }
  while (stack.length > 0) {
    repaired += stack.pop();
  }
  return repaired;
}

/**
 * Fixes unescaped quotes within JSON string values.
 * e.g.: "description": "Engineered "real-time" event broker"
 */
function fixUnescapedInnerQuotes(str: string): string {
  // Regex finding unescaped quotes that are followed by words instead of delimiters (: , } ])
  return str.replace(/([a-zA-Z0-9])"([a-zA-Z0-9])/g, '$1\\"$2');
}

/**
 * Finds candidate JSON objects inside raw text.
 */
function findCandidateObjects(text: string): string[] {
  const candidates: string[] = [];

  // 1. Markdown blocks (json or generic)
  const codeBlocks = Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi));
  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    const blockContent = codeBlocks[i][1].trim();
    if (blockContent.startsWith('{') || blockContent.startsWith('[')) {
      candidates.push(blockContent);
    }
  }

  // 2. Custom tags: <cv_json>...</cv_json> or <json>...</json>
  const tagBlocks = Array.from(text.matchAll(/<(?:cv_json|json|output)>\s*([\s\S]*?)\s*<\/(?:cv_json|json|output)>/gi));
  for (let i = tagBlocks.length - 1; i >= 0; i--) {
    candidates.push(tagBlocks[i][1].trim());
  }

  // 3. Balanced brace finder
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          candidates.push(text.substring(start, i + 1));
          start = -1;
        } else if (depth < 0) {
          depth = 0;
        }
      }
    }
  }

  // If text started with '{' but was never closed (truncated)
  if (depth > 0 && start !== -1) {
    candidates.push(text.substring(start));
  }

  return candidates;
}

/**
 * Primary extractor and repair function.
 */
export function extractAndRepairJson<T = unknown>(rawInput: unknown): JsonRepairResult<T> {
  if (rawInput == null) {
    throw new Error('Empty or null response received from AI model');
  }

  if (typeof rawInput === 'object') {
    return {
      data: rawInput as T,
      wasRepaired: false,
      rawText: JSON.stringify(rawInput),
    };
  }

  const rawText = String(rawInput);
  const { cleanText, thinking } = extractThinking(rawText);

  // 1. Direct parse attempt
  try {
    const parsed = JSON.parse(cleanText);
    if (parsed && typeof parsed === 'object') {
      return { data: parsed as T, wasRepaired: false, extractedThinking: thinking, rawText };
    }
  } catch {
    // Continue to repair pipeline
  }

  // 2. Discover candidates
  const candidates = findCandidateObjects(cleanText);
  if (candidates.length === 0) {
    candidates.push(cleanText);
  }

  // 3. Iterate candidates from last to first
  for (let i = candidates.length - 1; i >= 0; i--) {
    const candidate = candidates[i];

    // Try direct parse of candidate
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        return { data: parsed as T, wasRepaired: false, extractedThinking: thinking, rawText };
      }
    } catch {
      // Continue to sanitization
    }

    // Pass A: Sanitize trailing commas, smart quotes, comments
    const sanitized = sanitizeJsonString(candidate);
    try {
      const parsed = JSON.parse(sanitized);
      if (parsed && typeof parsed === 'object') {
        return { data: parsed as T, wasRepaired: true, extractedThinking: thinking, rawText };
      }
    } catch {
      // Continue to Pass B
    }

    // Pass B: Fix unescaped quotes within strings
    const fixedQuotes = fixUnescapedInnerQuotes(sanitized);
    try {
      const parsed = JSON.parse(fixedQuotes);
      if (parsed && typeof parsed === 'object') {
        return { data: parsed as T, wasRepaired: true, extractedThinking: thinking, rawText };
      }
    } catch {
      // Continue to Pass C
    }

    // Pass C: Auto-close truncated brackets/braces
    const closed = closeTruncatedJson(fixedQuotes);
    try {
      const parsed = JSON.parse(closed);
      if (parsed && typeof parsed === 'object') {
        return { data: parsed as T, wasRepaired: true, extractedThinking: thinking, rawText };
      }
    } catch {
      // Continue to next candidate
    }
  }

  throw new Error(`Failed to extract valid JSON from model response. Preview:\n${cleanText.slice(0, 300)}...`);
}
