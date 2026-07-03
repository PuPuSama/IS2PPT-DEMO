"""add per-project svg_reasoning_effort

Revision ID: 022_svg_reasoning_effort
Revises: 021_project_gen_mode
Create Date: 2026-06-24

Adds a per-project reasoning effort for SVG generation (frontend-selectable:
low/medium/high/xhigh). NULL = 'high' default. Used only by the SVG /responses
path (services/ai_service.py::generate_svg); image mode ignores it.
"""
from alembic import op
import sqlalchemy as sa


revision = '022_svg_reasoning_effort'
down_revision = '021_project_gen_mode'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('projects', sa.Column('svg_reasoning_effort', sa.String(length=20), nullable=True))


def downgrade():
    with op.batch_alter_table('projects') as batch_op:
        batch_op.drop_column('svg_reasoning_effort')
