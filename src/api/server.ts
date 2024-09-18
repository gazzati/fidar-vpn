import axios from "axios"

import config from "@root/config"

export interface CreateClientResponse {
  success: boolean
  conf: string
  qr: string
  already_exist?: boolean
  public_key?: string
}

export interface RevokeClientResponse {
  success: boolean
}

export const getClients = async (ip: string): Promise<Array<number>> => {
  const response = await axios.get(`http://${ip}:${config.serversPort}/clients`, { timeout: 5_000 })
  return response?.data || []
}

export const createClient = async (ip: string, id: number): Promise<CreateClientResponse> => {
  const response = await axios.post<CreateClientResponse>(
    `http://${ip}:${config.serversPort}/client`,
    { id },
    { timeout: 5_000 }
  )
  return response.data
}

export const revokeClient = async (ip: string, id: number): Promise<RevokeClientResponse> => {
  const result = await axios.delete<RevokeClientResponse>(`http://${ip}:${config.serversPort}/client/${id}`, {
    timeout: 5_000
  })
  return result.data
}
