import type { TurnstileApi, TurnstileRenderOptions } from "@/lib/turnstile";

/**
 * A fake `window.turnstile`, installed for the whole suite by `setup.ts`.
 *
 * Its presence is what keeps the tests offline: `loadTurnstile` short-circuits
 * on an already-defined `window.turnstile`, so no `<script>` pointing at
 * Cloudflare is ever appended. Cloudflare's always-pass test site key would
 * work in a browser but still needs the network, which is the thing the ticket
 * rules out — so the widget is stubbed instead, beside the `ResizeObserver`
 * polyfill that is there for the same reason.
 */
export interface FakeTurnstileWidget {
  readonly id: string;
  readonly sitekey: string;
  /** Resolve the challenge, as a visitor passing it would. */
  solve: (token?: string) => void;
  /** The widget itself failing — Cloudflare's `error-callback`. */
  fail: () => void;
  /** A solved challenge going stale — Cloudflare's `expired-callback`. */
  expire: () => void;
  removed: boolean;
}

const widgets: FakeTurnstileWidget[] = [];
let nextId = 0;

export function installFakeTurnstile(): void {
  widgets.length = 0;
  nextId = 0;
  const api: TurnstileApi = {
    render(_container: HTMLElement, options: TurnstileRenderOptions) {
      const id = `fake-widget-${nextId++}`;
      widgets.push({
        id,
        sitekey: options.sitekey,
        solve: (token = "fake-turnstile-token") => options.callback(token),
        fail: () => options["error-callback"](),
        expire: () => options["expired-callback"](),
        removed: false,
      });
      return id;
    },
    reset(widgetId: string) {
      void widgetId;
    },
    remove(widgetId: string) {
      const widget = widgets.find((w) => w.id === widgetId);
      if (widget) widget.removed = true;
    },
  };
  window.turnstile = api;
}

/** The most recently rendered widget. Throws rather than returning undefined,
 * so a test that expected a widget and got none fails on that fact instead of
 * on a later `undefined` dereference. */
export function currentTurnstileWidget(): FakeTurnstileWidget {
  const widget = widgets.at(-1);
  if (!widget) throw new Error("No Turnstile widget has been rendered");
  return widget;
}

export function renderedTurnstileWidgetCount(): number {
  return widgets.length;
}
