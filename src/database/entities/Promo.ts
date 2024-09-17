import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm"

import { PayTariff } from "@interfaces/pay"

@Entity({ name: "promo_codes" })
export class Promo {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  value: string

  @Column()
  months: PayTariff

  @Column()
  active: boolean

  @Column()
  @CreateDateColumn()
  created_at: Date

  @Column()
  @UpdateDateColumn()
  updated_at: Date
}
