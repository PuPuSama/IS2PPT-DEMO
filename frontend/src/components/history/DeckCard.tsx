import React, { useState, useEffect } from 'react';
import { Clock, FileText, ChevronRight, Trash2 } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { Card } from '@/components/shared';
import { getImageUrl } from '@/api/client';
import {
  getDeckCoverImage,
  getDeckDisplayTitle,
  getDeckProgress,
  type DeckProgress,
} from '@/entities/deck/model/deckSelectors';
import type { Deck } from '@/entities/deck/model/types';
import { formatDate } from '@/utils/projectUtils';

// History card copy stays local until the history feature locale is consolidated.
const deckCardI18n = {
  zh: {
    deckCard: {
      pages: '{{count}} 页',
      page: '第 {{num}} 页',
      untitled: '未命名项目',
      status: {
        'not-started': '未开始',
        'needs-description': '待生成描述',
        'needs-images': '待生成图片',
        complete: '已完成',
      },
    },
  },
  en: {
    deckCard: {
      pages: '{{count}} pages',
      page: 'Page {{num}}',
      untitled: 'Untitled Project',
      status: {
        'not-started': 'Not Started',
        'needs-description': 'Pending Descriptions',
        'needs-images': 'Pending Images',
        complete: 'Completed',
      },
    },
  },
};

const statusClass: Record<DeckProgress, string> = {
  complete: 'text-green-600 bg-green-50',
  'needs-images': 'text-yellow-600 bg-yellow-50',
  'needs-description': 'text-blue-600 bg-blue-50',
  'not-started': 'text-gray-600 bg-gray-50',
};

export interface DeckCardProps {
  deck: Deck;
  isSelected: boolean;
  isEditing: boolean;
  editingTitle: string;
  onSelect: (deck: Deck) => void;
  onToggleSelect: (deckId: string) => void;
  onDelete: (e: React.MouseEvent, deck: Deck) => void;
  onStartEdit: (e: React.MouseEvent, deck: Deck) => void;
  onTitleChange: (title: string) => void;
  onTitleKeyDown: (e: React.KeyboardEvent, deckId: string) => void;
  onSaveEdit: (deckId: string) => void;
  isBatchMode: boolean;
}

export const DeckCard: React.FC<DeckCardProps> = ({
  deck,
  isSelected,
  isEditing,
  editingTitle,
  onSelect,
  onToggleSelect,
  onDelete,
  onStartEdit,
  onTitleChange,
  onTitleKeyDown,
  onSaveEdit,
  isBatchMode,
}) => {
  const t = useT(deckCardI18n);
  // 检测屏幕尺寸，只在非手机端加载图片（必须在早期返回之前声明hooks）
  const [shouldLoadImage, setShouldLoadImage] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      // sm breakpoint is 640px
      setShouldLoadImage(window.innerWidth >= 640);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const title = getDeckDisplayTitle(deck, t('deckCard.untitled'));
  const pageCount = deck.slides.length;
  const progress = getDeckProgress(deck);
  const statusText = t(`deckCard.status.${progress}`);
  const firstPageImage = shouldLoadImage
    ? getImageUrl(getDeckCoverImage(deck) || undefined, deck.updatedAt)
    : null;

  return (
    <Card
      className={`p-3 md:p-6 transition-all ${
        isSelected
          ? 'border-2 border-brand-500 bg-brand-50 dark:bg-background-secondary'
          : 'hover:shadow-lg border border-gray-200 dark:border-border-primary'
      } ${isBatchMode ? 'cursor-default' : 'cursor-pointer'}`}
      onClick={() => onSelect(deck)}
    >
      <div className="flex items-start gap-3 md:gap-4">
        {/* 复选框 */}
        <div className="pt-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(deck.id)}
            className="w-4 h-4 text-brand-600 border-gray-300 dark:border-border-primary rounded focus:ring-brand-500 cursor-pointer"
          />
        </div>

        {/* 中间：项目信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 mb-2 flex-wrap">
            {isEditing ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => onTitleChange(e.target.value)}
                onKeyDown={(e) => onTitleKeyDown(e, deck.id)}
                onBlur={() => onSaveEdit(deck.id)}
                autoFocus
                className="text-base md:text-lg font-semibold text-gray-900 dark:text-foreground-primary px-2 py-1 border border-brand-500 rounded bg-white dark:bg-background-primary focus:outline-none focus:ring-2 focus:ring-brand-500 flex-1 min-w-0"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <h3
                className={`text-base md:text-lg font-semibold text-gray-900 dark:text-foreground-primary truncate flex-1 min-w-0 ${
                  isBatchMode
                    ? 'cursor-default'
                    : 'cursor-pointer hover:text-brand-600 transition-colors'
                }`}
                onClick={(e) => onStartEdit(e, deck)}
                title={isBatchMode ? undefined : t('common.edit')}
              >
                {title}
              </h3>
            )}
            <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 ${statusClass[progress]}`}>
              {statusText}
            </span>
          </div>
          <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-gray-500 dark:text-foreground-tertiary flex-wrap">
            <span className="flex items-center gap-1">
              <FileText size={14} />
              {t('deckCard.pages', { count: pageCount })}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {formatDate(deck.updatedAt || deck.createdAt)}
            </span>
          </div>
        </div>

        {/* 右侧：图片预览 */}
        <div className="hidden sm:block w-40 h-24 md:w-64 md:h-36 rounded-lg overflow-hidden bg-gray-100 dark:bg-background-secondary border border-gray-200 dark:border-border-primary flex-shrink-0">
          {firstPageImage ? (
            <img
              src={firstPageImage}
              alt={t('deckCard.page', { num: 1 })}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <FileText size={20} className="md:w-6 md:h-6" />
            </div>
          )}
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={(e) => onDelete(e, deck)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title={t('common.delete')}
          >
            <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
          </button>
          <ChevronRight size={18} className="text-gray-400 md:w-5 md:h-5" />
        </div>
      </div>
    </Card>
  );
};
