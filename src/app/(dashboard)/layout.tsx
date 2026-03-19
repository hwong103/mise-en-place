import MobileNav from "@/components/layout/MobileNav";
import { ToastProvider } from "@/components/ui/Toast";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 pb-24 md:px-8 md:py-10 md:pb-10">
        <ToastProvider>{children}</ToastProvider>
      </main>
      <MobileNav />
    </>
  );
}
