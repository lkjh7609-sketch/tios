import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pageNumbers } from './PagedFeed';
import styles from './NumberedPager.module.css';

/** 숫자 쪽 넘김 — ‹ 1 2 3 … 12 ›. page는 1부터. 쪽이 한 장뿐이면 그리지 않는다 */
export function NumberedPager({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  const { t } = useTranslation('community');
  if (pageCount <= 1) return null;
  return (
    <nav className={styles.pager} aria-label={t('feed.pager.label')}>
      <button type="button" className={styles.arrow} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label={t('feed.pager.prev')}>
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      {pageNumbers(page - 1, pageCount).map((n, i) =>
        n === 'gap' ? (
          <span key={`gap-${i}`} className={styles.gap} aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className={n === page - 1 ? styles.numActive : styles.num}
            onClick={() => onChange(n + 1)}
            aria-label={t('feed.pager.page', { page: n + 1 })}
            aria-current={n === page - 1 ? 'page' : undefined}
          >
            {n + 1}
          </button>
        ),
      )}
      <button type="button" className={styles.arrow} onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label={t('feed.pager.next')}>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </nav>
  );
}
