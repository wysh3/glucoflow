import * as React from 'react';
import { Alert, Button, Spinner, cn } from '@glucoflow/ui';
import { openAuthorizedUrl } from '../platform/download';
import { Capacitor } from '@capacitor/core';

/**
 * Source viewer.
 *
 * The server issues a short-lived authorized URL each time the pane opens. A field
 * with verified coordinates highlights exactly that region; without coordinates the
 * page and the quoted line are shown and no bounding box is drawn. The page is
 * rendered with PDF.js so highlighting is possible in the app on web and Android.
 */

export type SourceViewerProps = {
  documentId: string;
  versionId?: string;
  page: number;
  quote?: string | null;
  bbox?: [number, number, number, number] | null;
  url: string;
  expiresAt: string;
  documentName: string;
  pageCount: number | null;
  onRequestNewUrl: () => void;
  onChangePage?: (page: number) => void;
};

type RenderState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; pageCount: number }
  | { status: 'error'; message: string; canUsePlatformViewer: boolean };

export function SourceViewer(props: SourceViewerProps): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [state, setState] = React.useState<RenderState>({ status: 'loading' });
  const [expired, setExpired] = React.useState(false);
  const [rotation, setRotation] = React.useState(0);

  const isPdf = /\.pdf(\?|$)/i.test(props.documentName) || props.url.includes('pdf');

  React.useEffect(() => {
    setExpired(false);
    const timer = window.setTimeout(
      () => setExpired(true),
      Math.max(0, new Date(props.expiresAt).getTime() - Date.now() - 2_000),
    );
    return () => window.clearTimeout(timer);
  }, [props.expiresAt]);

  React.useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    let cancelRender: (() => void) | undefined;
    if (!isPdf) {
      setState({ status: 'ready', pageCount: props.pageCount ?? 1 });
      return () => {
        cancelled = true;
      };
    }
    setState({ status: 'loading' });
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const loading = pdfjs.getDocument({ url: props.url, withCredentials: false });
        destroy = () => { void loading.destroy(); };
        const document = await loading.promise;
        if (cancelled) return;
        const pageNumber = Math.min(Math.max(props.page, 1), document.numPages);
        const page = await document.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1, rotation });
        const containerWidth = containerRef.current?.clientWidth ?? 720;
        const scale = Math.min(2, Math.max(1, containerWidth / viewport.width));
        const scaled = page.getViewport({ scale, rotation });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.floor(scaled.width);
        canvas.height = Math.floor(scaled.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('canvas unavailable');
        const rendering = page.render({ canvas, canvasContext: context, viewport: scaled });
        cancelRender = () => rendering.cancel();
        await rendering.promise;
        if (cancelled) return;
        setState({ status: 'ready', pageCount: document.numPages });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: 'error',
          message:
            error instanceof Error
              ? `This page could not be displayed here (${error.message}).`
              : 'This page could not be displayed here.',
          canUsePlatformViewer: true,
        });
      }
    })();
    return () => {
      cancelled = true;
      cancelRender?.();
      destroy?.();
    };
  }, [props.url, props.page, isPdf, props.pageCount, rotation]);

  const highlight =
    props.bbox && props.bbox.length === 4
      ? {
          left: `${props.bbox[0] * 100}%`,
          top: `${props.bbox[1] * 100}%`,
          width: `${Math.max(0.5, (props.bbox[2] - props.bbox[0]) * 100)}%`,
          height: `${Math.max(0.5, (props.bbox[3] - props.bbox[1]) * 100)}%`,
        }
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-ink-soft">
          <span className="font-medium text-ink">{props.documentName}</span>
          {state.status === 'ready' ? (
            <>
              {' '}
              · page {props.page}
              {state.pageCount ? ` of ${state.pageCount}` : ''}
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.onChangePage && (props.pageCount ?? 1) > 1 ? <><Button size="sm" variant="secondary" disabled={props.page <= 1} onClick={() => props.onChangePage!(props.page - 1)}>Previous page</Button><Button size="sm" variant="secondary" disabled={props.page >= (props.pageCount ?? 1)} onClick={() => props.onChangePage!(props.page + 1)}>Next page</Button></> : null}
          {isPdf ? (
            <>
              <Button size="sm" variant="quiet" onClick={() => setRotation((value) => value - 90)}>
                Rotate left
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setRotation((value) => value + 90)}>
                Rotate right
              </Button>
            </>
          ) : null}
          {state.status === 'error' || Capacitor.isNativePlatform() ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void openAuthorizedUrl(props.url)}
            >
              Open with the device viewer
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={props.onRequestNewUrl}>
            Refresh access
          </Button>
        </div>
      </div>

      {expired ? (
        <div className="mb-3">
          <Alert tone="review" title="This source link expired">
            Source links last 60 seconds. Refresh access to continue reading the document.
          </Alert>
        </div>
      ) : null}

      {state.status === 'loading' ? (
        <div className="flex flex-1 items-center justify-center rounded-[12px] border border-line bg-canvas py-10">
          <Spinner label="Reading document" />
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="flex-1 space-y-3">
          <Alert tone="review" title="The page could not be drawn here">
            {state.message} The quoted text is shown below, and the document can be opened with the
            device viewer.
          </Alert>
          {props.quote ? (
            <blockquote className="rounded-[12px] border border-line bg-surface px-4 py-3 text-sm text-ink">
              “{props.quote}”
            </blockquote>
          ) : null}
        </div>
      ) : null}

      <div
        ref={containerRef}
        className={cn(
          'relative flex-1 overflow-auto rounded-[12px] border border-line bg-canvas p-2',
          state.status !== 'ready' && 'hidden',
        )}
      >
        {isPdf ? (
          <div className="relative mx-auto w-fit">
            <canvas ref={canvasRef} className="max-w-full" aria-label="Source document page" />
            {highlight && rotation === 0 ? (
              <span
                aria-hidden
                className="pointer-events-none absolute rounded-[2px] border border-review bg-review/20"
                style={highlight}
              />
            ) : null}
          </div>
        ) : (
          <div className="relative mx-auto w-fit">
            <img onError={() => setState({status: 'error', message: 'The image could not be loaded. Refresh access and try again.', canUsePlatformViewer: true})} src={props.url} alt="Source document page" className="max-w-full rounded-[8px]" />
          </div>
        )}
      </div>

      {props.quote ? (
        <div className="mt-3">
          <p className="text-[12px] font-medium uppercase tracking-wide text-ink-soft">
            Quoted source text
          </p>
          <blockquote className="mt-1 rounded-[12px] border border-line bg-surface px-4 py-3 text-sm text-ink">
            “{props.quote}”
          </blockquote>
          {!highlight ? (
            <p className="mt-1 text-[12px] text-ink-soft">
              No verified coordinates are available for this quote, so no highlight is drawn.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
