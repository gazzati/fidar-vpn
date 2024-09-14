import "./aliases"

import { getClients } from "@api/index"

import { entities } from "@database/data-source"
import logger from "@helpers/logger"

class Worker {
  private logger = logger
  private readonly pauseSec = 60 * 5 // 5 min

  public async main() {
    this.logger.debug("Worker started")

    await this.sleep(5)

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.loop()

        await this.sleep()
      } catch (error) {
        this.logger.error(error)
      }
    }
  }

  private async loop() {
    const servers = await entities.Server.find({ where: { active: true } })

    for (const server of servers) {
      const clients = await getClients(server.ip)
      this.logger.debug(`Server [${server.name}] clients`, clients)

      const bdClients = await entities.Client.find({ where: { server: { id: server.id } } })
      const bdClientsUserIds = bdClients.map(client => client.user_id)

      this.logger.debug(`Server [${server.name}] DB users`, bdClientsUserIds)

      for (const client of clients) {
        if (!bdClientsUserIds.includes(client)) {
          // if client don`t exist in DB
          await entities.Client.save({ user_id: client, server: { id: server.id } })
        }
      }

      for (const userId of bdClientsUserIds) {
        if (!clients.includes(userId)) {
          // if DB client don`t exist in server clients list
          await entities.Client.delete({ user_id: userId, server: { id: server.id } })
        }
      }
    }
  }

  private async sleep(ms = this.pauseSec) {
    await new Promise(resolve => setTimeout(resolve, ms * 1000))
  }
}

new Worker().main()
