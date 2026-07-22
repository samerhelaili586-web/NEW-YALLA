from datetime import date
import pytest
from app import db
from app.models.task_type import TaskType, Status, Transition
from app.models.project import Project
from app.models.task import Task


def setup_test_workflow(cm_id=1):
    """Helper to construct a test workflow, project, and task."""
    tt = TaskType(name="Video Reel Workflow", workflow_status="active")
    db.session.add(tt)
    db.session.flush()

    s1 = Status(task_type_id=tt.id, title="Début", temporal_type="evolutif", functional_type="debut")
    s2 = Status(task_type_id=tt.id, title="Montage En Cours", temporal_type="evolutif", functional_type="montage")
    s3 = Status(task_type_id=tt.id, title="Final", temporal_type="fige", functional_type="final_confirmation")
    db.session.add_all([s1, s2, s3])
    db.session.flush()

    # Transition 1: s1 -> s2 (restricted to CM role, requires 'note' field)
    t1 = Transition(
        from_status_id=s1.id,
        to_status_id=s2.id,
        allowed_roles=["cm"],
        form_fields=[{"id": "note", "label": "Remarque", "required": True}]
    )
    # Transition 2: s2 -> s3 (restricted to manager role)
    t2 = Transition(
        from_status_id=s2.id,
        to_status_id=s3.id,
        allowed_roles=["manager"],
        form_fields=[]
    )
    db.session.add_all([t1, t2])
    db.session.flush()

    proj = Project(title="Projet Alpha", status="actif", start_date=date.today(), cm_id=cm_id)
    db.session.add(proj)
    db.session.flush()

    task = Task(
        project_id=proj.id,
        task_type_id=tt.id,
        status_id=s1.id,
        title="Reel Promo 1",
        planned_publish_date=date.today(),
    )
    db.session.add(task)
    db.session.commit()
    return task, s1, s2, s3


def test_status_change_success_with_required_fields(client, cm_user, app):
    """Test valid transition with required form fields provided."""
    with app.app_context():
        task, s1, s2, s3 = setup_test_workflow(cm_user.id)
        task_id = task.id
        s2_id = s2.id

    # Login as CM user
    with client.session_transaction() as sess:
        sess["user_id"] = cm_user.id

    res = client.post(f"/api/tasks/{task_id}/change-status", json={
        "status_id": s2_id,
        "form_values": {"note": "Passage en montage validé."}
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["status_id"] == s2_id


def test_status_change_missing_required_field(client, cm_user, app):
    """Test rejection when required transition form field is missing."""
    with app.app_context():
        task, s1, s2, s3 = setup_test_workflow(cm_user.id)
        task_id = task.id
        s2_id = s2.id

    with client.session_transaction() as sess:
        sess["user_id"] = cm_user.id

    res = client.post(f"/api/tasks/{task_id}/change-status", json={
        "status_id": s2_id,
        "form_values": {}  # Missing required 'note' field
    })
    assert res.status_code == 400
    data = res.get_json()
    assert data["error"] == "missing_required_form_fields"


def test_status_change_unauthorized_role(client, cm_user, app):
    """Test rejection when user role is not allowed for the target transition."""
    with app.app_context():
        task, s1, s2, s3 = setup_test_workflow(cm_user.id)
        # Move task directly to s2 first
        task.status_id = s2.id
        db.session.commit()
        task_id = task.id
        s3_id = s3.id

    # CM user tries transition 2 (which requires 'manager' role)
    with client.session_transaction() as sess:
        sess["user_id"] = cm_user.id

    res = client.post(f"/api/tasks/{task_id}/change-status", json={
        "status_id": s3_id
    })
    assert res.status_code == 403
    data = res.get_json()
    assert data["error"] == "role_not_allowed_for_transition"
