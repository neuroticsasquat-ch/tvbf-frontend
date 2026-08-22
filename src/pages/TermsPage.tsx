export function TermsPage() {
  return (
    <article className="mx-auto max-w-prose py-8 space-y-4">
      <h1 className="text-3xl font-semibold">Terms of Service</h1>

      <p>
        <strong>Tom Boone d/b/a neuroticsasquat.ch</strong> (Maryland) operates TV BingeFriend ("the
        Service"). By using the Service, you agree to these terms.
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Account Responsibilities</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and
          for all activity that occurs under your account. You agree not to abuse the Service,
          impersonate others, or use the Service for any unlawful purpose.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Intellectual Property</h2>
        <p>
          Your watch data and ratings belong to you. The Service's code, design, and branding are
          the property of Tom Boone. Catalog data, images, and credits are provided by{" "}
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noreferrer noopener"
            className="underline"
          >
            TMDB
          </a>{" "}
          and used under their terms of service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Limitation of Liability</h2>
        <p>
          The Service is provided "as is" without warranty of any kind. In no event shall the
          operator be liable for any damages arising out of the use or inability to use the Service.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Governing Law</h2>
        <p>These terms are governed by the laws of the State of Maryland, USA.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Termination</h2>
        <p>
          We may suspend or terminate your account for violations of these terms. You may delete
          your account at any time through the account settings.
        </p>
      </section>

      <footer>
        <time dateTime="2026-08-21">Last updated: 2026-08-21</time>
      </footer>
    </article>
  );
}
