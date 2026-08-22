import { Link } from "react-router";

export function PrivacyPage() {
  return (
    <article className="mx-auto max-w-prose py-8 space-y-4">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>

      <p>
        <strong>Tom Boone d/b/a neuroticsasquat.ch</strong> (Maryland) operates TV BingeFriend ("the
        Service"). This policy describes how your information is collected, used, and shared.
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Session Cookies</h2>
        <p>
          The Service uses an httpOnly session cookie scoped to the app domain to keep you logged
          in. A CSRF token is returned in the response body and required on mutating requests. These
          cookies are essential for the Service to function and are not used for tracking.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">What Friends Can See</h2>
        <p>
          By default, your accepted connections can see your watch activity and ratings through a
          friend-scoped activity feed. You can hide individual shows from your activity using the
          per-show toggle, or disable the activity feed entirely from your account settings.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Data Export and Deletion</h2>
        <p>
          You can download your data at any time through the data export feature. You may delete
          your account and all associated data through the account settings. When you delete your
          account, your personal information is permanently removed.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Error Reporting</h2>
        <p>
          The Service uses Sentry for automatic crash reporting. No personal data is intentionally
          included in error reports.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Third-Party Data Sources</h2>
        <p>
          The Service uses data from{" "}
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noreferrer noopener"
            className="underline"
          >
            TMDB
          </a>{" "}
          for show catalog information, images, and credits. Airdate corrections are derived from
          data provided by{" "}
          <a
            href="https://www.tvmaze.com"
            target="_blank"
            rel="noreferrer noopener"
            className="underline"
          >
            TVmaze
          </a>{" "}
          under{" "}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer noopener"
            className="underline"
          >
            CC BY-SA 4.0
          </a>
          .
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p>
          If you have questions about this policy, please contact us through the{" "}
          <Link to="/contact" className="underline">
            contact form
          </Link>
          .
        </p>
      </section>

      <footer>
        <time dateTime="2026-08-21">Last updated: 2026-08-21</time>
      </footer>
    </article>
  );
}
