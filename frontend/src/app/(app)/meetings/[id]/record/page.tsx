"use client";
import { useParams, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AudioRecorder } from "@/components/recording/AudioRecorder";

export default function RecordPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <AuthGuard>
      <AudioRecorder
        meetingId={id}
        onDone={() => router.push(`/meetings/${id}`)}
        onCancel={() => router.push("/meetings")}
      />
    </AuthGuard>
  );
}
