# @vibe-forge/bootstrap 3.0.1

- Cache published package version lookups and fall back to the cached version when `npm view` is slow.
- Refresh package version metadata in a detached background worker after timeout fallback.
