import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from "typeorm"

import { Server } from "./Server"

@Entity({ name: "clients" })
export class Client {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true, type: "bigint" })
  user_id: number

  @Column({ type: "bigint" })
  chat_id: number

  @Column({ nullable: true })
  username: string

  @Column({ nullable: true })
  first_name: string

  @Column({ nullable: true })
  last_name: string

  @ManyToOne(() => Server, server => server.clients, {
    nullable: true
  })
  @JoinColumn({ name: "server_id", referencedColumnName: "id" })
  server: Server

  @Column({ nullable: true })
  public_key: string

  @Column()
  expired_at: Date

  @Column({ default: false })
  trial_used: boolean

  @Column()
  @CreateDateColumn()
  created_at: Date

  @Column()
  @UpdateDateColumn()
  updated_at: Date
}
