export type Importance = "important" | "not-important";
export type Urgency = "urgent" | "not-urgent";
export type KanbanStatus =
	| "not-started"
	| "in-progress"
	| "done"
	| "awaiting-decision"
	| "failed";

export type ProjectStatus = "active" | "paused" | "completed" | "archived";
// AgentRole is now a string validated against the agent registry at runtime.
// Built-in roles are kept as a type for backward compatibility.
export type BuiltInAgentRole =
	| "me"
	| "researcher"
	| "developer"
	| "marketer"
	| "business-analyst";
export type AgentRole = string;

// Legacy constant kept for backward compat — UI should prefer dynamic agents from API.
export const AGENT_ROLES: {
	id: BuiltInAgentRole;
	label: string;
	icon: string;
	description: string;
}[] = [
	{ id: "me", label: "Me", icon: "User", description: "Tasks I do myself" },
	{
		id: "researcher",
		label: "Researcher",
		icon: "Search",
		description: "Market research, analysis, evaluation",
	},
	{
		id: "developer",
		label: "Developer",
		icon: "Code",
		description: "Implementation, bug fixes, testing",
	},
	{
		id: "marketer",
		label: "Marketer",
		icon: "Megaphone",
		description: "Copy, growth strategy, content",
	},
	{
		id: "business-analyst",
		label: "Business Analyst",
		icon: "BarChart3",
		description: "Strategy, planning, prioritization",
	},
];

// ─── Agent Definition (dynamic registry) ──────────────────────────────────────

export type AgentStatus = "active" | "inactive";
export type AgentBackend = "claude";

export interface AgentDefinition {
	id: string;
	name: string;
	icon: string;
	description: string;
	instructions: string;
	skillIds: string[];
	status: AgentStatus;
	backend?: AgentBackend;
	model?: string;
	allowedTools?: string[];
	skipPermissions?: "inherit" | "on" | "off";
	createdAt: string;
	updatedAt: string;
}

export interface AgentsFile {
	agents: AgentDefinition[];
}

// ─── Skill Definition (skills library) ────────────────────────────────────────

export interface SkillDefinition {
	id: string;
	name: string;
	description: string;
	content: string;
	agentIds: string[];
	tags: string[];
	activated?: boolean;
	customized?: boolean;
	createdAt: string;
	updatedAt: string;
}

// Legacy skills-library.json format (migrated to SKILL.md files)
export interface LegacySkillDefinition {
	id: string;
	name: string;
	description: string;
	instructions: string;
	agentIds: string[];
	tags: string[];
}

export interface SkillsLibraryFile {
	skills: LegacySkillDefinition[];
}

// ─── AI Commands (slash commands) ───────────────────────────────────────────

export interface CommandDefinition {
	id: string;
	name: string;
	command: string; // e.g. "/standup"
	description: string;
	longDescription: string;
	icon: string;
	content: string;
	activated?: boolean;
	customized?: boolean;
	createdAt: string;
	updatedAt: string;
}

// ─── Subtasks ─────────────────────────────────────────────────────────────────

export interface Subtask {
	id: string;
	title: string;
	done: boolean;
}

// ─── Task Comments ───────────────────────────────────────────────────────────

export interface CommentAttachment {
	id: string;
	type: "image" | "file";
	url: string;
	filename: string;
}

export interface TaskComment {
	id: string;
	author: AgentRole | "system";
	type?: "note" | "comment" | "system";
	content: string;
	createdAt: string;
	attachments?: CommentAttachment[];
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface Task {
	id: string;
	title: string;
	description: string;
	importance: Importance;
	urgency: Urgency;
	kanban: KanbanStatus;
	projectId: string | null;
	initiativeId?: string | null;
	assignedTo: AgentRole | null;
	collaborators: string[];
	subtasks: Subtask[];
	blockedBy: string[];
	estimatedMinutes: number | null;
	actualMinutes: number | null;
	acceptanceCriteria: string;
	comments: TaskComment[];
	tags: string[];
	dueDate: string | null;
	createdAt: string;
	updatedAt: string;
	completedAt: string | null;
	deletedAt: string | null;
	mapPosition?: CanvasPosition;
	/** Link to the current/latest execution conversation (null until first run). */
	conversationId?: string | null;
	/** True for auto-created tasks from scheduled commands. Hidden from kanban board. */
	isScheduled?: boolean;
	/** Number of times the autopilot has dispatched and failed to complete this task. */
	attemptCount?: number;
	/** Error message when the task reaches a terminal failed state. */
	error?: string;
}

export interface TasksFile {
	tasks: Task[];
}

// ─── Goals ────────────────────────────────────────────────────────────────────

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface CanvasPosition {
	x: number;
	y: number;
}

export interface Project {
	id: string;
	name: string;
	description: string;
	status: ProjectStatus;
	color: string;
	teamMembers: string[];
	createdAt: string;
	tags: string[];
	mapPosition?: CanvasPosition;
	deletedAt: string | null;
}

export interface ProjectsFile {
	projects: Project[];
}

// ─── Brain Dump ───────────────────────────────────────────────────────────────

export interface BrainDumpEntry {
	id: string;
	content: string;
	capturedAt: string;
	processed: boolean;
	convertedTo: string | null;
	tags: string[];
}

export interface BrainDumpFile {
	entries: BrainDumpEntry[];
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

export type EventType =
	| "task_created"
	| "task_updated"
	| "task_completed"
	| "task_delegated"
	| "task_failed"
	| "message_sent"
	| "decision_requested"
	| "decision_answered"
	| "brain_dump_triaged"
	| "agent_checkin";

export interface ActivityEvent {
	id: string;
	type: EventType;
	actor: AgentRole | "system";
	taskId: string | null;
	summary: string;
	details: string;
	timestamp: string;
}

export interface ActivityLogFile {
	events: ActivityEvent[];
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

export type MessageType =
	| "delegation"
	| "report"
	| "question"
	| "update"
	| "approval";
export type MessageStatus = "unread" | "read" | "archived";

export interface InboxMessage {
	id: string;
	from: AgentRole | "system";
	to: AgentRole;
	type: MessageType;
	taskId: string | null;
	subject: string;
	body: string;
	status: MessageStatus;
	createdAt: string;
	readAt: string | null;
}

export interface InboxFile {
	messages: InboxMessage[];
}

// ─── Decisions ────────────────────────────────────────────────────────────────

export type DecisionStatus = "pending" | "answered";

export interface DecisionItem {
	id: string;
	requestedBy: AgentRole | "system";
	taskId: string | null;
	question: string;
	options: string[];
	context: string;
	status: DecisionStatus;
	answer: string | null;
	answeredAt: string | null;
	createdAt: string;
	/** Link to conversation that produced this decision (in addition to taskId). */
	conversationId?: string | null;
}

export interface DecisionsFile {
	decisions: DecisionItem[];
}

// ─── Active Runs (task execution tracking) ───────────────────────────────────

export type RunStatus =
	| "running"
	| "completed"
	| "failed"
	| "timeout"
	| "stopped";

export interface ActiveRun {
	id: string;
	taskId: string;
	agentId: string;
	source?:
		| "manual"
		| "project-run"
		| "mission-chain"
		| "scheduled"
		| "webhook"
		| "inbox-respond"
		| "comment"
		| "wiki";
	projectId: string | null;
	missionId: string | null;
	pid: number;
	status: RunStatus;
	startedAt: string;
	completedAt: string | null;
	exitCode: number | null;
	error: string | null;
	costUsd: number | null;
	numTurns: number | null;
	continuationIndex: number;
	streamFile?: string | null;
	// Wiki / extended fields
	sessionId?: string | null;
	firstMessage?: string | null;
	model?: string | null;
	noPrune?: boolean;
}

export interface ActiveRunsFile {
	runs: ActiveRun[];
}

// ─── Project Runs (continuous project execution) ────────────────────────────

export type ProjectRunStatus = "running" | "completed" | "stopped" | "stalled";

export interface ProjectRunTaskEntry {
	taskId: string;
	taskTitle: string;
	agentId: string;
	status: "completed" | "failed" | "timeout" | "stopped";
	startedAt: string;
	completedAt: string;
	summary: string;
	attempt: number;
}

export interface LoopDetectionState {
	taskAttempts: Record<string, number>;
	taskErrors: Record<string, string[]>;
}

export interface ProjectRun {
	id: string;
	projectId: string;
	status: ProjectRunStatus;
	startedAt: string;
	stoppedAt: string | null;
	completedAt: string | null;
	lastTaskCompletedAt: string | null;
	totalTasks: number;
	completedTasks: number;
	failedTasks: number;
	skippedTasks: number;
	taskHistory: ProjectRunTaskEntry[];
	loopDetection: LoopDetectionState;
}

export interface ProjectRunsFile {
	missions: ProjectRun[];
}

// ─── Eisenhower quadrant helpers ──────────────────────────────────────────────

export type EisenhowerQuadrant =
	| "do" // important + urgent
	| "schedule" // important + not-urgent
	| "delegate" // not-important + urgent
	| "eliminate"; // not-important + not-urgent

export function getQuadrant(task: Task): EisenhowerQuadrant {
	if (task.importance === "important" && task.urgency === "urgent") return "do";
	if (task.importance === "important" && task.urgency === "not-urgent")
		return "schedule";
	if (task.importance === "not-important" && task.urgency === "urgent")
		return "delegate";
	return "eliminate";
}

export function valuesFromQuadrant(quadrant: EisenhowerQuadrant): {
	importance: Importance;
	urgency: Urgency;
} {
	switch (quadrant) {
		case "do":
			return { importance: "important", urgency: "urgent" };
		case "schedule":
			return { importance: "important", urgency: "not-urgent" };
		case "delegate":
			return { importance: "not-important", urgency: "urgent" };
		case "eliminate":
			return { importance: "not-important", urgency: "not-urgent" };
	}
}

// ─── Workspace ────────────────────────────────────────────────────────────────

export interface WorkspaceSettings {
	daemonEnabled?: boolean; // defaults to true if absent
	envVars?: Record<string, string>; // injected into agent subprocess env
}

export interface Workspace {
	id: string;
	name: string;
	description: string;
	color: string;
	isDefault: boolean;
	settings: WorkspaceSettings;
	createdAt: string;
	updatedAt: string;
}

export interface WorkspacesFile {
	workspaces: Workspace[];
}

// ─── Initiative ───────────────────────────────────────────────────────────────

export type InitiativeStatus = "active" | "paused" | "completed" | "archived";

export interface Initiative {
	id: string;
	title: string;
	description: string;
	status: InitiativeStatus;
	projectId: string | null;
	color: string;
	teamMembers: string[];
	taskIds: string[];
	tags: string[];
	mapPosition?: CanvasPosition;
	createdAt: string;
	updatedAt: string;
	completedAt: string | null;
	deletedAt: string | null;
}

export interface InitiativesFile {
	initiatives: Initiative[];
}

// ─── Conversations (unified chat + task execution) ────────────────────────────
// Schema locked v1.0 — see docs/conversation-event-schema.md

export type ConversationStatus =
	| "idle"
	| "queued"
	| "starting"
	| "running"
	| "awaiting-decision"
	| "completed"
	| "failed"
	| "cancelled";

export type ConversationSource =
	| "chat"
	| "task"
	| "manual"
	| "project-run"
	| "mission-chain"
	| "scheduled"
	| "webhook"
	| "inbox-respond"
	| "comment"
	| "wiki";

export type ConversationErrorKind =
	| "cli_not_found"
	| "auth_expired"
	| "rate_limited"
	| "session_expired"
	| "context_exceeded"
	| "timeout"
	| "transport"
	| "unknown";

export interface ConversationTokens {
	input: number;
	output: number;
	cache?: number;
	total: number;
}

export interface Conversation {
	id: string;
	title: string;
	agentId: string | null;
	model: string | null;
	status: ConversationStatus;
	mode: "foreground" | "background";
	executionSource: ConversationSource;

	// Linking
	taskId: string | null;
	parentConversationId: string | null;

	// Run tracking
	currentRunId: string | null;
	runCount: number;

	// Aggregate metrics
	tokens: ConversationTokens;
	turnCount: number;

	// State
	error: string | null;
	errorKind: ConversationErrorKind | null;
	pausedReason: string | null;
	pausedDecisionId: string | null;
	summary: string | null;

	// Artifacts
	artifactRefs: string[];
	mentionedPaths: string[];
	attachmentPaths: string[];

	// Idempotency dedup window
	recentRequestIds: string[];

	// Timestamps
	createdAt: string;
	startedAt: string | null;
	updatedAt: string;
	completedAt: string | null;
	cancelledAt: string | null;
	archivedAt: string | null;
	deletedAt: string | null;
	pausedAt: string | null;

	// Schema version
	version: number;
}

export type ConversationRunStatus =
	| "starting"
	| "running"
	| "completed"
	| "failed"
	| "stopped"
	| "timeout";

export interface ConversationRun {
	id: string;
	conversationId: string;
	status: ConversationRunStatus;

	// Process tracking
	pid: number | null;
	sessionHandle: string | null;
	continuationIndex: number;

	// Context
	source: ConversationSource;
	projectId: string | null;
	missionId: string | null;

	// Metrics
	tokens: ConversationTokens;
	numTurns: number;

	// Idempotency
	requestId: string | null;

	// Timestamps
	startedAt: string;
	completedAt: string | null;

	// Outcome
	exitCode: number | null;
	error: string | null;
	errorKind: ConversationErrorKind | null;

	// Model snapshot
	model: string | null;
	noPrune?: boolean;
}

export interface ConversationsFile {
	conversations: Conversation[];
	runs: Record<string, ConversationRun>;
}

export type ConversationTurnRole = "user" | "assistant";

export type MessagePartType = "text" | "thinking" | "tool_use" | "tool_result";

export interface MessagePart {
	type: MessagePartType;
	content: string;
	toolName?: string;
	toolCallId?: string;
	status?: "running" | "completed" | "error";
}

export interface ToolCallRecord {
	id: string;
	tool: string;
	args: Record<string, unknown>;
	result?: string;
	status: "running" | "completed" | "error";
	durationMs?: number;
}

export interface ConversationTurn {
	id: string;
	turn: number;
	role: ConversationTurnRole;
	ts: string;
	content: string;
	parts?: MessagePart[];
	pending?: boolean;
	tokens?: { input: number; output: number; cache?: number };
	runId?: string;
	exitCode?: number | null;
	error?: string;
	toolCalls?: ToolCallRecord[];
	mentionedPaths?: string[];
	attachmentPaths?: string[];
	artifactRefs?: string[];
}

// ─── Conversation Events (SSE wire format) ────────────────────────────────────

export interface ConversationEventBase {
	conversationId: string;
	ts: string;
	seq: number;
}

export interface TurnStartedEvent extends ConversationEventBase {
	type: "turn.started";
	payload: {
		turnId: string;
		turn: number;
		role: ConversationTurnRole;
		runId?: string;
	};
}

export interface TurnDeltaEvent extends ConversationEventBase {
	type: "turn.delta";
	payload: { turnId: string; delta: string; partType?: "text" | "thinking" };
}

export interface TurnCompletedEvent extends ConversationEventBase {
	type: "turn.completed";
	payload: {
		turnId: string;
		tokens?: { input: number; output: number; cache?: number };
		// v1.1: full turn snapshot for clients without refetch
		content?: string;
		parts?: MessagePart[];
		toolCalls?: ToolCallRecord[];
	};
}

export interface ToolCallStartedEvent extends ConversationEventBase {
	type: "tool.started";
	payload: {
		turnId: string;
		toolCallId: string;
		tool: string;
		args: Record<string, unknown>;
	};
}

export interface ToolCallCompletedEvent extends ConversationEventBase {
	type: "tool.completed";
	payload: {
		turnId: string;
		toolCallId: string;
		tool: string;
		status: "completed" | "error";
		result?: string;
		durationMs?: number;
	};
}

export interface ConversationStartedEvent extends ConversationEventBase {
	type: "conversation.started";
	payload: { runId: string; source: ConversationSource };
}

export interface ConversationUpdatedEvent extends ConversationEventBase {
	type: "conversation.updated";
	payload: {
		fields: Partial<
			Pick<
				Conversation,
				"title" | "status" | "summary" | "tokens" | "turnCount" | "currentRunId"
			>
		>;
	};
}

export interface ConversationCompletedEvent extends ConversationEventBase {
	type: "conversation.completed";
	payload: {
		runId: string;
		exitCode: number | null;
		tokens: ConversationTokens;
	};
}

export interface ConversationPausedEvent extends ConversationEventBase {
	type: "conversation.paused";
	payload: { reason: string; decisionId: string };
}

export interface ConversationResumedEvent extends ConversationEventBase {
	type: "conversation.resumed";
	payload: { runId: string; decisionId: string; answer: string };
}

export interface ConversationErrorEvent extends ConversationEventBase {
	type: "conversation.error";
	payload: {
		runId: string | null;
		error: string;
		errorKind: ConversationErrorKind;
	};
}

export interface ConversationCancelledEvent extends ConversationEventBase {
	type: "conversation.cancelled";
	payload: { runId: string | null; reason?: string };
}

export interface DecisionCreatedEvent extends ConversationEventBase {
	type: "decision.created";
	payload: { decisionId: string; question: string; options: string[] };
}

export interface DecisionAnsweredEvent extends ConversationEventBase {
	type: "decision.answered";
	payload: { decisionId: string; answer: string };
}

export type ConversationEvent =
	| TurnStartedEvent
	| TurnDeltaEvent
	| TurnCompletedEvent
	| ToolCallStartedEvent
	| ToolCallCompletedEvent
	| ConversationStartedEvent
	| ConversationUpdatedEvent
	| ConversationCompletedEvent
	| ConversationPausedEvent
	| ConversationResumedEvent
	| ConversationErrorEvent
	| ConversationCancelledEvent
	| DecisionCreatedEvent
	| DecisionAnsweredEvent;

export type ConversationEventType = ConversationEvent["type"];
