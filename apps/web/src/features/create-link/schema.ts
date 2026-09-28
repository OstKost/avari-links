import { z } from 'zod';
import { translations, type Language } from '@/shared/i18n/translations';

const NSFW_URL_PATTERNS = [
  /pornhub/i,
  /xvideos/i,
  /xhamster/i,
  /xnxx/i,
  /redtube/i,
  /youporn/i,
  /brazzers/i,
  /chaturbate/i,
  /onlyfans/i,
  /stripchat/i,
  /bongacams/i,
  /eporner/i,
  /spankbang/i,
  /rule34/i,
  /nhentai/i,
  /hentai/i,
  /erotic/i,
  /эротик/i,
  /порно/i,
  /секс-шоп/i,
  /сексшоп/i,
  /sex-shop/i,
  /\bporn\b/i,
  /\bxxx\b/i,
  /\b18\+\b/i,
  /\br18\b/i,
];

export function isKnownNSFWUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  return NSFW_URL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const hostPart = trimmed.split('/')[0];
  if (hostPart.includes('.') || hostPart.toLowerCase().startsWith('localhost')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function getCreateLinkSchema(isPremium: boolean = false, lang: Language = 'ru') {
  const dict = translations[lang].createForm;

  return z.object({
    original_url: z
      .string()
      .min(1, dict.validation.urlRequired)
      .transform(normalizeUrlInput)
      .pipe(z.string().url(dict.validation.urlInvalid)),
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
