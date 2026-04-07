import { redirect } from "next/navigation";

export default function TeamMemberRedirect({ params }: { params: { role: string } }) {
  redirect(`/crew/${params.role}`);
}
