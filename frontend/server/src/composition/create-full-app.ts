import express from 'express'
import { createHttpApp } from '../infrastructure/http/http-app.js'
import type { HttpAppDeps } from '../infrastructure/http/http-app.js'
import { createBillingModule } from './billing-module.js'
import type { BillingModule, BillingModuleDeps } from './billing-module.js'

export type FullAppDeps = HttpAppDeps & {
  readonly billing?: Partial<Omit<BillingModuleDeps, 'clock' | 'idGenerator' | 'logger' | 'metrics'>>
}

export type FullApp = {
  readonly app: express.Express
  readonly billing: BillingModule
}

/**
 * Envuelve la app HTTP principal con el módulo de billing
 * (MECL-041 paywall, MECL-042 facturas PDF, MECL-043 audio Pro,
 * MECL-044 pagos) sin modificar el interior de createHttpApp.
 */
export function createFullApp(deps: FullAppDeps): FullApp {
  const innerApp = createHttpApp(deps)

  const billing = createBillingModule({
    clock: deps.clock,
    idGenerator: deps.idGenerator,
    logger: deps.logger,
    metrics: deps.metrics,
    corsOrigin: deps.config.corsOrigin,
    ...deps.billing,
  })

  const app = express()
  app.disable('x-powered-by')
  app.use('/api/v1', billing.router)
  app.use(innerApp)

  return { app, billing }
}
