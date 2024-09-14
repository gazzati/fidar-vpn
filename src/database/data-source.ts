import { DataSource } from "typeorm"

import config from "@root/config"

import { Client } from "@database/entities/Client"
import { Server } from "@database/entities/Server"
import logger from "@helpers/logger"

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.psqlHost,
  port: 5432,
  database: config.psqlDatabase,
  username: config.psqlUsername,
  password: config.psqlPassword,
  entities: [Server, Client],
  subscribers: [],
  migrations: [],
  synchronize: true
  //logging: false
})

AppDataSource.initialize()
  .then(() => logger.debug(`Connected to the database: ${config.psqlDatabase} \n`))
  .catch(error => console.error(error))

export const entities = {
  Server: AppDataSource.getRepository(Server),
  Client: AppDataSource.getRepository(Client)
}
