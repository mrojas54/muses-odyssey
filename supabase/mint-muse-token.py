#!/usr/bin/env python3
"""Mint a 90-day `muse_reader` JWT for The Muse's Odyssey quiz-history sync.

The token is signed HS256 with the project's *legacy JWT secret* (the same
secret that signs the anon key). Its `role: muse_reader` claim tells PostgREST
to switch to the muse_reader DB role, which the RLS policies in schema.sql
permit. No stdlib-external deps — pure hmac/base64, so no `pip install` needed.

Usage:
    export SUPABASE_JWT_SECRET='<paste legacy JWT secret from dashboard>'
    python3 supabase/mint-muse-token.py            # 90-day token (default)
    python3 supabase/mint-muse-token.py --days 30  # custom lifetime

Where to find the secret:
    Dashboard → Project Settings → API → JWT Settings → "JWT Secret" (legacy).

Rotation: re-run at day 85, paste the new token into the app config, redeploy.
"""
import argparse
import base64
import hashlib
import hmac
import json
import os
import sys
import time

PROJECT_REF = "agtfetvhsflmhhmddzxm"


def b64url(raw: bytes) -> str:
    """Base64url without padding, per JWT spec."""
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def mint(secret: str, days: int) -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "role": "muse_reader",
        "iss": "supabase",
        "ref": PROJECT_REF,
        "iat": now,
        "exp": now + days * 24 * 60 * 60,
    }
    signing_input = (
        b64url(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + b64url(json.dumps(payload, separators=(",", ":")).encode())
    )
    sig = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    return signing_input + "." + b64url(sig)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--days", type=int, default=90, help="token lifetime (default 90)")
    args = ap.parse_args()

    secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not secret:
        print(
            "ERROR: set SUPABASE_JWT_SECRET first.\n"
            "  Dashboard → Project Settings → API → JWT Settings → JWT Secret\n"
            "  export SUPABASE_JWT_SECRET='...'",
            file=sys.stderr,
        )
        return 1

    token = mint(secret, args.days)
    print(token)
    print(
        f"\n# ↑ muse_reader JWT, valid {args.days} days "
        f"(rotate ~{args.days - 5} days from now).",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
