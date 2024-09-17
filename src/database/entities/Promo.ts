import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity({ name: "promo_codes" })
export class Promo {
  @PrimaryGeneratedColumn()
  id: number

  @Column()
  value: string

  @Column()
  months: number

  @Column()
  active: boolean

  @Column()
  @CreateDateColumn()
  created_at: Date

  @Column()
  @UpdateDateColumn()
  updated_at: Date
}
