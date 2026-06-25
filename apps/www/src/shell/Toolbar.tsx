import { NewNoteButton, Toolbar as SharedToolbar } from "@hubble.md/ui";
import { useStoreValue } from "@simplestack/store/react";
import type { ReactNode } from "react";
import { currentPathStore } from "../store/state";

type Props = {
	onNewNote: () => void;
	sessionSlot?: ReactNode;
};

export function Toolbar({ onNewNote, sessionSlot }: Props) {
	const currentPath = useStoreValue(currentPathStore);

	return (
		<SharedToolbar
			currentPath={currentPath ?? null}
			sidebarOpen
			platformInset={false}
			rightSlot={
				<div className="flex items-center gap-1">
					{sessionSlot}
					<NewNoteButton onClick={onNewNote} />
				</div>
			}
		/>
	);
}
