import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm"

@Entity({ name: "blacklist" })
export class Blacklist {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true, type: "bigint" })
  user_id: number

  @Column()
  @CreateDateColumn()
  created_at: Date

  @Column()
  @UpdateDateColumn()
  updated_at: Date
}
