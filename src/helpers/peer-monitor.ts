import type { PeerMetrics } from "@api/server"

// Peer считается "застоявшимся", если за это время не было нового handshake.
export const STALE_HANDSHAKE_SEC = 60 * 30

// После создания клиента ждём этот период, прежде чем алертить, что peer отсутствует на сервере.
export const NEW_CLIENT_GRACE_SEC = 60 * 30

export enum PeerHealthStatus {
  Healthy = "healthy",
  Stale = "stale",
  NeverConnected = "never_connected"
}

export const getPeerHealthStatus = (peer: PeerMetrics, now = new Date()): PeerHealthStatus => {
  if (!peer.latest_handshake_at) return PeerHealthStatus.NeverConnected

  const handshakeAt = new Date(peer.latest_handshake_at)
  const ageSec = Math.floor((now.getTime() - handshakeAt.getTime()) / 1000)

  if (ageSec > STALE_HANDSHAKE_SEC) return PeerHealthStatus.Stale
  return PeerHealthStatus.Healthy
}

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"

  const units = ["B", "KB", "MB", "GB", "TB"]
  let value = bytes
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  const digits = value >= 10 || index === 0 ? 0 : 1
  return `${value.toFixed(digits)} ${units[index]}`
}

export const formatDateTime = (value?: string | Date | null): string => {
  if (!value) return "never"

  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return "unknown"

  return `${date.toLocaleDateString("ru-RU")} ${date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  })}`
}

export const formatAge = (value?: string | Date | null, now = new Date()): string => {
  if (!value) return "never"

  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return "unknown"

  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))
  const hours = Math.floor(diffSec / 3600)
  const minutes = Math.floor((diffSec % 3600) / 60)
  const seconds = diffSec % 60

  if (hours > 0) return `${hours}h ${minutes}m ago`
  if (minutes > 0) return `${minutes}m ${seconds}s ago`
  return `${seconds}s ago`
}
