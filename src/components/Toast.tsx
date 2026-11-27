import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="no-print fixed top-4 right-4 z-[9999] flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
      role="region"
      aria-label="Notifikasi sistem"
    >
      {toasts.map((toast) => {
        const iconMap = {
          success: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />,
          error: <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />,
          info: <Info className="h-5 w-5 shrink-0 text-blue-700" />,
        };
        const borderMap = {
          success: 'border-emerald-200 bg-white',
          error: 'border-red-200 bg-white',
          info: 'border-blue-200 bg-white',
        };

        return (
          <div
            key={toast.id}
            role="alert"
            className={`flex items-start gap-3 rounded-lg border p-3.5 shadow-lg transition-all ${borderMap[toast.type]}`}
          >
            {iconMap[toast.type]}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
              {toast.message && (
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Tutup notifikasi"
              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
