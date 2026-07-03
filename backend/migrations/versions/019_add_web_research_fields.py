"""add web research fields to projects

Revision ID: 019_web_research
Revises: 018_add_project_title
Create Date: 2026-06-18

Adds opt-in web-research columns to projects (see
docs/PRD-web-research-clarify-outline.md).
"""
from alembic import op
import sqlalchemy as sa


revision = '019_web_research'
down_revision = '018_add_project_title'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('projects', sa.Column('enable_web_research', sa.Boolean(), nullable=True, server_default=sa.false()))
    op.add_column('projects', sa.Column('research_context', sa.Text(), nullable=True))
    op.add_column('projects', sa.Column('research_sources', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('projects') as batch_op:
        batch_op.drop_column('research_sources')
        batch_op.drop_column('research_context')
        batch_op.drop_column('enable_web_research')
