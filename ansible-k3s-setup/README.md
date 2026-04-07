# K3s Kubernetes Cluster Deployment with Ansible

Automated deployment of a lightweight Kubernetes cluster using K3s with monitoring stack (Prometheus & Grafana) on Raspberry Pi or similar ARM-based devices.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage](#usage)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Security](#security)

## 🎯 Overview

This Ansible playbook automates the deployment of a K3s Kubernetes cluster with:
- **K3s**: Lightweight Kubernetes distribution
- **Prometheus**: Metrics collection and monitoring
- **Grafana**: Visualization and dashboards
- **UFW Firewall**: Network security configuration
- **Automated verification**: Ensures all nodes are ready

## ✨ Features

- ✅ Automated K3s master and worker node setup
- ✅ cgroup configuration for Raspberry Pi
- ✅ Unique hostname assignment (control-1, worker-1, etc.)
- ✅ Helm 3 installation
- ✅ kube-prometheus-stack deployment
- ✅ Grafana dashboard with NodePort access
- ✅ UFW firewall configuration
- ✅ Cluster health verification (30-minute timeout)
- ✅ Idempotent playbooks (safe to re-run)

## 📦 Prerequisites

### Control Machine (Your Mac)
```bash
# Install Ansible
brew install ansible

# Install required Ansible collections
ansible-galaxy collection install community.general
ansible-galaxy collection install kubernetes.core
```

### Target Nodes (Raspberry Pi/ARM devices)
- Raspberry Pi OS
- Python 3 installed
- SSH access configured
- sudo privileges
- At least 2GB RAM per node

### Network Requirements
- All nodes must be able to communicate
- Ports 6443, 10250, 8472 must be open between nodes

## 📁 Project Structure

```
ansible-k3s-setup/
├── playbook.yaml                    # Main playbook
├── inventory.ini                    # Inventory file
├── README.md                        # This file
└── roles/
    ├── kube_cluster/               # Common cluster setup
    │   ├── tasks/
    │   │   ├── main.yaml           # System updates, cgroups, hostnames
    │   │   ├── setup.yaml          # Apt updates, Helm installation
    │   │   └── hostnamectl.yaml    # Hostname configuration
    │   └── files/
    │       └── memgroup.py         # cgroup configuration script
    ├── kube_master/                # Master node setup
    │   └── tasks/
    │       ├── main.yaml           # Master orchestration
    │       ├── setup.yaml          # K3s master installation
    │       ├── firewall.yaml       # UFW configuration
    │       └── dashboard.yaml      # Monitoring stack deployment
    └── kube_worker/                # Worker node setup
        └── tasks/
            ├── main.yaml           # Worker orchestration
            └── setup.yaml          # K3s worker join
```

## 🚀 Quick Start

### 1. Clone the Repository
```bash
cd <github_repo>/ansible-k3s-setup
```

### 2. Configure Inventory
Edit `inventory.ini` with your node details:

```ini
[kube_masters]
master01 ansible_host=161.246.5.60 ansible_user=pi ansible_ssh_private_key_file=~/.ssh/id_ed25519

[kube_workers]
worker01 ansible_host=161.246.5.72 ansible_user=admin ansible_ssh_private_key_file=~/.ssh/id_ed25519 ansible_become_password="{{ lookup('env', 'PASSWORD') }}"

[kube_cluster:children]
kube_masters
kube_workers
```

### 3. Set Environment Variables
```bash
# If worker nodes require sudo password
export PASSWORD='your_sudo_password'
```

### 4. Test Connectivity
```bash
ansible -i inventory.ini kube_cluster -m ping
```

### 5. Deploy Cluster
```bash
ansible-playbook -i inventory.ini playbook.yaml
```

## ⚙️ Configuration

### Custom Grafana Password
Add to `inventory.ini` under `[kube_cluster:vars]`:
```ini
grafana_admin_password=YourSecurePassword123
```

### Multiple Masters/Workers
Add more nodes to inventory:
```ini
[kube_masters]
master01 ansible_host=192.168.1.10 ...
master02 ansible_host=192.168.1.11 ...

[kube_workers]
worker01 ansible_host=192.168.1.20 ...
worker02 ansible_host=192.168.1.21 ...
worker03 ansible_host=192.168.1.22 ...
```

## 📊 Monitoring

### Access Grafana Dashboard

After deployment completes, look for output:
```
TASK [Display Grafana access information]
ok: [master01] => {
    "msg": "Grafana Pod: monitoring-grafana-xxxxxxxxx-xxxxx\nRunning on Node IP: 161.246.5.60\nDashboard URL: http://161.246.5.60:30000\nUsername: admin\nPassword: admin123\n"
}
```

### Manual Access
```bash
# Get Grafana URL
kubectl get svc -n monitoring monitoring-grafana

# Access via NodePort (default: 30000)
http://<any-node-ip>:30000
```

### Default Credentials
- **Username**: `admin`
- **Password**: `admin123` (or your custom password)

### Available Dashboards
- Kubernetes / Compute Resources / Cluster
- Kubernetes / Compute Resources / Namespace (Pods)
- Node Exporter / Nodes
- Prometheus / Overview

## 🔧 Troubleshooting

### Nodes Not Ready
```bash
# Check node status
kubectl get nodes

# Describe problem node
kubectl describe node <node-name>

# Check K3s service
sudo systemctl status k3s        # on master
sudo systemctl status k3s-agent  # on worker
```

### Grafana Not Accessible
```bash
# Check Grafana pod
kubectl get pods -n monitoring -l app.kubernetes.io/name=grafana

# Check service
kubectl get svc -n monitoring monitoring-grafana

# View logs
kubectl logs -n monitoring deployment/monitoring-grafana
```

### Helm Installation Failed
```bash
# Verify Helm installation
helm version

# Check Helm releases
helm list -n monitoring

# Uninstall and retry
helm uninstall monitoring -n monitoring
```

### Worker Node Won't Join
```bash
# On master, get token
sudo cat /var/lib/rancher/k3s/server/node-token

# On worker, check logs
sudo journalctl -u k3s-agent -f

# Verify master is reachable
curl -k https://<master-ip>:6443
```

### Firewall Issues
```bash
# Check UFW status
sudo ufw status verbose

# Reload UFW
sudo ufw reload

# Disable temporarily for testing
sudo ufw disable
```

## 🔒 Security

### Firewall Ports (UFW)
- **22**: SSH
- **6443**: Kubernetes API
- **10250**: Kubelet API
- **8472**: Flannel VXLAN
- **30000**: Grafana NodePort
- **4001**: etcd (if using external etcd)

### Best Practices
1. Change default Grafana password immediately
2. Use SSH keys (already configured)
3. Keep sudo passwords in environment variables, not in files
4. Regularly update packages: `ansible-playbook -i inventory.ini playbook.yaml --tags update`
5. Monitor cluster logs regularly

### SSH Key Setup
```bash
# Generate SSH key if needed
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy to nodes
ssh-copy-id -i ~/.ssh/id_ed25519.pub pi@<master-ip>
ssh-copy-id -i ~/.ssh/id_ed25519.pub admin@<worker-ip>
```

## 📝 What the Playbook Does

### Stage 1: Cluster Setup (All Nodes)
1. ✅ Update system packages (`apt update && apt dist-upgrade`)
2. ✅ Install Git and Helm 3
3. ✅ Configure cgroups for Kubernetes (Raspberry Pi specific)
4. ✅ Set unique hostnames (control-1, worker-1, etc.)
5. ✅ Reboot systems

### Stage 2: Master Node
1. ✅ Install K3s master
2. ✅ Configure kubectl for user
3. ✅ Setup UFW firewall rules
4. ✅ Deploy kube-prometheus-stack via Helm
5. ✅ Reset Grafana admin password
6. ✅ Expose Grafana via NodePort (30000)

### Stage 3: Worker Nodes
1. ✅ Retrieve join token from master
2. ✅ Join K3s cluster
3. ✅ Wait for agent to be ready

### Stage 4: Verification
1. ✅ Count total nodes (must match inventory)
2. ✅ Wait for all nodes to be Ready (max 30 minutes)
3. ✅ Display final cluster status
4. ✅ Show Grafana access information

## 🎯 Usage Examples

### Deploy Only Master Node
```bash
ansible-playbook -i inventory.ini playbook.yaml --limit kube_masters
```

### Deploy Only Workers
```bash
ansible-playbook -i inventory.ini playbook.yaml --limit kube_workers
```

### Skip Monitoring Stack
```bash
# Comment out dashboard.yaml in roles/kube_master/tasks/main.yaml
```

### Re-run Verification Only
```bash
ansible-playbook -i inventory.ini playbook.yaml --tags verify
```

## 🆘 Support

For issues or questions:
1. Check logs: `kubectl logs -n monitoring <pod-name>`
2. Verify connectivity: `ansible -i inventory.ini kube_cluster -m ping`
3. Review Ansible output for failed tasks
4. Check K3s documentation: https://docs.k3s.io

## 📄 License

MIT License - feel free to use and modify.

## 🙏 Acknowledgments

- [K3s](https://k3s.io/) - Lightweight Kubernetes
- [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts) - Monitoring stack
- [Ansible](https://www.ansible.com/) - Automation platform

---

**Note**: This setup is optimized for Raspberry Pi and ARM devices but can work on x86_64 with minor modifications.