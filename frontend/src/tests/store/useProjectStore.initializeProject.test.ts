/**
 * initializeProject 测试 - 验证参考文件在 AI 生成前被关联到项目
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useProjectStore } from '@/store/useProjectStore'
import { STORAGE_KEYS } from '@/shared/storage/storageKeys'

// Track call order to verify files are associated before generation
const callOrder: string[] = []

const mockCreateProject = vi.fn()
const mockGetProject = vi.fn()
const mockAssociateFileToProject = vi.fn()
const mockUploadTemplate = vi.fn()
const mockGenerateFromDescription = vi.fn()
const mockGenerateOutline = vi.fn()

vi.mock('@/api/projectsApi', () => ({
  createProject: (...args: any[]) => {
    callOrder.push('createProject')
    return mockCreateProject(...args)
  },
  getProject: (...args: any[]) => {
    callOrder.push('getProject')
    return mockGetProject(...args)
  },
  uploadTemplate: (...args: any[]) => {
    callOrder.push('uploadTemplate')
    return mockUploadTemplate(...args)
  },
  updatePagesOrder: vi.fn(),
}))

vi.mock('@/api/referenceFilesApi', () => ({
  associateFileToProject: (...args: any[]) => {
    callOrder.push('associateFileToProject')
    return mockAssociateFileToProject(...args)
  },
}))

vi.mock('@/api/descriptionApi', () => ({
  generateFromDescription: (...args: any[]) => {
    callOrder.push('generateFromDescription')
    return mockGenerateFromDescription(...args)
  },
  generateDescriptions: vi.fn(),
  generateDescriptionsStream: vi.fn(),
  generatePageDescription: vi.fn(),
}))

vi.mock('@/api/outlineApi', () => ({
  generateOutline: (...args: any[]) => {
    callOrder.push('generateOutline')
    return mockGenerateOutline(...args)
  },
  generateOutlineStream: vi.fn(),
}))

vi.mock('@/api/pagesApi', () => ({
  updatePage: vi.fn(),
  updatePageDescription: vi.fn(),
  updatePageOutline: vi.fn(),
  addPage: vi.fn(),
  deletePage: vi.fn(),
}))

vi.mock('@/api/tasksApi', () => ({
  getTaskStatus: vi.fn(),
}))

vi.mock('@/api/imageGenerationApi', () => ({
  generateImages: vi.fn(),
  generatePageImage: vi.fn(),
  editPageImage: vi.fn(),
}))

vi.mock('@/api/renovationApi', () => ({
  regenerateRenovationPage: vi.fn(),
}))

vi.mock('@/api/exportsApi', () => ({
  exportPPTX: vi.fn(),
  exportPDF: vi.fn(),
  exportEditablePPTX: vi.fn(),
}))

vi.mock('@/api/auth', () => ({
  refreshCredits: vi.fn(),
}))

vi.mock('@/utils', () => ({
  debounce: (fn: any) => fn,
  normalizeErrorMessage: (msg: string) => msg,
}))

vi.mock('@/entities/deck/model/legacyProjectAdapter', () => ({
  projectDtoToLegacyProject: (data: any) => data,
}))

describe('initializeProject - reference file association', () => {
  beforeEach(() => {
    callOrder.length = 0
    vi.clearAllMocks()

    // Default mock responses
    mockCreateProject.mockResolvedValue({
      data: { project_id: 'proj-001' }
    })
    mockGetProject.mockResolvedValue({
      data: { id: 'proj-001', status: 'DRAFT', pages: [] }
    })
    mockAssociateFileToProject.mockResolvedValue({
      data: { file: { id: 'file-1', project_id: 'proj-001' } }
    })
    mockUploadTemplate.mockResolvedValue({ data: {} })
    mockGenerateFromDescription.mockResolvedValue({ data: {} })
    mockGenerateOutline.mockResolvedValue({ data: {} })
    localStorage.clear()

    // Reset store
    const { result } = renderHook(() => useProjectStore())
    act(() => {
      result.current.setCurrentProject(null)
      result.current.setError(null)
      result.current.setGlobalLoading(false)
    })
  })

  it('should pass reference file IDs and associate them after project creation', async () => {
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject(
        'idea',
        'Test idea prompt',
        undefined,
        undefined,
        ['file-1', 'file-2']
      )
    })

    expect(mockAssociateFileToProject).toHaveBeenCalledTimes(2)
    expect(mockAssociateFileToProject).toHaveBeenCalledWith('file-1', 'proj-001')
    expect(mockAssociateFileToProject).toHaveBeenCalledWith('file-2', 'proj-001')
  })

  it('should associate files before loading the created description project', async () => {
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject(
        'description',
        'Full description text',
        undefined,
        undefined,
        ['file-1']
      )
    })

    // Verify call order: create -> associate -> get project. Generation is triggered manually on the outline page.
    const createIdx = callOrder.indexOf('createProject')
    const associateIdx = callOrder.indexOf('associateFileToProject')
    const getProjectIdx = callOrder.indexOf('getProject')

    expect(createIdx).toBeLessThan(associateIdx)
    expect(associateIdx).toBeLessThan(getProjectIdx)
    expect(mockGenerateFromDescription).not.toHaveBeenCalled()
    expect(mockGenerateOutline).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEYS.currentProjectId)).toBe('proj-001')
  })

  it('should create outline projects without calling the long synchronous generation endpoint', async () => {
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject('outline', 'Slide 1\n- Point')
    })

    expect(mockGenerateOutline).not.toHaveBeenCalled()
    expect(mockGenerateFromDescription).not.toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEYS.currentProjectId)).toBe('proj-001')
  })

  it('should not call associateFileToProject when no file IDs provided', async () => {
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject('idea', 'Test prompt')
    })

    expect(mockAssociateFileToProject).not.toHaveBeenCalled()
  })

  it('should not call associateFileToProject when empty array provided', async () => {
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject('idea', 'Test prompt', undefined, undefined, [])
    })

    expect(mockAssociateFileToProject).not.toHaveBeenCalled()
  })

  it('should continue even if file association fails', async () => {
    mockAssociateFileToProject.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject(
        'idea',
        'Test prompt',
        undefined,
        undefined,
        ['file-1']
      )
    })

    // Should still complete successfully
    expect(result.current.currentProject).not.toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should associate files before uploading template', async () => {
    const templateFile = new File(['dummy'], 'template.png', { type: 'image/png' })

    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject(
        'idea',
        'Test prompt',
        templateFile,
        undefined,
        ['file-1']
      )
    })

    const associateIdx = callOrder.indexOf('associateFileToProject')
    const templateIdx = callOrder.indexOf('uploadTemplate')

    expect(associateIdx).toBeLessThan(templateIdx)
  })
})
