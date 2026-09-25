import { Modal } from '@/shared/components/Modal';
import { CreateLinkForm } from './CreateLinkForm';
import { useAppStore } from '@/shared/store/app-store';

export function CreateLinkModal() {
  const { isCreateModalOpen, setCreateModalOpen } = useAppStore();

  return (
    <Modal
      isOpen={isCreateModalOpen}
      onClose={() => setCreateModalOpen(false)}
      title="Новая короткая ссылка"
      description="Укажите адрес назначения. Название и короткий код можно добавить по желанию."
    >
      <CreateLinkForm onSuccess={() => setCreateModalOpen(false)} />
    </Modal>
  );
}
