import { z } from 'zod';

export const createLinkSchema = z.object({
  original_url: z
    .string()
    .min(1, 'Укажите адрес назначения')
    .url('Укажите корректный URL с http:// или https://'),
  title: z
    .string()
    .max(120, 'Название не должно превышать 120 символов')
    .optional(),
  custom_code: z
    .string()
    .max(30, 'Код не должен превышать 30 символов')
    .refine((val) => !val || /^[a-zA-Z0-9-_]{3,30}$/.test(val), {
      message: 'Код: 3–30 латинских букв, цифр, дефисов или подчёркиваний',
    })
    .optional(),
});

export type CreateLinkFormData = z.infer<typeof createLinkSchema>;
