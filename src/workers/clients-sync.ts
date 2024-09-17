import {getClients} from '@root/api/server';

import {entities} from '@database/data-source';

import Base from './base.js'

class ClientsSync extends Base {
  public async loop() {
    const servers = await entities.Server.find({ where: { active: true } })

    for (const server of servers) {
      const clients = await getClients(server.ip)
      this.logger.log(`Server [${server.name}] clients`, clients)

      const bdClients = await entities.Client.find({ where: { server: { id: server.id } } })
      const bdClientsUserIds = bdClients.map(client => client.user_id)

      this.logger.log(`Server [${server.name}] DB users`, bdClientsUserIds)

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
}

export default ClientsSync
