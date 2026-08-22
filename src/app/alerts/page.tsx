import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getAlerts } from '@/lib/alerts';
import { NAV, Shell } from '@/components/Shell';
import { PageHeader } from '@/components/ui';

export default async function AlertsPage() {
  const user = await requireUser();
  const alerts = await getAlerts(user);
  const bad = alerts.filter((a) => a.severity === 'bad');
  const warn = alerts.filter((a) => a.severity !== 'bad');

  return (
    <Shell user={user} module="compliance" nav={NAV.compliance} current="/compliance" alerts={alerts.length}>
      <PageHeader title="Needs attention" blurb="Everything the system thinks is worth a look, worst first." />

      {alerts.length === 0 && (
        <div className="banner-ok">
          <CheckCircle2 size={20} className="shrink-0" aria-hidden />
          <span>Nothing outstanding. Certificates in date, no overdue checks, nothing quarantined.</span>
        </div>
      )}

      {[['Deal with today', bad], ['Keep an eye on', warn]].map(([title, list]) => {
        const items = list as typeof alerts;
        if (items.length === 0) return null;
        return (
          <section key={title as string} className="mb-8">
            <h2 className="text-lg font-bold mb-3">{title as string}</h2>
            <ul className="space-y-3">
              {items.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className={`${a.severity === 'bad' ? 'banner-bad' : 'banner-warn'} hover:opacity-90 transition-opacity`}>
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden />
                    <span>
                      <strong className="block">{a.title}</strong>
                      <span className="opacity-80">{a.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Shell>
  );
}
