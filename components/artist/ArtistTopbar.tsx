"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchMyProfile, displayNameOf } from "@/lib/supabase/profile";

/**
 * Общая шапка артистских страниц. Аватар ведёт в профиль —
 * кнопка «Выйти» живёт там же, а не в каждом топбаре.
 */
export default function ArtistTopbar() {
  const [name, setName] = useState("Артист");

  useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then((p) => {
        if (cancelled || !p) return;
        setName(displayNameOf(p));
      })
      .catch(() => {
        /* профиль недоступен — оставляем значение по умолчанию */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex items-center justify-between mb-6">
      <Link href="/dashboard" className="font-semibold tracking-[0.16em] text-[17px]">
        UNIT
      </Link>
      <div className="flex items-center gap-[14px]">
        <span className="text-[12px] font-medium px-[10px] py-[4px] rounded-full bg-white border-[0.5px] border-[#ECEAE5] text-[#6E6D73]">
          Кабинет артиста
        </span>
        <Link
          href="/profile"
          aria-label="Профиль"
          title="Профиль"
          className="w-8 h-8 rounded-full overflow-hidden bg-[#17161A] text-white flex items-center justify-center text-[13px] font-medium hover:ring-2 hover:ring-[#17161A]/30 transition"
        >
          {name.charAt(0) || "?"}
        </Link>
      </div>
    </div>
  );
}
