import { Not } from "typeorm"

import { entities } from "@database/data-source"
import type { Client } from "@database/entities/Client"
import type { Server } from "@database/entities/Server"

import type { User, Chat } from "node-telegram-bot-api"

class DbService {
  public getClient(from: User): Promise<Client | null> {
    return entities.Client.findOne({ where: { user_id: from.id } })
  }

  public getClientWithServer(from: User): Promise<Client | null> {
    return entities.Client.findOne({ where: { user_id: from.id }, relations: { server: true } })
  }

  public saveClient(from: User, chat: Chat, serverId: number, expiredAt: Date): Promise<Client> {
    return entities.Client.save({
      user_id: from.id,
      chat_id: chat.id,
      server: { id: serverId },
      expired_at: expiredAt,
      ...(from.username && { username: from.username }),
      ...(from.first_name && { first_name: from.first_name }),
      ...(from.last_name && { last_name: from.last_name })
    })
  }

  public updateClientServer(from: User, serverId: number) {
    entities.Client.update(
      { user_id: from.id },
      {
        server: { id: serverId },
        ...(from.username && { username: from.username }),
        ...(from.first_name && { first_name: from.first_name }),
        ...(from.last_name && { last_name: from.last_name })
      }
    )
  }

  public updateClientExpiredAt(from: User, expiredAt: string) {
    entities.Client.update(
      { user_id: from.id },
      {
        expired_at: expiredAt,
        trial_used: true,
      }
    )
  }

  public getServer(name: string): Promise<Server | null> {
    return entities.Server.findOne({ where: { name } })
  }

  public getServersForClient(client: Client | null): Promise<Array<Server>> {
    return entities.Server.find({
      where: { active: true, ...(client && { id: Not(client.server.id) }) }
    })
  }
}

export default DbService
