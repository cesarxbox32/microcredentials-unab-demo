from datetime import datetime, timezone
from sqlalchemy import JSON, DateTime, ForeignKey, String, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


class Base(DeclarativeBase):
    pass


class Policy(Base):
    __tablename__ = "policy"
    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[int] = mapped_column(default=0)
    capacity: Mapped[int]
    max_transfers: Mapped[int]
    percent: Mapped[int]
    transfers: Mapped[int] = mapped_column(default=0)
    strategy: Mapped[str] = mapped_column(String(12), default="fifo")
    supervised: Mapped[bool] = mapped_column(default=True)


class Student(Base):
    __tablename__ = "student"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(150))
    cohort: Mapped[int]
    state: Mapped[str] = mapped_column(String(40), default="En lista de espera")
    membership: Mapped[str] = mapped_column(String(40), default="Sin membresía")
    certified: Mapped[bool] = mapped_column(default=False)
    eligible: Mapped[bool] = mapped_column(default=True)


class License(Base):
    __tablename__ = "license"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int | None] = mapped_column(ForeignKey("student.id"), unique=True)
    state: Mapped[str] = mapped_column(String(40), default="Disponible")
    uses: Mapped[int] = mapped_column(default=0)


class Operation(Base):
    __tablename__ = "operation"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    command: Mapped[str] = mapped_column(String(30))
    actor: Mapped[str] = mapped_column(String(40))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    result: Mapped[dict] = mapped_column(JSON)


def database(url):
    engine = create_engine(url)
    if engine.dialect.name == "sqlite":
        @event.listens_for(engine, "connect")
        def configure_sqlite(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
            connection.execute("PRAGMA busy_timeout=5000")
    return engine, sessionmaker(engine, expire_on_commit=False)


def seed(session, capacity=200, count=500):
    if session.get(Policy, 1):
        return
    session.add(Policy(id=1, capacity=capacity, max_transfers=300, percent=150))
    session.add_all(Student(id=i, name=f"Estudiante {i:03d}", email=f"estudiante{i:03d}@unab.example",
                            cohort=(i-1)//capacity+1) for i in range(1, count+1))
    session.add_all(License(id=i) for i in range(1, capacity+1))
