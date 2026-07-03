"""
Project model
"""
import uuid
import json
from datetime import datetime
from . import db


class Project(db.Model):
    """
    Project model - represents a PPT project
    """
    __tablename__ = 'projects'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_title = db.Column(db.String(255), nullable=True)
    idea_prompt = db.Column(db.Text, nullable=True)
    outline_text = db.Column(db.Text, nullable=True)  # 用户输入的大纲文本（用于outline类型）
    description_text = db.Column(db.Text, nullable=True)  # 用户输入的描述文本（用于description类型）
    extra_requirements = db.Column(db.Text, nullable=True)  # 额外要求，应用到每个页面的AI提示词
    outline_requirements = db.Column(db.Text, nullable=True)  # 大纲生成要求
    description_requirements = db.Column(db.Text, nullable=True)  # 页面描述生成要求
    creation_type = db.Column(db.String(20), nullable=False, default='idea')  # idea|outline|descriptions
    template_image_path = db.Column(db.String(500), nullable=True)
    template_style = db.Column(db.Text, nullable=True)  # 风格描述文本（无模板图模式）
    template_style_extracted = db.Column(db.Text, nullable=True)  # SVG 模式：从模板图片自动提取的风格文字（缓存，换/删模板时清空）
    # 导出设置
    export_allow_partial = db.Column(db.Boolean, nullable=True, default=False)  # 是否允许返回半成品（导出出错时继续而非停止）
    image_aspect_ratio = db.Column(db.String(10), nullable=False, server_default='16:9', default='16:9')
    generation_mode = db.Column(db.String(20), nullable=True)  # 页面生成方式: image(位图)/svg(整页矢量); NULL=image，在“生成描述”时选定
    svg_reasoning_effort = db.Column(db.String(20), nullable=True)  # SVG 生成的 reasoning effort: low/medium/high/xhigh; NULL=high(默认)，前端可选
    # 联网调研（增强大纲生成，见 docs/PRD-web-research-clarify-outline.md）
    enable_web_research = db.Column(db.Boolean, nullable=True, default=False, server_default=db.false())  # 是否在生成大纲前联网调研
    research_context = db.Column(db.Text, nullable=True)  # 调研汇总（注入大纲生成的 prompt）
    research_sources = db.Column(db.Text, nullable=True)  # 调研来源 JSON: [{"title","url"}]
    status = db.Column(db.String(50), nullable=False, default='DRAFT')
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    # 使用 'select' 策略支持 eager loading，同时保持灵活性
    pages = db.relationship('Page', back_populates='project', lazy='select', 
                           cascade='all, delete-orphan', order_by='Page.order_index')
    tasks = db.relationship('Task', back_populates='project', lazy='select',
                           cascade='all, delete-orphan')
    materials = db.relationship('Material', back_populates='project', lazy='select',
                           cascade='all, delete-orphan')
    
    def get_research_sources(self):
        """Parse research_sources JSON string into a list."""
        if self.research_sources:
            try:
                return json.loads(self.research_sources)
            except json.JSONDecodeError:
                return []
        return []

    def set_research_sources(self, sources):
        """Store research sources (list of {title,url}) as JSON string."""
        self.research_sources = json.dumps(sources, ensure_ascii=False) if sources else None

    def to_dict(self, include_pages=False):
        """Convert to dictionary"""
        # Format created_at and updated_at with UTC timezone indicator for proper frontend parsing
        created_at_str = None
        if self.created_at:
            created_at_str = self.created_at.isoformat() + 'Z' if not self.created_at.tzinfo else self.created_at.isoformat()
        
        updated_at_str = None
        if self.updated_at:
            updated_at_str = self.updated_at.isoformat() + 'Z' if not self.updated_at.tzinfo else self.updated_at.isoformat()
        
        data = {
            'project_id': self.id,
            'project_title': self.project_title,
            'idea_prompt': self.idea_prompt,
            'outline_text': self.outline_text,
            'description_text': self.description_text,
            'extra_requirements': self.extra_requirements,
            'outline_requirements': self.outline_requirements,
            'description_requirements': self.description_requirements,
            'creation_type': self.creation_type,
            'template_image_url': f'/files/{self.id}/template/{self.template_image_path.split("/")[-1]}' if self.template_image_path else None,
            'template_style': self.template_style,
            'export_allow_partial': self.export_allow_partial or False,
            'image_aspect_ratio': self.image_aspect_ratio,
            'generation_mode': self.generation_mode or 'image',
            'svg_reasoning_effort': self.svg_reasoning_effort or 'high',
            'enable_web_research': bool(self.enable_web_research),
            'research_context': self.research_context,
            'research_sources': self.get_research_sources(),
            'status': self.status,
            'created_at': created_at_str,
            'updated_at': updated_at_str,
        }
        
        if include_pages:
            # pages 现在是列表，不需要 order_by（已在 relationship 中定义）
            data['pages'] = [page.to_dict() for page in self.pages]
        
        return data
    
    def __repr__(self):
        return f'<Project {self.id}: {self.status}>'
