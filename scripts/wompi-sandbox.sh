#!/usr/bin/env bash
# Wompi sandbox helper: creates a checkout or verifies a payment through the API.
#   scripts/wompi-sandbox.sh checkout <email> <password> [planId]       # prints the checkout URL
#   scripts/wompi-sandbox.sh verify   <email> <password> <transactionId>
#   scripts/wompi-sandbox.sh status   <email> <password>                # plan and payment history
# API_URL defaults to http://localhost:$PORT (PORT from .env or the environment). It logs in on
# every call, so an expired access token is never a problem. See docs/pagos-wompi.md.
set -euo pipefail

if [[ -z "${PORT:-}" && -f .env ]]; then
  PORT="$(grep -E '^PORT=' .env | cut -d= -f2)"
fi
API_URL="${API_URL:-http://localhost:${PORT:?Set PORT or API_URL}}"

usage() {
  sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

# Reads one field from JSON on stdin (dot path), with Node so there are no extra dependencies.
json() {
  node -e '
    let s = ""; process.stdin.on("data", (c) => (s += c)).on("end", () => {
      const body = JSON.parse(s);
      if (body.statusCode >= 400) { console.error(JSON.stringify(body, null, 2)); process.exit(1); }
      const value = process.argv[1] ? process.argv[1].split(".").reduce((o, k) => o?.[k], body) : body;
      console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
    });' "${1:-}"
}

login() {
  curl -sS -X POST "$API_URL/v1/auth/login" -H 'content-type: application/json' \
    -d "$(node -e 'console.log(JSON.stringify({ email: process.argv[1], password: process.argv[2], refreshTokenIn: "body" }))' "$1" "$2")" |
    json accessToken
}

[[ $# -ge 3 ]] || usage
command="$1" email="$2" password="$3"
token="$(login "$email" "$password")"
auth=(-H "Authorization: Bearer $token")

case "$command" in
  checkout)
    plan="${4:-pro}"
    curl -sS -X POST "$API_URL/v1/me/subscription/checkout" "${auth[@]}" \
      -H 'content-type: application/json' -d "{\"planId\":\"$plan\"}" | json checkoutUrl
    ;;
  verify)
    [[ -n "${4:-}" ]] || usage
    curl -sS -X POST "$API_URL/v1/me/payments/verify" "${auth[@]}" \
      -H 'content-type: application/json' -d "{\"transactionId\":\"$4\"}" | json
    ;;
  status)
    echo "Plan:"
    curl -sS "$API_URL/v1/me/subscription" "${auth[@]}" | json
    echo "Pagos:"
    curl -sS "$API_URL/v1/me/payments" "${auth[@]}" | json
    ;;
  *) usage ;;
esac
