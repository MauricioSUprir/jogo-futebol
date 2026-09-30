#!/usr/bin/env bash
# Depois de editar um .js/.mjs do futebol3d/, confere a sintaxe com node --check.
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
case "$f" in
  */futebol3d/*.js|*/futebol3d/*.mjs) ;;
  *) exit 0 ;;
esac
[ -f "$f" ] || exit 0
out=$(node --check "$f" 2>&1) || { echo "Erro de sintaxe em $f:" >&2; echo "$out" >&2; exit 2; }
exit 0
