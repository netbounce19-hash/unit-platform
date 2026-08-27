"use client";

import { useState } from "react";
import { LifeBuoy, Send, Check, Mail } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { panelCls } from "@/components/label/LabelShell";
import type { MyOrg } from "@/lib/supabase/label";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Как пригласить артиста в кабинет?",
    a: "Раздел «Приглашения» → укажите email, при желании привяжите к существующей карточке артиста, скопируйте ссылку и отправьте сами.",
  },
  {
    q: "Откуда берутся цифры в «Статистике»?",
    a: "Обязательность считается по-настоящему, из выполненных задач. Стримы пока вводятся вручную в разделе «Загрузка данных» — реальный источник данных ещё не подключён.",
  },
  {
    q: "Как включить тёмную тему?",
    a: "Раздел «Настройки» → «Тема». Переключатель действует только на кабинет лейбла.",
  },
  {
    q: "Что делает чёрный список артистов?",
    a: "Пока это заглушка интерфейса — она ничего не блокирует по-настоящему. Реальное ограничение доступа потребует отдельной миграции.",
  },
];

function SupportInner({ org }: { org: MyOrg }) {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    // Заявки пока никуда не отправляются — нужен канал поддержки (email/тикет-система),
    // прежде чем это станет настоящей отправкой.
    setSent(true);
    setMessage("");
    setTimeout(() => setSent(false), 2400);
  };

  return (
    <LabelShell org={org} title="Поддержка" subtitle="Частые вопросы и связь с командой UNIT">
      <div className={`${panelCls} p-5 mb-5`}>
        <h2 className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] mb-4 flex items-center gap-2">
          <LifeBuoy className="w-4 h-4" strokeWidth={1.75} />
          Частые вопросы
        </h2>
        <div className="divide-y-[0.5px] divide-[#ECEAE5] dark:divide-[#242327]">
          {FAQ.map((item) => (
            <div key={item.q} className="py-3">
              <div className="text-[13.5px] font-medium text-[#17161A] dark:text-[#F5F4F2] mb-1">{item.q}</div>
              <div className="text-[13px] text-[#6E6D73] dark:text-[#9A98A0] leading-[1.5]">{item.a}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${panelCls} p-5`}>
        <h2 className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] mb-1 flex items-center gap-2">
          <Mail className="w-4 h-4" strokeWidth={1.75} />
          Написать в поддержку
        </h2>
        <p className="text-[12.5px] text-[#6E6D73] dark:text-[#9A98A0] mb-4">
          Форма пока не подключена к настоящему каналу — сообщение никуда не уйдёт. Для срочных вопросов
          напишите нам напрямую.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Опишите вопрос или проблему…"
            className="w-full resize-none text-[13.5px] leading-[1.45] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className="self-start inline-flex items-center gap-2 text-[13px] font-medium bg-[#17161A] text-white px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
          >
            {sent ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Send className="w-4 h-4" strokeWidth={1.75} />}
            {sent ? "Отправлено" : "Отправить"}
          </button>
        </form>
      </div>
    </LabelShell>
  );
}

export default function SupportPage() {
  return <LabelGate>{({ org }) => <SupportInner org={org} />}</LabelGate>;
}
