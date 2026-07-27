"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import AuthGate from "@/components/auth/AuthGate";

/**
 * Точка входа: пока сессии нет, AuthGate показывает окно входа/регистрации,
 * после входа сразу уводим в кабинет артиста.
 *
 * Ранний прототип на тёмной теме (ArtistDashboard / LabelDashboard
 * с RoleToggle) отсюда больше не рендерится — файлы остались в репозитории.
 */
function RedirectToDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-[#A6A5AB]">
      <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
    </div>
  );
}

export default function Home() {
  return (
    <AuthGate>
      <RedirectToDashboard />
    </AuthGate>
  );
}
