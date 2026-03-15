"use client";

import { usePathname } from "next/navigation";
import MobileNav, { isAppRoute } from "@/components/layout/MobileNav";
import { ToastProvider } from "@/components/ui/Toast";

export default function LayoutViewport({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showMobileNav = isAppRoute(pathname);

  return (
    <>
      <main
        className={`mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-10 ${
          showMobileNav ? "pb-24 md:pb-10" : "pb-10"
        }`}
      >
        <ToastProvider>{children}</ToastProvider>
      </main>
      {showMobileNav ? <MobileNav /> : null}
    </>
  );
}
