import AuthGate from "@/components/auth/AuthGate";
import ArtistTopbar from "@/components/artist/ArtistTopbar";
import ArtistNav from "@/components/artist/ArtistNav";

/**
 * Каркас кабинета артиста: гейт, шапка и нижняя навигация — один раз
 * на все разделы. Нижний паддинг оставляет место под фиксированную навигацию.
 */
export default function ArtistLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="max-w-[720px] mx-auto px-5 py-7 pb-[92px]">
        <ArtistTopbar />
        {children}
      </div>
      <ArtistNav />
    </AuthGate>
  );
}
