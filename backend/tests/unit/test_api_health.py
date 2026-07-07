"""
Health endpoint unit tests.
"""

from app_identity import API_DESCRIPTION, API_NAME, API_VERSION, HEALTH_MESSAGE


class TestHealthEndpoint:
    """Health endpoint tests."""

    def test_health_check_returns_ok(self, client):
        """Health check returns the configured app identity message."""
        response = client.get('/health')

        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'ok'
        assert data['message'] == HEALTH_MESSAGE

    def test_health_check_response_format(self, client):
        """Health check response shape stays stable."""
        response = client.get('/health')

        data = response.get_json()
        assert isinstance(data, dict)
        assert 'status' in data
        assert 'message' in data

    def test_root_endpoint_uses_app_identity(self, client):
        response = client.get('/')

        assert response.status_code == 200
        data = response.get_json()
        assert data['name'] == API_NAME
        assert data['version'] == API_VERSION
        assert data['description'] == API_DESCRIPTION