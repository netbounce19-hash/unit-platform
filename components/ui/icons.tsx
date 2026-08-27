/**
 * Свои иконки для мест, где lucide даёт слишком общий знак.
 *
 * Рисуются в том же языке, что и остальные: контур без заливки,
 * currentColor, скруглённые концы, сетка 24×24. Размер задаётся классом
 * снаружи, толщина — strokeWidth, по умолчанию 1.75 как в кабинетах.
 */

interface IconProps {
  className?: string;
  strokeWidth?: number;
}

function svgProps(strokeWidth: number) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

/**
 * Артист — микрофон. Нотный знак (lucide Music) означает музыку вообще,
 * а здесь нужен именно исполнитель.
 */
export function ArtistIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...svgProps(strokeWidth)} className={className} aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
      <path d="M8.5 21h7" />
    </svg>
  );
}

/**
 * Лейбл — пластинка в конверте. Офисное здание (lucide Building2) не
 * говорит, чем занимается компания; каталог релизов говорит.
 */
export function LabelIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...svgProps(strokeWidth)} className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  );
}

/**
 * Демо — кассета. Наушники (lucide Headphones) означают прослушивание,
 * а раздел про черновики, которые артист сдаёт лейблу.
 *
 * Деталей намеренно мало: иконка стоит в заголовке на 17px, и корпус
 * с планкой и близко посаженными катушками на этом размере слипался
 * в пятно. Осталось три штриха — корпус, две катушки и лента между ними.
 */
export function DemoIcon({ className, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg {...svgProps(strokeWidth)} className={className} aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="3" />
      <circle cx="8" cy="12" r="1.6" />
      <circle cx="16" cy="12" r="1.6" />
      <path d="M9.6 12h4.8" />
    </svg>
  );
}
