'use client';

import { Card } from './card';

interface KpiCardProps {
  label: string;
  value: string | number;
  color: string;
}

export function KpiCard({ label, value, color }: KpiCardProps) {
  return (
    <Card className="text-center p-2.5" style={{ borderTop: `2px solid ${color}` }}>
      <div className="text-xl font-extrabold" style={{ color }}>{value}</div>
      <div className="text-[9px] text-[#64748b] mt-0.5">{label}</div>
    </Card>
  );
}
