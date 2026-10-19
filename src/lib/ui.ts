import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error' | 'info';
}

interface UiState {
  confirmReq: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  toasts: Toast[];
  printDoc: string | null;
  setPrintDoc: (id: string | null) => void;
  /** بند يُطلب فتحه في المكتبة */
  focusClause: string | null;
  /** الاجتماع المعتمد لتوليد جدول الأعمال والمحضر */
  reportMeetingId: string | null;
  /** الوثيقة المحددة في التقارير */
  reportDoc: string;
  navOpen: boolean;
  setNavOpen: (v: boolean) => void;
}

let tid = 0;

export const useUi = create<UiState>((set) => ({
  confirmReq: null,
  toasts: [],
  printDoc: null,
  setPrintDoc: (id) => set({ printDoc: id }),
  focusClause: null,
  reportMeetingId: null,
  reportDoc: 'charter',
  navOpen: false,
  setNavOpen: (v) => set({ navOpen: v }),
}));

/** نافذة تأكيد بوعد: تعيد true إذا أكد المستخدم */
export const confirmAction = (opts: ConfirmOptions): Promise<boolean> =>
  new Promise((resolve) => {
    useUi.setState({
      confirmReq: {
        ...opts,
        resolve: (ok) => {
          useUi.setState({ confirmReq: null });
          resolve(ok);
        },
      },
    });
  });

export const toast = (text: string, kind: Toast['kind'] = 'ok'): void => {
  const id = ++tid;
  useUi.setState((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
  setTimeout(() => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 7000 : 3500);
};

/** يشغّل عملية غير متزامنة ويعرض نتيجتها أو خطأها للمستخدم */
export const attempt = async (fn: () => void | Promise<void>, okMsg?: string): Promise<boolean> => {
  try {
    await fn();
    if (okMsg) toast(okMsg);
    return true;
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), 'error');
    return false;
  }
};
