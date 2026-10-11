import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import styles from './ActionSheet.module.css';

export interface ActionSheetItem {
  key: string;
  label: string;
  icon?: ReactNode;
  /** 지우기·나가기처럼 되돌리기 어려운 동작 — 빨갛게 */
  danger?: boolean;
  /** 잠긴 항목(비로그인 등) — 눌러도 되지만 흐리게 보인다. 처리는 onSelect가 한다 */
  locked?: boolean;
  onSelect: () => void;
}

/**
 * 아래에서 올라오는 동작 선택 시트(iOS 액션 시트) — 여행 카드·글의 ⋮ 메뉴가 폰에서 쓴다. 항목 묶음 아래에 따로 떨어진 "취소" 버튼.
 * 문서 맨 끝(body)에 그려서 카드·링크 안에 있어도 눌림이 카드로 번지지 않는다. 위쪽을 잡아 내려도 닫힌다(sheetGestures.ts).
 */
export function ActionSheet({ title, items, cancelLabel, onClose }: { title?: string; items: ActionSheetItem[]; cancelLabel: string; onClose: () => void }) {
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  return createPortal(
    <div
      className={styles.overlay}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
    >
      <div ref={trapRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label={title ?? cancelLabel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.group}>
          {title ? <p className={styles.title}>{title}</p> : null}
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`${styles.item} ${item.danger ? styles.danger : ''} ${item.locked ? styles.locked : ''}`}
              aria-disabled={item.locked ? true : undefined}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                item.onSelect();
              }}
            >
              {item.icon ? <span className={styles.icon}>{item.icon}</span> : null}
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className={styles.cancel} onClick={onClose}>
          {cancelLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
