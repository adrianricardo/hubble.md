import { Modal } from "@hubble.md/ui";
import type { ReactNode } from "react";

export function SettingsDialog({
	open,
	onOpenChange,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
}) {
	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="Settings"
			description="App preferences and desktop behavior."
			className="max-w-2xl"
		>
			<div className="flex max-h-[min(80dvh,42rem)] flex-col gap-4 overflow-y-auto">
				{children}
			</div>
		</Modal>
	);
}

export function SettingsSection({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section className="rounded-lg border border-border bg-card/70 p-4 shadow-panel inset-shadow-chrome">
			<div className="flex flex-col gap-1">
				<h3 className="text-sm font-semibold">{title}</h3>
				{description ? (
					<p className="text-xs text-muted-foreground">{description}</p>
				) : null}
			</div>
			<div className="[margin-block-start:1rem]">{children}</div>
		</section>
	);
}
