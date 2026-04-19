#!/bin/sh
set -eu

log() {
  printf '[default worktree env] %s\n' "$*"
}

is_commit_ref() {
  printf '%s' "$1" | grep -Eq '^[0-9a-fA-F]{7,40}$'
}

pick_default_remote() {
  if git remote get-url origin >/dev/null 2>&1; then
    printf '%s\n' origin
    return
  fi

  git remote | sed -n '1p'
}

remote_branch_exists() {
  remote="$1"
  branch="$2"
  [ -n "$remote" ] &&
    [ -n "$branch" ] &&
    git ls-remote --exit-code --heads "$remote" "refs/heads/$branch" >/dev/null 2>&1
}

resolve_target_from_ref() {
  ref="$1"
  default_remote="$2"
  TARGET_REMOTE=
  TARGET_BRANCH=

  case "$ref" in
    '' | HEAD)
      return 1
      ;;
    refs/heads/*)
      TARGET_REMOTE="$default_remote"
      TARGET_BRANCH="${ref#refs/heads/}"
      ;;
    refs/remotes/*)
      remote_ref="${ref#refs/remotes/}"
      TARGET_REMOTE="${remote_ref%%/*}"
      TARGET_BRANCH="${remote_ref#*/}"
      ;;
    */*)
      possible_remote="${ref%%/*}"
      possible_branch="${ref#*/}"
      if git remote get-url "$possible_remote" >/dev/null 2>&1; then
        TARGET_REMOTE="$possible_remote"
        TARGET_BRANCH="$possible_branch"
      else
        TARGET_REMOTE="$default_remote"
        TARGET_BRANCH="$ref"
      fi
      ;;
    *)
      if is_commit_ref "$ref"; then
        return 1
      fi
      TARGET_REMOTE="$default_remote"
      TARGET_BRANCH="$ref"
      ;;
  esac

  [ -n "$TARGET_REMOTE" ] && [ -n "$TARGET_BRANCH" ]
}

current_branch="$(git branch --show-current 2>/dev/null || true)"
default_remote="$(pick_default_remote)"

if [ -z "$default_remote" ]; then
  log 'No git remote configured; skipping remote sync.'
  exit 0
fi

git fetch --prune "$default_remote"

target_remote=
target_branch=

if [ -n "$current_branch" ] && remote_branch_exists "$default_remote" "$current_branch"; then
  target_remote="$default_remote"
  target_branch="$current_branch"
else
  base_ref="${VF_WORKTREE_BASE_REF:-}"
  if resolve_target_from_ref "$base_ref" "$default_remote" &&
    remote_branch_exists "$TARGET_REMOTE" "$TARGET_BRANCH"; then
    target_remote="$TARGET_REMOTE"
    target_branch="$TARGET_BRANCH"
  fi
fi

if [ -z "$target_remote" ] || [ -z "$target_branch" ]; then
  log "No matching remote branch found for ${current_branch:-detached HEAD}; skipping remote sync."
  exit 0
fi

if [ -n "$current_branch" ]; then
  log "Pulling latest code from $target_remote/$target_branch into $current_branch."
  git pull --rebase --autostash "$target_remote" "$target_branch"
else
  log "Checking out latest code from $target_remote/$target_branch in detached mode."
  git fetch "$target_remote" "$target_branch"
  git checkout --detach FETCH_HEAD
fi
