#!/usr/bin/env python3
"""Commit local file changes to a GitHub repo via the REST API (no local git needed).

Requires GITHUB_TOKEN in the environment (a PAT with 'repo' scope, or a
fine-grained token with Contents: read/write on the target repo).

Usage:
  export GITHUB_TOKEN=ghp_xxx
  python3 scripts/github_commit.py --repo jonaschuba/wetterpilot --branch main \
      -m "Fix typo in README" README.md path/to/other_changed_file.js

Each path is read from disk (relative to --root, default: repo checkout dir)
and written to the same path in the repo. Deletions aren't supported here;
ask for that separately if needed.
"""
import argparse
import base64
import json
import os
import sys
import urllib.request
import urllib.error

API = "https://api.github.com"


def gh(token, method, path, body=None):
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        print(f"GitHub API error {e.code} on {method} {path}:\n{detail}", file=sys.stderr)
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--repo", required=True, help="owner/repo, e.g. jonaschuba/wetterpilot")
    ap.add_argument("--branch", default="main")
    ap.add_argument("--root", default=".", help="local directory the paths below are relative to")
    ap.add_argument("-m", "--message", required=True)
    ap.add_argument("paths", nargs="+", help="repo-relative file paths that changed")
    args = ap.parse_args()

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("GITHUB_TOKEN is not set in the environment.", file=sys.stderr)
        sys.exit(1)

    owner_repo = args.repo

    # 1. current branch tip
    ref = gh(token, "GET", f"/repos/{owner_repo}/git/ref/heads/{args.branch}")
    base_commit_sha = ref["object"]["sha"]
    base_commit = gh(token, "GET", f"/repos/{owner_repo}/git/commits/{base_commit_sha}")
    base_tree_sha = base_commit["tree"]["sha"]

    # 2. blob per changed file
    tree_entries = []
    for rel_path in args.paths:
        local_path = os.path.join(args.root, rel_path)
        with open(local_path, "rb") as f:
            content = f.read()
        blob = gh(token, "POST", f"/repos/{owner_repo}/git/blobs", {
            "content": base64.b64encode(content).decode(),
            "encoding": "base64",
        })
        tree_entries.append({
            "path": rel_path,
            "mode": "100644",
            "type": "blob",
            "sha": blob["sha"],
        })
        print(f"  blob created for {rel_path}")

    # 3. new tree on top of the current one
    tree = gh(token, "POST", f"/repos/{owner_repo}/git/trees", {
        "base_tree": base_tree_sha,
        "tree": tree_entries,
    })

    # 4. commit
    commit = gh(token, "POST", f"/repos/{owner_repo}/git/commits", {
        "message": args.message,
        "tree": tree["sha"],
        "parents": [base_commit_sha],
    })

    # 5. move the branch ref forward
    gh(token, "PATCH", f"/repos/{owner_repo}/git/refs/heads/{args.branch}", {
        "sha": commit["sha"],
    })

    print(f"Committed {commit['sha'][:7]} to {owner_repo}@{args.branch}")
    print(f"https://github.com/{owner_repo}/commit/{commit['sha']}")


if __name__ == "__main__":
    main()
