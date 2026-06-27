import { z } from 'zod'

export const createAliasSchema = z.object({
  source: z.string().email().max(255),
  destination: z.string().email().max(255),
  userEndDate: z.string().date().nullable().optional(),
})

export const updateAliasSchema = z.object({
  destination: z.string().email().max(255).optional(),
  userEndDate: z.string().date().nullable().optional(),
})

export type CreateAliasDto = z.infer<typeof createAliasSchema>
export type UpdateAliasDto = z.infer<typeof updateAliasSchema>
