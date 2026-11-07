import { ArrowLeft, ArrowUpRight, HeartPulse } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, Badge, Button, Card } from '@glucoflow/ui';
import { useSession } from '../../auth/session';
import { demoEnabled } from '../../auth/demo';

export function PrivacyPage() {
  const { me } = useSession();

  return (
    <main className="mx-auto w-full max-w-[820px] px-4 pb-12 pt-5 sm:px-8 sm:pt-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-lg font-semibold tracking-tight text-primary">
          <HeartPulse size={23} aria-hidden /> glucoflow
        </Link>
        <Button asChild variant="quiet" size="sm">
          <Link to={me ? '/account' : '/'}><ArrowLeft size={16} aria-hidden /> {me ? 'Back to account' : 'Back to home'}</Link>
        </Button>
      </header>

      <div className="mb-5 mt-7 space-y-3">
        <Badge tone="primary">Synthetic demonstration</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-[40px]">Privacy and data use</h1>
        <p className="max-w-[64ch] text-sm leading-6 text-ink-soft">Use fictional information when trying GlucoFlow. Keep real patient information, Aadhaar numbers and ABHA numbers out of reports, notes and assistant questions.</p>
      </div>

      {demoEnabled ? (
        <Alert tone="review" title="Public demo accounts are shared">
          People who choose the same demo account have that account’s access, including to saved workspaces and records visible to it.
        </Alert>
      ) : null}

      <div className="mt-4 grid gap-3">
        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold">Storage and access</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-soft">
            Uploaded files and saved records are stored on the server. The API checks the signed-in account, clinic membership and record permissions. Care workspaces are scoped to their owning account.
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            The demo has no verified India-only data residency, retention period or deletion timeline.
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold">Report processing and review</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-soft">
            Fixture processing uses deterministic rules. When live AI processing is enabled, report text or rendered page images can go to the configured AI provider. Live assistant requests can send questions and relevant demo context to that provider.
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            A person reviews and approves record publication and delegated workflow actions. Care workflows do not send automatic external messages.
          </p>
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-base font-semibold">ABHA and ABDM</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-soft">
            GlucoFlow does not connect to ABDM or verify ABHA numbers. It does not request ABDM consent or fetch health records through ABDM.
          </p>
          <a href="https://abdm.gov.in/home/digital" className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Official ABDM information <ArrowUpRight size={15} aria-hidden />
          </a>
        </Card>
      </div>
    </main>
  );
}
