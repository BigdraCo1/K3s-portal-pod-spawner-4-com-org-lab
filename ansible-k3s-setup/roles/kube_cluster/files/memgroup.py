import os

def read_file_content(file_path):
    try:
        with open(file_path, 'r') as file:
            content = file.read()
            return content
    except Exception as e:
        print(f"Error reading file: {e}")
        return None

cgroup = {
    "enable": "cpuset,memory",
    "memory": 1,
}

path = "/boot/firmware/cmdline.txt"
file_content = read_file_content(path)[:-1].split(" ")
file_content = [it.split("=") for it in file_content]
cg_content = [it[0] for it in file_content if "cgroup" in it[0]]
for it in cg_content:
    del cgroup[it[7:]]
for k, v in cgroup.items():
    key = "cgroup_" + k
    file_content.append([key, str(v)])
file_content.append("\n")

try:
     with open(path, 'w') as file:
         file.write(" ".join(["=".join(it) for it in file_content]))
except Exception as e:
     print(f"Error writing to file: {e}")