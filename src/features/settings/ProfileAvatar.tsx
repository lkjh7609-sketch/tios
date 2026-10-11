import { useMemo } from 'react';
import { PixelSprite } from '@/features/stats/PixelSprite';
import { avatarBustGrid, avatarSeedOf } from '@/features/stats/pixelArt';
import styles from './ProfileAvatar.module.css';

/**
 * 프로필 사진 — 직접 올린 사진이 있으면 그 사진, 없으면 도트 캐릭터의 얼굴~상반신(기본값).
 * 소셜 로그인 사진은 쓰지 않는다(2026-10-11, 사용자 결정). 바꾸려면 설정 → 내 정보 변경.
 * 크기·테두리는 className으로 정한다(원형 틀 안을 채운다).
 */
export function ProfileAvatar({
  userId,
  pixelSeed,
  photoUrl,
  className,
}: {
  userId: string;
  pixelSeed?: string | null;
  photoUrl?: string | null;
  className?: string;
}) {
  const grid = useMemo(() => avatarBustGrid(avatarSeedOf(userId, pixelSeed)), [userId, pixelSeed]);
  return (
    <span className={`${styles.frame} ${className ?? ''}`}>
      {photoUrl ? <img src={photoUrl} alt="" className={styles.fill} /> : <PixelSprite grid={grid} pixel={2} className={styles.fill} />}
    </span>
  );
}
