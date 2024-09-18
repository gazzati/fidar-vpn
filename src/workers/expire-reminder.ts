import { sendMessage } from "@api/tg"
import { LessThan } from "typeorm"

import config from "@root/config"

import Base from "./base"

class ExpireReminder extends Base {
  public async loop() {
    const now = new Date()
    now.setDate(now.getDate() + 1)

    const clients = await this.entities.Client.find({
      where: { expired_at: LessThan(now), active: true, was_reminded: false },
      relations: { server: true }
    })

    this.logger.log(clients)

    for (const client of clients) {
      try {
        this.entities.Client.update(
          { user_id: client.user_id },
          {
            was_reminded: true
          }
        )

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
