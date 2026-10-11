import { useTranslation } from 'react-i18next';
import { COMPANION_AGES } from './companionPrefs';
import type { MemberAgeBand, MemberGender } from '@/shared/api/profileService';
import styles from './DemographicsFields.module.css';

const GENDERS: MemberGender[] = ['female', 'male'];

/**
 * 내 성별·나잇대 — 작은 칩 모양(2026-10-11 "너무 큼직하다"는 지적으로 동행 모집글 선호 조건 모양과 따로 줄였다).
 * required면 고른 칩을 다시 눌러도 풀리지 않는다(필수 입력 — 바꾸기만 가능). 팝업(DemographicsPrompt)과 내 정보 변경이 같이 쓴다.
 */
export function DemographicsFields({
  gender,
  ageBand,
  onChange,
  required = false,
}: {
  gender: MemberGender | null;
  ageBand: MemberAgeBand | null;
  onChange: (next: { gender: MemberGender | null; ageBand: MemberAgeBand | null }) => void;
  required?: boolean;
}) {
  const { t } = useTranslation('community');
  return (
    <div className={styles.fields}>
      <div className={styles.field}>
        <span id="demo-gender-label" className={styles.label}>
          {t('demographics.genderLabel')}
        </span>
        <div className={styles.chips} role="radiogroup" aria-labelledby="demo-gender-label">
          {GENDERS.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              className={`${styles.chip} ${styles.genderChip} ${gender === g ? styles.chipOn : ''}`}
              aria-checked={gender === g}
              onClick={() => onChange({ gender: gender === g && !required ? null : g, ageBand })}
            >
              {t(`companion.gender.${g}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span id="demo-age-label" className={styles.label}>
          {t('demographics.ageLabel')}
        </span>
        <div className={`${styles.chips} ${styles.ages}`} role="radiogroup" aria-labelledby="demo-age-label">
          {COMPANION_AGES.map((age) => (
            <button
              key={age}
              type="button"
              role="radio"
              className={`${styles.chip} ${ageBand === age ? styles.chipOn : ''}`}
              aria-checked={ageBand === age}
              onClick={() => onChange({ gender, ageBand: ageBand === age && !required ? null : age })}
            >
              {t(`companion.ages.${age}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
