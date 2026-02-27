import { useTranslation } from 'react-i18next';
import { ShieldOff } from 'lucide-react';

interface AccessRevokedModalProps {
  isOpen: boolean;
}

export const AccessRevokedModal = ({ isOpen }: AccessRevokedModalProps) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleClose = () => {
    localStorage.removeItem('rc_token');
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-elevated border border-default rounded-xl p-8 w-full max-w-sm space-y-6 mx-4">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-red-600/20 rounded-full">
            <ShieldOff size={28} className="text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-primary text-center">
            {t('settings.remoteControl.revoked.title')}
          </h2>
          <p className="text-sm text-muted text-center">
            {t('settings.remoteControl.revoked.message')}
          </p>
        </div>

        <button
          onClick={handleClose}
          className="w-full px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {t('settings.remoteControl.revoked.close')}
        </button>
      </div>
    </div>
  );
};
