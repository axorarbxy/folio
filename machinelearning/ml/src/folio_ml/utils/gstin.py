"""GSTIN format and checksum utilities.

Standard algorithm: ISO/IEC 7064 Mod 36,36 variant used by GSTN India.
Format:
  - 2 digits: State code
  - 10 characters: PAN (5 letters, 4 digits, 1 letter)
  - 1 character: Entity number (1-9, A-Z)
  - 1 character: 'Z' by default
  - 1 character: Check character (0-9, A-Z)
"""

import random
import re

GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


def is_valid_format(gstin: str) -> bool:
    """Checks whether the string strictly conforms to 15-character GSTIN regex."""
    if not isinstance(gstin, str):
        return False
    return bool(GSTIN_REGEX.match(gstin.strip().upper()))


def compute_check_char(first_14: str) -> str:
    """Computes the 15th check character for the first 14 characters of a GSTIN.

    Algorithm:
      For each char at index i (0..13):
        idx = GSTIN_CHARS.index(char)
        factor = 1 if i % 2 == 0 else 2
        product = idx * factor
        term = (product // 36) + (product % 36)
        running_sum += term
      check_char_index = (36 - (running_sum % 36)) % 36
    """
    clean = first_14.strip().upper()
    if len(clean) != 14:
        raise ValueError(f"Input for check character must be exactly 14 characters, got {len(clean)}")

    running_sum = 0
    for i, char in enumerate(clean):
        if char not in GSTIN_CHARS:
            raise ValueError(f"Invalid character '{char}' in GSTIN base")
        idx = GSTIN_CHARS.index(char)
        factor = 1 if i % 2 == 0 else 2
        prod = idx * factor
        running_sum += (prod // 36) + (prod % 36)

    check_idx = (36 - (running_sum % 36)) % 36
    return GSTIN_CHARS[check_idx]


def is_valid_gstin(gstin: str) -> bool:
    """Validates both the structural format and the 15th checksum character."""
    if not is_valid_format(gstin):
        return False
    clean = gstin.strip().upper()
    expected_check = compute_check_char(clean[:14])
    return clean[14] == expected_check


def make_gstin(
    state_code: str | int,
    pan: str,
    entity_no: str | int = 1,
    rng: random.Random | None = None,
) -> str:
    """Generates a valid 15-character GSTIN given state code, PAN, and entity number."""
    st = f"{int(state_code):02d}"
    clean_pan = pan.strip().upper()
    entity = str(entity_no).upper()
    base = f"{st}{clean_pan}{entity}Z"
    chk = compute_check_char(base)
    return base + chk


def generate_random_pan(rng: random.Random | None = None) -> str:
    """Generates a synthetic, validly formatted 10-character PAN."""
    r = rng or random.Random()
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    digits = "0123456789"
    part1 = "".join(r.choice(letters) for _ in range(5))
    part2 = "".join(r.choice(digits) for _ in range(4))
    part3 = r.choice(letters)
    return f"{part1}{part2}{part3}"


def generate_synthetic_gstin(
    state_code: str | int | None = None,
    rng: random.Random | None = None,
) -> str:
    """Generates a valid synthetic GSTIN across common Indian states."""
    r = rng or random.Random()
    valid_states = ["07", "08", "09", "19", "24", "27", "29", "32", "33", "36"]
    st = str(state_code) if state_code is not None else r.choice(valid_states)
    pan = generate_random_pan(r)
    entity_code = r.choice("123456789")
    return make_gstin(st, pan, entity_code, r)
