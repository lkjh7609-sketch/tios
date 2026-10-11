import { Search, X } from 'lucide-react';
import styles from './SearchCapsule.module.css';

export interface SearchCapsuleSelect {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
  /** 정렬처럼 보조 선택일 때 — 글씨를 작고 연하게 */
  subtle?: boolean;
}

/**
 * 검색창 + 드롭다운을 한 알약 안에 — "내 여행" 화면의 검색 줄과 같은 모양(돋보기 · 입력 · 구분선 · 드롭다운).
 * 검색창과 정렬·필터 드롭다운을 따로 늘어놓던 화면(도시 게시판·자유게시판)이 모두 이걸 쓴다(2026-10-11 앱 화면 통일).
 * select를 안 넘기면 검색창만 알약으로 그린다. clearLabel을 넘기면 입력이 있을 때 지우기(X) 버튼이 나온다.
 */
export function SearchCapsule({
  value,
  onChange,
  placeholder,
  ariaLabel,
  select,
  clearLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  select?: SearchCapsuleSelect;
  clearLabel?: string;
}) {
  return (
    <div className={styles.capsule}>
      <label className={styles.search}>
        <Search size={20} className={styles.icon} aria-hidden="true" />
        <input
          type="search"
          className={styles.input}
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && clearLabel ? (
          <button type="button" className={styles.clear} aria-label={clearLabel} onClick={() => onChange('')}>
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </label>
      {select ? (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <select className={select.subtle ? `${styles.select} ${styles.selectSubtle}` : styles.select} value={select.value} aria-label={select.ariaLabel} onChange={(e) => select.onChange(e.target.value)}>
            {select.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </>
      ) : null}
    </div>
  );
}
