import { useCallback, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'stopped'

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [audioBase64, setAudioBase64] = useState<string | null>(null)
  const [mediaType, setMediaType] = useState<string>('audio/webm')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    const recorder = new MediaRecorder(stream, { mimeType: mime })
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mime })
      setMediaType(mime.split(';')[0] ?? 'audio/webm')
      const buf = await blob.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      setAudioBase64(base64)
      stream.getTracks().forEach((t) => t.stop())
    }
    recorder.start()
    recorderRef.current = recorder
    setState('recording')
  }, [])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    setState('stopped')
  }, [])

  const reset = useCallback(() => {
    setAudioBase64(null)
    setState('idle')
  }, [])

  return { state, audioBase64, mediaType, start, stop, reset }
}
