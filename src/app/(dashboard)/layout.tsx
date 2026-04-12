import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080810]">
      <Sidebar />
      <Header />
      <main className="ml-[220px] mt-[52px] p-5 max-w-[1100px]">
        {children}
      </main>
    </div>
  );
}
