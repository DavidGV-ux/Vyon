export type JsonExtractionResult = { ok: true; value: unknown } | { ok: false; reason: string }

const FENCE_REGEX = /```(?:json|JSON)?\s*([\s\S]*?)```/g

function stripFences(text: string): string {
  let result = text
  const fences = [...text.matchAll(FENCE_REGEX)]
  if (fences.length > 0) {
    result = fences.map((m) => m[1] ?? '').join('\n')
  }
  return result
}

function findBalancedJson(input: string): string | null {
  const starts: number[] = []
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '{' || ch === '[') starts.push(i)
  }
  for (const start of starts) {
    const candidate = tryBalancedFrom(input, start)
    if (candidate !== null) return candidate
  }
  return null
}

function tryBalancedFrom(input: string, start: number): string | null {
  const open = input[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < input.length; i++) {
    const ch = input[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) {
        return input.slice(start, i + 1)
      }
    }
  }
  return null
}

function repairTrailingCommas(text: string): string {
  return text.replace(/,\s*([}\]])/g, '$1')
}

function repairComments(text: string): string {
  return text.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

export function extractJson(text: string): JsonExtractionResult {
  const cleaned = stripFences(text).trim()
  if (!cleaned) {
    return { ok: false, reason: 'empty response' }
  }

  const candidates = [cleaned, findBalancedJson(cleaned) ?? '']
  for (const candidate of candidates) {
    if (!candidate) continue
    const attempts = [candidate, repairTrailingCommas(candidate), repairTrailingCommas(repairComments(candidate))]
    for (const attempt of attempts) {
      try {
        const parsed = JSON.parse(attempt)
        return { ok: true, value: parsed }
      } catch {
        // try next
      }
    }
  }

  // Last resort: scan every balanced chunk
  const found = findBalancedJson(cleaned)
  if (found) {
    try {
      return { ok: true, value: JSON.parse(found) }
    } catch (error) {
      return { ok: false, reason: `JSON parse failed: ${error instanceof Error ? error.message : String(error)}` }
    }
  }
  return { ok: false, reason: 'no JSON object found in response' }
}
