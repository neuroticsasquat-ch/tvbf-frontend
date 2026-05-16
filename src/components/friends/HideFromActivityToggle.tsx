import { useToggleHideFromActivity } from "@/api/me";

export function HideFromActivityToggle({
  showId,
  value,
}: {
  showId: number;
  value: boolean;
}) {
  const toggle = useToggleHideFromActivity(showId);
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        role="switch"
        aria-label="Hide this show from my activity feed"
        checked={value}
        disabled={toggle.isPending}
        onChange={(e) => toggle.mutate(e.currentTarget.checked)}
      />
      <span>Hide this show from my activity feed</span>
    </label>
  );
}
