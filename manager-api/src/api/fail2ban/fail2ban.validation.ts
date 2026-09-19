import { z } from "zod";

export const fail2banJailSchema = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/);

export const fail2banIpBodySchema = z.object({
  ip: z.union([z.ipv4(), z.ipv6()]),
});

export type Fail2banIpBody = z.infer<typeof fail2banIpBodySchema>;
