import { useEffect } from 'react';
import { Navbar } from '@/app/Navbar';
import { HeroBanner } from '@/app/HeroBanner';
import { Footer } from '@/app/Footer';
import { LinkList } from '@/features/link-list/LinkList';
import { QRCodeModal } from '@/features/qr-modal/QRCodeModal';
import { SessionModal } from '@/features/session/SessionModal';
import { useAppStore } from '@/shared/store/app-store';
import { useCreateSession } from '@/entities/session/queries';

export function App() {
  const sessionKey = useAppStore((s) => s.sessionKey);
  const createSessionMutation = useCreateSession();

  useEffect(() => {
    if (!sessionKey) {
      createSessionMutation.mutate();
    }
  }, [sessionKey]);

  return (
    <div id="top" className="avari-shell min-h-screen flex flex-col justify-between">
      <div>
        <Navbar />
        <main className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <HeroBanner />
          <LinkList />
        </main>
      </div>
      <Footer />
      <QRCodeModal />
      <SessionModal />
    </div>
  );
}

export default App;
