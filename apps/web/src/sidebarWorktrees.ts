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
>(projects: readonly Project[], threads: readonly T[]) {
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
  for (const thread of threads) {
    const owner = projectByRef.get(scopedProjectKey(thread));
    if (!owner) continue;
    const path = thread.worktreePath || owner.workspaceRoot;
    const key = worktreeFolderKey(thread.environmentId, path);
    (folders.get(key) ?? addFolder(owner, path)).threads.push(thread);
  }
  return [...folders.values()].filter(
    ({ group, threads }) => threads.length > 0 || (group.archivedAt == null && !group.isScratch),
  );
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
