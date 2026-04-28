import { existsSync, type FSWatcher, watch } from "node:fs";
import * as cron from "node-cron";
import { getWorkspaceDir } from "../../src/lib/paths";
import type { Dispatcher } from "./dispatcher";
import type { HealthMonitor } from "./health";
import { logger } from "./logger";
import type { DaemonConfig } from "./types";

type ScheduledTask = ReturnType<typeof cron.schedule>;

// Filenames (not paths) that trigger a dispatch check when modified.
// Directories are watched instead of individual files so watchers survive
// the atomic tmp→rename writes used throughout this codebase.
const DATA_DIR_WATCHED = new Set(["tasks.json", "decisions.json"]);

const WATCH_DEBOUNCE_MS = 5_000;

// ─── Scheduler ───────────────────────────────────────────────────────────────

export class Scheduler {
	private workspaceId: string;
	private jobs: Map<string, ScheduledTask> = new Map();
	private watchers: FSWatcher[] = [];
	private debounceTimer: NodeJS.Timeout | null = null;
	private config: DaemonConfig;
	private dispatcher: Dispatcher;
	private health: HealthMonitor;

	constructor(
		workspaceId: string,
		config: DaemonConfig,
		dispatcher: Dispatcher,
		health: HealthMonitor,
	) {
		this.workspaceId = workspaceId;
		this.config = config;
		this.dispatcher = dispatcher;
		this.health = health;
	}

	/**
	 * Start all configured schedules and the file watchers.
	 */
	start(): void {
		logger.info("scheduler", "Starting scheduler...");

		// Watch data directories for changes and dispatch immediately.
		// Directories are watched (not individual files) so watchers survive
		// the atomic tmp→rename write pattern used throughout this codebase.
		if (this.config.polling.enabled) {
			const trigger = (): void => {
				if (this.debounceTimer) clearTimeout(this.debounceTimer);
				this.debounceTimer = setTimeout(() => {
					this.dispatcher.pollAndDispatch();
				}, WATCH_DEBOUNCE_MS);
			};

			const watchDir = (
				dir: string,
				names: Set<string>,
				label: string,
			): void => {
				if (!existsSync(dir)) return;
				try {
					const watcher = watch(dir, (_, filename) => {
						if (filename && names.has(filename)) trigger();
					});
					watcher.on("error", (err) => {
						logger.warn(
							"scheduler",
							`Watcher error on ${label}: ${err.message}`,
						);
					});
					this.watchers.push(watcher);
					logger.info(
						"scheduler",
						`Task watching: monitoring ${label}/ for ${[...names].join(", ")}`,
					);
				} catch (err) {
					logger.warn(
						"scheduler",
						`Could not watch ${label}/: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			};

			watchDir(getWorkspaceDir(this.workspaceId), DATA_DIR_WATCHED, "data");
		}

		// Start scheduled commands
		for (const [name, schedule] of Object.entries(this.config.schedule)) {
			if (!schedule.enabled) {
				logger.debug("scheduler", `Schedule "${name}" is disabled, skipping`);
				continue;
			}

			if (!cron.validate(schedule.cron)) {
				logger.error(
					"scheduler",
					`Invalid cron expression for "${name}": ${schedule.cron}`,
				);
				continue;
			}

			logger.info(
				"scheduler",
				`Schedule "${name}": ${schedule.cron} → /${schedule.command}`,
			);

			const job = cron.schedule(schedule.cron, () => {
				logger.info(
					"scheduler",
					`Triggered scheduled command: /${schedule.command} (schedule: ${name})`,
				);
				this.dispatcher.runScheduledCommand(schedule.command);
			});

			this.jobs.set(name, job);

			// Calculate next run time
			this.health.setNextScheduledRun(
				schedule.command,
				this.getNextCronRun(schedule.cron),
			);
		}

		const parts: string[] = [];
		if (this.config.polling.enabled)
			parts.push(`${this.watchers.length} watcher(s)`);
		if (this.jobs.size > 0) parts.push(`${this.jobs.size} schedule(s)`);
		logger.info(
			"scheduler",
			`Scheduler started with ${parts.join(", ") || "nothing"} active`,
		);

		this.health.flush();
	}

	/**
	 * Stop all scheduled jobs and file watchers.
	 */
	stop(): void {
		logger.info("scheduler", "Stopping scheduler...");

		// Cancel any pending debounce
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		// Close file watchers
		for (const watcher of this.watchers) {
			watcher.close();
		}
		this.watchers = [];

		for (const [name, job] of this.jobs) {
			job.stop();
			logger.debug("scheduler", `Stopped schedule: ${name}`);
		}
		this.jobs.clear();

		logger.info("scheduler", "Scheduler stopped");
	}

	/**
	 * Reload schedules from updated config.
	 */
	reload(newConfig: DaemonConfig): void {
		logger.info("scheduler", "Reloading scheduler with new config...");
		this.stop();
		this.config = newConfig;
		this.dispatcher.updateConfig(newConfig);
		this.start();
	}

	/**
	 * Calculate approximate next run time for a cron expression.
	 */
	private getNextCronRun(cronExpr: string): string {
		// Simple approximation — for display purposes
		// node-cron doesn't provide a nextRun method, so we estimate
		try {
			const now = new Date();
			// Parse the cron parts
			const parts = cronExpr.split(" ");
			if (parts.length !== 5) return "unknown";

			const [min, hour] = parts;

			// If it's a simple "every N minutes" pattern
			if (min.startsWith("*/")) {
				const interval = parseInt(min.slice(2), 10);
				const nextMinute = Math.ceil(now.getMinutes() / interval) * interval;
				const next = new Date(now);
				next.setMinutes(nextMinute, 0, 0);
				if (next <= now) next.setMinutes(next.getMinutes() + interval);
				return next.toISOString();
			}

			// For specific times
			if (min !== "*" && hour !== "*") {
				const targetHour = parseInt(hour, 10);
				const targetMin = parseInt(min, 10);
				const next = new Date(now);
				next.setHours(targetHour, targetMin, 0, 0);
				if (next <= now) next.setDate(next.getDate() + 1);
				return next.toISOString();
			}

			return "scheduled";
		} catch {
			return "unknown";
		}
	}
}
