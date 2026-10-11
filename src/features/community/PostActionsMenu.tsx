import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EllipsisVertical, Flag, Pencil, Pin, PinOff, Trash2, UserX } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { ActionSheet, type ActionSheetItem } from '@/shared/ui/ActionSheet';
import { confirmDialog } from '@/shared/ui/dialogHost';
import { useBlockUser } from './hooks/useCommunitySafety';
import { ReportModal } from './ReportModal';
import type { ReportTargetType } from './types';
import styles from './PostActionsMenu.module.css';

interface PostActionsMenuProps {
  targetType: ReportTargetType;
  targetId: string;
  authorId: string;
  /** 수정은 본인 글에서만 쓴다 — 없으면 해당 항목을 감춘다. 삭제는 본인 글이거나 관리자일 때만 넘긴다 */
  onEdit?: () => void;
  onDelete?: () => void;
  /** 관리자 전용 '도시 공식 가이드로 고정/해제' — 넘길 때만 보인다(권한은 서버 함수가 다시 확인한다) */
  onTogglePin?: () => void;
  pinned?: boolean;
  onReported?: () => void;
}

/** 글/댓글 공용 ⋮ 메뉴 — (본인) 수정·삭제, (관리자) 공식 가이드 고정, (타인) 신고·차단 (06-community.md §1, §5.2, §5.3) */
export function PostActionsMenu({
  targetType,
  targetId,
  authorId,
  onEdit,
  onDelete,
  onTogglePin,
  pinned = false,
  onReported,
}: PostActionsMenuProps) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const blockMutation = useBlockUser(user?.id ?? null);
  const [open, setOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const isOwn = !!user && user.id === authorId;
  // 폰(앱): 드롭다운 대신 아래에서 올라오는 액션 시트
  const isPhone = useMediaQuery('(max-width: 1023px)');

  // 메뉴 밖을 누르거나 Esc를 누르면 닫는다(터치 기기엔 마우스가 없어 mouseleave로는 안 닫힌다).
  // 폰의 액션 시트는 body에 따로 그려 wrapRef 밖이라, 시트 버튼을 누르는 순간(pointerdown) 닫혀 click이 못 오고 시트가 바로 사라졌다 —
  // 시트는 자기 배경·취소·Esc로 닫으니 여기서는 드롭다운일 때만 듣는다
  useEffect(() => {
    if (!open || isPhone) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, isPhone]);

  function handleBlock() {
    setOpen(false);
    void confirmDialog({ title: t('menu.blockUser'), message: t('menu.blockConfirm'), confirmLabel: t('menu.blockUser'), danger: true }).then((ok) => {
      if (ok) blockMutation.mutate(authorId);
    });
  }

  const showOwn = isOwn && (onEdit || onDelete);
  const showOthers = !isOwn;
  if (!showOwn && !showOthers && !onTogglePin) return null;

  const sheetItems: ActionSheetItem[] = [];
  if (isOwn && onEdit) sheetItems.push({ key: 'edit', label: t('action.edit', { ns: 'common' }), icon: <Pencil size={18} aria-hidden="true" />, onSelect: onEdit });
  if (onTogglePin) sheetItems.push({ key: 'pin', label: t(pinned ? 'detail.unpin' : 'detail.pin'), icon: pinned ? <PinOff size={18} aria-hidden="true" /> : <Pin size={18} aria-hidden="true" />, onSelect: onTogglePin });
  if (onDelete) sheetItems.push({ key: 'delete', label: t('action.delete', { ns: 'common' }), icon: <Trash2 size={18} aria-hidden="true" />, danger: true, onSelect: onDelete });
  if (!isOwn) {
    sheetItems.push({ key: 'report', label: t('menu.report'), icon: <Flag size={18} aria-hidden="true" />, onSelect: () => setShowReport(true) });
    sheetItems.push({ key: 'block', label: t('menu.blockUser'), icon: <UserX size={18} aria-hidden="true" />, danger: true, onSelect: handleBlock });
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('menu.ariaLabel')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <EllipsisVertical size={18} aria-hidden="true" />
      </button>
      {open && isPhone ? <ActionSheet items={sheetItems} cancelLabel={t('action.cancel', { ns: 'common' })} onClose={() => setOpen(false)} /> : null}
      {open && !isPhone ? (
        <div className={styles.dropdown} role="menu">
          {isOwn && onEdit ? (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              <Pencil size={15} aria-hidden="true" />
              {t('action.edit', { ns: 'common' })}
            </button>
          ) : null}
          {onTogglePin ? (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                onTogglePin();
              }}
            >
              {pinned ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
              {t(pinned ? 'detail.unpin' : 'detail.pin')}
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              role="menuitem"
              className={styles.danger}
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              {t('action.delete', { ns: 'common' })}
            </button>
          ) : null}
          {!isOwn ? (
            <>
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => {
                  setOpen(false);
                  setShowReport(true);
                }}
              >
                {t('menu.report')}
              </button>
              <button type="button" role="menuitem" className={styles.danger} onClick={handleBlock}>
                {t('menu.blockUser')}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {showReport ? (
        <ReportModal targetType={targetType} targetId={targetId} onClose={() => setShowReport(false)} onReported={onReported} />
      ) : null}
    </div>
  );
}
