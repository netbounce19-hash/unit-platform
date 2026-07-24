import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { AppProvider } from "@/components/providers/AppProvider";
import { DemoProvider } from "@/components/artist/DemoContext";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={GeistSans.className}>
      <body className="bg-[#FAFAF9] text-[#17161A] antialiased">
        <AppProvider>
          <DemoProvider>{children}</DemoProvider>
        </AppProvider>
      </body>
    </html>
  );
}
