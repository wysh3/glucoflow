import { useI18n } from '../../i18n';
import { toServiceLanguageCode } from '../../i18n/language-code';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CareCommand, CareRuntimeStatus, CareWorkspace } from '@glucoflow/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CareRole } from '@glucoflow/contracts';
import { useToast } from '@glucoflow/ui';
import { downloadCareSnapshot } from './download-snapshot';
import { useApi } from '../../auth/session';
import { ApiRequestError, randomIdempotencyKey } from '../../lib/api';

import type { ChatProgressStage } from '../../lib/chat-progress';

const base = '/api/v1/care';
type Operation = 'create' | 'reopen' | 'continue' | 'command' | 'chat' | 'export';
type ErrorLocation = Operation | CareCommand['type'];
export type ChatMode = 'hermes' | 'offline';
export type WorkspaceTeam = {
  access: { ownerId: string; role: CareRole | null; shared: boolean; hospitalClinicId?: string };
  members: { displayName?: string; email?: string | null; userId: string; role: CareRole; active: boolean; assignedAt: string }[];
};

export function careErrorText(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return [error.message, ...Object.values(error.fields ?? {})].join(' ');
  }
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

function savedWorkspace(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useCareWorkspace(actorId: string, clinicId?: string) {
  const { locale } = useI18n();
  const { request } = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const storageKey = `glucoflow.care.workspace.${actorId}${clinicId ? `.${clinicId}` : ''}`;
  const [workspaceId, setWorkspaceId] = useState(() => savedWorkspace(storageKey));
  const [workspace, setWorkspace] = useState<CareWorkspace | null>(null);
  const current = useRef<CareWorkspace | null>(null);
  const lock = useRef<Operation | null>(null);
  const chatController = useRef<AbortController | null>(null);
  useEffect(() => () => chatController.current?.abort(), []);
  const retryCommand = useRef<{ signature: string; key: string; expectedRevision: number } | null>(null);
  const [chatProgress, setChatProgress] = useState<ChatProgressStage | null>(null);
  const [busy, setBusy] = useState<Operation | null>(null);
  const [error, setError] = useState('');
  const [errorFor, setErrorFor] = useState<ErrorLocation | null>(null);
  const [loadError, setLoadError] = useState('');
  const [readError, setReadError] = useState('');
  const [runtime, setRuntime] = useState<CareRuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState('');
  const team = useQuery({
    queryKey: ['care-team', actorId, workspaceId],
    queryFn: ({ signal }) => request<WorkspaceTeam>(`${base}/workspaces/${workspaceId}/team`, { signal }),
    enabled: !!workspaceId, staleTime: 15_000, refetchInterval: 30_000, retry: false,
  });

  const adopt = useCallback((next: CareWorkspace) => {
    if (current.current?.id === next.id && current.current.revision > next.revision) return;
    current.current = next;
    setWorkspace(next);
  }, []);

  const checkingRuntime = useRef(false);
  const checkRuntime = useCallback(async () => {
    if (checkingRuntime.current) return;
    checkingRuntime.current = true;
    try {
      setRuntime(await request<CareRuntimeStatus>(`${base}/runtime`, { timeoutMs: 8_000 }));
      setRuntimeError('');
    } catch (caught) {
      setRuntime(null);
      setRuntimeError(careErrorText(caught));
    } finally {
      checkingRuntime.current = false;
    }
  }, [request]);

  useEffect(() => {
    void checkRuntime();
    const timer = window.setInterval(() => {
      if (!document.hidden && lock.current !== 'chat') void checkRuntime();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [checkRuntime]);

  const refreshing = useRef<{ signal?: AbortSignal; id: string } | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!workspaceId || (refreshing.current?.id === workspaceId && !refreshing.current.signal?.aborted)) return;
    const attempt = { signal, id: workspaceId };
    refreshing.current = attempt;
    try {
      const next = await request<CareWorkspace>(`${base}/workspaces/${workspaceId}`, { signal });
      if (signal?.aborted || (current.current && current.current.id !== workspaceId)) return;
      adopt(next);
      setLoadError('');
      setReadError('');
    } catch (caught) {
      if (signal?.aborted || (current.current && current.current.id !== workspaceId)) return;
      if (current.current) setReadError(careErrorText(caught));
      else setLoadError(careErrorText(caught));
    } finally {
      if (refreshing.current === attempt) refreshing.current = null;
    }
  }, [adopt, request, workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    const poll = () => {
      if (!document.hidden && !lock.current) void refresh(controller.signal);
    };
    void refresh(controller.signal);
    const timer = window.setInterval(poll, 10_000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [refresh, workspaceId]);

  async function run(operation: Operation, work: () => Promise<void>, errorLocation: ErrorLocation = operation): Promise<boolean> {
    if (lock.current) return false;
    if (current.current?.archivedAt && (operation === 'command' || operation === 'chat')) {
      setErrorFor(errorLocation); setError('This archived simulation is read-only. Open a current workspace to make changes.');
      return false;
    }
    lock.current = operation;
    setBusy(operation);
    setError('');
    setErrorFor(null);
    try {
      await work();
      return true;
    } catch (caught) {
      setErrorFor(errorLocation);
      if (operation === 'chat' && caught instanceof ApiRequestError && caught.code === 'request_cancelled') {
        setError('Reply stopped. Your message is back in the composer.');
        return false;
      }
      if (caught instanceof ApiRequestError && caught.isStale) {
        if (operation === 'command') retryCommand.current = null;
        await refresh();
        setError('The workspace changed. Review the refreshed details and retry. Your input is still here.');
      } else {
        setError(careErrorText(caught));
        if (operation === 'chat') void checkRuntime();
      }
      return false;
    } finally {
      lock.current = null;
      setBusy(null);
    }
  }

  const activate = (next: CareWorkspace) => {
    try {
      sessionStorage.setItem(storageKey, next.id);
    } catch {
      // The current workspace remains usable when browser storage is unavailable.
    }
    retryCommand.current = null;
    setWorkspaceId(next.id);
    setLoadError('');
    setReadError('');
    adopt(next);
  };

  const create = () => run('create', async () => {
    activate(await request<CareWorkspace>(`${base}/workspaces`, { method: 'POST', body: clinicId ? { clinicId } : {} }));
    void queryClient.invalidateQueries({ queryKey: ['care-workspaces', actorId] });
  });

  const continueWorkspace = () => run('continue', async () => {
    const active = current.current;
    if (!active) throw new Error('Open a workspace first.');
    const result = await request<{ workspace: CareWorkspace; previousWorkspaceId: string }>(`${base}/workspaces/${active.id}/continue`, {
      method: 'POST', body: { expectedRevision: active.revision },
    });
    activate(result.workspace);
    void queryClient.invalidateQueries({ queryKey: ['care-workspaces', actorId] });
  });

  const reopen = (id: string) => run('reopen', async () => {
    activate(await request<CareWorkspace>(`${base}/workspaces/${encodeURIComponent(id)}`));
  });

  const command = (value: CareCommand) => run('command', async () => {
    const active = current.current;
    if (!active) throw new Error('Open a workspace first.');
    const signature = JSON.stringify([active.id, value]);
    const retry = retryCommand.current?.signature === signature ? retryCommand.current : null;
    const attempt = retry ?? { signature, key: randomIdempotencyKey(), expectedRevision: active.revision };
    retryCommand.current = attempt;
    try {
      const next = await request<CareWorkspace>(`${base}/workspaces/${active.id}/commands`, {
        method: 'POST',
        body: { expectedRevision: attempt.expectedRevision, command: value },
        idempotencyKey: attempt.key,
      });
      adopt(next);
      retryCommand.current = null;
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status > 0 && caught.status < 500) {
        retryCommand.current = null;
      }
      throw caught;
    }
  }, value.type);

  const chat = (message: string, mode: ChatMode) => run('chat', async () => {
    const active = current.current;
    if (!active) throw new Error('Open a workspace first.');
    const controller = new AbortController();
    chatController.current = controller;
    setChatProgress(null);
    try {
      const next = await request<CareWorkspace>(`${base}/workspaces/${active.id}/chat`, {
        method: 'POST', timeoutMs: 75_000, signal: controller.signal,
        onProgress: stage => { if (!controller.signal.aborted) setChatProgress(stage); },
        body: { message, mode, languageCode: toServiceLanguageCode(locale.tag) },
      });
      if (!controller.signal.aborted) adopt(next);
    } finally {
      if (chatController.current === controller) { chatController.current = null; setChatProgress(null); }
    }
  });

  const exportSnapshot = () => run('export', async () => {
    const active = current.current;
    if (!active) throw new Error('Open a workspace first.');
    const snapshot = await request<unknown>(`${base}/workspaces/${active.id}/export`);
    if (await downloadCareSnapshot(active.id, snapshot)) {
      toast.push({ title: 'Snapshot exported', tone: 'success' });
    }
  });

  return {
    team, workspace, loading: !!workspaceId && !workspace && !loadError, loadError, readError, error, errorFor,
    busy, chatProgress, runtime, runtimeError, refresh, checkRuntime, create, reopen, continueWorkspace, command, chat, exportSnapshot,
    stopChat: () => {
      setErrorFor('chat');
      setError(chatController.current ? 'Stopping reply…' : 'There is no active reply to stop.');
      chatController.current?.abort();
    },
    clearError: () => { setError(''); setErrorFor(null); },
  };
}

export type CareWorkspaceState = ReturnType<typeof useCareWorkspace>;
export type SendCommand = CareWorkspaceState['command'];
