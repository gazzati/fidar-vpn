import { DataSource } from "typeorm"

import config from "@root/config"

import { Blacklist } from "@database/entities/Blacklist"
import { Client } from "@database/entities/Client"
import { Payment } from "@database/entities/Payment"
import { Promo } from "@database/entities/Promo"
import { Server } from "@database/entities/Server"
import { log, error } from "@helpers/logger"

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.psqlHost,
  port: 5432,
  database: config.psqlDatabase,
  username: config.psqlUsername,
  password: config.psqlPassword,
  entities: [Server, Client, Promo, Payment, Blacklist],
  subscribers: [],
  migrations: [],
  synchronize: true
  //logging: false
})

AppDataSource.initialize()
  .then(() => log(`💾 Connected to the database: ${config.psqlDatabase} \n`))
  .catch((e) => error(e))

export const entities = {
  Blacklist: AppDataSource.getRepository(Blacklist),
  Server: AppDataSource.getRepository(Server),
  Client: AppDataSource.getRepository(Client),
  Promo: AppDataSource.getRepository(Promo),
  Payment: AppDataSource.getRepository(Payment)
}
