import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { resetTurnstileLoaderForTests } from "@/lib/turnstile";
import { currentTurnstileWidget, renderedTurnstileWidgetCount } from "@/test/turnstile";

import { TurnstileWidget } from "./TurnstileWidget";

describe("TurnstileWidget", () => {
  it("renders a challenge for the site key and reports the token once solved", async () => {
    const onToken = vi.fn();
    render(<TurnstileWidget siteKey="site-key-1" onToken={onToken} />);

    await waitFor(() => expect(renderedTurnstileWidgetCount()).toBe(1));
    expect(currentTurnstileWidget().sitekey).toBe("site-key-1");
    // Nothing is solved yet, so the caller has been told there is no token.
    expect(onToken).toHaveBeenCalledWith(null);

    act(() => currentTurnstileWidget().solve("tok-abc"));
    expect(onToken).toHaveBeenLastCalledWith("tok-abc");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("withdraws the token and offers a retry when the challenge errors", async () => {
    const onToken = vi.fn();
    render(<TurnstileWidget siteKey="k" onToken={onToken} />);
    await waitFor(() => expect(renderedTurnstileWidgetCount()).toBe(1));

    act(() => currentTurnstileWidget().solve("tok-abc"));
    expect(onToken).toHaveBeenLastCalledWith("tok-abc");

    act(() => currentTurnstileWidget().fail());
    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    expect(screen.getByRole("button", { name: /retry verification/i })).toBeInTheDocument();
  });

  it("withdraws the token when a solved challenge expires", async () => {
    const onToken = vi.fn();
    render(<TurnstileWidget siteKey="k" onToken={onToken} />);
    await waitFor(() => expect(renderedTurnstileWidgetCount()).toBe(1));

    act(() => currentTurnstileWidget().solve("tok-abc"));
    act(() => currentTurnstileWidget().expire());

    expect(onToken).toHaveBeenLastCalledWith(null);
    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/i);
  });

  it("draws a fresh challenge when the retry is used", async () => {
    render(<TurnstileWidget siteKey="k" onToken={vi.fn()} />);
    await waitFor(() => expect(renderedTurnstileWidgetCount()).toBe(1));
    const first = currentTurnstileWidget();

    act(() => first.fail());
    await userEvent.click(screen.getByRole("button", { name: /retry verification/i }));

    await waitFor(() => expect(renderedTurnstileWidgetCount()).toBe(2));
    expect(first.removed).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports the error state when the script itself cannot load", async () => {
    // The one path the installed fake hides: no `window.turnstile`, so the
    // component falls through to injecting the script.
    delete window.turnstile;
    resetTurnstileLoaderForTests();
    const onToken = vi.fn();

    render(<TurnstileWidget siteKey="k" onToken={onToken} />);

    const script = await waitFor(() => {
      const el = document.querySelector("script[src*='challenges.cloudflare.com']");
      if (!el) throw new Error("no Turnstile script was injected");
      return el;
    });
    act(() => {
      script.dispatchEvent(new Event("error"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't load/i);
    expect(onToken).toHaveBeenLastCalledWith(null);
    script.remove();
  });

  it("keeps the challenge in place when the parent re-renders with a new callback", async () => {
    function Host() {
      // A fresh function identity on every render, which is the shape a form
      // written without `useCallback` would hand us.
      return <TurnstileWidget siteKey="k" onToken={() => {}} />;
    }
    const { rerender } = render(<Host />);
    await waitFor(() => expect(renderedTurnstileWidgetCount()).toBe(1));

    rerender(<Host />);
    rerender(<Host />);

    expect(renderedTurnstileWidgetCount()).toBe(1);
  });
});
