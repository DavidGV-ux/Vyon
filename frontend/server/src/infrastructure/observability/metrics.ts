import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client'
import type { MetricsPort } from '../../domain/shared/ports.js'

export type MetricsRegistry = {
  readonly registry: Registry
  readonly metrics: MetricsPort
}

export function createMetricsRegistry(enabled: boolean): MetricsRegistry {
  const registry = new Registry()
  if (enabled) {
    collectDefaultMetrics({ register: registry })
  }

  const counters = new Map<string, Counter>()
  const histograms = new Map<string, Histogram>()
  const gauges = new Map<string, Gauge>()

  const metrics: MetricsPort = {
    increment(name, labels, value) {
      if (!enabled) return
      let c = counters.get(name)
      if (!c) {
        c = new Counter({ name, help: name, labelNames: Object.keys(labels ?? {}), registers: [registry] })
        counters.set(name, c)
      }
      c.inc(labels ?? {}, value ?? 1)
    },
    observe(name, value, labels) {
      if (!enabled) return
      let h = histograms.get(name)
      if (!h) {
        h = new Histogram({ name, help: name, labelNames: Object.keys(labels ?? {}), buckets: [50, 100, 250, 500, 1000, 2000, 4000, 8000], registers: [registry] })
        histograms.set(name, h)
      }
      h.observe(labels ?? {}, value)
    },
    gauge(name, value, labels) {
      if (!enabled) return
      let g = gauges.get(name)
      if (!g) {
        g = new Gauge({ name, help: name, labelNames: Object.keys(labels ?? {}), registers: [registry] })
        gauges.set(name, g)
      }
      g.set(labels ?? {}, value)
    },
  }

  return { registry, metrics }
}
