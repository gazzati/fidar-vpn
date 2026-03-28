import { getPeersMetrics } from "@api/server"
import { entities } from "@database/data-source"
import type { Client } from "@database/entities/Client"
import { sendMessage } from "@api/systemTg"
import { getPeerHealthStatus, NEW_CLIENT_GRACE_SEC, PeerHealthStatus } from "@helpers/peer-monitor"

import Base from "./base"

type ServerState = {
  healthyPeers: number
  unavailable: boolean
  zeroHealthyPeers: boolean
}

class PeerMonitor extends Base {
  private serverStates = new Map<number, ServerState>()
  private peerMissingAlerts = new Set<number>()

  public async loop() {
    const [servers, clients] = await Promise.all([
      entities.Server.find({ where: { active: true }, order: { id: "ASC" } }),
      entities.Client.find({ where: { active: true }, relations: { server: true } })
    ])

    this.logger.log(`Run started: servers=${servers.length}, active_clients=${clients.length}`)

    let hasProblems = false

    for (const server of servers) {
      const serverClients = clients.filter((client) => client.server?.id === server.id && client.public_key)

      this.logger.log(`Checking server=${server.name} ip=${server.ip} clients=${serverClients.length}`)

      try {
        const metrics = await getPeersMetrics(server.ip)
        const peersMap = new Map(metrics.peers.map((peer) => [peer.public_key, peer]))
        const healthyPeers = metrics.peers.filter(
          (peer) => getPeerHealthStatus(peer) === PeerHealthStatus.Healthy
        ).length

        this.logger.log(`Server metrics: server=${server.name} peers=${metrics.peers.length} healthy=${healthyPeers}`)

        await this.handleServerRecovered(server.id, server.name)
        await this.handleZeroHealthyPeers(server.id, server.name, serverClients.length, healthyPeers)
        if (this.serverStates.get(server.id)?.zeroHealthyPeers) hasProblems = true

        for (const client of serverClients) {
          const peer = peersMap.get(client.public_key)

          if (!peer) {
            hasProblems = true
            await this.handleMissingPeer(server.name, client)
            continue
          }

          this.peerMissingAlerts.delete(client.id)
        }
      } catch (e: any) {
        hasProblems = true
        await this.handleServerUnavailable(server.id, server.name, server.ip, e?.message)
      }
    }

    if (!hasProblems) {
      this.logger.log("Run finished: all good")
      return
    }

    this.logger.log("Run finished: problems detected")
  }

  private async handleServerUnavailable(serverId: number, serverName: string, serverIp: string, message?: string) {
    const current = this.serverStates.get(serverId) || { healthyPeers: 0, unavailable: false, zeroHealthyPeers: false }
    if (current.unavailable) return

    this.serverStates.set(serverId, { ...current, unavailable: true })
    await sendMessage(
      `🚨 VPN server unavailable\nserver=${serverName}\nip=${serverIp}\nerror=${message || "unknown error"}`
    )
  }

  private async handleServerRecovered(serverId: number, serverName: string) {
    const current = this.serverStates.get(serverId)
    if (!current?.unavailable) return

    this.serverStates.set(serverId, { ...current, unavailable: false })
    await sendMessage(`✅ VPN server recovered\nserver=${serverName}`)
  }

  private async handleZeroHealthyPeers(
    serverId: number,
    serverName: string,
    configuredClients: number,
    healthyPeers: number
  ) {
    const current = this.serverStates.get(serverId) || { healthyPeers: 0, unavailable: false, zeroHealthyPeers: false }
    const shouldAlert = configuredClients >= 3 && current.healthyPeers > 0 && healthyPeers === 0

    if (shouldAlert && !current.zeroHealthyPeers) {
      this.serverStates.set(serverId, { ...current, healthyPeers, zeroHealthyPeers: true })
      await sendMessage(
        `⚠️ Peer activity dropped to zero\nserver=${serverName}\nconfigured_clients=${configuredClients}\nhealthy_peers=${healthyPeers}`
      )
      return
    }

    if (!shouldAlert && current.zeroHealthyPeers) {
      this.serverStates.set(serverId, { ...current, healthyPeers, zeroHealthyPeers: false })
      await sendMessage(`✅ Peer activity restored\nserver=${serverName}\nhealthy_peers=${healthyPeers}`)
      return
    }

    this.serverStates.set(serverId, { ...current, healthyPeers, zeroHealthyPeers: shouldAlert })
  }

  private async handleMissingPeer(serverName: string, client: Client) {
    if (this.peerMissingAlerts.has(client.id)) return

    const clientAgeSec = Math.floor((Date.now() - new Date(client.created_at).getTime()) / 1000)
    if (clientAgeSec < NEW_CLIENT_GRACE_SEC) return

    this.peerMissingAlerts.add(client.id)

    await sendMessage(
      [
        "⚠️ Peer missing on server",
        `client_id=${client.id}`,
        `user_id=${client.user_id}`,
        `server=${serverName}`,
        `public_key=${client.public_key}`
      ].join("\n")
    )
  }
}

export default PeerMonitor
