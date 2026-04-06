import { auth } from "@/auth";
import {
  getPodStatus,
  createPodAndPVC,
  deletePodAndPVC,
} from "@/lib/k8s";

function extractStudentId(email: string): string {
  return email.split("@")[0].replace(/[^a-zA-Z0-9-_]/g, "");
}

// GET /api/pod — get pod status
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentId = extractStudentId(session.user.email);

  try {
    const status = await getPodStatus(studentId);
    return Response.json({ studentId, ...status });
  } catch (err: any) {
    console.error("Failed to get pod status:", err);
    return Response.json(
      { error: "Failed to get pod status" },
      { status: 500 }
    );
  }
}

// POST /api/pod — spawn a new pod
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentId = extractStudentId(session.user.email);

  // Check if pod already exists
  const existing = await getPodStatus(studentId);
  if (existing.exists) {
    return Response.json(
      { error: "Pod already exists. Delete it first before creating a new one." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => ({}));
  let password = body.password || generatePassword();
  // Sanitize password to prevent multiple-line injection into the chpasswd command
  password = String(password).replace(/[\n\r]/g, "").trim();

  try {
    await createPodAndPVC(studentId, password);
    return Response.json({
      message: "Pod created successfully",
      studentId,
      sshUser: `student${studentId}`,
      password,
    });
  } catch (err: any) {
    console.error("Failed to create pod:", err);
    return Response.json(
      { error: err?.body?.message || "Failed to create pod" },
      { status: 500 }
    );
  }
}

// DELETE /api/pod — delete pod and PVC
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentId = extractStudentId(session.user.email);

  try {
    await deletePodAndPVC(studentId);
    return Response.json({ message: "Pod and PVC deleted successfully" });
  } catch (err: any) {
    console.error("Failed to delete pod:", err);
    return Response.json(
      { error: "Failed to delete pod" },
      { status: 500 }
    );
  }
}

function generatePassword(): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
