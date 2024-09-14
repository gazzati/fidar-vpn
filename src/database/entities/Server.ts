import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"

import { Client } from "./Client"

@Entity({ name: "servers" })
export class Server {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  name: string

  @Column()
  ip: string

  @Column({ default: true })
  active: boolean

  @OneToMany(() => Client, client => client.server)
  clients: Array<Client>

  @Column()
  @CreateDateColumn()
  created_at: Date

  @Column()
  @UpdateDateColumn()
  updated_at: Date
}
