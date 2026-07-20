import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Заглушка: страница с данными и процессами по релизу — будет реализована позже.
export default async function ReleasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="max-w-[720px] mx-auto px-5 py-7">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-[6px] text-[13px] text-[#6E6D73] hover:text-[#17161A] transition mb-5"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        К дашборду
      </Link>

      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px]">
        <div className="text-[12px] text-[#A6A5AB] mb-1">Данные по релизу</div>
        <div className="text-[20px] font-medium tracking-[-0.01em] mb-2">{id}</div>
        <p className="text-[14px] text-[#6E6D73] leading-[1.5]">
          Здесь будет статистика и текущие процессы по релизу. Страница в разработке.
        </p>
      </div>
    </div>
  );
}
