import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "components/orders/order-composer.tsx"


class OrderComposerDocumentDialogStaticTest(unittest.TestCase):
    def read_source(self) -> str:
        return SOURCE.read_text()

    def test_composer_search_opens_mc_dialog_before_adding_document_line(self):
        source = self.read_source()
        for expected in [
            "pendingDocumentTemplate",
            "MEDICAL CERTIFICATE (MC)",
            "Fill out information below to complete document",
            "Document preview",
            "Complete later",
            "Complete document",
        ]:
            self.assertIn(expected, source)

    def test_composer_search_opens_referral_dialog_before_adding_document_line(self):
        source = self.read_source()
        for expected in [
            "REFERRAL LETTER",
            "Compose content",
            "Insert smart fields",
            "Patient name",
            "Referral to:",
            "handleCompletePendingDocument",
        ]:
            self.assertIn(expected, source)


if __name__ == "__main__":
    unittest.main()
