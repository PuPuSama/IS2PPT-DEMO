"""add svg generation-mode fields

Revision ID: 020_svg_generation
Revises: 019_web_research
Create Date: 2026-06-23

Adds the columns for the SVG generation mode (see
docs/PRD-svg-slide-generation.md):
  - pages.generated_svg_path : source SVG path when a page is generated as SVG
  - settings.generation_mode : 'image' (default) | 'svg'
Both nullable / backward-compatible; NULL means the existing image behaviour.
"""
from alembic import op
import sqlalchemy as sa


revision = '020_svg_generation'
down_revision = '019_web_research'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('pages', sa.Column('generated_svg_path', sa.String(length=500), nullable=True))
    op.add_column('settings', sa.Column('generation_mode', sa.String(length=20), nullable=True))


def downgrade():
    with op.batch_alter_table('settings') as batch_op:
        batch_op.drop_column('generation_mode')
    with op.batch_alter_table('pages') as batch_op:
        batch_op.drop_column('generated_svg_path')
