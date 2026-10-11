import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { profileQueryKey } from '@/shared/hooks/useProfile';
import { useSession } from '@/shared/hooks/useSession';
import { captureError } from '@/shared/monitoring';
import { formatRedeemInput, isCompleteRedeemInput, redeemCode } from '@/shared/api/redeemService';
import { showToast } from '@/shared/ui/toast';
import dialog from '@/shared/ui/SmallDialog.module.css';
import styles from './RedeemCodeDialog.module.css';

/**
 * 리딤 코드 — 운영자가 직접 발급해 준 코드를 넣으면 여행을 만들 수 있는 횟수가 늘어난다(예: +3회).
 * 프로 이용 중에는 쓸 수 없고(코드는 그대로 남는다) 프로가 끝난 뒤에 쓸 수 있다. 판매하는 코드가 아니다.
 */
export function RedeemCodeDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('settings');
  const { user } = useSession();
  const queryClient = useQueryClient();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!isCompleteRedeemInput(code) || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await redeemCode(code);
      if (result.ok) {
        if (user) await queryClient.invalidateQueries({ queryKey: profileQueryKey(user.id) });
        showToast(t('redeem.success', { n: result.amount }), { tone: 'success' });
        onClose();
        return;
      }
      setMessage(t(`redeem.error.${result.reason}`));
    } catch (err) {
      captureError(err, { context: 'redeemCode' });
      setMessage(t('redeem.error.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={dialog.overlay}>
      <div ref={trapRef} className={dialog.sheet} role="dialog" aria-modal="true" aria-label={t('redeem.title')} onClick={(e) => e.stopPropagation()}>
        <h2 className={dialog.title}>{t('redeem.title')}</h2>
        <p className={styles.desc}>{t('redeem.desc')}</p>
        <input
          className={styles.input}
          value={code}
          onChange={(e) => {
            setCode(formatRedeemInput(e.target.value));
            setMessage(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          placeholder="TRIP-XXXX-XXXX"
          aria-label={t('redeem.inputLabel')}
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          maxLength={14}
        />
        {message ? (
          <p className={styles.error} role="alert">
            {message}
          </p>
        ) : null}
        <div className={dialog.actions}>
          <button type="button" className={dialog.secondary} onClick={onClose}>
            {t('redeem.close')}
          </button>
          <button type="button" className={dialog.primary} disabled={!isCompleteRedeemInput(code) || busy} onClick={() => void submit()}>
            {busy ? t('redeem.applying') : t('redeem.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
