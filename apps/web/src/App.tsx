import { Navbar } from '@/app/Navbar';
import { HeroBanner } from '@/app/HeroBanner';
import { Footer } from '@/app/Footer';
import { LinkList } from '@/features/link-list/LinkList';
import { CreateLinkModal } from '@/features/create-link/CreateLinkModal';
import { QRCodeModal } from '@/features/qr-modal/QRCodeModal';

export function App() {
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
      <CreateLinkModal />
      <QRCodeModal />
    </div>
  );
}

export default App;
