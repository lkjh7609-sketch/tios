import { useTranslation } from 'react-i18next';
import { ExternalLink, Landmark, Sparkles, Ticket } from 'lucide-react';
import { openKlookSearch } from '@/features/plan/partnerLinks';
import styles from './SectionScreen.module.css';

const BANNERS = [
  { key: 'tour', Icon: Landmark },
  { key: 'ticket', Icon: Ticket },
  { key: 'experience', Icon: Sparkles },
] as const;

/**
 * 액티비티 화면의 Klook 자리 — 그 도시의 Klook 추천 배너 3개(투어·입장권·체험). 누르면 그 도시의 해당 종류 검색 결과로 간다.
 * 예전엔 트래블페이아웃 투어 위젯(tpembd.com, 3개)을 넣었는데 트래블페이아웃을 뺐다(2026-10-04) — 지금은 외부 스크립트 없이 우리 배너다.
 * 링크는 서버(api/partnerLink, brand=klook)가 정하므로, Klook 제휴를 새로 붙이면 서버 레지스트리만 바꾸면 이 배너가 그대로 제휴 링크가 된다.
 */
export function KlookToursWidget({ city, locale }: { city: string; locale: string }) {
  const { t } = useTranslation('home');
  return (
    <div className={styles.toursWidget}>
      <div className={styles.klookBanners}>
        {BANNERS.map(({ key, Icon }) => (
          <button
            key={key}
            type="button"
            className={styles.klookBanner}
            onClick={() => void openKlookSearch(`${city} ${t(`activities.klookBanners.${key}.query`)}`, locale, 'city')}
          >
            <span className={styles.klookIcon} aria-hidden="true">
              <Icon size={22} />
            </span>
            <span className={styles.klookBannerBody}>
              <span className={styles.klookBannerTitle}>{t(`activities.klookBanners.${key}.title`)}</span>
              <span className={styles.klookBannerDesc}>{t(`activities.klookBanners.${key}.desc`)}</span>
            </span>
            <ExternalLink size={14} aria-hidden="true" className={styles.klookBannerArrow} />
          </button>
        ))}
      </div>
    </div>
  );
}
