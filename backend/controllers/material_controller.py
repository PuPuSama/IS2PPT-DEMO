"""
Material Controller - handles inline image uploads
"""
from flask import Blueprint, request, current_app
from models import db, Project, Material
from utils import success_response, error_response, not_found, bad_request
from services import FileService


from typing import Optional
import io
import base64
import logging
import re
import struct
import uuid
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

material_bp = Blueprint('materials', __name__, url_prefix='/api/projects')
material_global_bp = Blueprint('materials_global', __name__, url_prefix='/api/materials')

ALLOWED_MATERIAL_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'}
PIL_FORMAT_EXTENSIONS = {
    'PNG': '.png',
    'JPEG': '.jpg',
    'GIF': '.gif',
    'WEBP': '.webp',
    'BMP': '.bmp',
}


def _generate_image_caption(filepath: str) -> str:
    """Generate AI caption for an uploaded image. Returns empty string on failure."""
    if filepath.lower().endswith('.svg'):
        return ""
    try:
        from PIL import Image

        image = Image.open(filepath)
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)

        output_lang = current_app.config.get('OUTPUT_LANGUAGE', 'zh')
        if output_lang == 'en':
            prompt = "Please provide a short description of the main content of this image. Return only the description text without any other explanation."
        else:
            prompt = "请用一句简短的中文描述这张图片的主要内容。只返回描述文字，不要其他解释。"

        provider_format = (current_app.config.get('AI_PROVIDER_FORMAT') or 'gemini').lower()
        caption_source = (current_app.config.get('IMAGE_CAPTION_MODEL_SOURCE') or '').lower()
        caption_model = current_app.config.get('IMAGE_CAPTION_MODEL', 'gemini-3-flash-preview')

        # Determine effective format: per-model source overrides global
        effective_format = caption_source or provider_format

        if effective_format == 'codex':
            from services.ai_providers import _get_openai_oauth_token
            token = _get_openai_oauth_token()
            if not token:
                return ""

            buffered = io.BytesIO()
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
                image = background
            image.save(buffered, format="JPEG", quality=95)
            base64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')

            import requests as http_requests
            resp = http_requests.post(
                'https://chatgpt.com/backend-api/codex/responses',
                headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
                json={
                    'model': caption_model,
                    'instructions': 'You are a helpful assistant that describes images.',
                    'input': [{'role': 'user', 'content': [
                        {'type': 'input_image', 'image_url': f'data:image/jpeg;base64,{base64_image}'},
                        {'type': 'input_text', 'text': prompt},
                    ]}],
                    'store': False,
                    'stream': True,
                },
                timeout=60,
                stream=True,
            )
            resp.raise_for_status()
            collected = []
            for raw_line in resp.iter_lines():
                line = raw_line.decode('utf-8') if isinstance(raw_line, bytes) else raw_line
                if not line or not line.startswith('data: '):
                    continue
                raw = line[6:]
                if raw.strip() == '[DONE]':
                    break
                try:
                    import json as json_mod
                    evt = json_mod.loads(raw)
                    if evt.get('type') == 'response.output_text.delta':
                        collected.append(evt.get('delta', ''))
                except Exception:
                    pass
            return ''.join(collected).strip()

        elif effective_format == 'openai':
            from openai import OpenAI
            api_key = current_app.config.get('OPENAI_API_KEY', '')
            if not api_key:
                return ""
            client = OpenAI(
                api_key=api_key,
                base_url=current_app.config.get('OPENAI_API_BASE') or None
            )

            buffered = io.BytesIO()
            if image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
                image = background
            image.save(buffered, format="JPEG", quality=95)
            base64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')

            response = client.chat.completions.create(
                model=caption_model,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
                        {"type": "text", "text": prompt}
                    ]
                }],
                temperature=0.3
            )
            return response.choices[0].message.content.strip()
        else:
            # Gemini (default)
            from google import genai
            from google.genai import types
            api_key = current_app.config.get('GOOGLE_API_KEY', '')
            if not api_key:
                return ""
            api_base = current_app.config.get('GOOGLE_API_BASE', '')
            client = genai.Client(
                http_options=types.HttpOptions(base_url=api_base) if api_base else None,
                api_key=api_key
            )
            result = client.models.generate_content(
                model=caption_model,
                contents=[image, prompt],
                config=types.GenerateContentConfig(temperature=0.3)
            )
            return result.text.strip()
    except Exception as e:
        logger.warning(f"Failed to generate caption for {filepath}: {e}")
        return ""


def _handle_material_upload(default_project_id: Optional[str] = None):
    """
    Common logic to handle material upload.
    Returns Flask response object.
    """
    try:
        raw_project_id = request.args.get('project_id', default_project_id)
        target_project_id, error = _resolve_target_project_id(raw_project_id)
        if error:
            return error

        file = request.files.get('file')
        material, error = _save_material_file(file, target_project_id)
        if error:
            return error

        result = material.to_dict()

        # Generate AI caption if requested
        generate_caption = request.args.get('generate_caption', '').lower() in ('true', '1', 'yes')
        if generate_caption:
            file_service = FileService(current_app.config['UPLOAD_FOLDER'])
            filepath = file_service.get_absolute_path(material.relative_path)
            caption = _generate_image_caption(filepath)
            material.caption = caption
            db.session.commit()
            result['caption'] = caption

        return success_response(result, status_code=201)

    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)


def _resolve_target_project_id(raw_project_id: Optional[str], allow_none: bool = True):
    """
    Normalize project_id from request.
    Returns (project_id | None, error_response | None)
    """
    if allow_none and (raw_project_id is None or raw_project_id == 'none'):
        return None, None

    if raw_project_id == 'all':
        return None, bad_request("project_id cannot be 'all' when uploading materials")

    if raw_project_id:
        project = Project.query.get(raw_project_id)
        if not project:
            return None, not_found('Project')

    return raw_project_id, None


def _save_material_file(file, target_project_id: Optional[str]):
    """Shared logic for saving uploaded material files to disk and DB."""
    if not file or not file.filename:
        return None, bad_request("file is required")

    original_filename = file.filename
    try:
        file_ext = _detect_material_file_extension(file)
    except ValueError:
        return None, bad_request(f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_MATERIAL_EXTENSIONS))}")

    file_service = FileService(current_app.config['UPLOAD_FOLDER'])
    if target_project_id:
        materials_dir = file_service.upload_folder / file_service._get_materials_dir(target_project_id)
    else:
        materials_dir = file_service.upload_folder / "materials"
    materials_dir.mkdir(exist_ok=True, parents=True)

    unique_filename = f"{uuid.uuid4().hex}{file_ext}"

    filepath = materials_dir / unique_filename
    file.save(str(filepath))

    relative_path = str(filepath.relative_to(file_service.upload_folder))
    if target_project_id:
        image_url = file_service.get_file_url(target_project_id, 'materials', unique_filename)
    else:
        image_url = f"/files/materials/{unique_filename}"

    material = Material(
        project_id=target_project_id,
        filename=unique_filename,
        relative_path=relative_path,
        url=image_url,
        original_filename=original_filename
    )

    try:
        db.session.add(material)
        db.session.commit()
        return material, None
    except Exception:
        db.session.rollback()
        raise


def _detect_material_file_extension(file) -> str:
    """Detect a supported material image type from uploaded content."""
    stream = file.stream
    original_position = stream.tell()
    try:
        with Image.open(stream) as image:
            file_ext = PIL_FORMAT_EXTENSIONS.get(image.format)
            if not file_ext or file_ext not in ALLOWED_MATERIAL_EXTENSIONS:
                raise ValueError("unsupported raster image format")
            image.verify()
            return file_ext
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, IndexError, struct.error):
        stream.seek(original_position)
        if _is_svg_upload(stream) and '.svg' in ALLOWED_MATERIAL_EXTENSIONS:
            return '.svg'
        raise ValueError("unsupported image content")
    finally:
        stream.seek(original_position)


def _is_svg_upload(stream) -> bool:
    """Return True when the upload content is an SVG document."""
    head = stream.read(4096)
    if isinstance(head, str):
        head = head.encode('utf-8')

    if head.startswith(b'\xef\xbb\xbf'):
        head = head[3:]

    clean_head = re.sub(b'<!--.*?-->', b'', head, flags=re.DOTALL)
    clean_head = re.sub(b'<\\?xml.*?\\?>', b'', clean_head, flags=re.DOTALL)
    clean_head = re.sub(b'<!DOCTYPE.*?\\]>\\s*', b'', clean_head, count=1, flags=re.DOTALL | re.IGNORECASE)
    clean_head = re.sub(b'<!DOCTYPE.*?>', b'', clean_head, flags=re.DOTALL | re.IGNORECASE)

    match = re.match(b'\\s*<\\s*([^\\s>/]+)', clean_head)
    if not match:
        return False

    tag = match.group(1).decode('utf-8', errors='ignore')
    return tag.split(':')[-1].lower() == 'svg'


@material_bp.route('/<project_id>/materials/upload', methods=['POST'])
def upload_material(project_id):
    """
    POST /api/projects/{project_id}/materials/upload - Upload a material image
    
    Supports multipart/form-data:
    - file: Image file (required)
    - project_id: Optional query parameter, defaults to path parameter if not provided
    
    Returns:
        Material info with filename, url, and metadata
    """
    return _handle_material_upload(default_project_id=project_id)


@material_global_bp.route('/upload', methods=['POST'])
def upload_material_global():
    """
    POST /api/materials/upload - Upload a material image (global, not bound to a project)
    
    Supports multipart/form-data:
    - file: Image file (required)
    - project_id: Optional query parameter to associate with a project
    
    Returns:
        Material info with filename, url, and metadata
    """
    return _handle_material_upload(default_project_id=None)


@material_global_bp.route('/<material_id>/caption', methods=['GET'])
def get_material_caption(material_id):
    """Get or generate caption for an existing material"""
    material = Material.query.get(material_id)
    if not material:
        return not_found('Material')

    # Return existing caption if available (None=not yet generated, ''=failed)
    if material.caption is not None:
        return success_response({'caption': material.caption})

    # Generate and store caption
    try:
        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        filepath = file_service.get_absolute_path(material.relative_path)
        caption = _generate_image_caption(filepath)
        material.caption = caption
        db.session.commit()
        return success_response({'caption': caption})
    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)


@material_global_bp.route('/by-url', methods=['GET'])
def get_material_by_url():
    """Get material by URL and ensure it has a caption"""
    url = request.args.get('url', '').strip()
    if not url:
        return bad_request('url parameter is required')

    material = Material.query.filter_by(url=url).first()
    if not material:
        return not_found('Material')

    # Ensure caption exists (None=not yet generated, ''=failed)
    try:
        if material.caption is None:
            file_service = FileService(current_app.config['UPLOAD_FOLDER'])
            filepath = file_service.get_absolute_path(material.relative_path)
            material.caption = _generate_image_caption(filepath)
            db.session.commit()
        return success_response(material.to_dict())
    except Exception as e:
        db.session.rollback()
        return error_response('SERVER_ERROR', str(e), 500)
