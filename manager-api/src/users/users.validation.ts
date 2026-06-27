import { z } from 'zod'

export const createUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
  quota: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  userEndDate: z.string().date().nullable().optional(),
})

export const updateUserSchema = z.object({
  password: z.string().min(8).max(255).optional(),
  quota: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  userEndDate: z.string().date().nullable().optional(),
})

export type CreateUserDto = z.infer<typeof createUserSchema>
export type UpdateUserDto = z.infer<typeof updateUserSchema>
