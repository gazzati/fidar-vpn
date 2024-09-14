import axios from "axios"

import config from "@root/config"

export interface CreateClientResponse {
  success: boolean
  conf: string
  qr: string
  already_exist?: boolean
}

export const getClients = async (ip: string): Promise<Array<number>> => {
  const response = await axios.get(`http://${ip}:${config.serversPort}/clients`)
  return response?.data || []
}

export const createClient = async (ip: string, id: number): Promise<CreateClientResponse> => {
  const response = await axios.post<CreateClientResponse>(`http://${ip}:${config.serversPort}/client`, { id })
  return response.data
}

export const revokeClient = async (ip: string, id: number) => {
  const result = await axios.delete(`http://${ip}:${config.serversPort}/client/${id}`)
  return result
}

