"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

interface PodStatus {
  studentId: string;
  exists: boolean;
  phase?: string;
  podIP?: string;
  nodePort?: number;
  nodeIP?: string;
  mountPath?: string;
  containerReady?: boolean;
  message?: string;
}

interface SpawnResult {
  message: string;
  studentId: string;
  sshUser: string;
  password: string;
}

export default function Dashboard() {
  const { data: session, status: sessionStatus } = useSession();
  const [podStatus, setPodStatus] = useState<PodStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [spawnResult, setSpawnResult] = useState<SpawnResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch("/api/pod", { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setPodStatus(data);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to fetch pod status");
      }
    } catch {
      setError("Could not reach the cluster. Is the K8s API accessible?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchStatus();
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [sessionStatus, fetchStatus]);

  const handleSpawn = async () => {
    if (!password.trim()) {
      setError("Please enter a password for SSH access");
      return;
    }
    setActionLoading(true);
    setError(null);
    setSpawnResult(null);

    try {
      const res = await fetch("/api/pod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to spawn pod");
      } else {
        setSpawnResult(data);
        setPassword("");
        fetchStatus();
      }
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    setError(null);
    setShowDeleteConfirm(false);
    setSpawnResult(null);

    try {
      const res = await fetch("/api/pod", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete pod");
      } else {
        setPodStatus({ studentId: podStatus?.studentId || "", exists: false });
      }
    } catch {
      setError("Network error");
    } finally {
      setActionLoading(false);
    }
  };

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  const studentId = podStatus?.studentId || (session?.user?.email?.split("@")[0] ?? "");

  return (
    <div className="dashboard-container">
      <div className="dashboard-backdrop" />

      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <span className="header-title">K3s Pod Spawner</span>
        </div>
        <div className="header-right">
          <div className="user-info">
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt="avatar"
                className="user-avatar"
              />
            )}
            <span className="user-email">{session?.user?.email}</span>
          </div>
          <button
            onClick={() => signOut()}
            className="btn btn-ghost"
            id="signout-btn"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Student Info */}
        <div className="card student-card">
          <h2 className="card-label">Student</h2>
          <p className="student-id">{studentId}</p>
          <p className="student-email">{session?.user?.email}</p>
        </div>

        {/* Pod Status */}
        <div className="card status-card">
          <div className="status-header">
            <h2 className="card-label">Pod Status</h2>
            <span
              className={`status-badge ${podStatus?.exists
                  ? podStatus.phase === "Running"
                    ? "status-running"
                    : "status-pending"
                  : "status-none"
                }`}
            >
              {podStatus?.exists ? podStatus.phase || "Unknown" : "Not Created"}
            </span>
          </div>

          {podStatus?.exists && (
            <div className="status-details">
              <div className="status-row">
                <span className="status-label">Pod Name</span>
                <code className="status-value">ubuntu-{studentId}</code>
              </div>
              <div className="status-row">
                <span className="status-label">Pod IP</span>
                <code className="status-value">{podStatus.podIP || "Assigning..."}</code>
              </div>
              <div className="status-row">
                <span className="status-label">Node Port (SSH)</span>
                <code className="status-value">{podStatus.nodePort || "Assigning..."}</code>
              </div>
              <div className="status-row">
                <span className="status-label">Node IP</span>
                <code className="status-value">{podStatus.nodeIP || "Assigning..."}</code>
              </div>
              <div className="status-row">
                <span className="status-label">Container Ready</span>
                <span className={`status-value ${podStatus.containerReady ? "text-green" : "text-yellow"}`}>
                  {podStatus.containerReady ? "✓ Yes" : "⏳ No"}
                </span>
              </div>
              <div className="status-row">
                <span className="status-label">SSH User</span>
                <code className="status-value">student{studentId}</code>
              </div>
              <div className="status-row">
                <span className="status-label">Data Mount</span>
                <code className="status-value">{podStatus.mountPath || `/data-${studentId}`}</code>
              </div>
            </div>
          )}

          {podStatus?.exists && podStatus.phase === "Running" && podStatus.nodePort && podStatus.nodeIP && (
            <div className="ssh-info">
              <h3 className="ssh-title">SSH Connection</h3>
              <code className="ssh-command">
                ssh -p {podStatus.nodePort} student{studentId}@{podStatus.nodeIP}
              </code>
            </div>
          )}
        </div>

        {/* Spawn Result */}
        {spawnResult && (
          <div className="card result-card">
            <h2 className="card-label">🎉 Pod Created!</h2>
            <div className="status-details">
              <div className="status-row">
                <span className="status-label">SSH User</span>
                <code className="status-value">{spawnResult.sshUser}</code>
              </div>
              <div className="status-row">
                <span className="status-label">Password</span>
                <code className="status-value password-value">{spawnResult.password}</code>
              </div>
            </div>
            <p className="result-warning">
              ⚠️ Save your password now — it won&apos;t be shown again!
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="card error-card">
            <p>{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="card actions-card">
          {!podStatus?.exists ? (
            <div className="spawn-form">
              <h2 className="card-label">Spawn Ubuntu Pod</h2>
              <p className="spawn-desc">
                Create your personal Ubuntu pod with SSH access and 10Gi persistent storage.
              </p>
              <div className="form-group">
                <label htmlFor="password-input" className="form-label">
                  SSH Password
                </label>
                <input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password for SSH access"
                  className="form-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSpawn()}
                />
              </div>
              <button
                onClick={handleSpawn}
                disabled={actionLoading}
                className="btn btn-primary"
                id="spawn-btn"
              >
                {actionLoading ? (
                  <span className="btn-loading">Creating...</span>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Spawn Pod
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="delete-section">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={actionLoading}
                  className="btn btn-danger"
                  id="delete-btn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete Pod & Storage
                </button>
              ) : (
                <div className="confirm-delete">
                  <p className="confirm-text">
                    Are you sure? This will delete your pod and all persistent storage.
                  </p>
                  <div className="confirm-actions">
                    <button
                      onClick={handleDelete}
                      disabled={actionLoading}
                      className="btn btn-danger"
                      id="confirm-delete-btn"
                    >
                      {actionLoading ? "Deleting..." : "Yes, Delete Everything"}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="btn btn-ghost"
                      id="cancel-delete-btn"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
