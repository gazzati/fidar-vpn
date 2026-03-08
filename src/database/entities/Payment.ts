import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from "typeorm"

import { Client } from "./Client"

@Entity({ name: "payments" })
export class Payment {
  @PrimaryGeneratedColumn()
  id: number

  @ManyToOne(() => Client, { nullable: false })
  @JoinColumn({ name: "client_id", referencedColumnName: "id" })
  client: Client

  @Column({ type: "integer" })
  amount: number

  @Column()
  currency: string

  @Column({ type: "integer" })
  months: number

  @Column()
  paid_until: Date

  @Column({ nullable: true })
  invoice_payload: string

  @Column({ unique: true })
  telegram_payment_charge_id: string

  @Column({ nullable: true })
  provider_payment_charge_id: string

  @Column()
  @CreateDateColumn()
  created_at: Date

  @Column()
  @UpdateDateColumn()
  updated_at: Date
}
