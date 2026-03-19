export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 md:py-10">{children}</main>
    </>
  );
}
