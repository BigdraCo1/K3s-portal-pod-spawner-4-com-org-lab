import * as k8s from "@kubernetes/client-node";

import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";

const kc = new k8s.KubeConfig();

try {
  // Try to load local kubeconfig.yaml first if we are doing local dev
  const kubeconfigPath = path.join(process.cwd(), "kubeconfig.yaml");
  if (fs.existsSync(kubeconfigPath)) {
    kc.loadFromFile(kubeconfigPath);
  } else {
    // Try inside-cluster config
    kc.loadFromCluster();
  }
} catch {
  // Fall back to default (~/.kube/config)
  kc.loadFromDefault();
}

const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const namespace = process.env.K8S_NAMESPACE || "default";

export interface PodStatusInfo {
  exists: boolean;
  phase?: string;
  podIP?: string;
  nodePort?: number;
  nodeIP?: string;
  mountPath?: string;
  containerReady?: boolean;
  message?: string;
}

export async function getPodStatus(studentId: string): Promise<PodStatusInfo> {
  const podName = `ubuntu-${studentId}`;
  try {
    const res = await coreApi.readNamespacedPod({
      name: podName,
      namespace,
    });
    const pod = res;
    const containerStatus = pod.status?.containerStatuses?.[0];
    let nodePort: number | undefined;
    try {
      const svcRes = await coreApi.readNamespacedService({
        name: `ubuntu-ssh-${studentId}`,
        namespace,
      });
      nodePort = svcRes.spec?.ports?.[0]?.nodePort;
    } catch { }

    const nodeName = pod.spec?.nodeName;
    let nodeIP = "161.246.5.60"; // default to control plane
    if (nodeName?.includes("worker-1")) {
      nodeIP = "161.246.5.72";
    } else if (nodeName?.includes("control-1")) {
      nodeIP = "161.246.5.60";
    }

    const isTerminating = !!pod.metadata?.deletionTimestamp;
    const mountPath = pod.spec?.containers?.[0]?.volumeMounts?.find(v => v.name === `data-${studentId}`)?.mountPath;

    return {
      exists: true,
      phase: isTerminating ? "Terminating" : pod.status?.phase,
      podIP: pod.status?.podIP,
      nodePort,
      nodeIP,
      mountPath,
      containerReady: containerStatus?.ready ?? false,
      message: pod.status?.conditions
        ?.map((c) => `${c.type}: ${c.status}`)
        .join(", "),
    };
  } catch (err: any) {
    if (
      err?.response?.statusCode === 404 ||
      err?.statusCode === 404 ||
      err?.code === 404 ||
      err?.body?.includes?.("not found")
    ) {
      return { exists: false };
    }
    throw err;
  }
}

export async function createPodAndPVC(
  studentId: string,
  password: string
): Promise<void> {
  const pvcName = `ubuntu-pvc-${studentId}`;
  const podName = `ubuntu-${studentId}`;
  const volumeName = `data-${studentId}`;

  // combining the system AUTH_SECRET (salt) and the studentId
  const salt = process.env.AUTH_SECRET || "default_kmitl_salt";
  const rootPassword = crypto
    .createHmac("sha256", salt)
    .update(studentId)
    .digest("hex")
    .substring(0, 16);

  const mountPathHash = crypto
    .createHmac("sha256", salt)
    .update(studentId)
    .digest("hex")
    .substring(0, 20);

  console.log(`Generated root password for ${studentId}: ${rootPassword}`);

  // Create PVC
  const pvc: k8s.V1PersistentVolumeClaim = {
    apiVersion: "v1",
    kind: "PersistentVolumeClaim",
    metadata: {
      name: pvcName,
      namespace,
      labels: {
        app: "pod-spawner",
        "student-id": studentId,
      },
    },
    spec: {
      accessModes: ["ReadWriteOnce"],
      storageClassName: "local-path",
      resources: {
        requests: {
          storage: "10Gi",
        },
      },
    },
  };

  // Create Pod
  const pod: k8s.V1Pod = {
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: podName,
      namespace,
      labels: {
        app: "pod-spawner",
        "student-id": studentId,
      },
    },
    spec: {
      containers: [
        {
          name: "ubuntu",
          image: "ubuntu",
          env: [
            { name: "STUDENT_PW", value: password },
            { name: "ROOT_PW", value: rootPassword }
          ],
          command: ["/bin/bash", "-c"],
          args: [
            `
          apt update && apt install -y openssh-server sudo
          mkdir -p /run/sshd
          
          # Native Fork Bomb Defense: Cap user processes to 200
          echo "student${studentId} hard nproc 200" >> /etc/security/limits.conf
          echo "student${studentId} soft nproc 200" >> /etc/security/limits.conf
          
          useradd -m -s /bin/bash student${studentId} || true
          echo "student${studentId}:$STUDENT_PW" | chpasswd
          usermod -aG sudo student${studentId}
          echo "root:$ROOT_PW" | chpasswd
          echo "PermitRootLogin yes" >> /etc/ssh/sshd_config
          echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config
          
          # Force PAM to enforce limits for SSH sessions
          sed -i 's/# session    required     pam_limits.so/session    required     pam_limits.so/g' /etc/pam.d/sshd
          
          /usr/sbin/sshd -D
          `
          ],
          resources: {
            requests: {
              memory: "512Mi",
              cpu: "250m",
            },
            limits: {
              memory: "1Gi",
              cpu: "500m",
            },
          },
          ports: [{ containerPort: 22 }],
          volumeMounts: [
            {
              name: volumeName,
              mountPath: `/data-${mountPathHash}`,
            },
          ],
        },
      ],
      volumes: [
        {
          name: volumeName,
          persistentVolumeClaim: {
            claimName: pvcName,
          },
        },
      ],
    },
  };

  // Create PVC first, then Pod
  try {
    await coreApi.createNamespacedPersistentVolumeClaim({
      namespace,
      body: pvc,
    });
  } catch (err: any) {
    // PVC might already exist if pod was deleted but PVC kept
    if (err?.response?.statusCode !== 409 && err?.statusCode !== 409) {
      throw err;
    }
  }

  await coreApi.createNamespacedPod({
    namespace,
    body: pod,
  });

  // Create SSH Service
  const svcName = `ubuntu-ssh-${studentId}`;
  let svcCreated = false;
  let attempts = 0;

  while (!svcCreated && attempts < 10) {
    const nodePort = Math.floor(Math.random() * (30050 - 30000 + 1)) + 30000;
    const svc: k8s.V1Service = {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: svcName,
        namespace,
      },
      spec: {
        type: "NodePort",
        ports: [
          {
            port: 22,
            targetPort: 22,
            nodePort,
          },
        ],
        selector: {
          app: "pod-spawner",
          "student-id": studentId,
        },
      },
    };

    try {
      await coreApi.createNamespacedService({ namespace, body: svc });
      svcCreated = true;
    } catch (err: any) {
      if (err?.body?.message?.includes("provided port is already allocated")) {
        attempts++;
      } else if (
        err?.response?.statusCode === 409 ||
        err?.statusCode === 409 ||
        err?.code === 409
      ) {
        svcCreated = true; // already exists
      } else {
        throw err;
      }
    }
  }
}

export async function deletePodAndPVC(studentId: string): Promise<void> {
  const pvcName = `ubuntu-pvc-${studentId}`;
  const podName = `ubuntu-${studentId}`;

  // Delete pod first
  try {
    await coreApi.deleteNamespacedPod({
      name: podName,
      namespace,
    });
  } catch (err: any) {
    if (err?.response?.statusCode !== 404 && err?.statusCode !== 404) {
      throw err;
    }
  }

  // Delete PVC
  try {
    await coreApi.deleteNamespacedPersistentVolumeClaim({
      name: pvcName,
      namespace,
    });
  } catch (err: any) {
    if (
      err?.response?.statusCode !== 404 &&
      err?.statusCode !== 404 &&
      err?.code !== 404 &&
      !err?.body?.includes?.("not found")
    ) {
      throw err;
    }
  }

  // Delete Service
  try {
    await coreApi.deleteNamespacedService({
      name: `ubuntu-ssh-${studentId}`,
      namespace,
    });
  } catch (err: any) {
    if (
      err?.response?.statusCode !== 404 &&
      err?.statusCode !== 404 &&
      err?.code !== 404 &&
      !err?.body?.includes?.("not found")
    ) {
      throw err;
    }
  }
}
