# K3s Pod Spawner 🚀

A highly secure, Next.js-powered web dashboard that allows authenticated university students to dynamically provision and manage their own isolated Ubuntu Kubernetes pods on a distributed K3s cluster.

### 🌟 Key Features
- **One-Click Provisioning**: Students can instantly spawn an interactive Ubuntu server equipped with SSH capabilities and a persistent volume claim natively through the web dashboard.
- **Dynamic NodePort Mapping**: Automatically finds and assigns unoccupied NodePorts dynamically ensuring flawless SSH exposure without painful collision errors or exposing internal pod IPs.
- **Real-Time K8s State Monitoring**: The UI uses asynchronous polling to report on the live orchestration phases of the cluster, translating complex API states (like `Pending`, `Running`, and active `deletionTimestamps` during teardown) into an intuitive Glassmorphic UI.
- **Stateful Storage**: Automates the attachment of mathematically hashed and obfuscated 10Gi Local Path Persistence Volumes (`/data-[hash]`) guaranteeing that students' internal web app states and files survive pod destruction.
- **Zero-Trust Access Architecture**:
  - Requires Google OAuth `@kmitl.ac.th` domain clearance cleanly rejecting outsider traffic.
  - Generates deeply sanitized shell environments immune to classic Command Injection.
  - Automatically pipes strict Linux `pam_limits.so` constraints into the SSH Daemon restricting student shells to `200` max PIDs physically blocking "fork bomb" system crashes.
  - Implements a cryptographic `HMAC-SHA256` deterministic algorithm to derive a master `.env` salted `rootPassword` for transparent administrative access control.

### 🛠 Tech Stack
- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS.
- **Authentication**: NextAuth.js / Auth.js (Google Provider).
- **Orchestration / Platform**: K3s Kubernetes, `@kubernetes/client-node` API Integration.

## 🚀 Getting Started

### 1. Prerequisites
- Node.js & Bun installed Locally.
- Active Google Cloud Console OAuth App credentials.
- `kubeconfig.yaml` from your K3s cluster.

### 2. Configure Environment Secrets
Create a `.env.local` file at the root:
```env
# Generate using `npx auth secret`
AUTH_SECRET=your_auth_secret_here

# Google OAuth Credentials
AUTH_GOOGLE_ID=your_google_id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your_google_secret

# Kmitl Domain Lock
ALLOWED_EMAIL_DOMAINS=kmitl.ac.th
```

### 3. Connect to the Cluster
Place your cluster's specific `kubeconfig` inside the repository as `kubeconfig.yaml`.
**Note:** Make sure you set `insecure-skip-tls-verify: true` if you are accessing a public ip with a local k3s SSL certificate.

### 4. Run the Dev Server
```bash
bun install
bun run dev
```

Point your browser to [http://localhost:3000](http://localhost:3000) and authenticate to begin spinning up Kubernetes Pods!

## 🔐 Administrative SSH Access
If an admin needs emergency root access to a student's pod, the system hashes a predictable 16-character backdoor password using the environment `AUTH_SECRET` acting as a localized salt against the `studentId`. Check the `.next/dev/logs` console output for the root password when the pod is spawned!
