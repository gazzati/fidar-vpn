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
  id: string

  @Column()
  @Column()
  user_id: number

  @Column({ nullable: true })
  username: string

  @Column({ nullable: true })
  first_name: string

  @Column({ nullable: true })
  last_name: string

  @ManyToOne(() => Server, server => server.clients, {
    nullable: false
  })
  @JoinColumn({ name: "server_id", referencedColumnName: "id" })
  server: Server

  @Column()
  @CreateDateColumn()
  created_at: Date

  @Column()
  @UpdateDateColumn()
  updated_at: Date
}
