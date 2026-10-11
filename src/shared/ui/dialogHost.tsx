import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import i18next from '@/shared/i18n';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './DialogHost.module.css';

/**
 * window.confirm / window.prompt 대신 쓰는 앱 안 창 — 앱(WKWebView)의 기본 확인·입력 창은 모양이 제각각이고 한국어 버튼도 못 바꾼다.
 *  · confirmDialog: 가운데 확인 창(ConfirmDialog) — 지우기·나가기처럼 되돌리기 어려운 일을 묻는다
 *  · promptDialog:  아래에서 올라오는 입력 시트 — 이름 바꾸기 같은 한 줄 입력
 * 둘 다 Promise를 돌려주고(취소는 false·null), App이 한 번 그려 두는 <DialogHost />가 띄운다. 여러 개가 겹치면 차례로 띄운다.
 */
interface ConfirmRequest {
  kind: 'confirm';
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (value: boolean) => void;
  /** 이미 답이 정해졌는지 — ConfirmDialog는 확인을 눌러도 onClose를 먼저 부르므로 첫 답만 쓴다 */
  settled?: boolean;
}
interface PromptRequest {
  kind: 'prompt';
  title: string;
  defaultValue: string;
  placeholder: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (value: string | null) => void;
}
type Request = ConfirmRequest | PromptRequest;

const queue: Request[] = [];
let current: Request | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function next() {
  current = queue.shift() ?? null;
  emit();
}
function enqueue(request: Request) {
  queue.push(request);
  if (!current) next();
}

const cancelText = () => i18next.t('common:action.cancel');
const confirmText = () => i18next.t('common:action.confirm');

export function confirmDialog(options: { title: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) =>
    enqueue({
      kind: 'confirm',
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? confirmText(),
      cancelLabel: options.cancelLabel ?? cancelText(),
      danger: options.danger ?? false,
      resolve,
    }),
  );
}

export function promptDialog(options: { title: string; defaultValue?: string; placeholder?: string; confirmLabel?: string; cancelLabel?: string }): Promise<string | null> {
  return new Promise((resolve) =>
    enqueue({
      kind: 'prompt',
      title: options.title,
      defaultValue: options.defaultValue ?? '',
      placeholder: options.placeholder ?? '',
      confirmLabel: options.confirmLabel ?? confirmText(),
      cancelLabel: options.cancelLabel ?? cancelText(),
      resolve,
    }),
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function PromptSheet({ request }: { request: PromptRequest }) {
  const [value, setValue] = useState(request.defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const finish = (result: string | null) => {
    request.resolve(result);
    next();
  };
  const trapRef = useFocusTrap<HTMLDivElement>(() => finish(null));
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const trimmed = value.trim();
  return (
    <div className={styles.overlay} onClick={() => finish(null)}>
      <div ref={trapRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label={request.title} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{request.title}</h2>
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          placeholder={request.placeholder}
          aria-label={request.title}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && trimmed) finish(trimmed);
          }}
        />
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => finish(null)}>
            {request.cancelLabel}
          </button>
          <button type="button" className={styles.primary} disabled={!trimmed} onClick={() => finish(trimmed)}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** App에 한 번만 둔다 — 요청이 있으면 확인 창이나 입력 시트를 띄운다 */
export function DialogHost() {
  const request = useSyncExternalStore(subscribe, () => current);
  if (!request) return null;
  if (request.kind === 'confirm') {
    return (
      <ConfirmDialog
        key={request.title + request.message}
        title={request.title}
        message={request.message}
        cancelLabel={request.cancelLabel}
        confirmLabel={request.confirmLabel}
        danger={request.danger}
        onConfirm={() => {
          if (request.settled) return;
          request.settled = true;
          request.resolve(true);
          next();
        }}
        onClose={() => {
          // 확인을 누르면 onClose 직후 onConfirm이 불린다 — 같은 틱이 끝난 뒤에도 답이 없을 때만 취소로 본다
          queueMicrotask(() => {
            if (request.settled) return;
            request.settled = true;
            request.resolve(false);
            next();
          });
        }}
      />
    );
  }
  return <PromptSheet key={request.title + request.defaultValue} request={request} />;
}
