import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { MyrealtripLink } from '../MyrealtripLink';
import { openExternal, openMyrealtripPage, openMyrealtripSearch, useMyrealtripLink } from '@/features/plan/partnerLinks';
import { INSTANT_TAG } from './activityFilters';
import type { ActivityProduct } from './activityApi';
import styles from './ActivityProductGrid.module.css';

function formatPrice(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** 카드 사이 간격 — 한꺼번에 부르지 않고 차례로 링크를 받아 둔다 */
const LINK_PREFETCH_STAGGER_MS = 350;

function ProductCard({ product, index }: { product: ActivityProduct; index: number }) {
  const { t, i18n } = useTranslation('home');
  const instant = product.tags.includes(INSTANT_TAG);
  const [opening, setOpening] = useState(false);
  // 추적 링크(마이링크)는 처음 만들 때 3초 넘게 걸려, 누른 뒤에 만들면 한참 멈춘 것처럼 보인다. 그래서 화면에 나온 카드만 차례로 미리 받아 둔다.
  // 서버가 같은 상품은 한 번만 만들어 저장하니 유료 호출은 상품당 처음 한 번뿐이고, 필터·더 보기로 보이지 않는 카드는 받지 않는다
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setArmed(true), 300 + index * LINK_PREFETCH_STAGGER_MS);
    return () => window.clearTimeout(id);
  }, [index]);
  const link = useMyrealtripLink(armed ? { kind: 'page', url: product.url, placement: 'product' } : null);

  async function open() {
    if (link) {
      openExternal(link);
      return;
    }
    // 아직 못 받았으면 받는 동안 눌린 것을 보여 준다(오래 걸리면 원래 주소로)
    setOpening(true);
    try {
      await openMyrealtripPage(product.url, 'product');
    } finally {
      setOpening(false);
    }
  }

  return (
    <button type="button" className={styles.card} aria-busy={opening || undefined} data-opening={opening || undefined} onClick={() => void open()}>
      <span className={styles.media}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            className={styles.image}
            loading="lazy"
            // 이미지가 깨지면 깨진 아이콘 대신 빈 자리(배경색)만
            onError={(e) => {
              e.currentTarget.style.visibility = 'hidden';
            }}
          />
        ) : null}
        {product.category ? <span className={styles.badge}>{product.category}</span> : null}
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{product.title}</span>
        <span className={styles.meta}>
          {product.rating != null ? (
            <>
              <span className={styles.rating}>★ {product.rating.toFixed(1)}</span>
              {product.reviewCount ? <span className={styles.reviews}>({product.reviewCount.toLocaleString(i18n.language)})</span> : null}
            </>
          ) : null}
          {instant ? <span className={styles.instant}>{t('activities.card.instant')}</span> : null}
        </span>
        <span className={styles.footer}>
          {product.price != null ? <span className={styles.price}>{formatPrice(product.price, product.currency, i18n.language)}</span> : <span />}
          <span className={styles.unit}>{t('activities.card.perPerson')}</span>
        </span>
      </span>
    </button>
  );
}

export function ProductSkeletonGrid({ count }: { count: number }) {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={`${styles.skeleton} ${styles.skeletonMedia}`} />
          <div className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: '78%' }} />
          <div className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: '52%' }} />
          <div className={`${styles.skeleton} ${styles.skeletonLine}`} style={{ width: '34%', marginTop: 12 }} />
        </div>
      ))}
    </div>
  );
}

interface ProductGridProps {
  products: ActivityProduct[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
}

/** 상품 카드 격자(PC 4열·모바일 2열)와 "더 보기" */
export function ActivityProductGrid({ products, hasMore, loadingMore, onMore }: ProductGridProps) {
  const { t } = useTranslation('home');
  return (
    <>
      <div className={styles.grid}>
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} index={i} />
        ))}
      </div>
      {hasMore ? (
        <button type="button" className={styles.more} onClick={onMore} disabled={loadingMore} aria-busy={loadingMore}>
          {t('activities.more')} <ChevronDown size={16} aria-hidden="true" />
        </button>
      ) : null}
    </>
  );
}

interface EmptyProps {
  kind: 'empty' | 'error';
  city: string;
  filtersActive: boolean;
  onResetFilters: () => void;
  onRetry: () => void;
}

/** 조건에 맞는 상품이 없거나 못 받았을 때 — 마이리얼트립 검색으로 보내는 길은 항상 둔다 */
export function ActivityEmpty({ kind, city, filtersActive, onResetFilters, onRetry }: EmptyProps) {
  const { t } = useTranslation('home');
  return (
    <div className={styles.empty} role={kind === 'error' ? 'alert' : 'status'}>
      <p className={styles.emptyTitle}>{kind === 'error' ? t('activities.error') : t('activities.empty')}</p>
      {kind === 'empty' ? <p className={styles.emptyHint}>{t('activities.emptyHint')}</p> : null}
      <div className={styles.emptyActions}>
        {kind === 'error' ? (
          <button type="button" className={styles.emptyButton} onClick={onRetry}>
            {t('activities.retry')}
          </button>
        ) : null}
        {kind === 'empty' && filtersActive ? (
          <button type="button" className={styles.emptyButton} onClick={onResetFilters}>
            {t('activities.resetFilters')}
          </button>
        ) : null}
        <MyrealtripLink
          target={{ kind: 'search', q: city }}
          placement="city"
          onFallback={() => void openMyrealtripSearch(city, 'city')}
          className={styles.emptyLink}
        >
          {t('activities.seeAllCity', { city })}
        </MyrealtripLink>
      </div>
    </div>
  );
}
