import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { AppProvider } from "@/components/providers/AppProvider";
import { DemoProvider } from "@/components/artist/DemoContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={GeistSans.className}>
      <body className="bg-[#FAFAF9] text-[#17161A] antialiased">
        {process.env.NEXT_PUBLIC_UNIT_PUBLIC_DEMO === "1" && (
          <div className="bg-white border-b-[0.5px] border-[#ECEAE5] px-5 py-2 text-[12px] text-[#6E6D73]">
            Ознакомительный режим · Данные вымышленные, изменения сохраняются
            только в этой вкладке.{" "}
            <a href="/" className="underline">
              Выбрать кабинет
            </a>
          </div>
        )}
        <AppProvider>
          <DemoProvider>{children}</DemoProvider>
        </AppProvider>
      </body>
    </html>
  );
}
