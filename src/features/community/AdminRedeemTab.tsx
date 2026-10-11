import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { captureError } from '@/shared/monitoring';
import { showToast } from '@/shared/ui/toast';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import {
  ADMIN_REDEEM_CODES_KEY,
  adminCreateRedeemCodes,
  adminDisableRedeemCode,
  adminListRedeemCodes,
  type RedeemCodeRow,
} from './adminService';
import styles from './AdminRedeemTab.module.css';

type CodeStatus = 'unused' | 'used' | 'expired' | 'disabled';

function statusOf(row: RedeemCodeRow): CodeStatus {
  if (row.disabled_at) return 'disabled';
  if (row.redeemed_at) return 'used';
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
  return 'unused';
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** 운영 콘솔 '리딤 코드' 탭 — 특정 회원에게 직접 보내는 1회용 코드(여행 한도 추가)를 만들고, 쓰였는지 보고, 안 쓴 코드를 취소한다(0110) */
export function AdminRedeemTab() {
  const { t, i18n } = useTranslation('community');
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ADMIN_REDEEM_CODES_KEY, queryFn: adminListRedeemCodes });
  const [amount, setAmount] = useState('3');
  const [count, setCount] = useState('1');
  const [expires, setExpires] = useState('');
  const [note, setNote] = useState('');
  const [created, setCreated] = useState<string[]>([]);
  const [confirmDisableId, setConfirmDisableId] = useState<string | null>(null);

  const amountNum = Number(amount);
  const countNum = Number(count);
  const valid = Number.isInteger(amountNum) && amountNum >= 1 && amountNum <= 100 && Number.isInteger(countNum) && countNum >= 1 && countNum <= 50;

  const create = useMutation({
    mutationFn: () =>
      adminCreateRedeemCodes({
        amount: amountNum,
        count: countNum,
        // 날짜만 고르므로 그날이 끝날 때(한국 시간 23:59:59)까지 쓸 수 있게 한다
        expiresAt: expires ? new Date(`${expires}T23:59:59+09:00`).toISOString() : null,
        note: note.trim(),
      }),
    onSuccess: (codes) => {
      setCreated(codes);
      showToast(t('admin.redeem.created'), { tone: 'success' });
      void queryClient.invalidateQueries({ queryKey: ADMIN_REDEEM_CODES_KEY });
    },
    onError: (err) => {
      captureError(err, { context: 'adminCreateRedeemCodes' });
      showToast(t('admin.redeem.createFailed'), { tone: 'error' });
    },
  });
  const disable = useMutation({
    mutationFn: (id: string) => adminDisableRedeemCode(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ADMIN_REDEEM_CODES_KEY }),
    onError: (err) => {
      captureError(err, { context: 'adminDisableRedeemCode' });
      showToast(t('admin.redeem.disableFailed'), { tone: 'error' });
    },
  });

  async function copy(text: string) {
    if (await copyText(text)) showToast(t('admin.redeem.copied'), { tone: 'success' });
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>{t('admin.redeem.intro')}</p>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !create.isPending) create.mutate();
        }}
      >
        <h2 className={styles.heading}>{t('admin.redeem.create')}</h2>
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>{t('admin.redeem.amount')}</span>
            <input className={styles.input} type="number" min={1} max={100} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t('admin.redeem.count')}</span>
            <input className={styles.input} type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t('admin.redeem.expires')}</span>
            <input className={styles.input} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </label>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>{t('admin.redeem.note')}</span>
          <input className={styles.input} value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button type="submit" className={styles.primary} disabled={!valid || create.isPending}>
          {create.isPending ? t('admin.redeem.creating') : t('admin.redeem.submit')}
        </button>

        {created.length > 0 ? (
          <div className={styles.created} role="status">
            <ul className={styles.createdList}>
              {created.map((code) => (
                <li key={code} className={styles.createdItem}>
                  <code className={styles.code}>{code}</code>
                  <button type="button" className={styles.iconBtn} aria-label={`${t('admin.redeem.copy')} ${code}`} onClick={() => void copy(code)}>
                    <Copy size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {created.length > 1 ? (
              <button type="button" className={styles.secondary} onClick={() => void copy(created.join('\n'))}>
                {t('admin.redeem.copyAll')}
              </button>
            ) : null}
          </div>
        ) : null}
      </form>

      <section aria-labelledby="admin-redeem-list">
        <h2 id="admin-redeem-list" className={styles.heading}>
          {t('admin.redeem.list')}
        </h2>
        {list.isLoading ? (
          <Skeleton height="80px" />
        ) : list.isError ? (
          <ErrorState summary={t('admin.redeem.loadFailed')} onRetry={() => void list.refetch()} />
        ) : !list.data || list.data.length === 0 ? (
          <p className={styles.empty}>{t('admin.redeem.empty')}</p>
        ) : (
          <ul className={styles.rows}>
            {list.data.map((row) => {
              const status = statusOf(row);
              return (
                <li key={row.id} className={styles.rowItem}>
                  <div className={styles.rowMain}>
                    <code className={status === 'unused' ? styles.code : styles.codeMuted}>{row.code}</code>
                    <span className={styles.plus}>{t('admin.redeem.plus', { n: row.amount })}</span>
                    <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>{t(`admin.redeem.status.${status}`)}</span>
                  </div>
                  <div className={styles.rowMeta}>
                    {row.note ? <span>{row.note}</span> : null}
                    {row.redeemed_by_name ? <span>{t('admin.redeem.usedBy', { name: row.redeemed_by_name })}</span> : null}
                    {row.expires_at ? <span>{t('admin.redeem.expiresOn', { date: new Date(row.expires_at).toLocaleDateString(i18n.language) })}</span> : null}
                  </div>
                  {status === 'unused' ? (
                    <div className={styles.rowActions}>
                      <button type="button" className={styles.secondary} onClick={() => void copy(row.code)}>
                        {t('admin.redeem.copy')}
                      </button>
                      <button
                        type="button"
                        className={styles.danger}
                        disabled={disable.isPending}
                        onClick={() => setConfirmDisableId(row.id)}
                      >
                        {t('admin.redeem.disable')}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {confirmDisableId ? (
        <ConfirmDialog
          title={t('admin.redeem.disable')}
          message={t('admin.redeem.disableConfirm')}
          cancelLabel={t('admin.redeem.keep')}
          confirmLabel={t('admin.redeem.disable')}
          danger
          onClose={() => setConfirmDisableId(null)}
          onConfirm={() => disable.mutate(confirmDisableId)}
        />
      ) : null}
    </div>
  );
}
