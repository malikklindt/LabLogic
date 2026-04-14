'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DataProvider } from '@/components/DataProvider';
import Header from '@/components/Header';
import BTCPriceCard from '@/components/BTCPriceCard';
import MacroRegimeCard from '@/components/MacroRegimeCard';
import VolatilityCard from '@/components/VolatilityCard';
import EconomicEventsCard from '@/components/EconomicEventsCard';
import MarketNewsCard from '@/components/MarketNewsCard';
import CorrelationsCard from '@/components/CorrelationsCard';

export default function Home() {
  const router = useRouter();
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('ll_auth') === '1') {
        setAuthed(true);
      } else {
        router.replace('/login');
      }
    }
  }, [router]);

  if (authed === null) {
    return <div style={{ background: 'var(--bg)', height: '100vh' }} suppressHydrationWarning />;
  }

  return (
    <DataProvider>
      <div className="dashboard">
        <Header />
        <div className="grid-top">
          <BTCPriceCard />
          <MacroRegimeCard />
          <VolatilityCard />
        </div>
        <div className="grid-bot">
          <EconomicEventsCard />
          <MarketNewsCard />
          <CorrelationsCard />
        </div>
      </div>
    </DataProvider>
  );
}
