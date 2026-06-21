# hubble.md context

Glossary for shared terms across the project. Implementation details belong in code or ADRs — not here.

## Flagged ambiguities

- **"Open folder" (desktop runtime) vs "Workspace."** The desktop editor operates on any open folder path and reads/writes the filesystem directly. Say "open folder" for the runtime notion and "Workspace" for the folder-first product notion.

## Glossary

### Workspace

A logical container of Markdown Files and Assets. On desktop, a Workspace is a folder the user has added to Hubble. Adding a Workspace does not require `.hubble/config.json`; optional capabilities create configuration only when needed.

[[Cloud Sync]] is an optional capability layered on top. A Workspace may be **local-only** (no cloud backend) or **synced** (bound to a Convex deployment, with a row in the `workspaces` table). On the **web** a Workspace is always synced — there is no local filesystem to fall back to. On **desktop** a Workspace starts local-only and can have Cloud Sync enabled later.

The Workspace is the unit; the **access path differs by surface**. The web app reads/writes through the Convex backend. The desktop app reads/writes the [[Workspace Folder]] directly on disk (the working source of truth), with the background sync engine reconciling to Convex when Cloud Sync is on. Features that must run on both surfaces — notably [[Embed]]s — target the Workspace as the unit and resolve against whichever backend the current surface provides; they never assume Convex.

### Workspace Folder

The on-disk realization of a [[Workspace]]: a folder the desktop app has added to Hubble. The folder may have no `.hubble/` directory. `.hubble/config.json` is created only when an optional capability needs Workspace Configuration, such as [[Cloud Sync]], agent instructions, or embeds. Multiple Workspace Folders across devices can map to the same synced Workspace when they share Cloud Sync linkage.

### Plain Folder

A folder opened directly in the desktop app without being added as a Workspace. The desktop app may read and edit it as a general markdown viewer, nothing syncs, and Workspace-scoped features may be unavailable until the folder is added as a Workspace.

### Folder

A filesystem directory inside a [[Workspace Folder]] or [[Plain Folder]]. A Folder can contain zero or more [[Markdown File]]s and zero or more Folders.
_Avoid_: Directory

### Compacted Folder Path

A single sidebar row that represents a chain of nested Folders where each Folder has exactly one child Folder and no sibling [[Markdown File]]s or Folders. Each segment in the row names one real Folder, and can be targeted independently for folder actions such as dragging or dropping.
_Avoid_: Compacted directory name

### Cloud Sync

The optional capability that binds a [[Workspace]] to a Convex deployment, enabling multi-device sync and web access. Required for web Workspaces; opt-in on desktop, where it can be enabled after a Workspace is created by supplying a Convex deployment URL.

Cloud Sync configuration lives under `cloudSync` in `.hubble/config.json`:

```json
{
	"cloudSync": {
		"provider": "convex",
		"deploymentUrl": "https://...",
		"workspaceId": "convex workspace id",
		"deviceId": "local sync device uuid",
		"backgroundSync": true
	}
}
```

`cloudSync.backgroundSync` controls automatic daemon sync only. Manual sync can still run when background sync is off. Turning off background sync preserves `cloudSync` and `.hubble/state.json`; disconnecting Cloud Sync removes the `cloudSync` configuration.

### Markdown File

A markdown document on the local filesystem or in a Workspace.

### HTML App

A folder-local `.html` file that Hubble runs as a self-contained, interactive UI. Opening an HTML App directly shows it in the main content panel instead of the Markdown editor. An HTML App reaches files in the open Folder only through a capability-scoped, async **broker**, never directly.

### Slash Command

A formatting command launched by typing `/` in a Markdown File. Slash Commands create a new block after the current block, except when the current block is an empty paragraph, where the command converts that paragraph in place.

### File Properties

User-facing structured fields attached to a Markdown File. File Properties are distinct from the document body and are stored in the file's front matter.

### Loose File

A Markdown File opened directly from the filesystem, not through a Workspace Folder or Plain Folder. The desktop app can read and edit it with access scoped to the file and nearby assets; nothing syncs.

### Asset

A binary file referenced by a Markdown File, such as an image. Asset paths in markdown use the desktop-canonical `<markdown-file-stem>.assets/<hash>.<ext>` convention relative to the Markdown File's folder.

### Embed

An inline placement of an [[HTML App]] at a point in a [[Markdown File]]. Use an Embed when an HTML App should appear inside existing Markdown content instead of taking over the main content panel. See ADR-0007.

Embeds have the same constraints as HTML apps; they reach files in the open Folder only through a capability-scoped, async **broker**, never directly.

### Workspace Snapshot

The client's currently loaded view of a [[Workspace]] — an atomically assembled bundle of (workspace name, files list, last-opened file content). The app shell renders only when a Workspace Snapshot exists; the UI never shows a partially-loaded one. Switching workspaces means preparing a new snapshot in the background and replacing the previous Workspace Snapshot in a single update once it's ready.
