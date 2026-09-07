import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "geoip_cache" })
export class GeoipCache {
  @PrimaryColumn({ name: "ip", type: "varchar", length: 45 })
  ip!: string;

  @Column({ name: "resolved", type: "tinyint", width: 1, default: 0 })
  resolved!: number;

  @Column({ name: "country_code", type: "char", length: 2, nullable: true })
  countryCode!: string | null;

  @Column({ name: "country", type: "varchar", length: 64, nullable: true })
  country!: string | null;

  @Column({ name: "region", type: "varchar", length: 64, nullable: true })
  region!: string | null;

  @Column({ name: "city", type: "varchar", length: 64, nullable: true })
  city!: string | null;

  @Column({ name: "latitude", type: "decimal", precision: 10, scale: 7, nullable: true })
  latitude!: string | null;

  @Column({ name: "longitude", type: "decimal", precision: 10, scale: 7, nullable: true })
  longitude!: string | null;

  @Column({ name: "asn", type: "int", unsigned: true, nullable: true })
  asn!: number | null;

  @Column({ name: "asn_org", type: "varchar", length: 128, nullable: true })
  asnOrg!: string | null;

  @Column({ name: "provider", type: "varchar", length: 32, nullable: true })
  provider!: string | null;

  @Column({ name: "fetched_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  fetchedAt!: Date;

  @Index("idx_geoip_cache_expires_at")
  @Column({ name: "expires_at", type: "datetime" })
  expiresAt!: Date;

  @Column({ name: "last_read_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  lastReadAt!: Date;
}
