import { randomUUID } from 'node:crypto'
import type { IdGenerator } from '../../domain/shared/ports.js'

export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID()
  }
}
