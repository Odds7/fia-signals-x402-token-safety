"""Python buyer-agent client for Fia Signals x402 token safety checks."""

from __future__ import annotations

import base64
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable


BASE_URL = "https://x402.fiasignals.com"
TOKEN_SAFETY_BATCH_PATH = "/token-safety/batch"
TOKEN_SAFETY_SINGLE_PATH = "/token-safety"
BASE_USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
X402_NETWORK = "eip155:8453"
X402_PAY_TO = "0x8D32c6a3EE3fB8a8b4c5378F7C5a26CC320a853F"
BATCH_AMOUNT_RAW_USDC = "100000"
SINGLE_AMOUNT_RAW_USDC = "30000"
EVM_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")


def _assert_address(address: str) -> None:
    if not EVM_ADDRESS_RE.match(address):
        raise ValueError(f"Invalid EVM token address: {address}")


def _decode_challenge(payment_required: str) -> Any:
    try:
        return json.loads(base64.b64decode(payment_required + "===").decode("utf-8"))
    except Exception:
        return None


def _request(url: str, headers: dict[str, str] | None = None) -> tuple[int, dict[str, str], bytes]:
    request = urllib.request.Request(url, headers=headers or {}, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, dict(response.headers), response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers), exc.read()


def _paid_get_json(
    path: str,
    params: dict[str, str],
    create_payment_header: Callable[[dict[str, Any]], str],
    base_url: str = BASE_URL,
) -> dict[str, Any]:
    url = f"{base_url}{path}?{urllib.parse.urlencode(params)}"
    status, headers, body = _request(url, {"Accept": "application/json"})
    if status != 402:
        if status >= 400:
            raise RuntimeError(f"Unexpected HTTP {status}: {body.decode('utf-8', errors='replace')}")
        return json.loads(body.decode("utf-8"))

    payment_required = headers.get("payment-required") or headers.get("Payment-Required")
    if not payment_required:
        raise RuntimeError("Received 402 without payment-required header")

    payment_header = create_payment_header(
        {
            "status": 402,
            "paymentRequired": payment_required,
            "decoded": _decode_challenge(payment_required),
        }
    )
    paid_status, _, paid_body = _request(
        url,
        {
            "Accept": "application/json",
            "X-PAYMENT": payment_header,
        },
    )
    if paid_status >= 400:
        raise RuntimeError(f"Paid request failed HTTP {paid_status}: {paid_body.decode('utf-8', errors='replace')}")
    return json.loads(paid_body.decode("utf-8"))


def screen_token_batch(
    token_addresses: list[str],
    create_payment_header: Callable[[dict[str, Any]], str],
    chain: str = "base",
    base_url: str = BASE_URL,
) -> dict[str, Any]:
    if not 1 <= len(token_addresses) <= 5:
        raise ValueError("token_addresses must contain 1 to 5 EVM addresses")
    for address in token_addresses:
        _assert_address(address)
    return _paid_get_json(
        TOKEN_SAFETY_BATCH_PATH,
        {"chain": chain, "token_addresses": ",".join(token_addresses)},
        create_payment_header,
        base_url,
    )


def screen_single_token(
    token_address: str,
    create_payment_header: Callable[[dict[str, Any]], str],
    chain: str = "base",
    base_url: str = BASE_URL,
) -> dict[str, Any]:
    _assert_address(token_address)
    return _paid_get_json(
        TOKEN_SAFETY_SINGLE_PATH,
        {"chain": chain, "token_address": token_address},
        create_payment_header,
        base_url,
    )
