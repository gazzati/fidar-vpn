import { disableClient } from "@api/server"
import { sendMessage } from "@api/tg"
import { LessThan } from "typeorm"

import config from "@root/config"

import Base from "./base"

class ClientsCleaner extends Base {
  public async loop() {
    const clients = await this.entities.Client.find({
      where: { expired_at: LessThan(new Date()), active: true },
      relations: { server: true }
    })
    this.logger.log(clients)

    for (const client of clients) {
      if (!client?.server?.ip) {
        this.logger.error("Not found server for user", client)
        continue
      }

      const userId = client.user_id

      try {
        disableClient(client.server.ip, userId)

        this.entities.Client.update(
          { user_id: userId },
          {
            active: false,
            trial_used: true
          }
        )

        sendMessage(
          client.chat_id.toString(),
          !client.trial_used ? config.phrases.EXPIRED_TRIAL_MESSAGE : config.phrases.EXPIRED_SUBSCRIPTION_MESSAGE,
          [config.inlineKeyboardItem.pay, config.inlineKeyboardItem.main]
        )
      } catch (e) {
        this.logger.error(client.id, e)
      }
    }
  }
}

export default ClientsCleaner
