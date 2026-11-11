import type { Request, Response, NextFunction } from 'express'
import type { AuthPort, AuthUser } from '../../auth/supabase-auth.js'
import { UnauthorizedError } from '../../../domain/shared/errors.js'
import { AppError } from '../../../domain/shared/errors.js'

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser | null
    }
  }
}

export function makeAuthMiddleware(auth: AuthPort, required: boolean) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
    if (!token) {
      if (required) {
        next(new UnauthorizedError('Missing bearer token'))
        return
      }
      req.authUser = null
      next()
      return
    }
    const user = await auth.authenticate(token)
    if (required && !user) {
      next(new UnauthorizedError('Invalid or expired token'))
      return
    }
    req.authUser = user
    next()
  }
}

export function errorHandlerPassthrough(err: unknown, _req: Request, _res: Response, next: NextFunction): void {
  next(err instanceof AppError ? err : new AppError({ code: 'INTERNAL_ERROR', message: String(err) }))
}
