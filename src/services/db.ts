import { Not } from "typeorm"

import { entities } from "@database/data-source"
import type { Client } from "@database/entities/Client"
import type { Promo } from "@database/entities/Promo"
import type { Server } from "@database/entities/Server"
import { getTrialExpiredAt } from "@helpers/date"

import type { User, Chat } from "node-telegram-bot-api"

class DbService {
  public async isBlacklisted(userId: number): Promise<boolean> {
    const blacklisted = await entities.Blacklist.exist({ where: { user_id: userId } })
    return blacklisted
  }

  public async getClient(from: User): Promise<Client | null> {
    return await entities.Client.findOne({ where: { user_id: from.id } })
  }

  public async getClientWithServer(from: User): Promise<Client | null> {
    return await entities.Client.findOne({ where: { user_id: from.id }, relations: { server: true } })
  }

  public async getClientByUserId(userId: number): Promise<Client | null> {
    return await entities.Client.findOne({ where: { user_id: userId } })
  }

  public async getClientWithServerByUserId(userId: number): Promise<Client | null> {
    return await entities.Client.findOne({ where: { user_id: userId }, relations: { server: true } })
  }

  public async saveClient(from: User, chat: Chat, serverId: number, publicKey: string): Promise<Client> {
    const expiredAt = getTrialExpiredAt()

    return await entities.Client.save({
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

  public async updateClientServer(from: User, serverId: number, publicKey: string): Promise<boolean> {
    const result = await entities.Client.update(
      { user_id: from.id },
      {
        server: { id: serverId },
        public_key: publicKey,
        ...(from.username && { username: from.username }),
        ...(from.first_name && { first_name: from.first_name }),
        ...(from.last_name && { last_name: from.last_name })
      }
    )

    return result.affected === 1
  }

  public async updateClientExpiredAt(userId: number, expiredAt: string): Promise<boolean> {
    const result = await entities.Client.update(
      { user_id: userId },
      {
        expired_at: expiredAt,
        trial_used: true,
        active: true,
        was_reminded: false
      }
    )

    return result.affected === 1
  }

  public async savePayment(data: {
    clientId: number
    amount: number
    currency: string
    months: number
    paidUntil: string
    invoicePayload?: string
    telegramPaymentChargeId: string
    providerPaymentChargeId?: string
  }): Promise<boolean> {
    await entities.Payment.upsert(
      {
        client: { id: data.clientId },
        amount: data.amount,
        currency: data.currency,
        months: data.months,
        paid_until: data.paidUntil,
        ...(data.invoicePayload && { invoice_payload: data.invoicePayload }),
        telegram_payment_charge_id: data.telegramPaymentChargeId,
        ...(data.providerPaymentChargeId && { provider_payment_charge_id: data.providerPaymentChargeId })
      },
      { conflictPaths: ["telegram_payment_charge_id"], skipUpdateIfNoValuesChanged: true }
    )

    return true
  }

  public async hasPayment(telegramPaymentChargeId: string): Promise<boolean> {
    return await entities.Payment.exist({ where: { telegram_payment_charge_id: telegramPaymentChargeId } })
  }

  public async getServer(name: string): Promise<Server | null> {
    return await entities.Server.findOne({ where: { name, active: true } })
  }

  public async getDefaultServer(): Promise<Server | null> {
    return await entities.Server.findOne({ where: { default: true } })
  }

  public async getServersForClient(client: Client | null): Promise<Array<Server>> {
    return await entities.Server.find({
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
