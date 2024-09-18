import { sendMessage } from "@api/tg"
import { LessThan } from "typeorm"

import config from "@root/config"

import Base from "./base"

class ExpireReminder extends Base {
  public async loop() {
    const now = new Date()
    now.setDate(now.getDate() + 1)

    const clients = await this.entities.Client.find({
      where: { expired_at: LessThan(now), active: true },
      relations: { server: true }
    })

    this.logger.log(clients)

    for (const client of clients) {
      try {
        sendMessage(
          client.chat_id.toString(),
          !client.trial_used ? config.phrases.REMINDER_TRIAL_MESSAGE : config.phrases.REMINDER_SUBSCRIPTION_MESSAGE,
          [config.inlineKeyboardItem.pay, config.inlineKeyboardItem.main]
        )
      } catch (e) {
        this.logger.error(client.id, e)
      }
    }
  }
}

export default ExpireReminder
