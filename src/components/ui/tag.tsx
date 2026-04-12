'use client';

export function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="px-2.5 py-0.5 rounded-[10px] text-[10px] font-bold"
      style={{ background: color + '18', color }}
    >
      {children}
    </span>
  );
}
