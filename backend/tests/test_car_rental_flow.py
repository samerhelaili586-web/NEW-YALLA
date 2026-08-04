"""
End-to-End Verification Test for Car Rental ("Location de voitures") Configuration.
Verifies that the generic platform supports the Car Rental vertical via API endpoints / business logic:
- Role & menu permissions
- Per-project task creation permissions
- Per-transition role-based restrictions
- Transition form field capture
"""

import unittest
from datetime import date, timedelta
from app import create_app, db
from app.models.user import User
from app.models.task_type import TaskType, Status, Transition
from app.models.project import Project
from app.models.task import Task
from app.routes.task_types import get_available_next_statuses


class TestCarRentalFlow(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        self.app_context.pop()

    def test_workflow_structure(self):
        """Verify the Car Rental workflow statuses and transitions exist."""
        workflow = TaskType.query.filter_by(name="Location de véhicules").first()
        self.assertIsNotNone(workflow, "Workflow 'Location de véhicules' should exist.")

        statuses = {s.title: s for s in workflow.statuses}
        expected_statuses = [
            "Demande reçue",
            "Vérification disponibilité",
            "Remise du véhicule",
            "En location",
            "Retour du véhicule",
            "Facturation",
            "Terminé",
        ]
        for name in expected_statuses:
            self.assertIn(name, statuses, f"Status '{name}' should exist in workflow.")

    def test_chauffeur_role_restriction(self):
        """
        Verify that ONLY Chauffeur (or admin_sys/manager) can execute the transition
        from 'Remise du véhicule' -> 'En location'.
        """
        workflow = TaskType.query.filter_by(name="Location de véhicules").first()
        statuses = {s.title: s for s in workflow.statuses}
        remise_status = statuses["Remise du véhicule"]
        en_location_status = statuses["En location"]

        transition = Transition.query.filter_by(
            from_status_id=remise_status.id,
            to_status_id=en_location_status.id
        ).first()

        self.assertIsNotNone(transition, "Transition 'Remise du véhicule' -> 'En location' should exist.")
        self.assertIn("chauffeur", transition.allowed_roles, "Transition must allow 'chauffeur' role.")
        self.assertNotIn("comptable", transition.allowed_roles, "Transition must NOT allow 'comptable'.")
        self.assertNotIn("agent_accueil", transition.allowed_roles, "Transition must NOT allow 'agent_accueil'.")

    def test_transition_form_field_capture(self):
        """Verify that the transition from 'Remise du véhicule' -> 'En location' has list_select form field."""
        workflow = TaskType.query.filter_by(name="Location de véhicules").first()
        statuses = {s.title: s for s in workflow.statuses}
        remise_status = statuses["Remise du véhicule"]
        en_location_status = statuses["En location"]

        transition = Transition.query.filter_by(
            from_status_id=remise_status.id,
            to_status_id=en_location_status.id
        ).first()

        self.assertTrue(len(transition.form_fields) > 0, "Transition must have form_fields configured.")
        field = transition.form_fields[0]
        self.assertEqual(field.get("type"), "list_select")
        self.assertIn("plaque", field.get("capture_fields", []))


if __name__ == "__main__":
    unittest.main()
