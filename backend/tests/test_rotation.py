from concurrent.futures import ThreadPoolExecutor
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient

from app.database import Base, License, database, seed
from app.main import create_app
from app.providers import CourseraAPIProvider, IdentityManager, MockCourseraProvider, ProviderError, RealAccess
from app.rotation import Conflict, LicenseRotationEngine


@pytest.fixture
def factory(tmp_path):
    engine, factory = database(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    with factory.begin() as db:
        seed(db, capacity=2, count=5)
    yield factory
    engine.dispose()


def test_reservation_idempotency_and_concurrency(factory):
    engine = LicenseRotationEngine(factory, MockCourseraProvider())
    with ThreadPoolExecutor(2) as workers:
        results = list(workers.map(lambda _: engine.run("same-key", "rotate", "admin", approved=True), range(2)))
    assert results[0] == results[1]
    assert len(results[0]["changes"]) == 2
    with pytest.raises(Conflict):
        engine.run("same-key", "rotate", "operator", approved=True)
    with pytest.raises(Conflict):
        engine.run("premature", "certify", "operator", 1)
    engine.run("accept-one", "accept", "operator", 1)
    assert not engine.run("no-release", "rotate", "admin", approved=True)["changes"]
    engine.run("certify-one", "certify", "operator", 1)
    preview = engine.run("preview-1", "rotate", "admin", approved=True, dry_run=True)
    assert preview["transfers"] == 1
    with factory() as db:
        assert db.get(License, 1).student_id == 1
    done = engine.run("apply-one", "rotate", "admin", approved=True)
    assert done["transfers"] == 1
    with factory() as db:
        assert db.get(License, 1).student_id == 3


def test_reconciliation_failure_can_retry_without_second_removal(factory):
    class Uncertain(MockCourseraProvider):
        removals = 0
        ready = False

        def remove(self, *_):
            self.removals += 1

        def capacity_confirmed(self, _):
            if not self.ready:
                raise ProviderError("HTTP 503")
            return True

    provider = Uncertain()
    engine = LicenseRotationEngine(factory, provider)
    engine.run("initial", "rotate", "admin", approved=True)
    engine.run("accepted", "accept", "operator", 1)
    engine.run("certified", "certify", "operator", 1)
    assert engine.run("failed", "rotate", "admin", approved=True)["changes"][0]["result"] == "error"
    with factory() as db:
        assert db.get(License, 1).state == "Pendiente de reconciliación"
    provider.ready = True
    assert engine.run("retry", "rotate", "admin", approved=True)["transfers"] == 1
    assert provider.removals == 1


def test_http_role_guards_and_initial_scenario(tmp_path, monkeypatch):
    monkeypatch.setenv("MICROCRED_ADMIN_TOKEN", "test-admin")
    monkeypatch.setenv("MICROCRED_AUDITOR_TOKEN", "test-auditor")
    url = f"sqlite:///{tmp_path / 'api.db'}"
    admin = {"Authorization": "Bearer test-admin", "Idempotency-Key": "scenario-1"}
    auditor = {"Authorization": "Bearer test-auditor", "Idempotency-Key": "scenario-2"}
    with TestClient(create_app(url, scheduler_minutes=0)) as client:
        assert client.get("/health").json()["real_writes"] is False
        assert client.get("/v1/students").status_code == 401
        assert client.post("/v1/operations", headers=auditor, json={"action": "rotate"}).status_code == 403
        assert client.post("/v1/operations", headers=admin, json={"action": "rotate", "approve": True, "dry_run": False}).status_code == 200
        assert client.get("/v1/summary", headers=auditor).json() == {"capacity": 200, "assigned": 200, "waiting": 300, "transfers": 0}
    with TestClient(create_app(url, scheduler_minutes=0)) as reopened:
        assert reopened.get("/v1/summary", headers=auditor).json()["assigned"] == 200


def test_coursera_disabled_then_http_failure():
    seen = []
    def handler(req):
        seen.append(str(req.url))
        return httpx.Response(503)

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        off = CourseraAPIProvider(http, "org", "key", "secret", RealAccess())
        with pytest.raises(ProviderError, match="deshabilitada"):
            off.programs()
        assert not seen
        on = CourseraAPIProvider(http, "org", "key", "secret", RealAccess(True, "test-contract", True))
        with pytest.raises(ProviderError, match="503"):
            on.programs()
        assert seen == ["https://api.coursera.com/oauth2/client_credentials/token"]


def test_graph_group_scope_and_deduplication():
    group = UUID(int=1)
    def handler(req):
        if req.method == "POST":
            return httpx.Response(200, json={"access_token": "mock"})
        assert f"/groups/{group}/members/" in req.url.path
        return httpx.Response(200, json={"value": [
            {"id": "one", "mail": "one@unab.example", "accountEnabled": False},
            {"id": "duplicate", "mail": "ONE@unab.example"},
            {"id": "outside", "mail": "two@external.example"},
        ]})

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        graph = IdentityManager(http, UUID(int=2), "id", "secret", {group}, {"unab.example"}, RealAccess(True, "test", True))
        with pytest.raises(ProviderError, match="lista autorizada"):
            graph.synchronize(UUID(int=3))
        result = graph.synchronize(group)
        assert [(user.id, user.enabled) for user in result] == [("one", False)]
