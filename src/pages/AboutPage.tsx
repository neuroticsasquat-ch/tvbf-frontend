export function AboutPage() {
  return (
    <article className="mx-auto max-w-prose py-8 space-y-4">
      <h1 className="text-3xl font-semibold">About TV BingeFriend</h1>

      <p>
        TV BingeFriend is a social TV tracking app. Keep track of what you're watching, discover
        what your friends are into, and get recommendations for what to watch next.
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Features</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Track episodes, seasons, and entire shows as you watch them</li>
          <li>See what your friends are watching and how they rate shows</li>
          <li>Get personalized recommendations based on your taste</li>
          <li>Browse a comprehensive catalog of TV shows</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Credits</h2>
        <p>
          TV BingeFriend is a solo project by{" "}
          <a
            href="https://neuroticsasquat.ch"
            target="_blank"
            rel="noreferrer noopener"
            className="underline"
          >
            Tom Boone
          </a>
          .
        </p>
        <p>A neuroticsasquat.ch release.</p>
      </section>

      <footer>
        <time dateTime="2026-08-21">Last updated: 2026-08-21</time>
      </footer>
    </article>
  );
}
