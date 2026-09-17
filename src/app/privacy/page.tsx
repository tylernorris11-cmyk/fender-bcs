import Link from 'next/link';

const CONTACT_EMAIL = 'tyler@fendersteel.co.uk';

/**
 * Public, unauthenticated — required by Google's OAuth verification (the
 * Google Drive backup connection under Set Up -> Backups needs a reachable
 * privacy policy URL to publish the consent screen). Plain and factual:
 * this is an internal tool with no public-facing data collection, not a
 * consumer product.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas p-6 sm:p-12">
      <div className="max-w-2xl mx-auto card card-pad">
        <h1 className="text-2xl font-bold mb-1">Privacy policy</h1>
        <p className="text-sm text-ink-muted mb-6">Fender BCS — last updated September 2026</p>

        <div className="space-y-5 text-sm leading-relaxed">
          <p>
            Fender BCS is an internal business management system used by Fender Steel Ltd and BCS Products to run
            day-to-day operations — sales orders, production, stock, deliveries, customers, holidays, vehicle and
            machine checks, and compliance records. It is not a public service: access is restricted to employees
            and contractors who have been given a login, and it does not collect information from members of the
            public.
          </p>

          <div>
            <h2 className="font-bold mb-1">What information it holds</h2>
            <p>
              Depending on your role, the system may hold your name, email address, job title, holiday and time-off
              records, vehicle/machine check and fuel records, and documents or photos you or a colleague upload
              (such as certificates, safety records, or a photo taken while using the system). For customers and
              suppliers, it holds order, account and contact details needed to run the business.
            </p>
          </div>

          <div>
            <h2 className="font-bold mb-1">How it's used</h2>
            <p>
              Information is used only to operate the business day to day and to meet health &amp; safety and steel
              traceability (CARES) record-keeping requirements. It is not sold, and it is not shared with third
              parties for marketing.
            </p>
          </div>

          <div>
            <h2 className="font-bold mb-1">Where it's stored</h2>
            <p>
              Records are held in a secured database, with certain uploaded files kept in encrypted cloud file
              storage. An administrator may also connect a private Google Drive folder as a backup copy of those
              files; that connection and the files it holds are accessible only to authorised administrators, never
              the public.
            </p>
          </div>

          <div>
            <h2 className="font-bold mb-1">Third-party services</h2>
            <p>
              The system relies on a small number of service providers to run: hosting and database infrastructure,
              file storage, outgoing email for password resets and notifications, and optionally Google Drive (for
              backups) and Telegram (for internal alerts) — each only processes the data needed to provide that
              specific function, and only when an administrator has connected it.
            </p>
          </div>

          <div>
            <h2 className="font-bold mb-1">Questions</h2>
            <p>
              If you have a question about this policy or the information the system holds about you, contact{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-700 font-semibold hover:underline">{CONTACT_EMAIL}</a>.
            </p>
          </div>
        </div>

        <p className="text-xs text-ink-faint mt-8">
          <Link href="/login" className="hover:underline">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
