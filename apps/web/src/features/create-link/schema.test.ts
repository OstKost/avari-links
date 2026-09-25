import { describe, it, expect } from 'vitest';
import { getCreateLinkSchema, createLinkSchema } from './schema';

describe('createLinkSchema', () => {
  it('validates a valid link creation payload', () => {
    const result = createLinkSchema.safeParse({
      original_url: 'https://example.com/some/path',
      title: 'Valid title',
      custom_code: 'my-custom-slug_1',
      is_nsfw: false,
    });

    expect(result.success).toBe(true);
  });

  it('fails on missing or invalid URL', () => {
    const emptyResult = createLinkSchema.safeParse({
      original_url: '',
      is_nsfw: false,
    });
    expect(emptyResult.success).toBe(false);

    const invalidURL = createLinkSchema.safeParse({
      original_url: 'not-a-valid-url',
      is_nsfw: false,
    });
    expect(invalidURL.success).toBe(false);
  });

  it('validates custom_code regex format and length constraints for free users', () => {
    const freeSchema = getCreateLinkSchema(false);

    // 4-7 chars rejected with Premium message
    const fourToSeven = freeSchema.safeParse({
      original_url: 'https://example.com',
      custom_code: 'short',
      is_nsfw: false,
    });
    expect(fourToSeven.success).toBe(false);
    if (!fourToSeven.success) {
      expect(fourToSeven.error.issues[0].message).toContain('Premium-статус');
    }

    // Invalid characters (spaces or special symbols)
    const invalidChars = freeSchema.safeParse({
      original_url: 'https://example.com',
      custom_code: 'code with spaces!',
      is_nsfw: false,
    });
    expect(invalidChars.success).toBe(false);

    // 8+ chars allowed
    const validEight = freeSchema.safeParse({
      original_url: 'https://example.com',
      custom_code: 'valid-slug-8',
      is_nsfw: false,
    });
    expect(validEight.success).toBe(true);

    // Empty or omitted custom_code is allowed
    const omitted = freeSchema.safeParse({
      original_url: 'https://example.com',
      custom_code: '',
      is_nsfw: false,
    });
    expect(omitted.success).toBe(true);
  });

  it('allows 4-7 character custom_codes for premium users', () => {
    const premiumSchema = getCreateLinkSchema(true);

    // 4 chars allowed
    const fourChars = premiumSchema.safeParse({
      original_url: 'https://example.com',
      custom_code: 'test',
      is_nsfw: false,
    });
    expect(fourChars.success).toBe(true);

    // 3 chars rejected
    const threeChars = premiumSchema.safeParse({
      original_url: 'https://example.com',
      custom_code: 'abc',
      is_nsfw: false,
    });
    expect(threeChars.success).toBe(false);

    // 8+ chars allowed
    const longSlug = premiumSchema.safeParse({
      original_url: 'https://example.com',
      custom_code: 'super-long-premium-slug',
      is_nsfw: false,
    });
    expect(longSlug.success).toBe(true);
  });
});

