import { Not } from "typeorm"

import { entities } from "@database/data-source"
import type { Client } from "@database/entities/Client"
import type { Promo } from "@database/entities/Promo"
import type { Server } from "@database/entities/Server"
import { getTrialExpiredAt } from "@helpers/date"

import type { User, Chat } from "node-telegram-bot-api"

class DbService {
  public getClient(from: User): Promise<Client | null> {
    return entities.Client.findOne({ where: { user_id: from.id } })
  }

  public getClientWithServer(from: User): Promise<Client | null> {
    return entities.Client.findOne({ where: { user_id: from.id }, relations: { server: true } })
  }

  public saveClient(from: User, chat: Chat, serverId: number, publicKey: string): Promise<Client> {
    const expiredAt = getTrialExpiredAt()

    return entities.Client.save({
      user_id: from.id,
      chat_id: chat.id,
      server: { id: serverId },
      public_key: publicKey,
      expired_at: expiredAt,
      ...(from.username && { username: from.username }),
      ...(from.first_name && { first_name: from.first_name }),
      ...(from.last_name && { last_name: from.last_name })
    })
  }

  public updateClientServer(from: User, serverId: number, publicKey: string) {
    entities.Client.update(
      { user_id: from.id },
      {
        server: { id: serverId },
        public_key: publicKey,
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
        trial_used: true
      }
    )
  }

  public getServer(name: string): Promise<Server | null> {
    return entities.Server.findOne({ where: { name, active: true } })
  }

  public getDefaultServer(): Promise<Server | null> {
    return entities.Server.findOne({ where: { default: true } })
  }

  public getServersForClient(client: Client | null): Promise<Array<Server>> {
    return entities.Server.find({
      where: { active: true, ...(client?.server && { id: Not(client.server.id) }) }
    })
  }

  public async getMatchedPromo(value: string): Promise<Promo | null> {
    const promo = await entities.Promo.findOne({ where: { active: true, value } })
    if (!promo) return null

    promo.active = false
    await entities.Promo.save(promo)

    return promo
  }
}

export default DbService
