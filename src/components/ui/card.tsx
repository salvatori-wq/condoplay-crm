import { cn } from '@/lib/utils';

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('bg-[#1e293b] rounded-[10px] p-4', className)} {...props}>
      {children}
    </div>
  );
}
