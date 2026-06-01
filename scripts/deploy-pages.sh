#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
worktree_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$worktree_dir"
}
trap cleanup EXIT

cp -R "$repo_root/dist/." "$worktree_dir/"
touch "$worktree_dir/.nojekyll"

git -C "$worktree_dir" init
git -C "$worktree_dir" checkout -b gh-pages
git -C "$worktree_dir" config user.name "$(git -C "$repo_root" config user.name)"
git -C "$worktree_dir" config user.email "$(git -C "$repo_root" config user.email)"
git -C "$worktree_dir" add .
git -C "$worktree_dir" commit -m "Deploy GitHub Pages"
git -C "$worktree_dir" remote add origin "$(git -C "$repo_root" remote get-url origin)"
git -C "$worktree_dir" push --force origin gh-pages
