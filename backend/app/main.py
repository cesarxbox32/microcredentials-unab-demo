from contextlib import asynccontextmanager
from os import getenv
from secrets import compare_digest
from typing import Annotated, Literal
from uuid import uuid4

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select

from .database import Base, License, Operation, Policy, Student, database, seed
from .providers import MockCourseraProvider
from .rotation import Conflict, LicenseRotationEngine

Role = Literal["admin", "operator", "auditor"]
bearer = HTTPBearer(auto_error=False)


class Command(BaseModel):
    action: Literal["rotate", "accept", "certify"]
    student_id: int | None = Field(default=None, gt=0)
    approve: bool = False
    dry_run: bool = True

    @model_validator(mode="after")
    def check_action(self):
        if (self.action == "rotate") != (self.student_id is None):
            raise ValueError("student_id es obligatorio solamente para accept y certify")
        return self


class PolicyInput(BaseModel):
    max_transfers: int = Field(ge=0, le=5000)
    percent: int = Field(ge=0, le=5000)
    strategy: Literal["fifo", "cohort"]
    supervised: bool = True


def create_app(url=None, provider=None, scheduler_minutes=None):
    engine, sessions = database(url or getenv("DATABASE_URL", "sqlite:///microcred.db"))
    rotation = LicenseRotationEngine(sessions, provider or MockCourseraProvider())
    configured = {role: getenv(f"MICROCRED_{role.upper()}_TOKEN", "") for role in ("admin", "operator", "auditor")}

    def role(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> Role:
        if credentials:
            matched = [r for r, secret in configured.items() if secret and compare_digest(secret, credentials.credentials)]
            if len(matched) == 1:
                return matched[0]
        raise HTTPException(401, "Token de laboratorio requerido", headers={"WWW-Authenticate": "Bearer"})

    @asynccontextmanager
    async def lifespan(_):
        Base.metadata.create_all(engine)
        with sessions.begin() as db:
            seed(db)
        minutes = scheduler_minutes if scheduler_minutes is not None else int(getenv("SCHEDULER_MINUTES", "0"))
        scheduler = BackgroundScheduler(timezone="America/Santiago")

        def scheduled():
            try:
                rotation.run("scheduler-" + uuid4().hex, "rotate", "scheduler")
            except Conflict:
                # Supervised policy requires approval.
                return

        if minutes > 0:
            scheduler.add_job(scheduled, "interval", minutes=minutes, max_instances=1, coalesce=True)
            scheduler.start()
        try:
            yield
        finally:
            if scheduler.running:
                scheduler.shutdown()
            engine.dispose()

    app = FastAPI(title="MicroCred Manager", version="0.1.0", lifespan=lifespan)

    @app.get("/health")
    def health():
        return {"status": "ok", "provider": "simulado", "real_writes": False}

    @app.get("/v1/summary")
    def summary(_: Role = Depends(role)):
        with sessions() as db:
            policy = db.get(Policy, 1)
            return {"capacity": policy.capacity, "transfers": policy.transfers,
                    "assigned": db.scalar(select(func.count()).select_from(License).where(License.student_id.is_not(None))),
                    "waiting": db.scalar(select(func.count()).select_from(Student).where(Student.state == "En lista de espera"))}

    @app.get("/v1/students")
    def students(_: Role = Depends(role), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
        with sessions() as db:
            rows = db.scalars(select(Student).order_by(Student.id).offset(offset).limit(limit))
            return [{"id": p.id, "name": p.name, "email": p.email, "cohort": p.cohort, "state": p.state,
                     "membership": p.membership, "certified": p.certified} for p in rows]

    @app.get("/v1/licenses")
    def licenses(_: Role = Depends(role), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
        with sessions() as db:
            rows = db.scalars(select(License).order_by(License.id).offset(offset).limit(limit))
            return [{"id": l.id, "student": l.student_id, "state": l.state, "uses": l.uses} for l in rows]

    @app.get("/v1/audit")
    def audit(_: Role = Depends(role), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200)):
        with sessions() as db:
            rows = db.scalars(select(Operation).order_by(Operation.at.desc(), Operation.id).offset(offset).limit(limit))
            return [{"id": row.id, "at": row.at, "actor": row.actor, **row.result} for row in rows]

    @app.put("/v1/policy")
    def set_policy(body: PolicyInput, actor: Role = Depends(role)):
        if actor != "admin":
            raise HTTPException(403, "Administrador requerido")
        from sqlalchemy import update
        with sessions.begin() as db:
            db.execute(update(Policy).where(Policy.id == 1).values(version=Policy.version + 1))
            policy = db.get(Policy, 1)
            prior = {key: getattr(policy, key) for key in body.model_fields_set | {"supervised"}}
            values = body.model_dump()
            for key, value in values.items():
                setattr(policy, key, value)
            db.add(Operation(id=uuid4().hex, command="policy", actor=actor,
                             result={"before": prior, "after": values}))
        return values

    @app.post("/v1/operations")
    def run(body: Command, key: Annotated[str, Header(alias="Idempotency-Key", min_length=8, max_length=100)],
            actor: Role = Depends(role)):
        if actor == "auditor" or (body.approve and actor != "admin"):
            raise HTTPException(403, "Operación no permitida para el rol")
        try:
            return rotation.run(key, body.action, actor, body.student_id, body.approve, body.dry_run)
        except Conflict as exc:
            raise HTTPException(409, str(exc)) from exc

    return app


app = create_app()
