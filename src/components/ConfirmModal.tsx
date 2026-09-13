import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isDanger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmText,
  cancelLabel = 'Cancel',
  cancelText,
  isDestructive = false,
  isDanger = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const finalConfirmLabel = confirmText || confirmLabel;
  const finalCancelLabel = cancelText || cancelLabel;
  const isDangerous = isDestructive || isDanger;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#171713]/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-[#E5E5DE] shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-[#6E6E63] hover:text-[#171713] p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isDangerous ? 'bg-rose-50 text-rose-600' : 'bg-[#EEF2E6] text-[#4F5D2F]'
            }`}
          >
            <AlertCircle className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-[#171713] mb-1">{title}</h3>
            <p className="text-sm text-[#6E6E63] leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold text-[#6E6E63] hover:text-[#171713] hover:bg-[#FAF9F5] rounded-xl border border-[#E5E5DE] transition-colors disabled:opacity-50"
          >
            {finalCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-semibold rounded-xl text-white shadow-xs transition-colors disabled:opacity-50 ${
              isDangerous
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[#4F5D2F] hover:bg-[#37421F]'
            }`}
          >
            {isLoading ? 'Processing...' : finalConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
