'use client';

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[#475569] text-sm">
      <span className="inline-block w-2 h-2 rounded-full bg-[#22d3ee] animate-pulse" />
      Carregando {label}...
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-[#475569] text-sm py-8 text-center">
      Nenhum registro em {label}.
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-[#1c1020] border border-[#7f1d1d] rounded-lg p-4 text-sm">
      <div className="text-[#ef4444] font-semibold mb-1">Erro ao carregar dados</div>
      <div className="text-[#94a3b8] text-xs mb-2">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[10px] text-[#22d3ee] hover:text-[#67e8f9] underline"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
