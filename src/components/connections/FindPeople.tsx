import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { ApiError, isEmailNotVerified } from "@/api/client";
import { searchUsers, sendConnectionRequest } from "@/api/connections";
import type { UserSearchResult } from "@/api/types";
import { useAuth } from "@/components/AuthContext";
import { UserIdentity } from "@/components/UserIdentity";
import { Button } from "@/components/ui/button";
import { useResendVerification } from "@/hooks/useResendVerification";
import { cn } from "@/lib/cn";
import {
  RESEND_ACTION,
  RESEND_SENDING,
  VERIFY_BLOCKED,
  VERIFY_NOTICE,
  resendMessage,
} from "@/lib/verification";

const DEBOUNCE_MS = 250;
/** Counted **after** a leading `@` is stripped, so the minimum means the same
 * thing on both sides of the wire: `@t` is a one-character query, and the
 * server strips the sigil before it matches (NEU-1163 §8). The strip itself
 * stays server-side — a client copy would be a second definition of it. */
const MIN_QUERY_LENGTH = 2;

/** The searchable-length form of what was typed. Not `normaliseHandle`: this
 * is a query, not a handle, and it is sent as typed — an email and a display
 * name both go through this box too. */
function queryLength(raw: string): number {
  return raw.replace(/^@/, "").length;
}

/** The id every gated Connect button describes itself with. One sentence for
 * twenty rows (NEU-1167 §3.2). */
const NOTICE_ID = "verify-gate-help";

type ConnectState = "idle" | "sending" | "sent";

export function FindPeople() {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [states, setStates] = useState<Record<string, ConnectState>>({});
  const [refused, setRefused] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();

  // Unverified accounts cannot send a connection request (NEU-1161 §4). While
  // `me` is still in flight `user` is null and nothing is gated — the guard on
  // the click and the 403 backstop below both still hold if it resolves the
  // other way.
  //
  // `refused` is what a 403 leaves behind: a viewer whose `me` said verified at
  // page load and who was refused at click time has seen no notice at all, so
  // the backstop raises the same explained state the load-time path draws
  // rather than a toast that disappears.
  const gated = (user !== null && user.email_verified_at === null) || refused;

  useEffect(() => {
    const trimmed = input.trim();
    const next = queryLength(trimmed) >= MIN_QUERY_LENGTH ? trimmed : "";
    const handle = setTimeout(() => setDebounced(next), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [input]);

  const {
    data: results,
    isFetching,
    isError,
  } = useQuery<UserSearchResult[]>({
    queryKey: ["users-search", debounced],
    queryFn: () => searchUsers(debounced),
    enabled: queryLength(debounced) >= MIN_QUERY_LENGTH,
  });

  const send = useMutation({
    mutationFn: (userId: string) => sendConnectionRequest(userId),
    onMutate: (userId) => {
      setStates((s) => ({ ...s, [userId]: "sending" }));
    },
    onSuccess: (_data, userId) => {
      setStates((s) => ({ ...s, [userId]: "sent" }));
      qc.invalidateQueries({ queryKey: ["connection-requests"] });
    },
    onError: (err, userId) => {
      setStates((s) => ({ ...s, [userId]: "idle" }));
      // The backstop for the state the button gate missed — a verification
      // that has not landed yet at click time, or an `email_verified_at` that
      // was still loading when the page drew.
      if (isEmailNotVerified(err)) {
        setRefused(true);
        toast.error(VERIFY_BLOCKED);
      } else if (err instanceof ApiError && err.status === 409) {
        toast.error("Already connected or request pending.");
      } else {
        toast.error("Could not send request. Try again.");
      }
    },
  });

  function connect(userId: string) {
    // The refusal lives here rather than in the `disabled` attribute — see
    // `ConnectButton`. No request is issued.
    if (gated) {
      toast.error(VERIFY_BLOCKED);
      return;
    }
    send.mutate(userId);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          role="searchbox"
          aria-label="Find people"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by display name, handle or email"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          className="w-full rounded border border-border bg-background py-1.5 pl-7 pr-2 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
        />
      </div>

      {gated && <VerifyNotice />}

      {queryLength(debounced) >= MIN_QUERY_LENGTH && (
        <SearchResults
          results={results}
          isFetching={isFetching}
          isError={isError}
          states={states}
          blocked={gated}
          onConnect={connect}
        />
      )}
    </div>
  );
}

/** The in-context explanation, deliberately **not** dismissible: it is the
 * floor the banner's per-tab dismissal cannot go below, so a user who
 * dismissed the banner and walked here never meets a row of inert buttons with
 * no reason anywhere on the page. */
function VerifyNotice() {
  const { status, resend } = useResendVerification();
  const outcome = resendMessage(status);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
      {/* The id carries the sentence alone — the resend button's own label is
          not part of the description a Connect button announces. */}
      <p id={NOTICE_ID} role="note" className="flex-1">
        {VERIFY_NOTICE}
      </p>
      {status !== "sent" && (
        <button
          type="button"
          onClick={resend}
          disabled={status === "sending"}
          className="rounded border border-amber-400 px-2 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:hover:bg-amber-900"
        >
          {status === "sending" ? RESEND_SENDING : RESEND_ACTION}
        </button>
      )}
      {outcome && (
        <p role="status" aria-live="polite" className="basis-full text-xs">
          {outcome}
        </p>
      )}
    </div>
  );
}

function SearchResults({
  results,
  isFetching,
  isError,
  states,
  blocked,
  onConnect,
}: {
  results: UserSearchResult[] | undefined;
  isFetching: boolean;
  isError: boolean;
  states: Record<string, ConnectState>;
  blocked: boolean;
  onConnect: (userId: string) => void;
}) {
  if (isError) {
    return <p className="text-sm text-destructive">Failed to search users.</p>;
  }
  if (isFetching && !results) {
    return <p className="text-sm text-muted-foreground">Searching…</p>;
  }
  if (!results || results.length === 0) {
    return <p className="text-sm text-muted-foreground">No matches.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border rounded border border-border">
      {results.map((u) => {
        const state = states[u.id] ?? "idle";
        return (
          <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <UserIdentity displayName={u.display_name} handle={u.handle} />
            </div>
            <ConnectButton state={state} blocked={blocked} onClick={() => onConnect(u.id)} />
          </li>
        );
      })}
    </ul>
  );
}

function ConnectButton({
  state,
  blocked,
  onClick,
}: {
  state: ConnectState;
  blocked: boolean;
  onClick: () => void;
}) {
  if (state === "sent") {
    return (
      <Button type="button" size="sm" variant="outline" disabled className={cn("text-emerald-700")}>
        <Check className="h-4 w-4" aria-hidden />
        Sent
      </Button>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      onClick={onClick}
      disabled={state === "sending"}
      // `aria-disabled` rather than `disabled` while the viewer is unverified,
      // exactly as NEU-1160 gated signup on the Turnstile challenge: a
      // disabled button leaves the tab order, taking the explanation of why it
      // is disabled with it — the dead button this ticket exists to prevent.
      // Focusable means the notice is announced, and pressing it hits the
      // guard in `connect` rather than the network.
      aria-disabled={blocked || undefined}
      aria-describedby={blocked ? NOTICE_ID : undefined}
      className={cn(blocked && "opacity-50")}
    >
      {state === "sending" ? "Sending…" : "Connect"}
    </Button>
  );
}
