import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { normalizeLocale } from '@/shared/i18n';
import { LANGUAGE_AUTONYMS } from '@/shared/i18n/languageNames';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { useProfile, useUpdateProfile } from '@/shared/hooks/useProfile';
import { ProBadge } from '@/shared/ui/ProBadge';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { signOut } from '@/shared/api/authService';
import { captureError, trackScreenView } from '@/shared/monitoring';
import { LoginButtons } from '@/features/auth/LoginButtons';
import { BackupModal } from '@/features/plan/BackupModal';
import { getStoredTheme, setTheme, type ThemePreference } from '@/shared/theme';
import { registerPushNotifications } from '@/shared/push/registerPush';
import { clearOfflineCache } from '@/shared/offline/persister';
import { normalizeNotificationPrefs, notificationsEnabled, withNotificationsEnabled, type NotificationKey, type NotificationPrefs } from '@/shared/api/profileService';
import { isNativeApp } from '@/shared/platform';
import { ProfileAvatar } from './ProfileAvatar';
import { useIsAdminViewer } from '@/features/community/hooks/usePostMeta';
import { showToast } from '@/shared/ui/toast';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { SettingsDesktop } from './SettingsDesktop';
import { DeleteAccountFlow } from './DeleteAccountFlow';
import { BlockedUsersList } from './BlockedUsersList';
import { Palette, Bell, HardDrive, Globe, Info, Sun, Moon, Monitor, ChevronRight, ArrowLeft, LogOut, UserX, ShieldCheck } from 'lucide-react';

import { EditProfileModal } from './EditProfileModal';
import { UnitSettingsModal } from './UnitSettingsModal';
import { LanguageModal } from './LanguageModal';
import { CurrencyModal } from './CurrencyModal';
import { FeedbackModal } from './FeedbackModal';

import { useAppVersion } from '@/features/notices/useAppVersion';
import styles from './SettingsScreen.module.css';

const NOTIFICATION_LABEL_KEYS: Record<NotificationKey, string> = {
  trip: 'notifications.trip',
  community: 'notifications.community',
  companion: 'notifications.companion',
  collab: 'notifications.collab',
};

/** 이 사이트가 이 기기에서 실제로 쓰는 저장 공간(MB). 잴 수 없는 환경이면 null */
async function readCacheUsageMB(): Promise<number | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    return (estimate.usage ?? 0) / (1024 * 1024);
  } catch {
    return null;
  }
}

/**
 * 설정 탭 (02-screens.md §5)
 * 계정 섹션은 기존과 동일. 환경설정(테마 실동작, 온도단위 실동작, 나머지는
 * profiles 컬럼에 저장만 — 언어 실제 전환·거리단위 지도 반영은 Phase 6
 * i18n/§6.4 이관 이후), 알림(발송 파이프라인 없이 설정값만 저장, Phase 6에서
 * 소비), 데이터(백업 JSON 내보내기/가져오기 연동 + 오프라인 캐시 삭제),
 * 정보(약관/개인정보처리방침/오픈소스 라이선스/문의하기) 섹션을 채운다.
 */
type SettingsSection = 'preferences' | 'notifications' | 'data' | 'community' | 'about';

export function SettingsScreen() {
  const appVersion = useAppVersion();
  const { section: sectionParam } = useParams();
  const { t, i18n } = useTranslation(['settings', 'common']);
  const { user, loading } = useSession();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const trips = useTrips();
  // PC(1024px~)는 Stitch/setting 시안의 별도 화면(SettingsDesktop), 모바일은 아래 화면 그대로
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [showDeleteFlow, setShowDeleteFlow] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showUnitSettings, setShowUnitSettings] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<'general' | 'partnership' | null>(null);

  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme());
  const [cacheUsageMB, setCacheUsageMB] = useState<number | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    trackScreenView('settings');
  }, []);

  useEffect(() => {
    void readCacheUsageMB().then((mb) => {
      if (mb != null) setCacheUsageMB(mb);
    });
  }, []);

  // 운영자 계정에만 보이는 운영 콘솔 줄 — 앱에는 주소창이 없어 콘솔(/admin)로 들어갈 길이 설정뿐이다
  const { data: isAdminViewer } = useIsAdminViewer(user?.id ?? null);

  if (isDesktop && user) return <SettingsDesktop />;

  if (showDeleteFlow) {
    return <DeleteAccountFlow />;
  }

  function handleThemeChange(next: ThemePreference) {
    setTheme(next);
    setThemeState(next);
  }

  async function handleClearCache() {
    setClearingCache(true);
    try {
      // 앱 셸 캐시(오프라인으로 앱을 여는 데 필요)는 남기고, 사진 캐시와 저장된 여행 데이터만 비운다
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('triptic-images')).map((key) => caches.delete(key)));
      await clearOfflineCache();
      const mb = await readCacheUsageMB();
      if (mb != null) setCacheUsageMB(mb);
    } catch (err) {
      captureError(err, { context: 'clearOfflineCache' });
    } finally {
      setClearingCache(false);
    }
  }

  function updateNotificationPref(key: NotificationKey, value: boolean) {
    const base: NotificationPrefs = normalizeNotificationPrefs(profile?.notification_prefs);
    updateProfile.mutate({ notification_prefs: { ...base, [key]: value } });
    // 알림을 켜는 순간 기기 등록도 확인한다(네이티브 앱에서만 동작 — src/shared/push/registerPush.ts. 보통은 로그인할 때 이미 등록돼 있다).
    if (value && user) {
      registerPushNotifications(user.id).catch((err) => captureError(err, { context: 'registerPushNotifications' }));
    }
  }

  const currentPrefs: NotificationPrefs = normalizeNotificationPrefs(profile?.notification_prefs);
  const masterOn = notificationsEnabled(currentPrefs);

  /** 알림 전체 허용 — 끄면 묶음 설정은 그대로 두고 서버가 모든 알림(운영 조치 포함)을 만들지 않는다. 켤 때 앱에서는 이 기기도 등록한다(iOS에서 막혀 있으면 설정 안내) */
  function setNotificationsMaster(value: boolean) {
    updateProfile.mutate({ notification_prefs: withNotificationsEnabled(currentPrefs, value) });
    if (value && user) {
      registerPushNotifications(user.id)
        .then((ok) => {
          if (!ok && isNativeApp()) showToast(t('notifications.osDenied'));
        })
        .catch((err) => captureError(err, { context: 'registerPushNotifications' }));
    }
  }

  const menu: { key: SettingsSection; icon: ReactNode; label: string; needsLogin: boolean }[] = [
    { key: 'preferences', icon: <Palette size={20} />, label: t('menu.preferences'), needsLogin: false },
    { key: 'notifications', icon: <Bell size={20} />, label: t('menu.notifications'), needsLogin: true },
    { key: 'data', icon: <HardDrive size={20} />, label: t('menu.data'), needsLogin: false },
    { key: 'community', icon: <Globe size={20} />, label: t('menu.community'), needsLogin: true },
    { key: 'about', icon: <Info size={20} />, label: t('menu.about'), needsLogin: false },
  ];
  const visibleMenu = menu.filter((item) => !item.needsLogin || user);
  const section = visibleMenu.find((item) => item.key === sectionParam);

  const preferencesContent = (
    <div className={styles.card}>
      <div className={styles.row}>
        <span>{t('preferences.theme')}</span>
        <div className={styles.themeToggleGroup}>
          <button type="button" className={theme === 'light' ? styles.themeToggleActive : styles.themeToggleBtn} onClick={() => handleThemeChange('light')} aria-label={t('preferences.themeLight')} aria-pressed={theme === 'light'}><Sun size={18}/></button>
          <button type="button" className={theme === 'dark' ? styles.themeToggleActive : styles.themeToggleBtn} onClick={() => handleThemeChange('dark')} aria-label={t('preferences.themeDark')} aria-pressed={theme === 'dark'}><Moon size={18}/></button>
          <button type="button" className={theme === 'system' ? styles.themeToggleActive : styles.themeToggleBtn} onClick={() => handleThemeChange('system')} aria-label={t('preferences.themeSystem')} aria-pressed={theme === 'system'}><Monitor size={18}/></button>
        </div>
      </div>
      {user ? (
        <>
          <button type="button" className={`${styles.row} ${styles.rowButton}`} onClick={() => setShowUnitSettings(true)}>
            <span>{t('preferences.unitSettings')}</span>
            <span style={{color: 'var(--text-muted)'}}>{profile?.temp_unit === 'f' ? '°F' : '°C'}, {profile?.distance_unit === 'mi' ? 'mi' : 'km'} &gt;</span>
          </button>
          <button type="button" className={`${styles.row} ${styles.rowButton}`} onClick={() => setShowCurrencyModal(true)}>
            <span>{t('preferences.baseCurrency')}</span>
            <span style={{color: 'var(--text-muted)'}}>{profile?.base_currency ?? 'KRW'} &gt;</span>
          </button>
          <button type="button" className={`${styles.row} ${styles.rowButton}`} onClick={() => setShowLanguageModal(true)}>
            <span>{t('preferences.language')}</span>
            <span style={{color: 'var(--text-muted)'}}>{LANGUAGE_AUTONYMS[normalizeLocale(i18n.language)]} &gt;</span>
          </button>
        </>
      ) : (
        <p className={styles.hint}>{t('preferences.loginHint')}</p>
      )}
    </div>
  );

  const notificationsContent = (
    <div className={styles.card}>
      {/* 맨 위 "알림 허용" — 꺼 두면 아래 세부 알림은 눌러지지 않는다 */}
      <label className={`${styles.row} ${styles.masterRow}`}>
        <span>{t('notifications.master')}</span>
        <input type="checkbox" checked={masterOn} onChange={(e) => setNotificationsMaster(e.target.checked)} />
      </label>
      {(Object.keys(NOTIFICATION_LABEL_KEYS) as NotificationKey[]).map((key) => (
        <label className={`${styles.row} ${masterOn ? '' : styles.rowDisabled}`} key={key}>
          <span>{t(NOTIFICATION_LABEL_KEYS[key])}</span>
          <input
            type="checkbox"
            disabled={!masterOn}
            checked={masterOn && currentPrefs[key]}
            onChange={(e) => updateNotificationPref(key, e.target.checked)}
          />
        </label>
      ))}
      <p className={styles.hint}>{t('notifications.hint')}</p>
    </div>
  );

  const dataContent = (
    <div className={styles.card}>
      <div className={styles.row}>
        <span>{t('data.offlineCache')}</span>
        <span>{cacheUsageMB == null ? t('data.calculating') : `${cacheUsageMB.toFixed(1)}MB`}</span>
      </div>
      <div className={styles.row}>
        <button type="button" className={styles.linkButton} onClick={handleClearCache} disabled={clearingCache}>
          {clearingCache ? t('data.clearingCache') : t('data.clearCache')}
        </button>
      </div>
      <div className={styles.row}>
        <button type="button" className={styles.linkButton} onClick={() => setShowBackup(true)}>
          {t('data.backup')}
        </button>
      </div>
      <p className={styles.hint}>{t('data.pdfHint')}</p>
    </div>
  );

  const communityContent = user ? (
    <div className={styles.card}>
      <BlockedUsersList userId={user.id} />
    </div>
  ) : null;

  const aboutContent = (
    <div className={styles.card}>
      <div className={styles.row}>
        <Link to="/guide" className={styles.linkButton}>
          {t('about.guide')}
        </Link>
      </div>
      <div className={styles.row}>
        <Link to="/notices" className={styles.linkButton}>
          {t('about.notices')}
        </Link>
      </div>
      <div className={styles.row}>
        <a href="/terms.html" target="_blank" rel="noopener" className={styles.linkButton}>
          {t('legal.terms', { ns: 'common' })}
        </a>
      </div>
      <div className={styles.row}>
        <a href="/privacy.html" target="_blank" rel="noopener" className={styles.linkButton}>
          {t('legal.privacy', { ns: 'common' })}
        </a>
      </div>
      <div className={styles.row}>
        <button type="button" className={styles.linkButton} onClick={() => setFeedbackKind('general')}>
          {t('feedback.menuLabel')}
        </button>
      </div>
      <div className={styles.row}>
        <button type="button" className={styles.linkButton} onClick={() => setFeedbackKind('partnership')}>
          {t('about.partnership')}
        </button>
      </div>
      <p className={styles.row}>{t('about.version', { version: appVersion })}</p>
      {/* 항목 중간에서 줄이 끊기지 않게 "운영자 · 메일" / "호스팅" / "저작권" 세 줄로 나눈다 */}
      <p className={`${styles.hint} ${styles.operator}`}>
        <span>
          {t('about.operatorItem')}
          <span className={styles.dot} aria-hidden="true">
            ·
          </span>
          admin@triptic.my
        </span>
        <span>{t('about.hostingItem')}</span>
        <span>&copy; {new Date().getFullYear()} Triptic</span>
      </p>
    </div>
  );

  const sectionContent: Record<SettingsSection, ReactNode> = {
    preferences: preferencesContent,
    notifications: notificationsContent,
    data: dataContent,
    community: communityContent,
    about: aboutContent,
  };

  return (
    <div className={styles.container}>
      {section ? (
        <>
          <div className={styles.subHeader}>
            <Link to="/settings" className={styles.backButton} aria-label={t('menu.back')}>
              <ArrowLeft size={22} />
            </Link>
            <h1 className={styles.subTitle}>{section.label}</h1>
          </div>
          {sectionContent[section.key]}
        </>
      ) : (
        <>
          {loading ? null : user ? (
            <button type="button" className={styles.profileCard} onClick={() => setShowEditProfile(true)} aria-label={t('account.editProfile')}>
              <ProfileAvatar userId={user.id} pixelSeed={profile?.pixel_avatar_seed} photoUrl={profile?.avatar_url} className={styles.avatar} />
              <span className={styles.profileInfo}>
                <span className={styles.profileNameRow}>
                  <span className={styles.profileName}>{profile?.display_name || user.user_metadata?.name || t('account.fallbackName')}</span>
                  {profile?.plan === 'pro' ? <ProBadge /> : null}
                </span>
                {profile?.handle ? <span className={styles.profileHandle}>@{profile.handle}</span> : null}
                <span className={styles.profileEmail}>{user.email}</span>
              </span>
              <ChevronRight size={20} className={styles.chevron} aria-hidden="true" />
            </button>
          ) : loading ? null : (
            <div className={styles.card}>
              <LoginButtons redirectPath="/" />
            </div>
          )}

          <nav className={`${styles.card} ${styles.menuList}`} aria-label={t('menu.title')}>
            {visibleMenu.map((item) => (
              <Link key={item.key} to={`/settings/${item.key}`} className={styles.menuRow}>
                <span className={styles.menuIcon}>{item.icon}</span>
                <span className={styles.menuLabel}>{item.label}</span>
                <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
              </Link>
            ))}
            {isAdminViewer ? (
              <Link to="/admin" className={styles.menuRow}>
                <span className={styles.menuIcon}>
                  <ShieldCheck size={20} />
                </span>
                <span className={styles.menuLabel}>{t('menu.admin')}</span>
                <ChevronRight size={18} className={styles.chevron} aria-hidden="true" />
              </Link>
            ) : null}
            {/* 로그아웃·계정 삭제는 메뉴와 같은 모양의 줄로 — 앱 정보(운영자는 운영 콘솔) 바로 아래 */}
            {user ? (
              <>
                <button
                  type="button"
                  className={`${styles.menuRow} ${styles.menuRowButton}`}
                  onClick={() => signOut().catch((err) => captureError(err, { context: 'signOut' }))}
                >
                  <span className={styles.menuIcon}>
                    <LogOut size={20} />
                  </span>
                  <span className={styles.menuLabel}>{t('account.signOut')}</span>
                </button>
                <button type="button" className={`${styles.menuRow} ${styles.menuRowButton} ${styles.menuRowDanger}`} onClick={() => setShowDeleteFlow(true)}>
                  <span className={styles.menuIcon}>
                    <UserX size={20} />
                  </span>
                  <span className={styles.menuLabel}>{t('account.deleteAction')}</span>
                </button>
              </>
            ) : null}
          </nav>
        </>
      )}

      {showBackup ? (
        <BackupModal trips={trips.data ?? []} onClose={() => setShowBackup(false)} onImported={() => trips.refetch()} />
      ) : null}
      {showEditProfile ? <EditProfileModal onClose={() => setShowEditProfile(false)} profile={profile} updateProfile={updateProfile} /> : null}
      {showUnitSettings ? <UnitSettingsModal onClose={() => setShowUnitSettings(false)} profile={profile} updateProfile={updateProfile} /> : null}
      {showCurrencyModal ? <CurrencyModal onClose={() => setShowCurrencyModal(false)} profile={profile} updateProfile={updateProfile} /> : null}
      {showLanguageModal ? <LanguageModal onClose={() => setShowLanguageModal(false)} profile={profile} updateProfile={updateProfile} /> : null}
      {feedbackKind ? <FeedbackModal kind={feedbackKind} onClose={() => setFeedbackKind(null)} /> : null}
    </div>
  );
}
