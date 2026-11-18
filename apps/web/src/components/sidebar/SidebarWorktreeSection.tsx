import { useState, type ReactNode } from "react";
import { cn } from "~/lib/utils";

const FOLDER_DRAG_TYPE = "application/x-t3-worktree-folder";

export function SidebarWorktreeSection(props: {
  folderKey: string;
  previousKey: string | undefined;
  nextKey: string | undefined;
  draggedKey: string | null;
  dropAfter: boolean;
  onDragFolder: (key: string | null) => void;
  onMove: (source: string, target: string) => void;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const acceptsDrop = props.draggedKey !== null && props.draggedKey !== props.folderKey;
  return (
    <li
      className={cn(
        "relative mt-2 list-none first:mt-0",
        acceptsDrop &&
          over &&
          "before:pointer-events-none before:absolute before:inset-x-1 before:z-10 before:h-0.5 before:rounded-full before:bg-primary",
        acceptsDrop && over && (props.dropAfter ? "before:-bottom-1" : "before:-top-1"),
      )}
      onDragStart={(event) => {
        if (
          !(event.target instanceof Element) ||
          !event.target.closest("[data-worktree-drag-handle]")
        )
          return;
        event.dataTransfer.setData(FOLDER_DRAG_TYPE, "move");
        event.dataTransfer.effectAllowed = "move";
        props.onDragFolder(props.folderKey);
      }}
      onDragOver={(event) => {
        if (!acceptsDrop || !event.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        )
          setOver(false);
      }}
      onDrop={(event) => {
        const source = props.draggedKey;
        if (!source || !event.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) return;
        event.preventDefault();
        setOver(false);
        props.onDragFolder(null);
        props.onMove(source, props.folderKey);
      }}
      onDragEnd={() => {
        setOver(false);
        props.onDragFolder(null);
      }}
      onKeyDown={(event) => {
        if (
          !event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          !(event.target instanceof Element) ||
          !event.target.matches("[data-worktree-drag-handle]")
        )
          return;
        const target =
          event.key === "ArrowUp"
            ? props.previousKey
            : event.key === "ArrowDown"
              ? props.nextKey
              : undefined;
        if (!target) return;
        event.preventDefault();
        props.onMove(props.folderKey, target);
      }}
    >
      <ul role="presentation" className="flex flex-col gap-px">
        {props.children}
      </ul>
    </li>
  );
}
