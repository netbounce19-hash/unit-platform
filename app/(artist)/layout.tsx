import AuthGate from "@/components/auth/AuthGate";
import ArtistTopbar from "@/components/artist/ArtistTopbar";
import ArtistNav from "@/components/artist/ArtistNav";
import ArtistSidebar from "@/components/artist/ArtistSidebar";

/**
 * Каркас кабинета артиста: гейт, шапка и навигация — один раз на все
 * разделы. До lg — мобильная колонка 720px с нижней панелью (нижний
 * паддинг оставляет под неё место); от lg — боковая панель и контент
 * до 1120px.
 */
export default function ArtistLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="min-h-screen lg:flex">
        <ArtistSidebar />
        <div className="flex-1 min-w-0">
          <div className="max-w-[720px] lg:max-w-[1120px] mx-auto px-5 lg:px-10 py-7 lg:py-8 pb-[92px] lg:pb-10">
            <ArtistTopbar />
            {children}
          </div>
        </div>
      </div>
      <ArtistNav />
    </AuthGate>
  );
}
