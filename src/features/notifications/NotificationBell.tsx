import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Bell, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { PopoverSheet } from '@/shared/ui/PopoverSheet';
import { useAlertLabels } from '@/features/travelAlerts/useAlertLabels';
import { appNoticePath, type AppNotice } from './appNotices';
import { useTripNotifications, type TripNotification } from './useTripNotifications';
import styles from './NotificationBell.module.css';

/** 종 모양 알림 버튼 — PC 헤더(프로필 왼쪽)와 모바일 홈 상단 오른쪽에서 같이 쓴다. 로그인하지 않았으면 그리지 않는다 */
export function NotificationBell() {
  const { t } = useTranslation('common');
  const { countryName, levelName } = useAlertLabels();
  const { signedIn, items, unreadCount, markAllRead, dismiss } = useTripNotifications();
  const [open, setOpen] = useState(false);
  // 폰(앱): 말풍선 대신 아래에서 올라오는 시트(PopoverSheet) — 바깥 누르기는 그 시트의 어두운 배경이 맡는다
  const phone = useMediaQuery('(max-width: 1023px)');
  const wrapRef = useRef<HTMLDivElement>(null);
  // 닫는 순간 안 읽은 것을 읽음으로 — 열어 둔 동안은 새 알림 표시가 그대로 보이게
  const markRef = useRef(markAllRead);
  useEffect(() => {
    markRef.current = markAllRead;
  });

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: Event) => {
      if (phone) return;
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
      markRef.current();
    };
  }, [open, phone]);

  if (!signedIn) return null;

  const message = (n: TripNotification) => {
    if (n.kind === 'announcement') return t(`notifications.announcement.${n.noticeKind}`, { version: n.version ?? '' });
    if (n.kind === 'community') return t(`notifications.community.${n.type}`, { name: n.actorName || t('notifications.community.someone') });
    return appMessage(n);
  };

  const appMessage = (n: AppNotice) => {
    const base = { name: n.name || t('notifications.community.someone'), count: n.count };
    switch (n.type) {
      case 'travel_alert':
        return t('travelAlert.bell', {
          country: countryName({ code: n.countryCode ?? '', nameKo: n.countryNameKo ?? '' }),
          level: n.level ?? '',
          name: levelName((n.level ?? 2) as 1 | 2 | 3 | 4),
        });
      case 'trip_week':
      case 'trip_soon':
      case 'companion_message':
        return t(`notifications.app.${n.type}${n.type === 'companion_message' && n.count > 1 ? '_many' : ''}`, base);
      case 'ops_content_removed':
        return t(`notifications.app.ops_content_removed.${n.target === 'comment' || n.target === 'companion_post' ? n.target : 'post'}`);
      case 'ops_report_result':
        return t(`notifications.app.ops_report_result.${n.result === 'actioned' ? 'actioned' : 'dismissed'}`);
      default:
        return t(`notifications.app.${n.type}`, base);
    }
  };

  const titleOf = (n: TripNotification) => {
    if (n.kind === 'community') return n.postTitle;
    if (n.kind === 'announcement') return n.title;
    return n.title || t(`notifications.app.heading.${n.type}`);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.bell}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unreadCount > 0
            ? t('notifications.ariaUnread', { count: unreadCount })
            : t('notifications.aria')
        }
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className={styles.badge} aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <PopoverSheet phone={phone} onClose={() => setOpen(false)}>
        <div className={styles.panel} role="dialog" aria-label={t('notifications.title')}>
          <h2 className={styles.heading}>{t('notifications.title')}</h2>
          {items.length === 0 ? (
            <p className={styles.empty}>{t('notifications.empty')}</p>
          ) : (
            <ul className={styles.list}>
              {items.map((n) => (
                <li key={n.id} className={styles.item}>
                  <Link
                    to={
                      n.kind === 'community'
                        ? `/community/post/${n.postId}${n.commentId ? `#comment-${n.commentId}` : ''}`
                        : n.kind === 'announcement'
                          ? `/notices?open=${n.announcementId}`
                          : appNoticePath(n)
                    }
                    className={styles.itemLink}
                    onClick={() => setOpen(false)}
                  >
                    {n.unread ? <span className={styles.dot} aria-hidden="true" /> : null}
                    <span className={styles.itemText}>
                      <span className={styles.itemTitle}>{titleOf(n)}</span>
                      <span className={styles.itemMessage}>{message(n)}</span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => dismiss(n.id)}
                    aria-label={t('notifications.dismiss', { title: titleOf(n) })}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.note}>{t('notifications.note')}</p>
        </div>
        </PopoverSheet>
      ) : null}
    </div>
  );
}
