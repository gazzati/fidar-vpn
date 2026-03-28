import TelegramBot, { type Message } from "node-telegram-bot-api"
import { Between } from "typeorm"

import { getClients, getPeersMetrics } from "@api/server"
import config from "@root/config"
import { AppDataSource, entities } from "@database/data-source"
import { formatAge, formatBytes, formatDateTime, getPeerHealthStatus, PeerHealthStatus } from "@helpers/peer-monitor"

enum SystemTelegramCommand {
  Help = "/help",
  Peer = "/peer",
  Status = "/status",
  Servers = "/servers"
}

const SYSTEM_COMMANDS: Array<string> = [
  SystemTelegramCommand.Help,
  SystemTelegramCommand.Peer,
  SystemTelegramCommand.Status,
  SystemTelegramCommand.Servers
]

class SystemCommandHandler {
  constructor(private bot: TelegramBot) {}

  public process() {
    this.bot
      .setMyCommands([
        { command: "help", description: "Показать список системных команд" },
        { command: "peer", description: "Текущий статус пира по client_id" },
        { command: "status", description: "Краткий статус приложения" },
        { command: "servers", description: "Проверить доступность VPN серверов" }
      ])
      .catch(() => null)

    this.bot.on("message", (message) => {
      this.handle(message)
    })
  }

  private async handle(message: Message) {
    const { text, chat } = message
    if (!text) return

    const [command] = text.trim().split(/\s+/)
    if (!SYSTEM_COMMANDS.includes(command)) return

    if (chat.id !== config.systemTelegramChatId) {
      await this.safeSend(chat.id, "⛔ Команда доступна только в системном чате.")
      return
    }

    switch (command) {
      case SystemTelegramCommand.Help:
        await this.safeSend(chat.id, this.getHelpMessage())
        return
      case SystemTelegramCommand.Peer:
        await this.safeSend(chat.id, await this.getPeerMessage(text))
        return
      case SystemTelegramCommand.Servers:
        await this.safeSend(chat.id, await this.getServersMessage())
        return
      case SystemTelegramCommand.Status:
        await this.safeSend(chat.id, await this.getStatusMessage())
        return
      default:
        return
    }
  }

  private getHelpMessage() {
    return [
      "Системные команды:",
      "/peer {client_id} - live-статус конкретного пира",
      "/status - общий статус приложения",
      "/servers - доступность VPN серверов",
      "/help - список команд"
    ].join("\n")
  }

  private async getStatusMessage() {
    const [health, stats] = await Promise.all([this.getHealthMessage(), this.getStatsMessage()])

    return ["📊 Статус приложения", `⏱ uptime: ${this.formatDuration(process.uptime())}`, "", health, "", stats].join(
      "\n"
    )
  }

  private async getHealthMessage() {
    if (!AppDataSource.isInitialized) {
      return "🩺 Health\n❌ БД не инициализирована"
    }

    try {
      await AppDataSource.query("SELECT 1")
      return "🩺 Health\n✅ БД доступна"
    } catch (e: any) {
      return `🩺 Health\n❌ БД недоступна: ${e?.message || "unknown error"}`
    }
  }

  private async getStatsMessage() {
    if (!AppDataSource.isInitialized) {
      return "📦 Stats\n❌ БД не инициализирована"
    }

    const now = new Date()
    const nextDay = new Date(now)
    nextDay.setDate(nextDay.getDate() + 1)

    const [totalClients, activeClients, expiringClients, totalServers, activeServers] = await Promise.all([
      entities.Client.count(),
      entities.Client.countBy({ active: true }),
      entities.Client.countBy({ active: true, expired_at: Between(now, nextDay) }),
      entities.Server.count(),
      entities.Server.countBy({ active: true })
    ])

    return [
      "📦 Stats",
      `👥 clients: total=${totalClients}, active=${activeClients}`,
      `⏳ expiring_24h: ${expiringClients}`,
      `🌍 servers: total=${totalServers}, active=${activeServers}`
    ].join("\n")
  }

  private async getServersMessage() {
    if (!AppDataSource.isInitialized) {
      return "🌍 Servers\n❌ БД не инициализирована"
    }

    const activeServers = await entities.Server.find({
      where: { active: true },
      order: { id: "ASC" }
    })

    if (!activeServers.length) {
      return "🌍 Servers\n⚠️ Нет активных серверов"
    }

    const checks = await Promise.all(
      activeServers.map(async (server) => {
        try {
          const clients = await getClients(server.ip)
          return `✅ ${server.name} (${server.ip}) clients=${clients.length}`
        } catch {
          return `❌ ${server.name} (${server.ip}) unavailable`
        }
      })
    )

    return ["🌍 Servers", ...checks].join("\n")
  }

  private async getPeerMessage(text: string) {
    if (!AppDataSource.isInitialized) {
      return "🔎 Peer\n❌ БД не инициализирована"
    }

    const [, rawClientId] = text.trim().split(/\s+/)
    const clientId = Number(rawClientId)

    if (!clientId) {
      return "🔎 Peer\n⚠️ Использование: /peer {client_id}"
    }

    const client = await entities.Client.findOne({
      where: { id: clientId },
      relations: { server: true }
    })

    if (!client) {
      return `🔎 Peer\n❌ Клиент ${clientId} не найден`
    }

    if (!client.server) {
      return `🔎 Peer\n❌ У клиента ${clientId} не найден сервер`
    }

    if (!client.public_key) {
      return `🔎 Peer\n❌ У клиента ${clientId} не сохранен public_key`
    }

    try {
      const response = await getPeersMetrics(client.server.ip)
      const peer = response.peers.find((item) => item.public_key === client.public_key)

      if (!peer) {
        return [
          `🔎 Peer ${client.id}`,
          `👤 user_id=${client.user_id}`,
          `🌍 server=${client.server.name} (${client.server.ip})`,
          `📅 expires=${formatDateTime(client.expired_at)}`,
          `🔑 public_key=${client.public_key}`,
          "❌ peer отсутствует на сервере"
        ].join("\n")
      }

      const status = this.getPeerStatusLabel(peer)

      return [
        `🔎 Peer ${client.id}`,
        `👤 user_id=${client.user_id}`,
        `🌍 server=${client.server.name} (${client.server.ip})`,
        `✅ client_active=${client.active ? "yes" : "no"}`,
        `📅 expires=${formatDateTime(client.expired_at)}`,
        `📡 status=${status}`,
        `🤝 handshake=${formatDateTime(peer.latest_handshake_at)} (${formatAge(peer.latest_handshake_at)})`,
        `🌐 endpoint=${peer.endpoint || "unknown"}`,
        `⬇️ rx=${formatBytes(peer.rx_bytes)}`,
        `⬆️ tx=${formatBytes(peer.tx_bytes)}`,
        `🛣 allowed_ips=${peer.allowed_ips}`,
        `🕒 server_time=${formatDateTime(response.server_time)}`
      ].join("\n")
    } catch (e: any) {
      return [
        `🔎 Peer ${client.id}`,
        `🌍 server=${client.server.name} (${client.server.ip})`,
        `❌ не удалось получить метрики: ${e?.message || "unknown error"}`
      ].join("\n")
    }
  }

  private getPeerStatusLabel(peer: Awaited<ReturnType<typeof getPeersMetrics>>["peers"][number]) {
    const status = getPeerHealthStatus(peer)

    switch (status) {
      case PeerHealthStatus.Healthy:
        return "healthy"
      case PeerHealthStatus.Stale:
        return "stale"
      case PeerHealthStatus.NeverConnected:
        return "never_connected"
      default:
        return "unknown"
    }
  }

  private formatDuration(secondsRaw: number) {
    const seconds = Math.floor(secondsRaw)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const restSeconds = seconds % 60

    return `${hours}h ${minutes}m ${restSeconds}s`
  }

  private async safeSend(chatId: number, text: string) {
    try {
      await this.bot.sendMessage(chatId, text)
    } catch {
      // noop
    }
  }
}

export default SystemCommandHandler
