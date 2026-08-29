import { ConnectionsTabs } from "@/components/connections/ConnectionsTabs";

export function FriendsFeedPage() {
  return (
    <section aria-label="Friends" className="space-y-4">
      <h1 className="text-2xl font-semibold">Friends</h1>
      <ConnectionsTabs />
    </section>
  );
}
