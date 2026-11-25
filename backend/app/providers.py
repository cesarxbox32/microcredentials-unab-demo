from dataclasses import dataclass
from typing import Protocol
from urllib.parse import quote, urlparse
from uuid import UUID

import httpx

COURSERA = "https://api.coursera.com"
GRAPH = "https://graph.microsoft.com"
BUSINESSES = "/ent/api/businesses.v1"


class ProviderError(RuntimeError):
    pass


class ManualAction(ProviderError):
    pass


class LearningProvider(Protocol):
    def programs(self) -> dict: ...
    def members(self, program: str) -> dict: ...
    def invitations(self, program: str) -> dict: ...
    def membership(self, program: str, member: str) -> dict: ...
    def enrollment(self, program: str, enrollment: str) -> dict: ...
    def progress(self) -> dict: ...
    def certificate_evidence(self) -> list: ...
    def invite(self, program: str, external_id: str, email: str) -> dict: ...
    def remove(self, program: str, member: str) -> None: ...
    def capacity_confirmed(self, operation: str) -> bool: ...


class MockCourseraProvider:
    def programs(self):
        return {"elements": [{"id": "demo", "name": "Microcredenciales"}]}

    def members(self, program):
        return {"elements": []}

    def invitations(self, program):
        return {"elements": []}

    def membership(self, program, member):
        return {"id": member, "program": program, "state": "ACTIVE"}

    def enrollment(self, program, enrollment):
        return {"id": enrollment, "program": program, "state": "ENROLLED"}

    def progress(self):
        return {"elements": []}

    def certificate_evidence(self):
        return []

    def invite(self, program, external_id, email):
        return {"id": external_id, "program": program, "email": email, "state": "PENDING"}

    def remove(self, program, member):
        return None

    def capacity_confirmed(self, operation):
        return True


@dataclass(frozen=True)
class RealAccess:
    enabled: bool = False
    contract_reference: str = ""
    administrator_activated: bool = False

    def require(self):
        if not (self.enabled and self.contract_reference.strip() and self.administrator_activated):
            raise ProviderError("Integración real deshabilitada")


def request(client, method, url, **kwargs):
    try:
        response = client.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json() if response.content else {}
    except httpx.HTTPStatusError as exc:
        raise ProviderError(f"El proveedor respondió HTTP {exc.response.status_code}") from None
    except (httpx.RequestError, ValueError):
        raise ProviderError("Respuesta de integración no disponible o inválida") from None


class CourseraAPIProvider:
    def __init__(self, client: httpx.Client, organization: str, key: str, secret: str, access: RealAccess):
        self.client = client
        self.base = f"{COURSERA}{BUSINESSES}/{quote(organization, safe='')}"
        self.credentials = (key, secret)
        self.access = access

    def _get(self, path):
        self.access.require()
        if not all(self.credentials):
            raise ProviderError("Faltan credenciales autorizadas de Coursera")
        token = request(self.client, "POST", COURSERA + "/oauth2/client_credentials/token",
                        auth=self.credentials, data={"grant_type": "client_credentials"}).get("access_token")
        if not token:
            raise ProviderError("El proveedor no entregó un token")
        return request(self.client, "GET", self.base + path, headers={"Authorization": f"Bearer {token}"})

    def programs(self):
        return self._get("/programs")

    def members(self, program):
        return self._get(f"/programs/{quote(program, safe='')}/memberships")

    def invitations(self, program):
        return self._get(f"/programs/{quote(program, safe='')}/invitations")

    def membership(self, program, member):
        return self._get(f"/programs/{quote(program, safe='')}/memberships/{quote(member, safe='')}")

    def enrollment(self, program, enrollment):
        return self._get(f"/programs/{quote(program, safe='')}/programEnrollments/{quote(enrollment, safe='')}")

    def progress(self):
        return self._get("/enrollmentReports")

    def certificate_evidence(self):
        return [row for row in self.progress().get("elements", []) if row.get("contentCertificateUrl")]

    def invite(self, program, external_id, email):
        raise ManualAction("Invitación documentada. Activación de escritura pendiente de piloto autorizado.")

    def remove(self, program, member):
        raise ManualAction("Eliminación documentada. Requiere aprobación y reconciliación institucional.")

    def capacity_confirmed(self, operation):
        raise ManualAction("Confirme capacidad efectiva con evidencia contractual del proveedor.")


@dataclass(frozen=True)
class Identity:
    id: str
    name: str
    email: str
    upn: str
    enabled: bool | None


class IdentityManager:
    def __init__(self, client: httpx.Client, tenant: UUID, client_id: str, secret: str,
                 groups: set[UUID], domains: set[str], access: RealAccess):
        self.client = client
        self.tenant = tenant
        self.client_id = client_id
        self.secret = secret
        self.groups = groups
        self.domains = {d.lower() for d in domains}
        self.access = access

    def token(self):
        self.access.require()
        if not self.client_id or not self.secret:
            raise ProviderError("Faltan credenciales autorizadas de Microsoft Graph")
        result = request(self.client, "POST", f"https://login.microsoftonline.com/{self.tenant}/oauth2/v2.0/token",
                         data={"client_id": self.client_id, "client_secret": self.secret,
                               "scope": GRAPH + "/.default", "grant_type": "client_credentials"})
        if not result.get("access_token"):
            raise ProviderError("Microsoft Graph no entregó un token")
        return result["access_token"]

    def synchronize(self, group: UUID):
        self.access.require()
        if group not in self.groups:
            raise ProviderError("Grupo fuera de la lista autorizada")
        headers = {"Authorization": "Bearer " + self.token(), "ConsistencyLevel": "eventual"}
        path = f"/v1.0/groups/{group}/members/microsoft.graph.user"
        url = GRAPH + path + "?$select=id,displayName,mail,userPrincipalName,accountEnabled&$count=true"
        result = {}
        emails = set()
        seen = set()
        while url:
            parsed = urlparse(url)
            if parsed.scheme != "https" or parsed.netloc != "graph.microsoft.com" or parsed.path != path or url in seen:
                raise ProviderError("Paginación inesperada de Microsoft Graph")
            seen.add(url)
            body = request(self.client, "GET", url, headers=headers)
            for user in body.get("value", []):
                upn = user.get("userPrincipalName") or ""
                email = (user.get("mail") or upn).lower()
                object_id = user.get("id")
                if not object_id or object_id in result or email in emails or email.rpartition("@")[2] not in self.domains:
                    continue
                enabled = user.get("accountEnabled")
                result[object_id] = Identity(object_id, user.get("displayName") or "", email, upn,
                                             enabled if isinstance(enabled, bool) else None)
                emails.add(email)
            url = body.get("@odata.nextLink")
        return list(result.values())

    def send_mail(self, sender: UUID, recipient: str, subject: str, body: str):
        """Use a separately consented app and a mailbox scoped in Exchange."""
        headers = {"Authorization": "Bearer " + self.token()}
        return request(self.client, "POST", f"{GRAPH}/v1.0/users/{sender}/sendMail", headers=headers,
                       json={"message": {"subject": subject, "body": {"contentType": "Text", "content": body},
                                         "toRecipients": [{"emailAddress": {"address": recipient}}]}})
