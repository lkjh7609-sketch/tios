import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { useProfile, useUpdateProfile } from '@/shared/hooks/useProfile';
import { useSession } from '@/shared/hooks/useSession';
import type { MemberAgeBand, MemberGender } from '@/shared/api/profileService';
import { captureError } from '@/shared/monitoring';
import { DemographicsFields } from './DemographicsFields';
import styles from './DemographicsPrompt.module.css';

/** 이 프로필에 팝업을 띄울지 — 나잇대·성별 중 하나라도 비어 있으면(필수, 2026-10-11) */
export function shouldAskDemographics(profile: { gender: unknown; age_band: unknown } | undefined): boolean {
  if (!profile) return false;
  return !(profile.gender && profile.age_band);
}

/**
 * 커뮤니티에 들어올 때 나잇대·성별이 비어 있으면 뜨는 팝업 — 필수라 둘 다 골라 저장해야 커뮤니티를 쓸 수 있다. "닫기"(와 Esc)를 누르면
 * 입력 없이 이전 화면으로 돌려보낸다(2026-10-11 사용자 결정). 동행 모집글·지원 화면에 표기하려고 받는다고 밝힌다. 서버(profiles.gender/age_band)를 기준으로 해서
 * 다른 기기·기존 회원에게도 뜬다. 이전의 "나중에"(demographics_skips)는 더 이상 쓰지 않는다.
 */
export function DemographicsPrompt({ onLeave }: { onLeave: () => void }) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const [gender, setGender] = useState<MemberGender | null>(null);
  const [ageBand, setAgeBand] = useState<MemberAgeBand | null>(null);
  const [error, setError] = useState(false);
  const [closed, setClosed] = useState(false);
  // 닫기·Esc는 입력 없이 커뮤니티를 떠난다(onLeave — 이전 화면으로)
  const trapRef = useFocusTrap<HTMLDivElement>(onLeave);

  if (!user || closed || !shouldAskDemographics(profile)) return null;

  async function save() {
    setError(false);
    try {
      await update.mutateAsync({ gender, age_band: ageBand });
      setClosed(true);
    } catch (err) {
      captureError(err, { context: 'saveDemographics' });
      setError(true);
    }
  }

  const incomplete = !gender || !ageBand;

  return (
    <div className={styles.overlay}>
      <div ref={trapRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label={t('demographics.title')} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{t('demographics.title')}</h2>
        <p className={styles.reason}>{t('demographics.reason')}</p>
        <DemographicsFields required gender={gender} ageBand={ageBand} onChange={(next) => { setGender(next.gender); setAgeBand(next.ageBand); }} />
        {error ? (
          <p className={styles.error} role="alert">
            {t('demographics.saveError')}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className={styles.close} onClick={onLeave}>
            {t('demographics.close')}
          </button>
          <button type="button" className={styles.save} disabled={incomplete || update.isPending} onClick={() => void save()}>
            {t('demographics.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
