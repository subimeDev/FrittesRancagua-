from __future__ import annotations


class QrTokenExpiredError(Exception):
    pass


class QrTokenInvalidError(Exception):
    pass


class QrTokenAlreadyUsedError(Exception):
    pass


class InsufficientStampsError(Exception):
    pass


class CustomerNotFoundError(Exception):
    pass
