import { Column, Entity, PrimaryColumn } from "typeorm";

// The credentials of one external sign-in provider, held here rather than in the
// environment so a root admin can add or replace them from the interface without
// editing a file, rebuilding an image or restarting the API.
//
// `client_id` is stored as-is: it is public by design and travels in every
// authorize URL. `client_secret_cipher` is sealed with AES-256-GCM (see
// api-token.cipher.ts), the key being the pepper the API already requires. A
// stolen dump therefore yields nothing on its own: the ciphertext is in the
// database, the key never is.
@Entity({ name: "passport_provider_credentials" })
export class PassportProviderCredential {
  // The provider id from the catalog (passport-providers.ts). One row per
  // provider, so the id is the key: a provider cannot be configured twice.
  @PrimaryColumn({ name: "provider", type: "varchar", length: 32 })
  provider!: string;

  @Column({ name: "client_id", type: "varchar", length: 255 })
  clientId!: string;

  @Column({ name: "client_secret_cipher", type: "varchar", length: 512 })
  clientSecretCipher!: string;

  // Whether this provider may be used. Kept beside its credentials rather than
  // in app_settings: switching a provider on and configuring it are one subject.
  @Column({ name: "enabled", type: "tinyint", width: 1, default: 0 })
  enabled!: number;

  @Column({ name: "created_at", type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @Column({
    name: "updated_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date;
}
