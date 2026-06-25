import { Menu, nativeImage, Tray } from "electron";

export type TrayHandlers = {
	/** Reopen / focus the main window (reuses the createWindow/activate path). */
	onOpen: () => void;
	/** Quit the app for real (sets isQuitting, tears down, then app.quit). */
	onQuit: () => void;
};

function buildTrayMenu(handlers: TrayHandlers): Electron.Menu {
	return Menu.buildFromTemplate([
		{ label: "Open Hubble", click: () => handlers.onOpen() },
		{ type: "separator" },
		{ label: "Quit Hubble", click: () => handlers.onQuit() },
	]);
}

/**
 * Create the always-on system-tray indicator. Only constructed while a cloud
 * Live-Document workspace is connected (Decision C); destroyed otherwise so a
 * purely-local user never sees a background-process affordance.
 *
 * The icon is best-effort: if the asset cannot be loaded we fall back to an
 * empty image so the tray entry still appears (verify appearance manually).
 */
export function createAppTray(
	iconPath: string,
	appName: string,
	handlers: TrayHandlers,
): Tray {
	const loaded = nativeImage.createFromPath(iconPath);
	const image = loaded.isEmpty()
		? nativeImage.createEmpty()
		: loaded.resize({ width: 18, height: 18 });
	const tray = new Tray(image);
	tray.setToolTip(appName);
	tray.setContextMenu(buildTrayMenu(handlers));
	// Left-click reopens the window on platforms that surface it (Win/Linux);
	// macOS shows the context menu, where "Open Hubble" is the reopen path.
	tray.on("click", () => handlers.onOpen());
	return tray;
}
