import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, Trash2, Sun, Moon, Presentation } from 'lucide-react';
import { Button, Loading, Card, Pagination, useToast, useConfirm } from '@/components/shared';
import { DeckCard } from '@/components/history/DeckCard';
import { useProjectStore } from '@/store/useProjectStore';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/hooks/useT';
import { deleteDeck, listDecks, renameDeck } from '@/entities/deck/api/deckRepository';
import { getDeckDisplayTitle, getDeckRoute } from '@/entities/deck/model/deckSelectors';
import type { Deck } from '@/entities/deck/model/types';
import { projectSession } from '@/shared/storage/projectSession';
import { historyPreferences } from '@/shared/storage/historyPreferences';
import { historyI18n } from '@/config/historyI18n';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const t = useT(historyI18n); // 组件内翻译 + 自动 fallback 到全局
  const { isDark, setTheme } = useTheme();
  const { syncProject, setCurrentProject } = useProjectStore();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [totalDecks, setTotalDecks] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => historyPreferences.readPageSize());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const totalPages = Math.ceil(totalDecks / pageSize);

  const loadDecks = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * pageSize;
      const result = await listDecks(pageSize, offset);
      setDecks(result.decks);
      setTotalDecks(result.total);
    } catch (err: any) {
      console.error('加载历史项目失败:', err);
      setError(err.message || t('history.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    loadDecks(currentPage);
  }, [currentPage, loadDecks]);

  const handlePageChange = useCallback((page: number) => {
    setSelectedDeckIds(new Set());
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    historyPreferences.savePageSize(size);
    setPageSize(size);
    setCurrentPage(1);
    setSelectedDeckIds(new Set());
  }, []);

  // ===== Deck selection and navigation =====

  const handleOpenDeck = useCallback(async (deck: Deck) => {
    const deckId = deck.id;

    // 如果正在批量选择模式，不跳转
    if (selectedDeckIds.size > 0) {
      return;
    }

    // 如果正在编辑该项目，不跳转
    if (editingDeckId === deckId) {
      return;
    }

    try {
      projectSession.setActiveProjectId(deckId);
      
      // 同步项目数据
      await syncProject(deckId);
      
      // 根据项目状态跳转到不同页面
      const route = getDeckRoute(deck);
      navigate(route, { state: { from: 'history' } });
    } catch (err: any) {
      console.error('打开项目失败:', err);
      show({
        message: t('history.openFailed') + ': ' + (err.message || t('common.unknownError')),
        type: 'error'
      });
    }
   
  }, [selectedDeckIds, editingDeckId, syncProject, navigate, show]);

  // ===== 批量选择操作 =====

  const handleToggleSelect = useCallback((deckId: string) => {
    setSelectedDeckIds(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(deckId)) {
        newSelected.delete(deckId);
      } else {
        newSelected.add(deckId);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedDeckIds(prev => {
      if (prev.size === decks.length) {
        return new Set();
      } else {
        return new Set(decks.map((deck) => deck.id));
      }
    });
  }, [decks]);

  // ===== 删除操作 =====

  const deleteDecks = useCallback(async (deckIds: string[]) => {
    setIsDeleting(true);
    const currentProjectId = projectSession.getActiveProjectId();
    let deletedCurrentProject = false;

    try {
      // 批量删除 - 使用 allSettled 处理部分失败
      const results = await Promise.allSettled(
        deckIds.map(deleteDeck)
      );

      const successIds = deckIds.filter((_, i) => results[i].status === 'fulfilled');
      const failCount = results.filter(r => r.status === 'rejected').length;

      // 检查是否删除了当前项目
      if (currentProjectId && successIds.includes(currentProjectId)) {
        projectSession.clearActiveProjectId();
        setCurrentProject(null);
        deletedCurrentProject = true;
      }

      // 清空选择
      setSelectedDeckIds(new Set());

      // Reload current page; if all items on this page were deleted, go back one page
      if (successIds.length > 0) {
        const remainingOnPage = decks.length - successIds.length;
        const newPage = remainingOnPage <= 0 && currentPage > 1 ? currentPage - 1 : currentPage;
        if (newPage !== currentPage) {
          // setCurrentPage triggers the useEffect which reloads the deck list.
          setCurrentPage(newPage);
        } else {
          await loadDecks(newPage);
        }
      }

      if (failCount > 0 && successIds.length > 0) {
        show({
          message: t('history.deletePartial', { success: successIds.length, fail: failCount }),
          type: 'warning'
        });
      } else if (deletedCurrentProject) {
        show({
          message: t('history.deleteCurrentProject'),
          type: 'info'
        });
      } else if (successIds.length > 0) {
        show({
          message: t('history.deleteSuccess', { count: successIds.length }),
          type: 'success'
        });
      } else {
        show({
          message: t('history.deleteFailed'),
          type: 'error'
        });
      }
    } catch (err: any) {
      console.error('删除项目失败:', err);
      show({
        message: t('history.deleteFailed') + ': ' + (err.message || t('common.unknownError')),
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  }, [setCurrentProject, show, decks, currentPage, loadDecks]);

  const handleDeleteDeck = useCallback(async (e: React.MouseEvent, deck: Deck) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发项目选择

    const deckTitle = getDeckDisplayTitle(deck, t('history.untitled'));
    confirm(
      t('history.confirmDelete', { title: deckTitle }),
      async () => {
        await deleteDecks([deck.id]);
      },
      { title: t('history.deleteTitle'), variant: 'danger' }
    );
   
  }, [confirm, deleteDecks, t]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedDeckIds.size === 0) return;

    const count = selectedDeckIds.size;
    confirm(
      t('history.confirmBatchDelete', { count }),
      async () => {
        await deleteDecks(Array.from(selectedDeckIds));
      },
      { title: t('history.batchDeleteTitle'), variant: 'danger' }
    );
  }, [selectedDeckIds, confirm, deleteDecks, t]);

  // ===== 编辑操作 =====

  const handleStartEdit = useCallback((e: React.MouseEvent, deck: Deck) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发项目选择
    
    // 如果正在批量选择模式，不允许编辑
    if (selectedDeckIds.size > 0) {
      return;
    }
    
    const currentTitle = getDeckDisplayTitle(deck, t('history.untitled'));
    setEditingDeckId(deck.id);
    setEditingTitle(currentTitle);
  }, [selectedDeckIds, t]);

  const handleCancelEdit = useCallback(() => {
    setEditingDeckId(null);
    setEditingTitle('');
  }, []);

  const handleSaveEdit = useCallback(async (deckId: string) => {
    const nextTitle = editingTitle.trim();

    if (!nextTitle) {
      show({ message: t('history.titleEmpty'), type: 'error' });
      return;
    }

    try {
      const targetDeck = decks.find((deck) => deck.id === deckId);
      if (!targetDeck) return;
      await renameDeck(deckId, nextTitle);

      // 更新本地状态
      setDecks((currentDecks) => currentDecks.map((deck) => (
        deck.id === deckId ? { ...deck, title: nextTitle } : deck
      )));

      setEditingDeckId(null);
      setEditingTitle('');
      show({ message: t('history.titleUpdated'), type: 'success' });
    } catch (err: any) {
      console.error('更新项目名称失败:', err);
      show({
        message: t('history.titleUpdateFailed') + ': ' + (err.message || t('common.unknownError')),
        type: 'error'
      });
    }
   
  }, [editingTitle, decks, show, t]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent, deckId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(deckId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 dark:from-background-primary via-white dark:via-background-primary to-gray-50 dark:to-background-primary">
      {/* 导航栏 */}
      <nav className="h-14 md:h-16 bg-white dark:bg-background-secondary shadow-sm dark:shadow-background-primary/30 border-b border-gray-100 dark:border-border-primary">
        <div className="max-w-7xl mx-auto px-3 md:px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-brand-600 rounded-lg flex items-center justify-center text-white">
              <Presentation size={20} className="md:w-6 md:h-6" />
            </div>
            <span className="text-lg md:text-xl font-bold text-gray-900 dark:text-foreground-primary">{t('home.title')}</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <Button
              variant="ghost"
              size="sm"
              icon={<Home size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate('/')}
              className="text-xs md:text-sm"
            >
              {t('nav.home')}
            </Button>
            {/* 分隔线 */}
            <div className="h-5 w-px bg-gray-300 dark:bg-border-primary" />
            {/* 语言切换按钮 */}
            <button
              onClick={() => i18n.changeLanguage(i18n.language?.startsWith('zh') ? 'en' : 'zh')}
              className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:text-gray-900 dark:hover:text-gray-100 hover:bg-brand-100/60 dark:hover:bg-background-hover rounded-md transition-all"
              title={t('settings.language.label')}
            >
              {i18n.language?.startsWith('zh') ? 'EN' : '中'}
            </button>
            {/* 主题切换按钮 */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="p-1.5 text-gray-600 dark:text-foreground-tertiary hover:text-gray-900 dark:hover:text-gray-100 hover:bg-brand-100/60 dark:hover:bg-background-hover rounded-md transition-all"
              title={isDark ? t('settings.theme.light') : t('settings.theme.dark')}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="max-w-6xl mx-auto px-3 md:px-4 py-6 md:py-8">
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-foreground-primary mb-1 md:mb-2">{t('history.title')}</h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-foreground-tertiary">{t('history.subtitle')}</p>
          </div>
          {decks.length > 0 && selectedDeckIds.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-foreground-tertiary">
                {t('history.selectedCount', { count: selectedDeckIds.size })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedDeckIds(new Set())}
                disabled={isDeleting}
              >
                {t('history.cancelSelect')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Trash2 size={16} />}
                onClick={handleBatchDelete}
                disabled={isDeleting}
                loading={isDeleting}
              >
                {t('history.batchDelete')}
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loading message={t('common.loading')} />
          </div>
        ) : error ? (
          <Card className="p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-gray-600 dark:text-foreground-tertiary mb-4">{error}</p>
            <Button variant="primary" onClick={() => loadDecks(currentPage)}>
              {t('common.retry')}
            </Button>
          </Card>
        ) : decks.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-foreground-secondary mb-2">
              {t('history.noProjects')}
            </h3>
            <p className="text-gray-500 dark:text-foreground-tertiary mb-6">
              {t('history.createFirst')}
            </p>
            <Button variant="primary" onClick={() => navigate('/')}>
              {t('home.actions.createProject')}
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* 全选工具栏 */}
            {decks.length > 0 && (
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200 dark:border-border-primary">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDeckIds.size === decks.length && decks.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-brand-600 border-gray-300 dark:border-border-primary rounded focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-foreground-secondary">
                    {selectedDeckIds.size === decks.length ? t('common.deselectAll') : t('common.selectAll')}
                  </span>
                </label>
              </div>
            )}
            
            {decks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                isSelected={selectedDeckIds.has(deck.id)}
                isEditing={editingDeckId === deck.id}
                editingTitle={editingTitle}
                onSelect={handleOpenDeck}
                onToggleSelect={handleToggleSelect}
                onDelete={handleDeleteDeck}
                onStartEdit={handleStartEdit}
                onTitleChange={setEditingTitle}
                onTitleKeyDown={handleTitleKeyDown}
                onSaveEdit={handleSaveEdit}
                isBatchMode={selectedDeckIds.size > 0}
              />
            ))}

            {/* 分页 */}
            <div className="pt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                pageSizeLabel={t('history.perPage')}
              />
            </div>
          </div>
        )}
      </main>
      <ToastContainer />
      {ConfirmDialog}
    </div>
  );
};
