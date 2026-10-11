/**
 * 푸시 알림 등록 — 네이티브 셸(iOS/Android)에서만 동작한다(웹 푸시는 범위 밖).
 * 로그인한 뒤 알림 권한을 묻고, 받은 기기 토큰을 서버(push_tokens)에 저장한다. 발송은 서버(Edge Function send-push, APNs)가 한다.
 * 이 기기의 토큰은 따로 기억해 두었다가, 로그아웃할 때 지운다(같은 기기에 다른 사람이 로그인했을 때 이전 사람의 알림이 오지 않게).
 */
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { captureError } from '@/shared/monitoring';
import { isNativeApp } from '@/shared/platform';
import { deletePushToken, savePushToken, type PushPlatform } from './pushService';

const TOKEN_KEY = 'triptic-push-token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // 저장소를 못 쓰면 기억만 못 한다
  }
}

let currentUserId: string | null = null;
let listenersReady = false;

/** 앱 안 경로만 연다 — 서버가 보낸 값이라도 바깥 주소는 버린다 */
export function safeAppPath(path: unknown): string | null {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && path.length <= 200 ? path : null;
}

/** 이 기기의 알림 권한 — 앱이 아니거나 확인 못 하면 null. 'prompt'는 아직 한 번도 안 물어본 상태 */
export async function readPushPermission(): Promise<'prompt' | 'granted' | 'denied' | null> {
  if (!isNativeApp()) return null;
  try {
    const { receive } = await PushNotifications.checkPermissions();
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
  } catch (err) {
    captureError(err, { context: 'readPushPermission' });
    return null;
  }
}

/** options.prompt=false면 아직 안 물어본 상태에서 iOS 권한 창을 띄우지 않는다(앱 안 동의 창을 먼저 보여 줄 때) */
export async function registerPushNotifications(userId: string, options: { prompt?: boolean } = {}): Promise<boolean> {
  if (!isNativeApp()) return false;
  const prompt = options.prompt ?? true;

  const platform = Capacitor.getPlatform();
  if (platform !== 'ios' && platform !== 'android') return false;
  currentUserId = userId;

  try {
    const current = await PushNotifications.checkPermissions();
    const needsAsk = current.receive === 'prompt' || current.receive === 'prompt-with-rationale';
    if (needsAsk && !prompt) return false;
    const permission = needsAsk ? await PushNotifications.requestPermissions() : current;
    // 웹 인스펙터에서 "권한 창이 안 떴다"를 가려내는 용도 — 이미 정해진 권한이면 iOS는 창을 다시 띄우지 않는다
    console.info(`[push] permission ${current.receive} -> ${permission.receive}`);
    if (permission.receive !== 'granted') return false;

    if (!listenersReady) {
      listenersReady = true;
      await PushNotifications.addListener('registration', (token) => {
        writeToken(token.value);
        if (!currentUserId) return;
        void savePushToken(currentUserId, token.value, platform as PushPlatform).catch((err) => captureError(err, { context: 'savePushToken' }));
      });
      await PushNotifications.addListener('registrationError', (err) => {
        captureError(new Error('Push registration failed'), { context: 'pushRegistration', detail: err });
      });
    }

    await PushNotifications.register();
    return true;
  } catch (err) {
    captureError(err, { context: 'registerPushNotifications' });
    return false;
  }
}

/** iPhone 설정의 이 앱 화면을 연다 — iOS는 한 번 정해진(거부한) 알림 권한을 앱이 다시 물을 수 없어 설정에서 켜야 한다 */
export function openPushSettings(): void {
  if (!isNativeApp()) return;
  // Capacitor iOS는 앱 밖 주소로의 이동을 UIApplication.open으로 넘겨 준다 — app-settings:는 이 앱의 설정 화면
  window.location.href = 'app-settings:';
}

/** 로그아웃 직전 — 이 기기의 토큰을 서버에서 지운다(실패해도 로그아웃은 막지 않는다) */
export async function unregisterPushForSignOut(userId: string | null | undefined): Promise<void> {
  if (!isNativeApp()) return;
  const token = readToken();
  writeToken(null);
  currentUserId = null;
  if (!token || !userId) return;
  try {
    await deletePushToken(userId, token);
  } catch (err) {
    captureError(err, { context: 'unregisterPush' });
  }
}

/** 알림을 눌러 앱이 열리면 그 경로로 이동한다(서버가 알림에 담은 path). 돌려주는 함수로 듣기를 멈춘다 */
export function installPushTapHandler(open: (path: string) => void): () => void {
  if (!isNativeApp()) return () => {};
  let removed = false;
  let remove: (() => void) | null = null;
  void PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const path = safeAppPath((action.notification.data as { path?: unknown } | undefined)?.path);
    if (path) open(path);
  })
    .then((handle) => {
      if (removed) void handle.remove();
      else remove = () => void handle.remove();
    })
    .catch((err) => captureError(err, { context: 'pushTapHandler' }));
  return () => {
    removed = true;
    remove?.();
  };
}
