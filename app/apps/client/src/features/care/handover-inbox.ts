import type { CareHandoverVersion, CareWorkspace } from '@glucoflow/contracts';

type HandoverActor = { shared?: boolean; actorId?: string };

export function isHandoverRecipient(workspace: CareWorkspace, access: HandoverActor, version: CareHandoverVersion) {
  if (version.recipientRole !== workspace.role) return false;
  if (access.shared === true) return !!access.actorId && version.recipientUserId === access.actorId;
  return access.shared === false && !!workspace.demoStaffId && !version.recipientUserId && version.recipientStaffId === workspace.demoStaffId;
}

export function pendingHandoverReceipts(workspace: CareWorkspace, access: HandoverActor) {
  if (workspace.archivedAt) return [];
  return (workspace.handoverDocuments ?? []).flatMap(document => document.versions.flatMap(version =>
    version.sharedAt && !version.receivedAt && isHandoverRecipient(workspace, access, version)
      ? [{ document, version, sharedAt: version.sharedAt }] : [],
  )).sort((a, b) => b.sharedAt.localeCompare(a.sharedAt));
}

export function handoverReviewParams(current: URLSearchParams, documentId: string, version: number) {
  const params = new URLSearchParams(current);
  params.set('view', 'teams');
  params.set('handoverDocument', documentId);
  params.set('handoverVersion', String(version));
  params.delete('handoverEncounter');
  return params;
}
