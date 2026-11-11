import { useState } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { ApiClient } from '../infrastructure/http/api-client.js'
import { AnalyzeDocumentUseCase } from '../application/analyze-document.js'
import type { OutputKind, MultimodalInput } from '../domain/assistant.js'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { Loader2, Mic, Square, Sparkles } from 'lucide-react'

const client = new ApiClient()
const useCase = new AnalyzeDocumentUseCase(client)

const KINDS: { value: OutputKind; label: string }[] = [
  { value: 'finanzas', label: 'Finanzas' },
  { value: 'tareas', label: 'Tareas' },
  { value: 'resumenes', label: 'Resúmenes' },
]

export default function Assistant() {
  const [kind, setKind] = useState<OutputKind>('resumenes')
  const [text, setText] = useState('')
  const [result, setResult] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recorder = useAudioRecorder()

  async function run(input: MultimodalInput) {
    setLoading(true)
    setError(null)
    try {
      const r = await useCase.run(kind, input, 'es')
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function handleText() {
    if (!text.trim()) return
    await run({ text })
  }

  async function handleAudio() {
    if (!recorder.audioBase64) return
    const tr = await client.transcribe(recorder.audioBase64, recorder.mediaType, 'es')
    await run({ text: tr.text })
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Asistente IA <span className="vyon-gradient-text">multimodal</span>
          </h1>
          <p className="mt-2 text-white/60">Prompt Maestro con parser JSON: finanzas, tareas y resúmenes.</p>
        </div>

        <div className="vyon-card p-6 space-y-4">
          <div className="flex gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => setKind(k.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  kind === k.value ? 'bg-vyon-gradient text-vyon-dark' : 'bg-vyon-slate text-white/70 hover:text-white'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Pega texto, un transcript o una descripción..."
            className="vyon-input w-full min-h-[120px]"
          />

          <div className="flex items-center gap-3">
            <button onClick={handleText} disabled={loading || !text.trim()} className="vyon-btn-primary flex items-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Analizar texto
            </button>

            <button
              onClick={recorder.state === 'recording' ? recorder.stop : recorder.start}
              className="vyon-btn-secondary flex items-center gap-2"
            >
              {recorder.state === 'recording' ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {recorder.state === 'recording' ? 'Detener' : 'Grabar audio'}
            </button>

            {recorder.audioBase64 && (
              <button onClick={handleAudio} disabled={loading} className="vyon-btn-secondary disabled:opacity-50">
                Transcribir y analizar
              </button>
            )}
            {recorder.audioBase64 && (
              <button onClick={recorder.reset} className="text-sm text-white/40 hover:text-white">
                Descartar audio
              </button>
            )}
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}

          {result !== null && (
            <pre className="bg-vyon-slate/60 rounded-xl p-4 text-xs overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
