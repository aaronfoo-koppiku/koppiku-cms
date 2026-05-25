// apps/tv-player/src/App.tsx
import { useDevice } from './hooks/useDevice'
import { PairingScreen } from './components/PairingScreen'
import { PlayerScreen } from './components/PlayerScreen'

export default function App() {
  const { deviceId, outletId, pairingCode } = useDevice()

  if (!outletId) return <PairingScreen pairingCode={pairingCode} />
  return <PlayerScreen deviceId={deviceId} outletId={outletId} />
}
