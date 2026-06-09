import { Button } from "@hubble.md/ui";
import type { DesktopUpdateState } from "../desktopApi/types";
import { SettingsSection } from "./SettingsDialog";

export function UpdateReadyBanner({
	version,
	onOpenSettings,
	onInstall,
}: {
	version: string | null;
	onOpenSettings: () => void;
	onInstall: () => void;
}) {
	return (
		<div className="border-b border-primary/20 bg-primary/8">
			<div className="flex flex-wrap items-center justify-between gap-3 [padding-block:0.625rem] [padding-inline:0.875rem]">
				<p className="text-sm text-foreground">
					{version
						? `Update ${version} is ready to install.`
						: "A new update is ready to install."}
				</p>
				<div className="flex shrink-0 items-center gap-2">
					<Button size="sm" variant="outline" onClick={onOpenSettings}>
						View details
					</Button>
					<Button size="sm" onClick={onInstall}>
						Restart to Update
					</Button>
				</div>
			</div>
		</div>
	);
}

export function UpdatesSection({
	state,
	onCheckForUpdates,
	onInstall,
}: {
	state: DesktopUpdateState;
	onCheckForUpdates: () => void;
	onInstall: () => void;
}) {
	const isChecking = state.status === "checking";
	const isReady = state.status === "ready";
	const isDownloading = state.status === "downloading";
	const canCheck =
		state.isSupported && !isChecking && !isDownloading && !isReady;

	return (
		<SettingsSection
			title="Updates"
			description="Background checks stay quiet. Use this panel for manual checks and installs."
		>
			<div className="flex flex-col gap-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex min-w-0 flex-col gap-2">
						<div className="flex flex-wrap items-center gap-2">
							<UpdateStatusBadge status={state.status} />
							<p className="text-xs text-muted-foreground">
								Current version {state.currentVersion}
							</p>
						</div>
						<p className="text-sm text-foreground">
							{updateSummaryText(state)}
						</p>
						{state.lastCheckedAt ? (
							<p className="text-xs text-muted-foreground">
								Last checked {formatUpdateTimestamp(state.lastCheckedAt)}.
							</p>
						) : null}
						{!state.isSupported && state.message ? (
							<p className="text-xs text-muted-foreground">{state.message}</p>
						) : null}
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							disabled={!canCheck}
							onClick={onCheckForUpdates}
						>
							{isChecking ? "Checking..." : "Check for Updates"}
						</Button>
						{isReady ? (
							<Button size="sm" onClick={onInstall}>
								Restart to Update
							</Button>
						) : null}
					</div>
				</div>
				{isDownloading ? (
					<div className="flex flex-col gap-2">
						<div className="h-2 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary transition-[width]"
								style={{
									width: `${Math.min(100, Math.max(8, Math.round(state.progressPercent ?? 8)))}%`,
								}}
							/>
						</div>
						<p className="text-xs text-muted-foreground">
							{state.progressPercent !== null
								? `${Math.round(state.progressPercent)}% downloaded`
								: "Downloading update..."}
						</p>
					</div>
				) : null}
				{state.status === "error" && state.message ? (
					<p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
						{state.message}
					</p>
				) : null}
			</div>
		</SettingsSection>
	);
}

function UpdateStatusBadge({
	status,
}: {
	status: DesktopUpdateState["status"];
}) {
	const label =
		status === "up-to-date"
			? "Up to date"
			: status === "ready"
				? "Update ready"
				: status.charAt(0).toUpperCase() + status.slice(1);
	return (
		<span className="rounded-full border border-border bg-muted/70 [padding-block:0.2rem] [padding-inline:0.5rem] text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
			{label}
		</span>
	);
}

function updateSummaryText(state: DesktopUpdateState) {
	switch (state.status) {
		case "idle":
			return state.isSupported
				? "Automatic background checks are enabled."
				: "Updates are unavailable in this build.";
		case "checking":
			return "Checking for the latest release...";
		case "up-to-date":
			return "You're on the latest release.";
		case "downloading":
			return state.availableVersion
				? `Version ${state.availableVersion} is downloading now.`
				: "A new release is downloading now.";
		case "ready":
			return state.availableVersion
				? `Version ${state.availableVersion} is ready to install.`
				: "A new release is ready to install.";
		case "error":
			return "Update check failed.";
	}
}

function formatUpdateTimestamp(value: number) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(value);
}
