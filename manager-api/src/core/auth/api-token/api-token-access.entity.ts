import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { ApiToken } from "./api-token.entity";

@Entity({ name: "api_token_access" })
@Index("idx_api_token_access_token_created", ["tokenId", "createdAt"])
export class ApiTokenAccess {
  @PrimaryGeneratedColumn({ name: "id", type: "bigint" })
  id!: string;

  @Column({ name: "token_id", type: "int" })
  tokenId!: number;

  @ManyToOne(() => ApiToken, { onDelete: "CASCADE" })
  @JoinColumn({ name: "token_id" })
  token!: ApiToken;

  @Column({ name: "method", type: "varchar", length: 10 })
  method!: string;

  @Column({ name: "route", type: "varchar", length: 512 })
  route!: string;

  @Column({ name: "status_code", type: "smallint" })
  statusCode!: number;

  @Column({ name: "client_ip", type: "varchar", length: 45, default: "" })
  clientIp!: string;

  @Column({ name: "user_agent", type: "varchar", length: 512, default: "" })
  userAgent!: string;

  @Column({ name: "origin", type: "varchar", length: 255, default: "" })
  origin!: string;

  @Column({ name: "referer", type: "varchar", length: 512, default: "" })
  referer!: string;

  @Column({ name: "duration_ms", type: "int", default: 0 })
  durationMs!: number;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;
}
