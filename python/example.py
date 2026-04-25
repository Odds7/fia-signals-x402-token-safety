from fia_x402_token_safety import screen_token_batch


def sign_x402_challenge(challenge):
    print("x402 challenge:", challenge)
    raise RuntimeError("Wire this to your x402 wallet/client and return the X-PAYMENT header.")


result = screen_token_batch(
    token_addresses=[
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "0x4200000000000000000000000000000000000006",
    ],
    create_payment_header=sign_x402_challenge,
)
print(result)
