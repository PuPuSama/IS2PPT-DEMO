"""API tests for the page SVG get/save endpoint (in-frontend SVG editing)."""
import os

import pytest

_VALID_SVG = (
    '<svg viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">'
    '<rect x="0" y="0" width="1280" height="720" fill="#0f2027"/>'
    '<text x="100" y="360" font-family="Noto Sans CJK SC" font-size="80" '
    'fill="#ffffff">原始标题</text>'
    '</svg>'
)


def _make_svg_page(app, project_id):
    """Create a page with a real .svg file under the app's upload folder."""
    from models import db, Page
    with app.app_context():
        page = Page(project_id=project_id, order_index=0, part='封面')
        db.session.add(page)
        db.session.commit()
        rel = f"{project_id}/pages/{page.id}_v1.svg"
        abs_path = os.path.join(app.config['UPLOAD_FOLDER'], rel)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, 'w', encoding='utf-8') as f:
            f.write(_VALID_SVG)
        page.generated_svg_path = rel
        db.session.commit()
        return page.id


@pytest.mark.unit
def test_get_svg_returns_source(client, app, sample_project):
    pid = sample_project['project_id']
    page_id = _make_svg_page(app, pid)
    r = client.get(f'/api/projects/{pid}/pages/{page_id}/svg')
    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] is True
    assert '原始标题' in body['data']['svg']


@pytest.mark.unit
def test_put_svg_saves_and_rerenders(client, app, sample_project):
    pid = sample_project['project_id']
    page_id = _make_svg_page(app, pid)
    edited = _VALID_SVG.replace('原始标题', '编辑后的标题')

    r = client.put(f'/api/projects/{pid}/pages/{page_id}/svg', json={'svg': edited})
    assert r.status_code == 200
    data = r.get_json()['data']
    # a fresh PNG version was rendered + the page now exposes both urls
    assert data.get('generated_image_url')
    assert data.get('generated_svg_url')

    # persisted: re-GET shows the edit
    r2 = client.get(f'/api/projects/{pid}/pages/{page_id}/svg')
    assert '编辑后的标题' in r2.get_json()['data']['svg']


@pytest.mark.unit
def test_put_invalid_viewbox_rejected(client, app, sample_project):
    pid = sample_project['project_id']
    page_id = _make_svg_page(app, pid)
    bad = '<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"><text>x</text></svg>'
    r = client.put(f'/api/projects/{pid}/pages/{page_id}/svg', json={'svg': bad})
    assert r.status_code == 400


@pytest.mark.unit
def test_put_missing_svg_rejected(client, app, sample_project):
    pid = sample_project['project_id']
    page_id = _make_svg_page(app, pid)
    r = client.put(f'/api/projects/{pid}/pages/{page_id}/svg', json={})
    assert r.status_code == 400


@pytest.mark.unit
def test_get_svg_404_when_not_svg_mode(client, app, sample_project):
    pid = sample_project['project_id']
    from models import db, Page
    with app.app_context():
        page = Page(project_id=pid, order_index=0, part='x')
        db.session.add(page)
        db.session.commit()
        page_id = page.id
    r = client.get(f'/api/projects/{pid}/pages/{page_id}/svg')
    assert r.status_code == 404
