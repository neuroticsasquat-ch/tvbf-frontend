import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import {
  searchUsers,
  sendConnectionRequest,
} from "@/api/connections";
import type { UserSearchResult } from "@/api/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

type ConnectState = "idle" | "sending" | "sent";

export function FindPeople() {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [states, setStates] = useState<Record<string, ConnectState>>({});
  const qc = useQueryClient();

  useEffect(() => {
    const trimmed = input.trim();
    const next = trimmed.length >= MIN_QUERY_LENGTH ? trimmed : "";
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
    enabled: debounced.length >= MIN_QUERY_LENGTH,
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
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Already connected or request pending.");
      } else {
        toast.error("Could not send request. Try again.");
      }
    },
  });

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
          placeholder="Search by display name or email"
          className="w-full rounded border border-border bg-background py-1.5 pl-7 pr-2 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
        />
      </div>

      {debounced.length >= MIN_QUERY_LENGTH && (
        <SearchResults
          results={results}
          isFetching={isFetching}
          isError={isError}
          states={states}
          onConnect={(userId) => send.mutate(userId)}
        />
      )}
    </div>
  );
}

function SearchResults({
  results,
  isFetching,
  isError,
  states,
  onConnect,
}: {
  results: UserSearchResult[] | undefined;
  isFetching: boolean;
  isError: boolean;
  states: Record<string, ConnectState>;
  onConnect: (userId: string) => void;
}) {
  if (isError) {
    return (
      <p className="text-sm text-destructive">Failed to search users.</p>
    );
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
          <li
            key={u.id}
            className="flex items-center justify-between px-3 py-2"
          >
            <span className="text-sm">{u.display_name}</span>
            <ConnectButton
              state={state}
              onClick={() => onConnect(u.id)}
            />
          </li>
        );
      })}
    </ul>
  );
}

function ConnectButton({
  state,
  onClick,
}: {
  state: ConnectState;
  onClick: () => void;
}) {
  if (state === "sent") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled
        className={cn("text-emerald-700")}
      >
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
    >
      {state === "sending" ? "Sending…" : "Connect"}
    </Button>
  );
}
