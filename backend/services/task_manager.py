"""
Task Manager - handles background tasks using ThreadPoolExecutor
No need for Celery or Redis, uses in-memory task tracking
"""
import logging
import os
import shutil
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from typing import Callable, List, Dict, Any, Optional
from datetime import datetime
from math import gcd
import time
from sqlalchemy import func
from sqlalchemy.exc import OperationalError
from PIL import Image, ImageDraw, ImageFilter
from models import db, Task, Page, Material, PageImageVersion, Settings, Project
from utils import get_filtered_pages
from utils.image_utils import check_image_resolution

logger = logging.getLogger(__name__)


def get_image_prompt_field_names() -> set:
    """读取设置中允许进入文生图 prompt 的额外字段名。"""
    try:
        settings = Settings.get_settings()
        return set(settings.get_image_prompt_extra_fields())
    except Exception as e:
        logger.warning("Failed to retrieve image prompt extra fields; using defaults: %s", e)
        return set(Settings.DEFAULT_IMAGE_PROMPT_FIELDS)


def _append_extra_fields(
    desc_text: Optional[str],
    desc_content: Optional[dict],
    allowed_fields: Optional[set] = None,
) -> str:
    """将 extra_fields 拼接到描述文本末尾，供图片生成 prompt 使用。"""
    safe_desc = (desc_text or "").strip()
    if not desc_content or not isinstance(desc_content, dict):
        return safe_desc
    extra_fields = desc_content.get('extra_fields')
    if not extra_fields or not isinstance(extra_fields, dict):
        return safe_desc
    allowed = allowed_fields if allowed_fields is not None else get_image_prompt_field_names()
    parts = []
    if safe_desc:
        parts.append(safe_desc)
    for name, value in extra_fields.items():
        if value is not None and str(value).strip() != "" and name in allowed:
            parts.append(f"{name}：{value}")
    return '\n'.join(parts)


def _svg_plan_desc(desc_text: Optional[str], desc_content: Optional[dict]) -> str:
    """SVG 设计阶段的输入“施工图”：正文(主旨+要点) + 拼回版面规划字段(类型/版面/层级/占位)。

    描述阶段把规划字段抽成了 extra_fields(正文只留可见文字)，但 SVG 设计仍需这些排版指导，
    所以生成前再拼回来。演讲者备注是配音用、不渲染，不拼回。
    """
    from services.prompts import SVG_LAYOUT_PLAN_FIELDS
    return _append_extra_fields(desc_text, desc_content, set(SVG_LAYOUT_PLAN_FIELDS))
from pathlib import Path
from services.pdf_service import split_pdf_to_pages
from services.svg_render_service import render_svg_to_png, resolution_to_width


class ResourceLimiter:
    """Thread-safe concurrency limiter for a shared external resource."""

    def __init__(self, name: str, capacity: int):
        self.name = name
        self.capacity = max(1, int(capacity))
        self._in_use = 0
        self._condition = threading.Condition()

    def update_capacity(self, capacity: int):
        new_capacity = max(1, int(capacity))
        with self._condition:
            if new_capacity == self.capacity:
                return
            logger.info(f"Updating {self.name} limiter: {self.capacity} -> {new_capacity}")
            self.capacity = new_capacity
            self._condition.notify_all()

    @contextmanager
    def slot(self, label: str, on_acquire: Optional[Callable[[], None]] = None):
        waited = False
        with self._condition:
            while self._in_use >= self.capacity:
                if not waited:
                    waited = True
                    logger.info(
                        f"{self.name} limiter full ({self._in_use}/{self.capacity}), "
                        f"waiting: {label}"
                    )
                self._condition.wait(timeout=0.5)

            self._in_use += 1

        if waited:
            logger.info(f"{self.name} limiter slot acquired: {label}")

        try:
            if on_acquire:
                on_acquire()
            yield
        finally:
            with self._condition:
                self._in_use -= 1
                self._condition.notify()


class TaskManager:
    """Simple task manager using ThreadPoolExecutor"""
    
    def __init__(self, max_workers: int = 4):
        """Initialize task manager"""
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self.active_tasks = {}  # task_id -> Future
        self.lock = threading.Lock()
        self.max_workers = max_workers
    
    def submit_task(self, task_id: str, func: Callable, *args, **kwargs):
        """Submit a background task"""
        with self.lock:
            executor = self.executor

        future = executor.submit(func, task_id, *args, **kwargs)
        
        with self.lock:
            self.active_tasks[task_id] = future
        
        # Add callback to clean up when done and log exceptions
        future.add_done_callback(lambda f: self._task_done_callback(task_id, f))
    
    def _task_done_callback(self, task_id: str, future):
        """Handle task completion and log any exceptions"""
        try:
            # Check if task raised an exception
            exception = future.exception()
            if exception:
                logger.error(f"Task {task_id} failed with exception: {exception}", exc_info=exception)
        except Exception as e:
            logger.error(f"Error in task callback for {task_id}: {e}", exc_info=True)
        finally:
            self._cleanup_task(task_id)
    
    def _cleanup_task(self, task_id: str):
        """Clean up completed task"""
        with self.lock:
            if task_id in self.active_tasks:
                del self.active_tasks[task_id]
    
    def is_task_active(self, task_id: str) -> bool:
        """Check if task is still running"""
        with self.lock:
            return task_id in self.active_tasks
    
    def shutdown(self):
        """Shutdown the executor"""
        self.executor.shutdown(wait=True)

    def update_max_workers(self, max_workers: int):
        """Replace the shared executor so new tasks use a higher/lower ceiling."""
        new_max_workers = max(1, int(max_workers))
        old_executor = None

        with self.lock:
            if new_max_workers == self.max_workers:
                return

            logger.info(f"Updating background task pool size: {self.max_workers} -> {new_max_workers}")
            old_executor = self.executor
            self.executor = ThreadPoolExecutor(max_workers=new_max_workers)
            self.max_workers = new_max_workers

        if old_executor is not None:
            old_executor.shutdown(wait=False, cancel_futures=False)


def _compute_background_worker_target(description_workers: int, image_workers: int) -> int:
    """Keep the shared task pool from becoming the product-level bottleneck."""
    return max(8, int(description_workers) + int(image_workers) + 4)


# Global task manager and resource limiters
task_manager = TaskManager(max_workers=max(8, int(os.getenv('MAX_BACKGROUND_TASK_WORKERS', '16'))))
image_resource_limiter = ResourceLimiter("image", int(os.getenv('MAX_IMAGE_WORKERS', '20')))
text_resource_limiter = ResourceLimiter("text", int(os.getenv('MAX_DESCRIPTION_WORKERS', '20')))


def sync_resource_limits(description_workers: int, image_workers: int):
    """Apply the latest runtime settings to shared concurrency controls."""
    task_manager.update_max_workers(
        _compute_background_worker_target(description_workers, image_workers)
    )
    image_resource_limiter.update_capacity(image_workers)
    text_resource_limiter.update_capacity(description_workers)


def save_image_with_version(image, project_id: str, page_id: str, file_service,
                            page_obj=None, image_format: str = 'PNG') -> tuple[str, int]:
    """
    保存图片并创建历史版本记录的公共函数

    Args:
        image: PIL Image 对象
        project_id: 项目ID
        page_id: 页面ID
        file_service: FileService 实例
        page_obj: Page 对象（可选，如果提供则更新页面状态）
        image_format: 图片格式，默认 PNG

    Returns:
        tuple: (image_path, version_number) - 图片路径和版本号

    这个函数会：
    1. 计算下一个版本号（使用 MAX 查询确保安全）
    2. 标记所有旧版本为非当前版本
    3. 保存图片到最终位置
    4. 生成并保存压缩的缓存图片
    5. 创建新版本记录
    6. 如果提供了 page_obj，更新页面状态和图片路径
    """
    # 使用 MAX 查询确保版本号安全（即使有版本被删除也不会重复）
    max_version = db.session.query(func.max(PageImageVersion.version_number)).filter_by(page_id=page_id).scalar() or 0
    next_version = max_version + 1

    # 批量更新：标记所有旧版本为非当前版本（使用单条 SQL 更高效）
    PageImageVersion.query.filter_by(page_id=page_id).update({'is_current': False})

    # 保存原图到最终位置（使用版本号）
    image_path = file_service.save_generated_image(
        image, project_id, page_id,
        version_number=next_version,
        image_format=image_format
    )

    # 生成并保存压缩的缓存图片（用于前端快速显示）
    cached_image_path = file_service.save_cached_image(
        image, project_id, page_id,
        version_number=next_version,
        quality=85
    )

    # 创建新版本记录
    new_version = PageImageVersion(
        page_id=page_id,
        image_path=image_path,
        version_number=next_version,
        is_current=True
    )
    db.session.add(new_version)

    # 如果提供了 page_obj，更新页面状态和图片路径
    if page_obj:
        page_obj.generated_image_path = image_path
        page_obj.cached_image_path = cached_image_path
        # 清掉可能残留的 SVG 源：新图一旦落盘，旧的 generated_svg_path 即失效。否则
        # （如从 SVG 路线切回生图路线后重新生图）前端预览见 generated_svg_url 仍内联旧
        # SVG、看不到新图。SVG 模式下紧随其后的 save_page_svg 会把它重新设上，无影响。
        page_obj.generated_svg_path = None
        page_obj.status = 'COMPLETED'
        page_obj.updated_at = datetime.utcnow()

    _commit_with_retry()

    logger.debug(f"Page {page_id} image saved as version {next_version}: {image_path}, cached: {cached_image_path}")

    return image_path, next_version


def render_page_svg(ai_service, outline, page_data, desc_text, page_index,
                    has_material_images, extra_requirements, language,
                    has_template, aspect_ratio, resolution, reasoning_effort=None):
    """SVG generation mode: text model -> full-page SVG -> PNG.

    Returns ``(PIL.Image, svg_str)``. The PNG is fed to the unchanged
    ``save_image_with_version`` path so all downstream (thumbnail/PDF/video/frontend)
    stays identical; ``svg_str`` is persisted separately via ``save_page_svg``.

    ``reasoning_effort`` (project-level, frontend-selectable) tunes the /responses
    reasoning depth; None lets generate_svg apply its default.
    """
    svg = ai_service.generate_svg(
        outline=outline, page=page_data, page_desc=desc_text, page_index=page_index,
        has_material_images=has_material_images, extra_requirements=extra_requirements,
        language=language, has_template=has_template, aspect_ratio=aspect_ratio,
        reasoning_effort=reasoning_effort,
    )
    # SVG 是矢量、渲染极廉(~0.3s)，不应被图像模型的分辨率上限(如 OpenAI 仅 1K)拖累，
    # 至少按 2K(2560) 渲染以保证 PNG 清晰。
    render_width = max(resolution_to_width(resolution), 2560)
    image = render_svg_to_png(svg, width=render_width)
    return image, svg


def augment_requirements_with_template_style(ai_service, file_service, project_id,
                                             use_template, extra_requirements):
    """SVG mode only: fold the template image's visual style into the text prompt.

    Image mode passes the template image straight to the (vision) image model, so
    palette/typography carry over. The SVG route is driven by a *text* model that
    never sees the image — so without this it only ever picks up the user's text
    style description, ignoring an image-only template. We run the existing
    multimodal style extractor once and append the result to ``extra_requirements``.

    Returns the (possibly augmented) requirements string; a no-op when there is no
    template image, and never fatal — extraction failure just proceeds without it.
    """
    if not use_template:
        return extra_requirements
    try:
        template_path = file_service.get_template_path(project_id)
        if not template_path:
            return extra_requirements
        # 缓存命中：提取一次约 70s（多模态），存到 project，换/删模板时失效
        proj = Project.query.get(project_id)
        style_desc = (proj.template_style_extracted or "").strip() if proj else ""
        if style_desc:
            logger.info(f"🎨 [SVG] Using cached template style for project {project_id} "
                        f"({len(style_desc)} chars)")
        else:
            style_desc = ai_service.extract_style_description(template_path)
            if not (style_desc and style_desc.strip()):
                return extra_requirements
            style_desc = style_desc.strip()
            logger.info(f"🎨 [SVG] Extracted template style for project {project_id} "
                        f"({len(style_desc)} chars)")
            if proj is not None:
                proj.template_style_extracted = style_desc
                db.session.commit()
        style_block = (
            "\n\n模板图片风格参考（由模板图自动提取，请据此确定配色/字体/设计语言，"
            "仅借鉴风格、禁止照搬模板里的文字）：\n" + style_desc.strip()
        )
        return (extra_requirements or "") + style_block
    except Exception as e:
        logger.warning(f"[SVG] Failed to extract template style, proceeding without it: {e}")
        return extra_requirements


def save_page_svg(svg: str, image_path: str, file_service, page_obj=None) -> str:
    """Write the source SVG next to the saved PNG and record its relative path.

    ``image_path`` is relative to the upload folder (as returned by
    ``save_image_with_version`` / ``file_service.save_generated_image``), so we
    resolve it against ``file_service.upload_folder`` to write, but store the
    relative path on the page (consistent with ``generated_image_path``).
    """
    rel_svg_path = os.path.splitext(image_path)[0] + '.svg'
    abs_svg_path = file_service.upload_folder / rel_svg_path
    abs_svg_path.parent.mkdir(parents=True, exist_ok=True)
    with open(abs_svg_path, 'w', encoding='utf-8') as f:
        f.write(svg)
    if page_obj is not None:
        page_obj.generated_svg_path = rel_svg_path
    return rel_svg_path


def _commit_with_retry(max_retries=5, base_delay=0.5):
    for attempt in range(max_retries):
        try:
            db.session.commit()
            return
        except OperationalError as e:
            if "database is locked" in str(e) and attempt < max_retries - 1:
                db.session.rollback()
                delay = base_delay * (2 ** attempt)
                logger.warning(f"Database locked, retrying commit in {delay:.1f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(delay)
            else:
                raise


SUPPORTED_IMAGE_ASPECT_RATIOS = (
    '1:1',
    '1:4',
    '1:8',
    '2:3',
    '3:2',
    '3:4',
    '4:1',
    '4:3',
    '4:5',
    '5:4',
    '8:1',
    '9:16',
    '16:9',
    '21:9',
)


def _aspect_ratio_from_size(width: int, height: int) -> str:
    """Map arbitrary pixel dimensions to the nearest provider-supported aspect ratio."""
    safe_width = max(1, width)
    safe_height = max(1, height)
    divisor = gcd(safe_width, safe_height)
    normalized = f"{safe_width // divisor}:{safe_height // divisor}"
    if normalized in SUPPORTED_IMAGE_ASPECT_RATIOS:
        return normalized

    source_ratio = safe_width / safe_height
    return min(
        SUPPORTED_IMAGE_ASPECT_RATIOS,
        key=lambda candidate: abs(source_ratio - (int(candidate.split(':')[0]) / int(candidate.split(':')[1]))),
    )


def _normalize_selection_bbox(selection: dict, image_size: tuple[int, int]) -> tuple[int, int, int, int]:
    """Clamp a selection rectangle into source image bounds."""
    width, height = image_size
    x0 = max(0, min(int(selection['x']), width - 1))
    y0 = max(0, min(int(selection['y']), height - 1))
    x1 = max(x0 + 1, min(x0 + int(selection['width']), width))
    y1 = max(y0 + 1, min(y0 + int(selection['height']), height))
    return x0, y0, x1, y1


def _create_marked_reference_image(source_image: Image.Image, bbox: tuple[int, int, int, int]) -> Image.Image:
    """Highlight the selected region so edit models can focus on it reliably."""
    marked = source_image.convert('RGB').copy()
    draw = ImageDraw.Draw(marked, 'RGBA')
    outline_width = max(4, min(source_image.size) // 120)
    draw.rectangle(bbox, fill=(0, 0, 0, 190), outline=(255, 255, 255, 255), width=outline_width)
    return marked


def _blend_region_into_source(
    source_image: Image.Image,
    edited_image: Image.Image,
    bbox: tuple[int, int, int, int],
    feather_radius: int = 12,
) -> Image.Image:
    """Blend only the selected region from the edited result back into the source image."""
    if edited_image.size != source_image.size:
        edited_image = edited_image.resize(source_image.size, Image.Resampling.LANCZOS)

    source_rgb = source_image.convert('RGB')
    edited_rgb = edited_image.convert('RGB')
    mask = Image.new('L', source_rgb.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle(bbox, fill=255)
    if feather_radius > 0:
        mask = mask.filter(ImageFilter.GaussianBlur(radius=feather_radius))
    return Image.composite(edited_rgb, source_rgb, mask)


def _build_region_edit_instruction(prompt: str, operation: str) -> str:
    """Create a focused prompt for region-based edits using a marked reference image."""
    cleaned_prompt = (prompt or '').strip()
    if operation == 'erase_region':
        user_goal = cleaned_prompt or "移除黑色标记区域中的主体内容，并自然补全背景纹理与光影。"
        return (
            "用户会提供两张参考图：一张原图，一张带有黑色实心选区标记的图。\n"
            "请只处理黑色标记区域，将该区域内容移除，并根据周围视觉自然补全。\n"
            "黑色区域之外的构图、文字、光影、色调尽量保持不变。\n"
            f"额外要求：{user_goal}"
        )

    return (
        "用户会提供两张参考图：一张原图，一张带有黑色实心选区标记的图。\n"
        "请重点修改黑色标记区域，严格围绕该区域执行用户指令。\n"
        "未标记区域尽量保持原样，不要无关改动整体构图。\n"
        f"用户编辑要求：{cleaned_prompt}"
    )


def generate_descriptions_task(task_id: str, project_id: str, ai_service,
                               project_context, outline: List[Dict],
                               max_workers: int = 5, app=None,
                               language: str = None,
                               detail_level: str = 'default',
                               generation_mode: str = 'image'):
    """
    Background task for generating page descriptions
    Based on demo.py gen_desc() with parallel processing

    Note: app instance MUST be passed from the request context

    Args:
        task_id: Task ID
        project_id: Project ID
        ai_service: AI service instance
        project_context: ProjectContext object containing all project information
        outline: Complete outline structure
        max_workers: Maximum number of parallel workers
        app: Flask app instance
        language: Output language (zh, en, ja, auto)
        detail_level: Description detail level (concise/default/detailed)
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    # 在整个任务中保持应用上下文
    with app.app_context():
        try:
            # 重要：在后台线程开始时就获取task和设置状态
            task = Task.query.get(task_id)
            if not task:
                logger.error(f"Task {task_id} not found")
                return
            
            task.status = 'PROCESSING'
            db.session.commit()
            logger.info(f"Task {task_id} status updated to PROCESSING")
            
            # Flatten outline to get pages
            pages_data = ai_service.flatten_outline(outline)
            
            # Get all pages for this project
            pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()
            
            if len(pages) != len(pages_data):
                raise ValueError("Page count mismatch")
            
            # Mark all pages as GENERATING_DESCRIPTION before starting
            for page in pages:
                page.status = 'GENERATING_DESCRIPTION'

            # Initialize progress
            task.set_progress({
                "total": len(pages),
                "completed": 0,
                "failed": 0
            })
            db.session.commit()

            # Generate descriptions in parallel
            completed = 0
            failed = 0
            
            def generate_single_desc(page_id, page_outline, page_index):
                """
                Generate description for a single page
                注意：只传递 page_id（字符串），不传递 ORM 对象，避免跨线程会话问题
                """
                # 关键修复：在子线程中也需要应用上下文
                with app.app_context():
                    try:
                        # Get singleton AI service instance
                        from services.ai_service_manager import get_ai_service
                        ai_service = get_ai_service()
                        
                        with text_resource_limiter.slot(
                            f"description project={project_id} page={page_id}"
                        ):
                            desc_result = ai_service.generate_page_description(
                                project_context, outline, page_outline, page_index,
                                language=language,
                                detail_level=detail_level,
                                generation_mode=generation_mode
                            )

                        # generate_page_description returns dict with text + optional extra_fields
                        desc_content = {
                            "text": desc_result['text'],
                            "generated_at": datetime.utcnow().isoformat()
                        }
                        if desc_result.get('extra_fields'):
                            desc_content['extra_fields'] = desc_result['extra_fields']
                        
                        return (page_id, desc_content, None)
                    except Exception as e:
                        import traceback
                        error_detail = traceback.format_exc()
                        logger.error(f"Failed to generate description for page {page_id}: {error_detail}")
                        return (page_id, None, str(e))
            
            # Use ThreadPoolExecutor for parallel generation
            # 关键：提前提取 page.id，不要传递 ORM 对象到子线程
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [
                    executor.submit(generate_single_desc, page.id, page_data, i)
                    for i, (page, page_data) in enumerate(zip(pages, pages_data), 1)
                ]
                
                # Process results as they complete
                for future in as_completed(futures):
                    page_id, desc_content, error = future.result()
                    
                    db.session.expire_all()
                    
                    # Update page in database
                    page = Page.query.get(page_id)
                    if page:
                        if error:
                            page.status = 'FAILED'
                            failed += 1
                        else:
                            page.set_description_content(desc_content)
                            page.status = 'DESCRIPTION_GENERATED'
                            completed += 1
                        
                        db.session.commit()
                    
                    # Update task progress
                    task = Task.query.get(task_id)
                    if task:
                        task.update_progress(completed=completed, failed=failed)
                        db.session.commit()
                        logger.info(f"Description Progress: {completed}/{len(pages)} pages completed")
            
            # Mark task as completed
            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
                db.session.commit()
                logger.info(f"Task {task_id} COMPLETED - {completed} pages generated, {failed} failed")
            
            # Update project status
            from models import Project
            project = Project.query.get(project_id)
            if project and failed == 0:
                project.status = 'DESCRIPTIONS_GENERATED'
                db.session.commit()
                logger.info(f"Project {project_id} status updated to DESCRIPTIONS_GENERATED")
        
        except Exception as e:
            # Mark task as failed
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()


def generate_images_task(task_id: str, project_id: str, ai_service, file_service,
                        outline: List[Dict], use_template: bool = True, 
                        max_workers: int = 8, aspect_ratio: str = "16:9",
                        resolution: str = "2K", app=None,
                        extra_requirements: str = None,
                        language: str = None,
                        page_ids: list = None,
                        image_prompt_field_names: Optional[set] = None):
    """
    Background task for generating page images
    Based on demo.py gen_images_parallel()
    
    Note: app instance MUST be passed from the request context
    
    Args:
        language: Output language (zh, en, ja, auto)
        page_ids: Optional list of page IDs to generate (if not provided, generates all pages)
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    with app.app_context():
        try:
            # Update task status to PROCESSING
            task = Task.query.get(task_id)
            if not task:
                return
            
            task.status = 'PROCESSING'
            db.session.commit()
            
            # Get pages for this project (filtered by page_ids if provided)
            pages = get_filtered_pages(project_id, page_ids)
            all_pages_data = ai_service.flatten_outline(outline)
            image_prompt_field_names = (
                image_prompt_field_names
                if image_prompt_field_names is not None
                else get_image_prompt_field_names()
            )

            # Build mapping from order_index to page_data so filtered pages
            # get matched to the correct outline entry (not just first N)
            pages_data_by_index = {i: pd for i, pd in enumerate(all_pages_data)}

            # 页面生成模式（image / svg）：按项目级（在“生成描述”时选定），整批读一次供子线程闭包复用
            _proj = Project.query.get(project_id)
            generation_mode = ((_proj.generation_mode if _proj else None) or 'image').lower()
            svg_reasoning_effort = (_proj.svg_reasoning_effort if _proj else None)
            logger.info(f"🧭 Generation mode = {generation_mode} (project {project_id}), svg_effort={svg_reasoning_effort or 'default'}")

            # SVG 路线看不到模板图片：整批只提取一次模板风格文字，喂进 SVG prompt
            if generation_mode == 'svg':
                extra_requirements = augment_requirements_with_template_style(
                    ai_service, file_service, project_id, use_template, extra_requirements
                )

            # 注意：不在任务开始时获取模板路径，而是在每个子线程中动态获取
            # 这样可以确保即使用户在上传新模板后立即生成，也能使用最新模板
            
            # Initialize progress
            task.set_progress({
                "total": len(pages),
                "completed": 0,
                "failed": 0
            })
            db.session.commit()
            
            # Generate images in parallel
            completed = 0
            failed = 0
            resolution_mismatched = 0  # Count of resolution mismatches
            
            def generate_single_image(page_id, page_data, page_index):
                """
                Generate image for a single page
                注意：只传递 page_id（字符串），不传递 ORM 对象，避免跨线程会话问题
                """
                # 关键修复：在子线程中也需要应用上下文
                with app.app_context():
                    try:
                        logger.debug(f"Starting image generation for page {page_id}, index {page_index}")
                        # Get page from database in this thread
                        page_obj = Page.query.get(page_id)
                        if not page_obj:
                            raise ValueError(f"Page {page_id} not found")
                        
                        def mark_generating():
                            page_for_update = Page.query.get(page_id)
                            if page_for_update:
                                page_for_update.status = 'GENERATING'
                                db.session.commit()
                                logger.debug(f"Page {page_id} status updated to GENERATING")

                        with image_resource_limiter.slot(
                            f"project={project_id} page={page_id}",
                            on_acquire=mark_generating,
                        ):
                            # Get description content
                            desc_content = page_obj.get_description_content()
                            if not desc_content:
                                raise ValueError("No description content for page")
                            
                            # 获取描述文本（可能是 text 字段或 text_content 数组）
                            desc_text = desc_content.get('text', '')
                            if not desc_text and desc_content.get('text_content'):
                                # 如果 text 字段不存在，尝试从 text_content 数组获取
                                text_content = desc_content.get('text_content', [])
                                if isinstance(text_content, list):
                                    desc_text = '\n'.join(text_content)
                                else:
                                    desc_text = str(text_content)

                            # 图片专用 extra_fields（排版布局/视觉元素/视觉焦点）只喂 image 路线。
                            # SVG 由文本模型自行排版(便当网格)，仅用核心描述，避免位图风布局提示干扰；
                            # desc_text 保持核心内容，image 分支用拼接后的 desc_text_image。
                            desc_text_image = _append_extra_fields(desc_text, desc_content, image_prompt_field_names)

                            logger.debug(f"Got description text for page {page_id}: {desc_text[:100]}...")
                            
                            # 从当前页面的描述内容中提取图片 URL
                            page_additional_ref_images = []
                            has_material_images = False
                            
                            # 从描述文本中提取图片
                            if desc_text:
                                image_urls = ai_service.extract_image_urls_from_markdown(desc_text)
                                if image_urls:
                                    logger.info(f"Found {len(image_urls)} image(s) in page {page_id} description")
                                    page_additional_ref_images = image_urls
                                    has_material_images = True
                            
                            # 在子线程中动态获取模板路径，确保使用最新模板
                            page_ref_image_path = None
                            if use_template:
                                page_ref_image_path = file_service.get_template_path(project_id)
                                # 注意：如果有风格描述，即使没有模板图片也允许生成
                                # 这个检查已经在 controller 层完成，这里不再检查
                            
                            svg_markup = None
                            if generation_mode == 'svg':
                                # SVG 模式：文本模型直出整页 SVG → 渲染成 PNG（喂同一保存路径）
                                logger.info(f"🎨 [SVG] Generating page {page_index}/{len(pages)} as SVG...")
                                svg_plan = _svg_plan_desc(desc_text, desc_content)
                                image, svg_markup = render_page_svg(
                                    ai_service, outline, page_data, svg_plan, page_index,
                                    has_material_images, extra_requirements, language,
                                    use_template, aspect_ratio, resolution,
                                    reasoning_effort=svg_reasoning_effort,
                                )
                            else:
                                # Generate image prompt（位图路线用拼接了图片 extra_fields 的描述）
                                prompt = ai_service.generate_image_prompt(
                                    outline, page_data, desc_text_image, page_index,
                                    has_material_images=has_material_images,
                                    extra_requirements=extra_requirements,
                                    language=language,
                                    has_template=use_template,
                                    aspect_ratio=aspect_ratio
                                )
                                logger.debug(f"Generated image prompt for page {page_id}")

                                # Generate image
                                logger.info(f"🎨 Calling AI service to generate image for page {page_index}/{len(pages)}...")
                                image = ai_service.generate_image(
                                    prompt, page_ref_image_path, aspect_ratio, resolution,
                                    additional_ref_images=page_additional_ref_images if page_additional_ref_images else None
                                )
                        logger.info(f"✅ Image generated successfully for page {page_index}")
                        
                        if not image:
                            raise ValueError("Failed to generate image")
                        
                        # Check resolution for all providers
                        actual_res, is_match = check_image_resolution(image, resolution)
                        if not is_match:
                            logger.warning(f"Resolution mismatch for page {page_index}: requested {resolution}, got {actual_res}")
                        
                        # 优化：直接在子线程中计算版本号并保存到最终位置
                        # 每个页面独立，使用数据库事务保证版本号原子性，避免临时文件
                        image_path, next_version = save_image_with_version(
                            image, project_id, page_id, file_service, page_obj=page_obj
                        )

                        # SVG 模式：把源 SVG 与 PNG 同名落盘并记录到 page
                        if svg_markup:
                            save_page_svg(svg_markup, image_path, file_service, page_obj=page_obj)
                            _commit_with_retry()

                        return (page_id, image_path, None, not is_match)
                        
                    except Exception as e:
                        import traceback
                        error_detail = traceback.format_exc()
                        logger.error(f"Failed to generate image for page {page_id}: {error_detail}")
                        return (page_id, None, str(e), None)
            
            # Use ThreadPoolExecutor for parallel generation
            # 关键：提前提取 page.id，不要传递 ORM 对象到子线程
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [
                    executor.submit(
                        generate_single_image, page.id,
                        pages_data_by_index.get(page.order_index, {}), i
                    )
                    for i, page in enumerate(pages, 1)
                ]
                
                # Process results as they complete
                for future in as_completed(futures):
                    page_id, image_path, error, is_mismatched = future.result()
                    
                    if is_mismatched:
                        resolution_mismatched += 1
                    
                    db.session.expire_all()
                    
                    # Update page in database (主要是为了更新失败状态)
                    page = Page.query.get(page_id)
                    if page:
                        if error:
                            page.status = 'FAILED'
                            failed += 1
                            db.session.commit()
                        else:
                            # 图片已在子线程中保存并创建版本记录，这里只需要更新计数
                            completed += 1
                            # 刷新页面对象以获取最新状态
                            db.session.refresh(page)
                    
                    # Update task progress
                    task = Task.query.get(task_id)
                    if task:
                        progress = task.get_progress()
                        progress['completed'] = completed
                        progress['failed'] = failed
                        # 第一次检测到不匹配时设置警告
                        if resolution_mismatched > 0 and 'warning_message' not in progress:
                            progress['warning_message'] = "图片返回分辨率与设置不符，建议使用gemini格式以避免此问题"
                        task.set_progress(progress)
                        db.session.commit()
                        logger.info(f"Image Progress: {completed}/{len(pages)} pages completed")
            
            # Mark task as completed
            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
                if resolution_mismatched > 0:
                    logger.warning(f"Task {task_id} has {resolution_mismatched} resolution mismatches")
                db.session.commit()
                logger.info(f"Task {task_id} COMPLETED - {completed} images generated, {failed} failed")

            # Update project status
            project = Project.query.get(project_id)
            if project and failed == 0:
                project.status = 'COMPLETED'
                db.session.commit()
                logger.info(f"Project {project_id} status updated to COMPLETED")
        
        except Exception as e:
            # Mark task as failed
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()


def generate_single_page_image_task(task_id: str, project_id: str, page_id: str, 
                                    ai_service, file_service, outline: List[Dict],
                                    use_template: bool = True, aspect_ratio: str = "16:9",
                                    resolution: str = "2K", app=None,
                                    extra_requirements: str = None,
                                    language: str = None,
                                    image_prompt_field_names: Optional[set] = None):
    """
    Background task for generating a single page image
    
    Note: app instance MUST be passed from the request context
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    with app.app_context():
        try:
            # Update task status to PROCESSING
            task = Task.query.get(task_id)
            if not task:
                return
            
            task.status = 'PENDING'
            db.session.commit()
            
            # Get page from database
            page = Page.query.get(page_id)
            if not page or page.project_id != project_id:
                raise ValueError(f"Page {page_id} not found")
            
            # Single-page requests should only flip to GENERATING after they acquire
            # a real image-generation slot.
            page.status = 'QUEUED'
            db.session.commit()
            
            # Get description content
            desc_content = page.get_description_content()
            if not desc_content:
                raise ValueError("No description content for page")
            image_prompt_field_names = (
                image_prompt_field_names
                if image_prompt_field_names is not None
                else get_image_prompt_field_names()
            )
            
            # 获取描述文本（可能是 text 字段或 text_content 数组）
            desc_text = desc_content.get('text', '')
            if not desc_text and desc_content.get('text_content'):
                text_content = desc_content.get('text_content', [])
                if isinstance(text_content, list):
                    desc_text = '\n'.join(text_content)
                else:
                    desc_text = str(text_content)

            # 图片专用 extra_fields 只喂 image 路线；SVG 用核心 desc_text（自行排版）。
            desc_text_image = _append_extra_fields(desc_text, desc_content, image_prompt_field_names)

            # 从描述文本中提取图片 URL
            additional_ref_images = []
            has_material_images = False
            
            if desc_text:
                image_urls = ai_service.extract_image_urls_from_markdown(desc_text)
                if image_urls:
                    logger.info(f"Found {len(image_urls)} image(s) in page {page_id} description")
                    additional_ref_images = image_urls
                    has_material_images = True
            
            # Get template path if use_template
            ref_image_path = None
            if use_template:
                ref_image_path = file_service.get_template_path(project_id)
                # 注意：如果有风格描述，即使没有模板图片也允许生成
                # 这个检查已经在 controller 层完成，这里不再检查
            
            page_data = page.get_outline_content() or {}
            if page.part:
                page_data['part'] = page.part

            # 页面生成模式（image / svg）：按项目级
            _proj = Project.query.get(project_id)
            generation_mode = ((_proj.generation_mode if _proj else None) or 'image').lower()
            svg_reasoning_effort = (_proj.svg_reasoning_effort if _proj else None)
            logger.info(f"🧭 Generation mode = {generation_mode} (single page {page_id}), svg_effort={svg_reasoning_effort or 'default'}")

            # SVG 路线看不到模板图片：先把模板风格提取成文字喂进 SVG prompt
            if generation_mode == 'svg':
                extra_requirements = augment_requirements_with_template_style(
                    ai_service, file_service, project_id, use_template, extra_requirements
                )

            # 仅 image 模式预先构建文生图 prompt（svg 模式由 generate_svg 自建）
            prompt = None
            if generation_mode != 'svg':
                prompt = ai_service.generate_image_prompt(
                    outline, page_data, desc_text_image, page.order_index + 1,
                    has_material_images=has_material_images,
                    extra_requirements=extra_requirements,
                    language=language,
                    has_template=use_template,
                    aspect_ratio=aspect_ratio
                )

            def mark_generating():
                task_obj = Task.query.get(task_id)
                if task_obj:
                    task_obj.status = 'PROCESSING'
                    db.session.commit()
                page_obj = Page.query.get(page_id)
                if page_obj:
                    page_obj.status = 'GENERATING'
                    db.session.commit()
            
            svg_markup = None
            with image_resource_limiter.slot(
                f"project={project_id} page={page_id}",
                on_acquire=mark_generating,
            ):
                if generation_mode == 'svg':
                    logger.info(f"🎨 [SVG] Generating page {page_id} as SVG...")
                    svg_plan = _svg_plan_desc(desc_text, desc_content)
                    image, svg_markup = render_page_svg(
                        ai_service, outline, page_data, svg_plan, page.order_index + 1,
                        has_material_images, extra_requirements, language,
                        use_template, aspect_ratio, resolution,
                        reasoning_effort=svg_reasoning_effort,
                    )
                else:
                    # Generate image
                    logger.info(f"🎨 Generating image for page {page_id}...")
                    image = ai_service.generate_image(
                        prompt, ref_image_path, aspect_ratio, resolution,
                        additional_ref_images=additional_ref_images if additional_ref_images else None
                    )

            if not image:
                raise ValueError("Failed to generate image")

            # 保存图片并创建历史版本记录
            image_path, next_version = save_image_with_version(
                image, project_id, page_id, file_service, page_obj=page
            )

            # SVG 模式：源 SVG 同名落盘并记录
            if svg_markup:
                save_page_svg(svg_markup, image_path, file_service, page_obj=page)
                db.session.commit()
            
            # Mark task as completed
            task.status = 'COMPLETED'
            task.completed_at = datetime.utcnow()
            task.set_progress({
                "total": 1,
                "completed": 1,
                "failed": 0
            })
            db.session.commit()
            
            logger.info(f"✅ Task {task_id} COMPLETED - Page {page_id} image generated")
        
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"Task {task_id} FAILED: {error_detail}")
            
            # Mark task as failed
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()
            
            # Update page status
            page = Page.query.get(page_id)
            if page:
                page.status = 'FAILED'
                db.session.commit()


def edit_page_image_task(task_id: str, project_id: str, page_id: str,
                         edit_instruction: str, ai_service, file_service,
                         aspect_ratio: str = "16:9", resolution: str = "2K",
                         original_description: str = None,
                         additional_ref_images: List[str] = None,
                         temp_dir: str = None, app=None):
    """
    Background task for editing a page image
    
    Note: app instance MUST be passed from the request context
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    with app.app_context():
        try:
            # Update task status to PROCESSING
            task = Task.query.get(task_id)
            if not task:
                return
            
            # Get page from database
            page = Page.query.get(page_id)
            if not page or page.project_id != project_id:
                raise ValueError(f"Page {page_id} not found")
            
            if not page.generated_image_path:
                raise ValueError("Page must have generated image first")
            
            # Get current image path
            current_image_path = file_service.get_absolute_path(page.generated_image_path)
            
            def mark_generating():
                task_obj = Task.query.get(task_id)
                if task_obj:
                    task_obj.status = 'PROCESSING'
                    db.session.commit()
                page_obj = Page.query.get(page_id)
                if page_obj:
                    page_obj.status = 'GENERATING'
                    db.session.commit()

            # Edit image
            logger.info(f"🎨 Editing image for page {page_id}...")
            try:
                with image_resource_limiter.slot(
                    f"edit project={project_id} page={page_id}",
                    on_acquire=mark_generating,
                ):
                    image = ai_service.edit_image(
                        edit_instruction,
                        current_image_path,
                        aspect_ratio,
                        resolution,
                        original_description=original_description,
                        additional_ref_images=additional_ref_images if additional_ref_images else None
                    )
            finally:
                # Clean up temp directory if created
                if temp_dir:
                    import shutil
                    from pathlib import Path
                    temp_path = Path(temp_dir)
                    if temp_path.exists():
                        shutil.rmtree(temp_dir)
            
            if not image:
                raise ValueError("Failed to edit image")
            
            # 保存编辑后的图片并创建历史版本记录
            image_path, next_version = save_image_with_version(
                image, project_id, page_id, file_service, page_obj=page
            )
            
            # Mark task as completed
            task.status = 'COMPLETED'
            task.completed_at = datetime.utcnow()
            task.set_progress({
                "total": 1,
                "completed": 1,
                "failed": 0
            })
            db.session.commit()
            
            logger.info(f"✅ Task {task_id} COMPLETED - Page {page_id} image edited")
        
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"Task {task_id} FAILED: {error_detail}")
            
            # Clean up temp directory on error
            if temp_dir:
                import shutil
                from pathlib import Path
                temp_path = Path(temp_dir)
                if temp_path.exists():
                    shutil.rmtree(temp_dir)
            
            # Mark task as failed
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()
            
            # Update page status
            page = Page.query.get(page_id)
            if page:
                page.status = 'FAILED'
                db.session.commit()


def generate_material_image_task(task_id: str, project_id: str, prompt: str,
                                 ai_service, file_service,
                                 ref_image_path: str = None,
                                 additional_ref_images: List[str] = None,
                                 aspect_ratio: str = "16:9",
                                 resolution: str = "2K",
                                 temp_dir: str = None, app=None):
    """
    Background task for generating a material image
    复用核心的generate_image逻辑，但保存到Material表而不是Page表
    
    Note: app instance MUST be passed from the request context
    project_id can be None for global materials (but Task model requires a project_id,
    so we use a special value 'global' for task tracking)
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")
    
    with app.app_context():
        try:
            # Update task status to PENDING until a real image slot is acquired
            task = Task.query.get(task_id)
            if not task:
                return
            
            task.status = 'PENDING'
            db.session.commit()

            def mark_processing():
                task_obj = Task.query.get(task_id)
                if task_obj:
                    task_obj.status = 'PROCESSING'
                    db.session.commit()
            
            # Generate image (复用核心逻辑)
            logger.info(f"🎨 Generating material image with prompt: {prompt[:100]}...")
            with image_resource_limiter.slot(
                f"material-generate project={project_id} task={task_id}",
                on_acquire=mark_processing,
            ):
                image = ai_service.generate_image(
                    prompt=prompt,
                    ref_image_path=ref_image_path,
                    aspect_ratio=aspect_ratio,
                    resolution=resolution,
                    additional_ref_images=additional_ref_images or None,
                )
            
            if not image:
                raise ValueError("Failed to generate image")
            
            # 处理project_id：如果为'global'或None，转换为None
            actual_project_id = None if (project_id == 'global' or project_id is None) else project_id
            
            # Save generated material image
            relative_path = file_service.save_material_image(image, actual_project_id)
            relative = Path(relative_path)
            filename = relative.name
            
            # Construct frontend-accessible URL
            image_url = file_service.get_file_url(actual_project_id, 'materials', filename)
            
            # Save material info to database
            material = Material(
                project_id=actual_project_id,
                filename=filename,
                relative_path=relative_path,
                url=image_url
            )
            db.session.add(material)
            
            # Mark task as completed
            task.status = 'COMPLETED'
            task.completed_at = datetime.utcnow()
            task.set_progress({
                "total": 1,
                "completed": 1,
                "failed": 0,
                "material_id": material.id,
                "image_url": image_url
            })
            db.session.commit()
            
            logger.info(f"✅ Task {task_id} COMPLETED - Material {material.id} generated")
        
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"Task {task_id} FAILED: {error_detail}")
            
            # Mark task as failed
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()
        
        finally:
            if temp_dir:
                import shutil
                temp_path = Path(temp_dir)
                if temp_path.exists():
                    shutil.rmtree(temp_dir, ignore_errors=True)


def process_material_image_task(
    task_id: str,
    project_id: str,
    operation: str,
    prompt: str,
    ai_service,
    file_service,
    source_image_path: str = None,
    ref_image_path: str = None,
    additional_ref_images: List[str] = None,
    aspect_ratio: str = "16:9",
    resolution: str = "2K",
    selection: Optional[dict] = None,
    apply_mode: str = "overlay_selection",
    temp_dir: str = None,
    app=None,
):
    """Unified material processing task for generate/edit/region-edit workflows."""
    if app is None:
        raise ValueError("Flask app instance must be provided")

    with app.app_context():
        try:
            task = Task.query.get(task_id)
            if not task:
                return

            task.status = 'PENDING'
            db.session.commit()

            refs = list(additional_ref_images or [])
            result_image: Optional[Image.Image] = None
            source_image = None
            source_aspect_ratio = aspect_ratio

            if source_image_path:
                source_image = Image.open(source_image_path).convert('RGB')
                source_aspect_ratio = _aspect_ratio_from_size(*source_image.size)

            def mark_processing():
                task_obj = Task.query.get(task_id)
                if task_obj:
                    task_obj.status = 'PROCESSING'
                    db.session.commit()

            with image_resource_limiter.slot(
                f"material-process operation={operation} project={project_id} task={task_id}",
                on_acquire=mark_processing,
            ):
                if operation == 'generate':
                    result_image = ai_service.generate_image(
                        prompt=prompt,
                        ref_image_path=ref_image_path,
                        aspect_ratio=aspect_ratio,
                        resolution=resolution,
                        additional_ref_images=refs if refs else None,
                    )
                elif operation == 'edit_full':
                    if not source_image_path:
                        raise ValueError("source_image_path is required for edit_full")

                    if ref_image_path:
                        refs.insert(0, ref_image_path)

                    result_image = ai_service.edit_image(
                        prompt=prompt,
                        current_image_path=source_image_path,
                        aspect_ratio=source_aspect_ratio,
                        resolution=resolution,
                        additional_ref_images=refs if refs else None,
                    )
                elif operation in {'region_edit', 'erase_region'}:
                    if not source_image or not source_image_path:
                        raise ValueError("source_image_path is required for region operations")
                    if not selection:
                        raise ValueError("selection is required for region operations")

                    bbox = _normalize_selection_bbox(selection, source_image.size)
                    marked_reference = _create_marked_reference_image(source_image, bbox)
                    if not temp_dir:
                        raise ValueError("区域操作需要 temp_dir")

                    marked_reference_path = str(Path(temp_dir) / f"{task_id}_marked_region.png")
                    marked_reference.save(marked_reference_path)
                    refs.insert(0, marked_reference_path)

                    if ref_image_path:
                        refs.insert(0, ref_image_path)

                    instruction = _build_region_edit_instruction(prompt, operation)
                    generated = ai_service.edit_image(
                        prompt=instruction,
                        current_image_path=source_image_path,
                        aspect_ratio=source_aspect_ratio,
                        resolution=resolution,
                        additional_ref_images=refs if refs else None,
                    )

                    if generated is None:
                        raise ValueError("Failed to process region edit")

                    if generated.size != source_image.size:
                        generated = generated.resize(source_image.size, Image.Resampling.LANCZOS)

                    if operation == 'erase_region' or apply_mode == 'overlay_selection':
                        result_image = _blend_region_into_source(source_image, generated, bbox)
                    else:
                        result_image = generated
                else:
                    raise ValueError(f"Unsupported material operation: {operation}")

            if result_image is None:
                raise ValueError("Failed to generate image")

            actual_project_id = None if (project_id == 'global' or project_id is None) else project_id
            relative_path = file_service.save_material_image(result_image, actual_project_id)
            relative = Path(relative_path)
            filename = relative.name
            image_url = file_service.get_file_url(actual_project_id, 'materials', filename)

            material = Material(
                project_id=actual_project_id,
                filename=filename,
                relative_path=relative_path,
                url=image_url
            )
            db.session.add(material)

            task.status = 'COMPLETED'
            task.completed_at = datetime.utcnow()
            task.set_progress({
                "total": 1,
                "completed": 1,
                "failed": 0,
                "operation": operation,
                "apply_mode": apply_mode if operation == 'region_edit' else None,
                "selection": selection if operation in {'region_edit', 'erase_region'} else None,
                "material_id": material.id,
                "image_url": image_url
            })
            db.session.commit()

            logger.info(f"✅ Task {task_id} COMPLETED - Material {material.id} processed via {operation}")

        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"Task {task_id} FAILED: {error_detail}")

            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()

        finally:
            if source_image is not None:
                try:
                    source_image.close()
                except Exception:
                    pass
            if temp_dir:
                temp_path = Path(temp_dir)
                if temp_path.exists():
                    shutil.rmtree(temp_dir, ignore_errors=True)


def process_ppt_renovation_task(task_id: str, project_id: str, ai_service,
                                file_service, file_parser_service,
                                keep_layout: bool = False,
                                max_workers: int = 5, app=None,
                                language: str = 'zh'):
    """
    Background task for PPT renovation: parse PDF pages → extract content → fill outline + description

    Flow:
    1. Split PDF → per-page PDFs
    2. Parallel: parse each page PDF → markdown via fileparser
    3. Parallel: AI extract {title, points, description} from each markdown
    4. If keep_layout: parallel caption model describe layout → append to description
    5. Update page.outline_content + page.description_content
    6. Concatenate descriptions → project.description_text
    7. project.status = DESCRIPTIONS_GENERATED

    Args:
        task_id: Task ID
        project_id: Project ID
        ai_service: AI service instance
        file_service: FileService instance
        file_parser_service: FileParserService instance
        keep_layout: Whether to preserve original layout via caption model
        max_workers: Maximum parallel workers
        app: Flask app instance
        language: Output language
    """
    if app is None:
        raise ValueError("Flask app instance must be provided")

    with app.app_context():
        try:
            task = Task.query.get(task_id)
            if not task:
                logger.error(f"Task {task_id} not found")
                return

            task.status = 'PROCESSING'
            db.session.commit()

            from models import Project
            project = Project.query.get(project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")

            # Get the PDF path from project
            pdf_path = None
            project_dir = Path(app.config['UPLOAD_FOLDER']) / project_id
            # Look for the uploaded PDF file
            for f in (project_dir / "template").iterdir() if (project_dir / "template").exists() else []:
                if f.suffix.lower() == '.pdf':
                    pdf_path = str(f)
                    break

            if not pdf_path:
                raise ValueError("No PDF file found for renovation project")

            # Step 1: Split PDF into per-page PDFs
            split_dir = str(project_dir / "split_pages")
            page_pdfs = split_pdf_to_pages(pdf_path, split_dir)
            logger.info(f"Split PDF into {len(page_pdfs)} pages")

            # Get existing pages
            pages = Page.query.filter_by(project_id=project_id).order_by(Page.order_index).all()

            # Ensure page count matches
            if len(pages) != len(page_pdfs):
                logger.warning(f"Page count mismatch: {len(pages)} pages vs {len(page_pdfs)} PDFs. Using min.")
            page_count = min(len(pages), len(page_pdfs))
            if page_count == 0:
                raise ValueError("No pages to process")

            task.set_progress({
                "total": page_count,
                "completed": 0,
                "failed": 0,
                "current_step": "parsing"
            })
            db.session.commit()

            # Process each page as an independent pipeline:
            # parse markdown → AI extract content → (optional layout caption) → write to DB
            logger.info("Processing pages (parse → extract → save pipeline)...")
            import threading
            progress_lock = threading.Lock()
            completed = 0
            failed = 0
            extraction_errors = []
            content_results = {}  # index -> {title, points, description}

            def process_single_page(idx, page_pdf_path):
                nonlocal completed, failed
                with app.app_context():
                    try:
                        # Step A: Parse page PDF → markdown
                        filename = os.path.basename(page_pdf_path)
                        _batch_id, md_text, extract_id, error_msg, _failed = file_parser_service.parse_file(page_pdf_path, filename)
                        if error_msg:
                            logger.warning(f"Page {idx} parse warning: {error_msg}")
                        md_text = md_text or ''

                        # Supplement with header/footer from layout.json
                        if extract_id:
                            hf_text = file_parser_service.extract_header_footer_from_layout(extract_id)
                            if hf_text:
                                md_text = hf_text + '\n\n' + md_text

                        if not md_text.strip():
                            content = {'title': f'Page {idx + 1}', 'points': [], 'description': ''}
                            error = 'empty_input'
                        else:
                            # Step B: AI extract structured content
                            with text_resource_limiter.slot(
                                f"renovation-extract project={project_id} page-index={idx}"
                            ):
                                content = ai_service.extract_page_content(md_text, language=language)
                            error = None

                        # Step C: Optional layout caption
                        if keep_layout and not error:
                            try:
                                page_obj = pages[idx] if idx < len(pages) else None
                                if page_obj:
                                    image_path = None
                                    if page_obj.cached_image_path:
                                        image_path = file_service.get_absolute_path(page_obj.cached_image_path)
                                    elif page_obj.generated_image_path:
                                        image_path = file_service.get_absolute_path(page_obj.generated_image_path)
                                    if image_path and Path(image_path).exists():
                                        with text_resource_limiter.slot(
                                            f"layout-caption project={project_id} page-index={idx}"
                                        ):
                                            caption = ai_service.generate_layout_caption(image_path)
                                        if caption:
                                            content['description'] += f"\n\n{caption}"
                            except Exception as e:
                                logger.error(f"Layout caption failed for page {idx}: {e}")

                        # Step D: Write to DB immediately
                        content_results[idx] = content
                        page_obj = Page.query.get(pages[idx].id)
                        if page_obj:
                            title = content.get('title', f'Page {idx + 1}')
                            points = content.get('points', [])
                            description = content.get('description', '')

                            page_obj.set_outline_content({
                                'title': title,
                                'points': points
                            })
                            page_obj.set_description_content({
                                "text": description,
                                "generated_at": datetime.utcnow().isoformat()
                            })
                            page_obj.status = 'DESCRIPTION_GENERATED'
                            db.session.commit()

                        with progress_lock:
                            if error and error != 'empty_input':
                                failed += 1
                                extraction_errors.append(error)
                            else:
                                completed += 1
                            task_obj = Task.query.get(task_id)
                            if task_obj:
                                task_obj.update_progress(completed=completed, failed=failed)
                                db.session.commit()

                        logger.info(f"Page {idx} pipeline done (completed={completed}, failed={failed})")

                    except Exception as e:
                        logger.error(f"Pipeline failed for page {idx}: {e}")
                        with progress_lock:
                            failed += 1
                            extraction_errors.append(str(e))
                            task_obj = Task.query.get(task_id)
                            if task_obj:
                                task_obj.update_progress(completed=completed, failed=failed)
                                db.session.commit()

            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = [
                    executor.submit(process_single_page, i, page_pdfs[i])
                    for i in range(page_count)
                ]
                for future in as_completed(futures):
                    future.result()  # propagate any unexpected exceptions

            logger.info(f"All pages processed: {completed} completed, {failed} failed")

            # Fail-fast: any extraction failure aborts the entire task
            if failed > 0:
                reason = extraction_errors[0] if extraction_errors else "empty page content"
                raise ValueError(f"{failed}/{page_count} 页内容提取失败: {reason}")

            # Update project-level aggregated text
            project = Project.query.get(project_id)
            if project:
                all_outlines = []
                all_descriptions = []
                for i in range(page_count):
                    content = content_results.get(i, {})
                    title = content.get('title', '')
                    points = content.get('points', [])
                    description = content.get('description', '')
                    header = f"第{i + 1}页：{title}"
                    if points:
                        all_outlines.append(f"{header}\n" + "\n".join(f"- {p}" for p in points))
                    else:
                        all_outlines.append(header)
                    all_descriptions.append(f"--- 第{i + 1}页 ---\n{description}")
                project.outline_text = "\n\n".join(all_outlines)
                project.description_text = "\n\n".join(all_descriptions)
                project.status = 'DESCRIPTIONS_GENERATED'
                project.updated_at = datetime.utcnow()

            db.session.commit()

            # Mark task as completed
            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
                task.set_progress({
                    "total": page_count,
                    "completed": completed,
                    "failed": failed,
                    "current_step": "done"
                })
                db.session.commit()

            logger.info(f"Task {task_id} COMPLETED - PPT renovation processed {page_count} pages")

        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"Task {task_id} FAILED: {error_detail}")

            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()

            # Reset project status so user can retry
            project = Project.query.get(project_id)
            if project:
                project.status = 'DRAFT'

            db.session.commit()


def export_svg_editable_pptx_task(
    task_id: str,
    project_id: str,
    filename: str,
    file_service,
    page_ids: list = None,
    mode: str = 'raster',
    app=None,
):
    """Export an editable PPTX directly from a project's stored SVG pages.

    Translates each page's source ``.svg`` into native, click-to-edit PowerPoint
    shapes (text boxes / rectangles / ovals / gradients) with one transparent
    resvg overlay for decorative paths/icons. Fast (no model calls) and lossless.
    """
    logger.info(f"🚀 Task {task_id} started: export_svg_editable_pptx (project={project_id})")

    if app is None:
        raise ValueError("Flask app instance must be provided")

    with app.app_context():
        import os
        from datetime import datetime
        from services.svg_to_pptx_service import SvgToPptxService

        try:
            db.session.expire_all()

            pages = get_filtered_pages(project_id, page_ids)
            if not pages:
                raise ValueError('No pages found for project')

            svg_paths = []
            for page in pages:
                if page.generated_svg_path:
                    abs_path = file_service.get_absolute_path(page.generated_svg_path)
                    if os.path.exists(abs_path):
                        svg_paths.append(abs_path)

            if not svg_paths:
                raise ValueError(
                    'No source SVG found for project. SVG editable export requires '
                    'pages generated in SVG mode.'
                )

            logger.info(f"找到 {len(svg_paths)} 个 SVG 页面")

            task = Task.query.get(task_id)
            task.set_progress({
                "total": 100, "completed": 5, "failed": 0,
                "current_step": f"翻译 {len(svg_paths)} 页 SVG 为可编辑形状...",
                "percent": 5,
                "messages": ["🚀 开始从 SVG 导出可编辑 PPTX..."],
            })
            db.session.commit()

            exports_dir = os.path.join(app.config['UPLOAD_FOLDER'], project_id, 'exports')
            os.makedirs(exports_dir, exist_ok=True)

            if not filename.endswith('.pptx'):
                filename += '.pptx'
            output_path = os.path.join(exports_dir, filename)
            if os.path.exists(output_path):
                base_name = filename.rsplit('.', 1)[0]
                timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
                filename = f"{base_name}_{timestamp}.pptx"
                output_path = os.path.join(exports_dir, filename)

            _, build_stats = SvgToPptxService.build_from_paths(
                svg_paths, output_file=output_path, mode=mode
            )
            logger.info(f"✓ SVG 可编辑 PPTX 已创建: {output_path} ({build_stats})")

            download_path = f"/files/{project_id}/exports/{filename}"
            if build_stats.get('mode') == 'raster':
                detail = (f"{build_stats['slides']} 页（保真模式）："
                          f"{build_stats['text']} 个可编辑文本框，背景与预览一致")
            else:
                detail = (f"{build_stats['slides']} 页："
                          f"{build_stats['text']} 个文本框、{build_stats['shapes']} 个形状、"
                          f"{build_stats['overlays']} 个图标叠层")
            messages = ["🚀 开始从 SVG 导出可编辑 PPTX...", f"✅ 完成：{detail}"]

            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
                task.set_progress({
                    "total": 100, "completed": 100, "failed": 0,
                    "current_step": "✓ 导出完成", "percent": 100,
                    "messages": messages,
                    "download_url": download_path,
                    "filename": filename,
                    "method": "svg_native",
                    "stats": build_stats,
                })
                db.session.commit()
                logger.info(f"✓ 任务 {task_id} 完成 - SVG 原生导出成功")

        except Exception as e:
            import traceback
            logger.error(f"✗ 任务 {task_id} 失败: {traceback.format_exc()}")
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()
