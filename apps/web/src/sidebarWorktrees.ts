import {
  buildProjectGroups,
  derivePhysicalProjectKeyFromPath,
} from "@t3tools/client-runtime/state/project-grouping";
import { inferProjectTitleFromPath } from "@t3tools/client-runtime/state/projects";
import type { ClientSettings } from "@t3tools/contracts/settings";
import type { EnvironmentId } from "@t3tools/contracts";
import { scopedProjectKey } from "@t3tools/client-runtime/environment";
import type { Project, SidebarThreadSummary } from "./types";

export function usesWorktreeFolders(settings: ClientSettings) {
  return settings.boringSidebarEnabled && settings.worktreeSidebarEnabled;
}

function worktreeFolderKey(environmentId: EnvironmentId, path: string) {
  return `worktree:${derivePhysicalProjectKeyFromPath(environmentId, path)}`;
}

export interface WorktreeFolder extends Project {
  readonly projectKey: string;
  readonly displayName: string;
  readonly worktreePath: string | null;
}

export function groupSidebarThreadsByWorktree<
  T extends Pick<SidebarThreadSummary, "environmentId" | "projectId" | "worktreePath">,
>(projects: readonly Project[], threads: readonly T[], unlisted: readonly T[] = []) {
  const folders = new Map<string, { group: WorktreeFolder; threads: T[] }>();
  const projectByRef = new Map<string, Project>();
  function addFolder(project: Project, worktreePath: string | null) {
    const path = worktreePath ?? project.workspaceRoot;
    const key = worktreeFolderKey(project.environmentId, path);
    const folder = {
      group: {
        ...project,
        projectKey: key,
        displayName: worktreePath === null ? project.title : inferProjectTitleFromPath(path),
        worktreePath,
      },
      threads: [] as T[],
    };
    folders.set(key, folder);
    return folder;
  }

  // A separately registered checkout owns its section even for threads created under another project.
  for (const group of buildProjectGroups({
    projects,
    settings: { sidebarProjectGroupingMode: "separate", sidebarProjectGroupingOverrides: {} },
  })) {
    addFolder(group.representative, null);
    for (const ref of group.memberProjectRefs)
      projectByRef.set(scopedProjectKey(ref), group.representative);
  }
  function folderFor(thread: T) {
    const owner = projectByRef.get(scopedProjectKey(thread));
    if (!owner) return undefined;
    const path = thread.worktreePath || owner.workspaceRoot;
    return folders.get(worktreeFolderKey(thread.environmentId, path)) ?? addFolder(owner, path);
  }
  for (const thread of threads) folderFor(thread)?.threads.push(thread);
  // A worktree keeps its section while any thread remains, such as a settled one listed elsewhere.
  for (const thread of unlisted) folderFor(thread);
  return [...folders.values()].filter(
    ({ group, threads }) => threads.length > 0 || (group.archivedAt == null && !group.isScratch),
  );
}

export function moveWorktreeFolder(
  saved: readonly string[],
  visible: readonly string[],
  source: string,
  target: string,
): readonly string[] {
  if (source === target || !visible.includes(source) || !visible.includes(target)) return saved;
  // Keep keys for filtered projects and disconnected environments when saving this view.
  const order = [...new Set([...saved, ...visible])];
  const targetIndex = order.indexOf(target);
  order.splice(order.indexOf(source), 1);
  order.splice(targetIndex, 0, source);
  return order;
}

export function worktreeFolderDraftOptions(
  environmentId: EnvironmentId,
  workspaceRoot: string,
  worktreePath: string | null = null,
) {
  return {
    draftProjectKey: worktreeFolderKey(environmentId, worktreePath ?? workspaceRoot),
    envMode: worktreePath === null ? ("local" as const) : ("worktree" as const),
    worktreePath,
    branch: null,
    startFromOrigin: false,
  };
}
