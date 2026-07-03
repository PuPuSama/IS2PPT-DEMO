"""add projects.template_style_extracted (cached SVG template style)

Revision ID: 023_template_style_cache
Revises: 022_svg_reasoning_effort
Create Date: 2026-06-26

SVG generation runs on a text model that can't see the template image, so we
extract the template's visual style (palette/typography) into text via the
multimodal caption model. That call is slow (~70s), so we cache the result on
the project and reuse it; it's cleared when the template image is replaced or
removed (see template_controller upload/delete).
"""
from alembic import op
import sqlalchemy as sa


revision = '023_template_style_cache'
down_revision = '022_svg_reasoning_effort'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('projects', sa.Column('template_style_extracted', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('projects') as batch_op:
        batch_op.drop_column('template_style_extracted')
