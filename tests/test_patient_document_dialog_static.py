import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "app/(routes)/patients/[id]/referral-mc-section.tsx"


class PatientDocumentDialogStaticTest(unittest.TestCase):
    def read_source(self) -> str:
        return SOURCE.read_text()

    def test_patient_profile_has_yezza_style_document_selector_dialog(self):
        source = self.read_source()
        for expected in [
            "Create document",
            "MEDICAL CERTIFICATE (MC)",
            "REFERRAL LETTER",
            "Search inventory and services",
            "Existing documents",
        ]:
            self.assertIn(expected, source)

    def test_patient_profile_mc_dialog_has_form_and_live_preview(self):
        source = self.read_source()
        for expected in [
            "Fill out information below to complete document",
            "Document preview",
            "No of days",
            "Complete document",
            "To whom it may concern",
        ]:
            self.assertIn(expected, source)

    def test_patient_profile_referral_dialog_has_editor_smart_fields_and_preview(self):
        source = self.read_source()
        for expected in [
            "Compose content",
            "Insert smart fields",
            "Patient name",
            "Visit date",
            "Referral to:",
        ]:
            self.assertIn(expected, source)


if __name__ == "__main__":
    unittest.main()
