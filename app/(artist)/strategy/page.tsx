import { Target, Check } from "lucide-react";

// Утверждённая стратегия на ближайший квартал
const strategyPillars = [
  { title: "Выпуск сингла", meta: "мастер, обложка и питчинг в плейлисты" },
  { title: "Выпуск EP", meta: "сведение, тексты и данные об авторах" },
  { title: "Презентация EP", meta: "шоукейс и промо-кампания" },
];

export default function StrategyPage() {
  return (
    <>
      <div className="mb-4">
        <div className="text-[22px] font-medium tracking-[-0.01em]">Стратегия</div>
        <div className="text-[14px] text-[#6E6D73] mt-[3px]">План на III квартал 2026</div>
      </div>

      <div className="bg-[#FBF1DE] border-[0.5px] border-[#F0E2BF] rounded-[16px] p-[22px]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Target className="w-[17px] h-[17px] text-[#8A5A16]" strokeWidth={1.75} />
            <div className="text-[16px] font-semibold tracking-[-0.01em]">Фокус квартала</div>
          </div>
          <span className="inline-flex items-center gap-[5px] text-[12px] font-medium px-[10px] py-[4px] rounded-full bg-[#E9F6EF] text-[#166B49]">
            <Check className="w-3 h-3" strokeWidth={3} />
            Утверждена
          </span>
        </div>
        <div className="text-[13px] text-[#6E6D73] mb-4">
          Выпустить первый сингл и EP
        </div>
        <div className="space-y-[10px]">
          {strategyPillars.map((p, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-[22px] h-[22px] rounded-full bg-[#F0EEEA] text-[#17161A] text-[12px] font-semibold flex items-center justify-center shrink-0 mt-[1px]">
                {i + 1}
              </span>
              <div>
                <div className="text-[14px] text-[#17161A] leading-[1.35]">{p.title}</div>
                <div className="text-[12px] text-[#A6A5AB] mt-[1px]">{p.meta}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-[12px] text-[#8A5A16]/60 mt-4 pt-3 border-t-[0.5px] border-[#F0E2BF]">
          Согласована с A&R · Анна Ковалёва · 14 июля
        </div>
      </div>
    </>
  );
}
