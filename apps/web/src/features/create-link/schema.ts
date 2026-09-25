import { z } from 'zod';
import { translations, type Language } from '@/shared/i18n/translations';

export function getCreateLinkSchema(isPremium: boolean = false, lang: Language = 'ru') {
  const dict = translations[lang].createForm;

  return z.object({
    original_url: z
      .string()
      .min(1, dict.validation.urlRequired)
      .url(dict.validation.urlInvalid),
    title: z
      .string()
      .max(120, dict.validation.titleMax)
      .optional(),
    custom_code: z
      .string()
      .max(30, dict.validation.codeMax)
      .refine(
        (val) => {
          if (!val) return true;
          const minLen = isPremium ? 4 : 8;
          if (val.length < minLen) return false;
          return /^[a-zA-Z0-9-_]+$/.test(val);
        },
        (val) => {
          if (val && val.length >= 4 && val.length < 8 && !isPremium) {
            return {
              message: lang === 'en'
                ? 'Custom slugs from 4 to 7 characters require Premium status.'
                : 'Коды от 4 до 7 символов требуют Premium-статус. Обратитесь к администратору для подключения.',
            };
          }
          return {
            message: isPremium
              ? (lang === 'en' ? 'Slug: 4 to 30 latin letters, digits, hyphens, or underscores' : 'Код: от 4 до 30 латинских букв, цифр, дефисов или подчёркиваний')
              : dict.validation.codeFormat,
          };
        }
      )
      .optional(),
    is_nsfw: z.boolean(),
  });
}

export const createLinkSchema = getCreateLinkSchema(false, 'ru');

export type CreateLinkFormData = z.infer<typeof createLinkSchema>;
