"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, ChevronDown } from "lucide-react";

interface FaqItem {
  q: string;
  a: string;
}

const faqs: FaqItem[] = [
  {
    q: "Как подготовить и загрузить релиз?",
    a: "Соберите финальный мастер (WAV или FLAC), обложку, текст песни и данные об авторах. На карточке релиза нажмите «Загрузить данные» либо «Добавить новый релиз», прикрепите аудио и текст, укажите правообладателя и со-авторов с долями — сумма долей должна составлять 100%. Учитывайте, что все треки отгружаются за 3 недели до даты релиза.",
  },
  {
    q: "Выполнение задач",
    a: "В разделе «Задачи на сегодня» собраны конкретные шаги по вашим релизам и промо согласно утверждённому плану. Отмечайте выполненное, нажимая на кружок слева. Задачи ставит ваш менеджер; по срочным вопросам пишите ему в мессенджере.",
  },
  {
    q: "Стратегия — почему это важно?",
    a: "Стратегия — это согласованный с A&R план на квартал: какие релизы выпускаем, каких целей по аудитории достигаем и какие промо-активности запускаем. Из неё вытекают ваши задачи, бюджеты и релизы. Двигаясь по стратегии, вы растёте предсказуемо, а не хаотично.",
  },
  {
    q: "Как правильно подавать заявки на финансирование?",
    a: "Нажмите «Сделать заявку», опишите, на что нужен бюджет (сведение, клип, промо, съёмка), и укажите желаемую сумму. Заявка уходит менеджеру на согласование со статусом «На рассмотрении». После решения статус меняется на «Одобрена» или «Отклонена». Неактуальную заявку можно смахнуть влево, чтобы удалить.",
  },
  {
    q: "Лента новостей и мероприятий — что это?",
    a: "Лента — это анонсы мероприятий и новости от лейбла: концерты, шоукейсы, показы и важные напоминания. Хотите попасть на событие — нажмите «Хочу пойти»: запрос уйдёт менеджеру, а вы увидите подтверждение «Запрос отправлен».",
  },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[18px] pb-[6px] mt-4">
      <div className="flex items-center gap-2 mb-1">
        <HelpCircle className="w-[17px] h-[17px] text-[#6E6D73]" strokeWidth={1.75} />
        <div className="text-[18px] font-semibold tracking-[-0.01em]">FAQ</div>
        <span className="text-[12px] text-[#A6A5AB]">частые вопросы</span>
      </div>

      {faqs.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={i > 0 ? "border-t-[0.5px] border-[#ECEAE5]" : ""}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 py-[14px] text-left"
            >
              <span className="text-[14px] font-medium text-[#17161A]">{item.q}</span>
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 text-[#A6A5AB]"
              >
                <ChevronDown className="w-[18px] h-[18px]" strokeWidth={2} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <p className="text-[13.5px] leading-[1.55] text-[#6E6D73] pb-[16px] pr-6">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
