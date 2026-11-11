import type { ParsedData } from '../../domain/ai/entities.js'
import type { OutputKind } from '../../domain/ai/value-objects.js'
import type { Result } from '../../domain/shared/result.js'
import type { AppError } from '../../domain/shared/errors.js'

export interface OutputParserPort {
  parse(outputKind: OutputKind, raw: unknown): Result<ParsedData, AppError>
}
