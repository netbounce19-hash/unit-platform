/**
 * Роли в команде лейбла и что каждой доступно.
 *
 * Это карта для интерфейса: какие разделы показать и что пускать на
 * странице. Настоящие ограничения стоят в базе (миграция team_roles) —
 * если здесь что-то разъедется, база всё равно не даст лишнего.
 */

export type TeamRole = "label_admin" | "label_manager" | "project" | "scout" | "delivery" | "marketing" | "finance";

export const TEAM_ROLES: { key: TeamRole; label: string; hint: string }[] = [
  { key: "label_admin", label: "Администратор", hint: "Всё, включая команду и настройки лейбла" },
  { key: "label_manager", label: "Менеджер", hint: "Все разделы, кроме управления командой" },
  { key: "project", label: "Проджект-менеджер", hint: "Артисты: задачи, чаты, заявки, приёмка релизов, промо" },
  { key: "scout", label: "Скаут", hint: "Поиск артистов: демо, находки, приглашения" },
  { key: "delivery", label: "Отгрузка", hint: "Модерация, выпуск релизов на площадки, данные" },
  { key: "marketing", label: "Маркетинг", hint: "Промо, креатив, чаты с артистами, данные" },
  { key: "finance", label: "Финансы", hint: "Роялти, авансы, заявки на бюджет, данные" },
];

export const roleLabel = (r: string) => TEAM_ROLES.find((x) => x.key === r)?.label ?? r;

export type Section =
  | "roster"
  | "budgets"
  | "messages"
  | "stats"
  | "scouting"
  | "royalties"
  | "moderation"
  | "promo"
  | "campaigns"
  | "dataUpload"
  | "invites"
  | "tasks"
  | "team"
  | "settings"
  | "support";

const ALL: TeamRole[] = ["label_admin", "label_manager", "project", "scout", "delivery", "marketing", "finance"];

export const SECTION_ROLES: Record<Section, TeamRole[]> = {
  roster: ALL,
  stats: ALL,
  support: ALL,
  team: ALL, // смотреть состав могут все, менять — только администратор
  settings: ALL, // тема — для всех; настройки лейбла — администратору
  budgets: ["label_admin", "label_manager", "project", "finance"],
  messages: ["label_admin", "label_manager", "project", "marketing"],
  scouting: ["label_admin", "label_manager", "scout", "project"],
  royalties: ["label_admin", "label_manager", "finance"],
  moderation: ["label_admin", "label_manager", "delivery"],
  promo: ["label_admin", "label_manager", "project", "marketing"],
  campaigns: ["label_admin", "label_manager", "project", "marketing"],
  dataUpload: ["label_admin", "label_manager", "delivery", "marketing", "finance"],
  invites: ["label_admin", "label_manager", "project", "scout"],
  tasks: ["label_admin", "label_manager", "project"],
};

export const canAccess = (role: string, section: Section) => SECTION_ROLES[section].includes(role as TeamRole);

export const isAdmin = (role: string) => role === "label_admin";

/** Решение по релизу (утвердить / отклонить). */
export const canDecideRelease = (role: string) => ["label_admin", "label_manager", "project"].includes(role);

/** Модерация и выпуск на площадки. */
export const canShip = (role: string) => ["label_admin", "label_manager", "delivery"].includes(role);

/** Решение по заявке на бюджет. */
export const canDecideBudget = (role: string) => ["label_admin", "label_manager", "project", "finance"].includes(role);

/** Раздел по адресу — для проверки доступа в каркасе кабинета. */
export function sectionOfPath(path: string): Section | null {
  const map: [string, Section][] = [
    ["/label/roster", "roster"],
    ["/label/artists", "roster"],
    ["/label/releases", "roster"],
    ["/label/tasks", "tasks"],
    ["/label/budgets", "budgets"],
    ["/label/messages", "messages"],
    ["/label/stats", "stats"],
    ["/label/scouting", "scouting"],
    ["/label/royalties", "royalties"],
    ["/label/moderation", "moderation"],
    ["/label/promo", "promo"],
    ["/label/campaigns", "campaigns"],
    ["/label/data-upload", "dataUpload"],
    ["/label/invites", "invites"],
    ["/label/team", "team"],
    ["/label/settings", "settings"],
    ["/label/support", "support"],
  ];
  return map.find(([p]) => path === p || path.startsWith(p + "/"))?.[1] ?? null;
}
