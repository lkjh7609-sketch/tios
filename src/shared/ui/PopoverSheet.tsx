import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './PopoverSheet.module.css';

/**
 * 말풍선처럼 버튼 아래에 붙던 패널(알림 목록·인원 선택)을 폰에서는 아래에서 올라오는 시트로 — 문서 맨 끝(body)에 그려서 헤더·폼 안의
 * 변형·고정 위치 때문에 위치가 틀어지지 않게 하고(앱에서 알림 패널이 헤더 높이의 흰 띠로 깨졌다), 뒤는 어두운 배경이 가린다.
 * 폰이 아니면(phone=false) 지금 자리에 그대로 그린다. 바깥(어두운 배경)을 누르면 onClose.
 * from='top'이면 위에서 내려오는 시트 — 상태 표시줄·다이나믹 아일랜드 아래(안전 영역)에서 시작한다(알림 패널). 이 경우 안쪽 패널은 data-top-sheet를 달아 내려오는 움직임을 받는다.
 * 안쪽 패널은 role="dialog"로 둔다 — 위쪽을 잡아 내려 닫는 동작(sheetGestures)이 그걸 보고 붙는다.
 */
export function PopoverSheet({ phone, from = 'bottom', onClose, children }: { phone: boolean; from?: 'bottom' | 'top'; onClose: () => void; children: ReactNode }) {
  if (!phone) return <>{children}</>;
  return createPortal(
    <div className={from === 'top' ? `${styles.overlay} ${styles.overlayTop}` : styles.overlay} onClick={onClose}>
      <div className={styles.holder} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
