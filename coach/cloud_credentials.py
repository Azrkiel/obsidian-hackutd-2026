"""Runtime tokens in Windows Credential Manager; never a plaintext fallback."""
from __future__ import annotations

import hashlib
import sys
from typing import Any


class CloudCredentialError(Exception):
    """Safe-to-display credential-store error, without backend exception text."""


class CredentialStore:
    def __init__(self, backend: Any = None):
        self._backend = backend

    def _get_backend(self):
        if self._backend is None:
            if sys.platform != "win32":
                raise CloudCredentialError("Windows Credential Manager is unavailable on this platform; use complete environment overrides.")
            try:
                from keyring.backends.Windows import WinVaultKeyring
                self._backend = WinVaultKeyring()
            except Exception:
                raise CloudCredentialError("Windows Credential Manager is unavailable; install the cloud extra.") from None
        return self._backend

    @staticmethod
    def _service(url: str, database: str) -> str:
        target = f"{url.rstrip('/')}\n{database}".encode("utf-8")
        return "PitPal.SpacetimeDB." + hashlib.sha256(target).hexdigest()

    def get_token(self, url: str, database: str, identity: str) -> str | None:
        try:
            return self._get_backend().get_password(self._service(url, database), identity)
        except CloudCredentialError:
            raise
        except Exception:
            raise CloudCredentialError("Unable to read the cloud credential from Windows Credential Manager.") from None

    def set_token(self, url: str, database: str, identity: str, token: str) -> None:
        try:
            self._get_backend().set_password(self._service(url, database), identity, token)
        except CloudCredentialError:
            raise
        except Exception:
            raise CloudCredentialError("Unable to save the cloud credential in Windows Credential Manager.") from None

    def delete_token(self, url: str, database: str, identity: str) -> None:
        try:
            self._get_backend().delete_password(self._service(url, database), identity)
        except CloudCredentialError:
            raise
        except Exception:
            raise CloudCredentialError("Unable to remove the cloud credential from Windows Credential Manager.") from None


WindowsCredentialStore = CredentialStore
