#!/usr/bin/env bash
# End-to-end smoke test for阶段 1: auth + users + friends.
# Requires the server running locally.
#
# Usage:
#   BASE_URL=http://localhost:3000/api/v1 ./test/e2e-flow.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"
RAND="$(date +%s%N)"
USER_A_EMAIL="alice_${RAND}@test.local"
USER_B_EMAIL="bob_${RAND}@test.local"
PASSWORD="Pass1234"

step() { echo ""; echo "==> $1"; }
fail() { echo "FAIL: $1" >&2; exit 1; }

require_jq() {
  command -v jq >/dev/null || fail "jq required (apt-get install jq)"
}

post() {
  local path="$1"; local body="$2"; shift 2
  curl -sS -X POST -H "Content-Type: application/json" "$@" -d "$body" "${BASE_URL}${path}"
}

get() {
  local path="$1"; shift
  curl -sS "$@" "${BASE_URL}${path}"
}

require_jq

step "1. health"
H="$(get /health)"
echo "$H" | jq .
[[ "$(echo "$H" | jq -r .db)" == "up" ]] || fail "health.db != up"

step "2. register Alice"
A_REG="$(post /auth/register "$(jq -n --arg e "$USER_A_EMAIL" --arg p "$PASSWORD" --arg n "Alice" \
  '{email:$e,password:$p,nickname:$n}')")"
echo "$A_REG" | jq .
A_ACCESS="$(echo "$A_REG" | jq -r '.tokens.accessToken')"
A_REFRESH="$(echo "$A_REG" | jq -r '.tokens.refreshToken')"
A_ID="$(echo "$A_REG" | jq -r '.user.id')"
[[ -n "$A_ACCESS" && "$A_ACCESS" != "null" ]] || fail "no access token"

step "3. register Bob"
B_REG="$(post /auth/register "$(jq -n --arg e "$USER_B_EMAIL" --arg p "$PASSWORD" --arg n "Bob" \
  '{email:$e,password:$p,nickname:$n}')")"
B_ACCESS="$(echo "$B_REG" | jq -r '.tokens.accessToken')"
B_ID="$(echo "$B_REG" | jq -r '.user.id')"

step "4. duplicate register Alice (expect 409)"
DUP="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Content-Type: application/json" \
  -d "$(jq -n --arg e "$USER_A_EMAIL" --arg p "$PASSWORD" --arg n "Alice2" \
        '{email:$e,password:$p,nickname:$n}')" "${BASE_URL}/auth/register")"
[[ "$DUP" == "409" ]] || fail "expected 409 got $DUP"
echo "ok: 409"

step "5. login Alice"
L="$(post /auth/login "$(jq -n --arg e "$USER_A_EMAIL" --arg p "$PASSWORD" '{email:$e,password:$p}')")"
echo "$L" | jq '.user'
A_ACCESS="$(echo "$L" | jq -r '.tokens.accessToken')"
A_REFRESH="$(echo "$L" | jq -r '.tokens.refreshToken')"

step "6. login wrong password (expect 401)"
WRONG="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Content-Type: application/json" \
  -d "$(jq -n --arg e "$USER_A_EMAIL" '{email:$e,password:"wrong-pw1"}')" \
  "${BASE_URL}/auth/login")"
[[ "$WRONG" == "401" ]] || fail "expected 401 got $WRONG"
echo "ok: 401"

step "7. /users/me with token"
ME="$(get /users/me -H "Authorization: Bearer $A_ACCESS")"
echo "$ME" | jq '{id,email,nickname}'
[[ "$(echo "$ME" | jq -r .id)" == "$A_ID" ]] || fail "me id mismatch"

step "8. /users/me without token (expect 401)"
NO_AUTH="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}/users/me")"
[[ "$NO_AUTH" == "401" ]] || fail "expected 401 got $NO_AUTH"
echo "ok: 401"

step "9. refresh token"
REF="$(post /auth/refresh "$(jq -n --arg t "$A_REFRESH" '{refreshToken:$t}')")"
echo "$REF" | jq '{accessTokenLen:(.accessToken|length), refreshTokenLen:(.refreshToken|length), expiresIn}'
A_ACCESS="$(echo "$REF" | jq -r '.accessToken')"
A_REFRESH_NEW="$(echo "$REF" | jq -r '.refreshToken')"

step "10. old refresh token reused (expect 401, rotation)"
OLD_REUSE="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$A_REFRESH" '{refreshToken:$t}')" "${BASE_URL}/auth/refresh")"
[[ "$OLD_REUSE" == "401" ]] || fail "expected 401 got $OLD_REUSE"
echo "ok: 401 (rotated)"
A_REFRESH="$A_REFRESH_NEW"

step "11. Alice sends friend request to Bob"
SEND="$(post /friends/requests "$(jq -n --arg id "$B_ID" '{friendId:$id, remark:"hi from alice"}')" \
  -H "Authorization: Bearer $A_ACCESS")"
echo "$SEND" | jq .
[[ "$(echo "$SEND" | jq -r .status)" == "pending" ]] || fail "expected pending"

step "12. Bob lists incoming requests"
INC="$(get /friends/requests/incoming -H "Authorization: Bearer $B_ACCESS")"
echo "$INC" | jq .
COUNT="$(echo "$INC" | jq 'length')"
[[ "$COUNT" -ge 1 ]] || fail "expected ≥1 incoming"

step "13. Bob accepts request"
ACC="$(curl -sS -X POST "${BASE_URL}/friends/requests/${A_ID}/accept" -H "Authorization: Bearer $B_ACCESS")"
echo "$ACC" | jq .

step "14. Alice friend list contains Bob"
A_FR="$(get /friends -H "Authorization: Bearer $A_ACCESS")"
echo "$A_FR" | jq .
HAS_BOB="$(echo "$A_FR" | jq --arg id "$B_ID" 'any(.id == $id)')"
[[ "$HAS_BOB" == "true" ]] || fail "Alice does not see Bob"

step "15. Bob friend list contains Alice"
B_FR="$(get /friends -H "Authorization: Bearer $B_ACCESS")"
HAS_ALICE="$(echo "$B_FR" | jq --arg id "$A_ID" 'any(.id == $id)')"
[[ "$HAS_ALICE" == "true" ]] || fail "Bob does not see Alice"

step "16. forgot-password (dev token returned)"
FP="$(post /auth/forgot-password "$(jq -n --arg e "$USER_A_EMAIL" '{email:$e}')")"
echo "$FP" | jq .
DEV_TOKEN="$(echo "$FP" | jq -r '.devToken // empty')"
[[ -n "$DEV_TOKEN" ]] || fail "no devToken in non-prod"

step "17. reset-password with token"
RP="$(post /auth/reset-password "$(jq -n --arg t "$DEV_TOKEN" '{token:$t,newPassword:"NewPass99"}')")"
echo "$RP" | jq .

step "18. login with new password"
L2="$(post /auth/login "$(jq -n --arg e "$USER_A_EMAIL" '{email:$e,password:"NewPass99"}')")"
echo "$L2" | jq '.user.id'

step "19. old refresh token revoked after password reset (expect 401)"
OLD_AFTER_RESET="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$A_REFRESH" '{refreshToken:$t}')" "${BASE_URL}/auth/refresh")"
[[ "$OLD_AFTER_RESET" == "401" ]] || fail "expected 401 got $OLD_AFTER_RESET"
echo "ok: 401"

step "20. Alice removes Bob"
RM="$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE \
  "${BASE_URL}/friends/${B_ID}" -H "Authorization: Bearer $(echo "$L2" | jq -r '.tokens.accessToken')")"
[[ "$RM" == "204" ]] || fail "expected 204 got $RM"

step "ALL CHECKS PASSED"
