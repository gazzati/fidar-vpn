import axios from "axios"

import config from "@root/config"

import { error } from "@helpers/logger"

export interface CreateClientResponse {
  success: boolean
  conf: string
  qr: string
  already_exist?: boolean
  public_key: string
}

export interface RevokeClientResponse {
  success: boolean
}

export interface PeerMetrics {
  public_key: string
  preshared_key: string | null
  endpoint: string | null
  allowed_ips: string
  latest_handshake_at: string | null
  rx_bytes: number
  tx_bytes: number
  persistent_keepalive: number | null
}

export interface PeersMetricsResponse {
  success: boolean
  peers: Array<PeerMetrics>
  server_time: string
}

export const getClients = async (ip: string): Promise<Array<number>> => {
  const response = await axios.get(`http://${ip}:${config.serversPort}/clients`, { timeout: 5_000 })
  return response?.data || []
}

export const createClient = async (ip: string, id: number): Promise<CreateClientResponse> => {
  try {
    const response = await axios.post<CreateClientResponse>(
      `http://${ip}:${config.serversPort}/client`,
      { id },
      { timeout: 5_000 }
    )
    return response.data
  } catch (e: any) {
    error(`Server ID [${id}]`, e.response?.data)
    throw new Error(e.message)
  }
}

export const getPeersMetrics = async (ip: string): Promise<PeersMetricsResponse> => {
  const response = await axios.get<PeersMetricsResponse>(`http://${ip}:${config.serversPort}/peers`, {
    timeout: 5_000
  })

  return response.data
}

export const disableClient = async (ip: string, id: number): Promise<void> => {
  try {
    await axios.delete<RevokeClientResponse>(`http://${ip}:${config.serversPort}/client/${id}`, {
      timeout: 5_000
    })
  } catch (e: any) {
    error(`Server ID [${id}]`, e.response?.data)
  }
}

export const enableClient = async (ip: string, id: number, publicKey: string): Promise<RevokeClientResponse> => {
  try {
    const response = await axios.post<RevokeClientResponse>(
      `http://${ip}:${config.serversPort}/client/enable`,
      { id, public_key: publicKey },
      { timeout: 5_000 }
    )
    return response.data
  } catch (e: any) {
    error(`Server ID [${id}]`, e.response?.data)
    throw new Error(e.message)
  }
}
