"use client";
import Link from "next/link";
import { AppProvider } from "@/components/providers/AppProvider";
import ArtistDashboard from "@/components/artist/ArtistDashboard";
import LabelDashboard from "@/components/label/LabelDashboard";
export default function PublicCabinet({role}:{role:"artist"|"label"}) {
 return <AppProvider><main className="max-w-[1120px] mx-auto px-5 py-7"><header className="flex flex-wrap justify-between items-center gap-3"><Link href="/" className="font-semibold tracking-[0.16em]">UNIT</Link><nav aria-label="Демонстрационные кабинеты" className="flex gap-2"><Link href="/showcase/artist" aria-current={role==="artist"?"page":undefined} className="rounded-full border border-[#E5E3DE] bg-white px-[14px] py-[8px] text-[13px]">Артист</Link><Link href="/showcase/label" aria-current={role==="label"?"page":undefined} className="rounded-full border border-[#E5E3DE] bg-white px-[14px] py-[8px] text-[13px]">Лейбл</Link></nav></header><div className="mt-6 mb-7 rounded-[12px] border-[0.5px] border-[#ECEAE5] p-3 text-[13px] text-[#6E6D73]">Ознакомительный кабинет · Данные вымышленные. Изменения действуют только до обновления страницы и не отправляются в реальные аккаунты.</div><h1 className="text-[24px] font-medium mb-6">Кабинет {role==="artist"?"артиста":"лейбла"}</h1>{role==="artist"?<ArtistDashboard/>:<LabelDashboard/>}</main></AppProvider>;
}
