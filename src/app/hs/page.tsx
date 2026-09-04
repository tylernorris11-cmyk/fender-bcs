import Link from 'next/link';
import { AlertTriangle, FileText, HardHat } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { getAlerts } from '@/lib/alerts';
import { incompleteRequiredModulesFor, requiredModulesFor } from '@/lib/training';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';

export default async function HsOverviewPage() {
  const user = await requirePermission('hs.view');
  const alerts = await getAlerts(user);
  const [required, incomplete] = await Promise.all([
    requiredModulesFor(user),
    incompleteRequiredModulesFor(user),
  ]);

  return (
    <Shell user={user} module="hs" nav={NAV.hs} current="/hs" alerts={alerts.length}>
      <PageHeader title="Health & Safety" blurb="HSE documents, RAMS and mandatory training." />

      <div className="banner-warn mb-6 items-start">
        <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden />
        <span>
          <strong>This content is a supplement, not a substitute.</strong> It does not replace a manufacturer&apos;s
          operating manual, a site-specific risk assessment signed off by a competent person, or any legally required
          certified training.
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 mb-6">
        <Link href="/hs/documents" className="card card-pad hover:shadow-pop transition-shadow">
          <span className="inline-grid place-items-center h-12 w-12 rounded-2xl bg-teal-100 text-teal-700 mb-4">
            <FileText size={22} />
          </span>
          <h2 className="text-lg font-bold">Documents</h2>
          <p className="text-sm text-ink-muted mt-1.5">Policies, RAMS, COSHH sheets and method statements.</p>
        </Link>

        <Link href="/hs/training" className="card card-pad hover:shadow-pop transition-shadow">
          <span className="inline-grid place-items-center h-12 w-12 rounded-2xl bg-teal-100 text-teal-700 mb-4">
            <HardHat size={22} />
          </span>
          <h2 className="text-lg font-bold">My training</h2>
          <p className="text-sm text-ink-muted mt-1.5">
            {required.length === 0
              ? 'Nothing required for you right now.'
              : incomplete.length === 0
                ? `All ${required.length} required module${required.length === 1 ? '' : 's'} complete.`
                : `${incomplete.length} of ${required.length} required module${required.length === 1 ? '' : 's'} still to complete.`}
          </p>
        </Link>
      </div>
    </Shell>
  );
}
