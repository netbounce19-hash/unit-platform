# UI Layout Standards (Next.js & Tailwind CSS)

Whenever creating or modifying a layout/screen, ALWAYS follow these structural rules to ensure perfect proportions and centering:

## 1. Centering & Containers
- **Root Element:** Always wrap the page in a flex column that forces centering to prevent full-width stretching on wide screens:
  `className="min-h-screen flex flex-col items-center bg-f-bg w-full"`
- **Inner Wrapper:** Always use a strictly constrained inner container:
  `className="w-full max-w-[720px] mx-auto px-6 py-10 flex flex-col gap-10"`

## 2. Proportions & Whitespace (Premium Airiness)
- **Section Gaps:** Use large, breathable gaps between main sections (`gap-8` or `gap-10`).
- **Card Padding:** Use generous internal padding for cards (`p-6`, `p-7`, or `p-8`). Never use cramped paddings (`p-3`, `p-4`) for main layout cards.
- **Micro-gaps:** For grouping a title and a subtitle, use `gap-1` or `gap-1.5`.

## 3. Typography Scaling
- **Page Titles/Greetings:** `text-3xl font-medium tracking-tight leading-tight`
- **Card Titles:** `text-xl` or `text-2xl font-semibold`
- **Stat Values (Numbers):** `text-[26px]` or `text-3xl font-semibold leading-none`
- **Subtext/Labels:** `text-[13px] text-f-ink-3 font-medium`

## 4. Borders & Contrast
- When the background (`#FAFAF9`) and cards (`#FFFFFF`) have very low contrast, **always** ensure cards have `border-[0.5px] border-f-line rounded-[16px]` so they don't visually merge into the background.
