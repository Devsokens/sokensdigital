"""WeasyPrint dépend de libs natives souvent absentes en dev Windows : le
PDF du devis est simulé dans les tests de l'app (sa génération réelle est
couverte par le conteneur de production)."""
from unittest.mock import patch

import pytest


@pytest.fixture(autouse=True)
def _fake_quote_pdf():
    with patch('marketing.quote_pdf.build_quote_pdf', return_value=b'%PDF-1.7 test') as fake:
        yield fake
