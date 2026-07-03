"""add per-project generation_mode

Revision ID: 021_project_gen_mode
Revises: 020_svg_generation
Create Date: 2026-06-24

Moves the image/svg choice to a per-project field, chosen at the
"generate descriptions" step (see docs/PRD-svg-slide-generation.md). NULL = image.
Settings.generation_mode (migration 020) is left in place but no longer drives
generation; project.generation_mode is the source of truth.
"""
from alembic import op
import sqlalchemy as sa


revision = '021_project_gen_mode'
down_revision = '020_svg_generation'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('projects', sa.Column('generation_mode', sa.String(length=20), nullable=True))


def downgrade():
    with op.batch_alter_table('projects') as batch_op:
        batch_op.drop_column('generation_mode')
