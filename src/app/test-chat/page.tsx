// TODO: delete in Phase 4 (smoke test only)
// Phase 1: demo cwd + persona for manual testing
import { AssistantThread } from "@/components/chat/AssistantThread";

export default function TestChatPage() {
	return (
		<div className="h-screen w-full">
			<AssistantThread
				cwd="/home/sil/ccmc-assistant-ui"
				persona="You are a helpful coding assistant focused on TypeScript and React development."
				model="sonnet"
			/>
		</div>
	);
}
