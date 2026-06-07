import { whepClient } from '@/api/client'
import { useSystemStore } from '@/store/systemStore'

export const connectWhep = async (video: HTMLVideoElement): Promise<() => void> => {
  const pc = new RTCPeerConnection()
  let stopped = false

  pc.addTransceiver('video', { direction: 'recvonly' })

  pc.ontrack = (event) => {
    const [stream] = event.streams
    if (stream) {
      video.srcObject = stream
      void video.play().catch(() => undefined)
      useSystemStore.getState().setVideoConnected(true)
    }
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      useSystemStore.getState().setVideoConnected(false)
    }
  }

  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)

  try {
    const { data: answerSdp } = await whepClient.post<string>(
      '/rover/whep',
      offer.sdp ?? '',
    )
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
    useSystemStore.getState().setVideoConnected(true)
  } catch {
    useSystemStore.getState().setVideoConnected(false)
    throw new Error('WHEP connection failed')
  }

  return () => {
    if (stopped) return
    stopped = true
    pc.close()
    video.srcObject = null
    useSystemStore.getState().setVideoConnected(false)
  }
}
