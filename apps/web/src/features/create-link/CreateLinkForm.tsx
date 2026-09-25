import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createLinkSchema, type CreateLinkFormData } from './schema';
import { useCreateLink } from '@/entities/link/queries';
import { Input } from '@/shared/components/Input';
import { Button } from '@/shared/components/Button';
import { Link2, Sparkles, Tag, Globe } from 'lucide-react';

interface CreateLinkFormProps {
  onSuccess?: () => void;
  compact?: boolean;
}

export function CreateLinkForm({ onSuccess, compact = false }: CreateLinkFormProps) {
  const createLink = useCreateLink();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLinkFormData>({
    resolver: zodResolver(createLinkSchema),
    defaultValues: {
      original_url: '',
      title: '',
      custom_code: '',
    },
  });

  const onSubmit = async (data: CreateLinkFormData) => {
    try {
      await createLink.mutateAsync({
        original_url: data.original_url,
        title: data.title || undefined,
        custom_code: data.custom_code || undefined,
      });
      reset();
      onSuccess?.();
    } catch {
      // Handled by TanStack Query onError toast
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Адрес назначения"
        placeholder="https://example.com/article"
        leftIcon={<Globe className="w-4 h-4" />}
        error={errors.original_url?.message}
        {...register('original_url')}
      />

      <div className={compact ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
        <Input
          label="Название (необязательно)"
          placeholder="Например, мой проект"
          leftIcon={<Tag className="w-4 h-4" />}
          error={errors.title?.message}
          {...register('title')}
        />

        <Input
          label="Свой код (необязательно)"
          placeholder="Например, my-project"
          leftIcon={<Link2 className="w-4 h-4" />}
          error={errors.custom_code?.message}
          helperText="Оставьте пустым для автоматического кода"
          {...register('custom_code')}
        />
      </div>

      <div className="pt-2 flex justify-end">
        <Button
          type="submit"
          isLoading={isSubmitting || createLink.isPending}
          leftIcon={<Sparkles className="w-4 h-4" />}
          className="w-full sm:w-auto"
        >
          Создать короткую ссылку
        </Button>
      </div>
    </form>
  );
}
