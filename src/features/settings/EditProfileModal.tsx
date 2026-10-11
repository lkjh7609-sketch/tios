import { useRef, useState, type FormEvent } from 'react';
import { Shuffle, RotateCcw, ImagePlus, Trash2 } from 'lucide-react';
import { randomAvatarSeed } from '@/features/stats/pixelArt';
import { captureError } from '@/shared/monitoring';
import { showToast } from '@/shared/ui/toast';
import { AvatarError, isUploadedAvatar, removeAvatarFiles, uploadAvatar } from './avatar';
import { ProfileAvatar } from './ProfileAvatar';
import { flagInvalid } from '@/shared/ui/invalidField';
import { useTranslation } from 'react-i18next';
import type { UseMutationResult } from '@tanstack/react-query';
import { DISPLAY_NAME_INPUT_MAX, isValidDisplayName } from '@/shared/displayName';
import { checkDisplayNameAvailable, type MemberAgeBand, type MemberGender, type ProfilePatch, type ProfileRow } from '@/shared/api/profileService';
import { DemographicsFields } from '@/features/community/DemographicsFields';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '../plan/AddPlaceModal.module.css';
import styles from './EditProfileModal.module.css';

interface EditProfileModalProps {
  onClose: () => void;
  profile: ProfileRow | undefined;
  updateProfile: UseMutationResult<void, Error, ProfilePatch>;
}

function getErrorHint(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'hint' in err) {
    return (err as { hint?: string }).hint;
  }
  return undefined;
}

/**
 * 내 정보 변경 — 표시 이름(profiles.display_name, 커뮤니티 글·동행자 목록에 보이는 이름)과 선택 입력인 성별·나잇대
 * (동행 모집글·지원 화면에 표기된다. 2026-10-05 설정 화면의 '내 정보' 칸을 이 창으로 옮겼다).
 * (예전 화면의 휴대폰 인증은 실제 발송 없이 '1234'만 통과시키는 목업이었고, 존재하지 않는
 * nickname/phone 컬럼에 저장하려다 실패하고 있었다 — 제거)
 */
export function EditProfileModal({ onClose, profile, updateProfile }: EditProfileModalProps) {
  const { t } = useTranslation(['settings', 'common']);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [name, setName] = useState(profile?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<'idle' | 'checking' | 'available'>('idle');
  const [checking, setChecking] = useState(false);
  const checkedNameRef = useRef<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nameChanged = name.trim() !== (profile?.display_name ?? '');
  const [gender, setGender] = useState<MemberGender | null>(profile?.gender ?? null);
  const [ageBand, setAgeBand] = useState<MemberAgeBand | null>(profile?.age_band ?? null);
  const [pixelSeed, setPixelSeed] = useState<string | null>(profile?.pixel_avatar_seed ?? null);
  const avatarChanged = pixelSeed !== (profile?.pixel_avatar_seed ?? null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const hasPhoto = isUploadedAvatar(profile?.avatar_url);
  const demographicsChanged = gender !== (profile?.gender ?? null) || ageBand !== (profile?.age_band ?? null);

  /** 사진을 올리면 바로 적용한다(저장 버튼을 기다리지 않는다) — 데스크톱 설정과 같은 방식 */
  async function changePhoto(file: File | undefined) {
    if (!file || !profile) return;
    setPhotoBusy(true);
    try {
      const url = await uploadAvatar(profile.id, file);
      await updateProfile.mutateAsync({ avatar_url: url });
      showToast(t('desktop.account.photoDone'), { tone: 'success' });
    } catch (err) {
      const code = err instanceof AvatarError ? err.code : 'upload_failed';
      if (code === 'upload_failed') captureError(err, { context: 'uploadAvatar' });
      showToast(t(`desktop.account.photoError.${code}`), { tone: 'error' });
    } finally {
      setPhotoBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  async function removePhoto() {
    if (!profile) return;
    setPhotoBusy(true);
    try {
      await removeAvatarFiles(profile.id);
      await updateProfile.mutateAsync({ avatar_url: null });
      showToast(t('desktop.account.photoRemoved'), { tone: 'success' });
    } catch (err) {
      captureError(err, { context: 'removeAvatar' });
      showToast(t('desktop.account.photoError.upload_failed'), { tone: 'error' });
    } finally {
      setPhotoBusy(false);
    }
  }

  function handleNameChange(value: string) {
    setName(value);
    setError(null);
    setCheckState('idle');
  }

  async function handleCheckDuplicate() {
    const trimmed = name.trim();
    if (!isValidDisplayName(trimmed)) {
      setError(t('profile.nameFormatError'));
      flagInvalid(nameInputRef.current);
      return;
    }
    if (!profile) return;
    setChecking(true);
    setError(null);
    try {
      const available = await checkDisplayNameAvailable(trimmed, profile.id);
      checkedNameRef.current = trimmed;
      if (available) {
        setCheckState('available');
      } else {
        setCheckState('idle');
        setError(t('profile.nameTaken'));
      }
    } catch {
      setCheckState('idle');
      setError(t('profile.saveError'));
    } finally {
      setChecking(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('profile.nameRequired'));
      flagInvalid(nameInputRef.current);
      return;
    }
    if (!nameChanged && !demographicsChanged && !avatarChanged) {
      onClose();
      return;
    }
    if (nameChanged) {
      if (!isValidDisplayName(trimmed)) {
        setError(t('profile.nameFormatError'));
        flagInvalid(nameInputRef.current);
        return;
      }
      if (checkState !== 'available' || checkedNameRef.current !== trimmed) {
        setError(t('profile.nameCheckRequired'));
        flagInvalid(nameInputRef.current);
        return;
      }
    }
    updateProfile.mutate(
      {
        ...(nameChanged ? { display_name: trimmed } : {}),
        ...(demographicsChanged ? { gender, age_band: ageBand } : {}),
        ...(avatarChanged ? { pixel_avatar_seed: pixelSeed } : {}),
      },
      {
        onSuccess: onClose,
        onError: (err) => {
          const hint = getErrorHint(err);
          if (hint === 'duplicate_display_name') setError(t('profile.nameTaken'));
          else if (hint === 'reserved_display_name') setError(t('profile.nameReserved'));
          else if (hint === 'invalid_display_name') setError(t('profile.nameFormatError'));
          else setError(t('profile.saveError'));
        },
      },
    );
  }

  return (
    <div className={modalStyles.overlay}>
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <h2 id="edit-profile-title">{t('profile.title')}</h2>
          <div className={modalStyles.field}>
            <label className={modalStyles.label} htmlFor="profile-name">
              {t('profile.nameLabel')}
            </label>
            <div className={styles.nameRow}>
              <input
                ref={nameInputRef}
                id="profile-name"
                className={modalStyles.input}
                value={name}
                maxLength={DISPLAY_NAME_INPUT_MAX}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t('profile.namePlaceholder')}
                autoComplete="nickname"
              />
              <button
                type="button"
                className={styles.checkBtn}
                onClick={handleCheckDuplicate}
                disabled={!nameChanged || checking || !profile}
              >
                {checking ? t('profile.checking') : t('profile.checkDuplicate')}
              </button>
            </div>
            <p className={modalStyles.hint}>{t('profile.nameHint')}</p>
            {!error && checkState === 'available' ? (
              <p className={`${modalStyles.hint} ${styles.available}`}>{t('profile.nameAvailable')}</p>
            ) : null}
            {error ? (
              <p className={modalStyles.error} role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className={modalStyles.field}>
            <span className={modalStyles.label}>{t('profile.pixelAvatarLabel')}</span>
            <div className={styles.avatarRow}>
              {/* 지금 프로필 사진으로 보이는 모습 — 올린 사진이 있으면 사진, 없으면 도트 캐릭터 상반신 */}
              <ProfileAvatar
                userId={profile?.id ?? ''}
                pixelSeed={pixelSeed}
                photoUrl={hasPhoto ? profile?.avatar_url : null}
                className={styles.avatarPreview}
              />
              <div className={styles.avatarBtns}>
                <button type="button" className={styles.checkBtn} onClick={() => setPixelSeed(randomAvatarSeed())}>
                  <Shuffle size={14} aria-hidden="true" /> {t('profile.pixelAvatarRandom')}
                </button>
                {pixelSeed ? (
                  <button type="button" className={styles.checkBtn} onClick={() => setPixelSeed(null)}>
                    <RotateCcw size={14} aria-hidden="true" /> {t('profile.pixelAvatarReset')}
                  </button>
                ) : null}
                <button type="button" className={styles.checkBtn} disabled={photoBusy || !profile} onClick={() => photoInputRef.current?.click()}>
                  <ImagePlus size={14} aria-hidden="true" /> {t('profile.photoUpload')}
                </button>
                {hasPhoto ? (
                  <button type="button" className={styles.checkBtn} disabled={photoBusy} onClick={() => void removePhoto()}>
                    <Trash2 size={14} aria-hidden="true" /> {t('profile.photoRemove')}
                  </button>
                ) : null}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  aria-label={t('profile.photoUpload')}
                  onChange={(e) => void changePhoto(e.target.files?.[0])}
                />
              </div>
            </div>
            <p className={modalStyles.hint}>{t('profile.pixelAvatarHint')}</p>
          </div>
          <div className={modalStyles.field}>
            <span className={modalStyles.label}>{t('demographics.settingsTitle', { ns: 'community' })}</span>
            <DemographicsFields required gender={gender} ageBand={ageBand} onChange={(next) => { setGender(next.gender); setAgeBand(next.ageBand); }} />
            <p className={modalStyles.hint}>{t('demographics.settingsHint', { ns: 'community' })}</p>
          </div>
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.secondary} onClick={onClose}>
              {t('common:action.cancel')}
            </button>
            <button
              type="submit"
              className={modalStyles.primary}
              disabled={updateProfile.isPending}
            >
              {t('common:action.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
