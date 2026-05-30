from extractor.client import XiaomiMimoClient

def test_api_connection_is_alive():
    client = XiaomiMimoClient()
    response = client.chat("Trả lời: OK")
    assert response is not None
    assert len(response) > 0
