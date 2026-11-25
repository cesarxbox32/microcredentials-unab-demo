from sqlalchemy import select, update

from .database import License, Operation, Policy, Student
from .providers import LearningProvider, ProviderError


class Conflict(RuntimeError):
    pass


class LicenseRotationEngine:
    def __init__(self, sessions, provider: LearningProvider):
        self.sessions = sessions
        self.provider = provider

    def run(self, key, command, actor, student_id=None, approved=False, dry_run=False):
        with self.sessions() as db:
            # A write to the policy row serializes mutating operations in both database engines.
            db.execute(update(Policy).where(Policy.id == 1).values(version=Policy.version + 1))
            previous = db.get(Operation, key)
            inputs = {"command": command, "student": student_id, "approved": approved, "actor": actor}
            if previous:
                if previous.result.get("inputs") != inputs or dry_run:
                    raise Conflict("La clave de idempotencia ya tiene otra solicitud")
                return previous.result
            p = db.get(Policy, 1)
            changes = []
            if command == "rotate":
                if p.supervised and not approved:
                    raise Conflict("Se requiere aprobación del administrador")
                self.rotate(db, p, changes, dry_run)
            else:
                student = db.get(Student, student_id)
                if student is None:
                    raise Conflict("Estudiante desconocido")
                self.transition(db, student, command, changes)
            result = {"inputs": inputs, "changes": changes, "transfers": p.transfers, "dry_run": dry_run}
            if dry_run:
                db.rollback()
            else:
                db.add(Operation(id=key, command=command, actor=actor, result=result))
                db.commit()
            return result

    def transition(self, db, student, command, changes):
        license = db.scalar(select(License).where(License.student_id == student.id))
        before = student.state
        if command == "accept" and license and license.state == "Reservada" and student.membership == "Invitación pendiente":
            student.state, student.membership, license.state = "Activo", "Activa", "Asignada"
        elif command == "certify" and license and license.state == "Asignada" and student.membership == "Activa" and not student.certified:
            student.state, student.certified = "Certificado", True
        else:
            raise Conflict("Transición inválida para el estado actual")
        changes.append({"student": student.id, "license": license.id, "from": before, "to": student.state, "result": "ok"})

    def rotate(self, db, policy, changes, dry_run):
        limit = min(policy.max_transfers, policy.capacity * policy.percent // 100)
        students = list(db.scalars(select(Student).order_by(Student.id)))
        people = {p.id: p for p in students}
        queue = [p for p in students if p.state == "En lista de espera" and p.eligible]
        if policy.strategy == "cohort":
            incomplete = [p.cohort for p in students if not p.certified]
            first = min(incomplete, default=None)
            queue = [p for p in queue if p.cohort == first]
        licenses = list(db.scalars(select(License).order_by(License.id)))
        if not queue:
            return
        for license in licenses:
            if not queue:
                break
            assigned = people.get(license.student_id)
            if assigned and assigned.certified and policy.transfers < limit:
                if policy.strategy == "cohort" and any(p.cohort == assigned.cohort and not p.certified for p in students):
                    continue
                if not dry_run:
                    try:
                        if license.state != "Pendiente de reconciliación":
                            self.provider.remove("demo", str(assigned.id))
                            license.state = "Pendiente de reconciliación"
                        if not self.provider.capacity_confirmed(f"release:{license.id}:{license.uses}"):
                            raise ProviderError("Cupo pendiente de confirmación")
                    except ProviderError as exc:
                        changes.append({"license": license.id, "student": assigned.id, "result": "error", "reason": str(exc)})
                        continue
                license.student_id = None
                assigned.state, assigned.membership = "Finalizado", "Eliminada"
                license.state = "Disponible para reasignación"
                changes.append({"license": license.id, "student": assigned.id, "from": "Certificado", "to": "Finalizado", "result": "ok"})
            if license.state not in {"Disponible", "Disponible para reasignación"}:
                continue
            if license.uses and policy.transfers >= limit:
                continue
            student = queue[0]
            if not dry_run:
                try:
                    self.provider.invite("demo", str(student.id), student.email)
                except ProviderError as exc:
                    changes.append({"license": license.id, "student": student.id, "result": "error", "reason": str(exc)})
                    break
            queue.pop(0)
            license.student_id, license.state = student.id, "Reservada"
            student.state, student.membership = "Invitado", "Invitación pendiente"
            policy.transfers += int(license.uses > 0)
            license.uses += 1
            changes.append({"license": license.id, "student": student.id, "from": "En lista de espera", "to": "Invitado", "result": "ok"})
