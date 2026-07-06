import { test, expect } from '@playwright/test'
import { seedProjectWithImages } from './helpers/seed-project'

test.describe('Preview settings modal and multi-select', () => {
  test('mock: project settings modal can close and preview multi-select bar stays pinned', async ({ page }) => {
    const projectId = 'preview-settings-mock'

    await page.route(url => new URL(url).pathname.startsWith('/api/'), async (route) => {
      const url = new URL(route.request().url())

      if (url.pathname === '/api/access-code/check') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { enabled: false } }),
        })
      }

      if (url.pathname === '/api/settings') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              ai_provider_format: 'gemini',
              image_resolution: '2K',
              max_description_workers: 5,
              max_image_workers: 8,
              output_language: 'zh',
            },
          }),
        })
      }

      if (url.pathname === '/api/output-language') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { language: 'zh' } }),
        })
      }

      if (url.pathname === `/api/projects/${projectId}`) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              project_id: projectId,
              id: projectId,
              idea_prompt: '多选固定条测试',
              status: 'COMPLETED',
              pages: Array.from({ length: 14 }, (_, index) => ({
                id: `p${index + 1}`,
                page_id: `p${index + 1}`,
                order_index: index,
                status: 'COMPLETED',
                generated_image_path: `/files/mock/${index + 1}.png`,
                generated_image_url: `/files/mock/${index + 1}.png`,
                outline_content: { title: `Slide ${index + 1}`, points: [] },
                description_content: { text: `Desc ${index + 1}` },
              })),
            },
          }),
        })
      }

      if (url.pathname === '/api/user-templates') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { templates: [] } }),
        })
      }

      if (url.pathname.includes('/materials') || url.pathname.includes('/image-versions')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: {} }),
        })
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      })
    })

    await page.route('**/files/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(128) })
    })

    await page.goto(`/project/${projectId}/preview`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '项目设置' }).click()
    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
    await page.getByRole('button', { name: /关闭|Close|common\.close/ }).click()
    await expect(page).toHaveURL(new RegExp(`/project/${projectId}/preview$`))

    const thumbScroller = page.locator('aside .overflow-y-auto').first()
    const stickyBar = thumbScroller.locator('button:has-text("多选")').first()
    const stickyBarRow = stickyBar.locator('..')
    const before = await stickyBar.boundingBox()
    expect(before).not.toBeNull()
    await expect(stickyBarRow).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

    await thumbScroller.evaluate((el) => { el.scrollTop = 800 })
    await page.waitForTimeout(150)

    await stickyBar.click()
    const after = await stickyBar.boundingBox()
    expect(after).not.toBeNull()
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(4)
  })

  test('integration: project settings modal closes and multi-select stays visible while scrolling', async ({ page }) => {
    const frontendUrl = process.env.BASE_URL || 'http://localhost:3011'
    const frontendPort = parseInt(new URL(frontendUrl).port || '3011', 10)
    const backendUrl = `http://localhost:${frontendPort + 2000}`

    const { projectId } = await seedProjectWithImages(backendUrl, 14)

    try {
      await page.goto(`/project/${projectId}/preview`)
      await page.waitForLoadState('networkidle')

      await page.getByRole('button', { name: '项目设置' }).click()
      await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
      await page.getByRole('button', { name: /关闭|Close|common\.close/ }).click()
      await expect(page).toHaveURL(new RegExp(`/project/${projectId}/preview$`))

      const thumbScroller = page.locator('aside .overflow-y-auto').first()
      const multiSelectToggle = thumbScroller.locator('button:has-text("多选")').first()
      const stickyBarRow = multiSelectToggle.locator('..')
      const before = await multiSelectToggle.boundingBox()
      expect(before).not.toBeNull()
      await expect(stickyBarRow).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

      await thumbScroller.evaluate((el) => { el.scrollTop = 900 })
      await page.waitForTimeout(150)

      const after = await multiSelectToggle.boundingBox()
      expect(after).not.toBeNull()
      expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(4)
    } finally {
      await fetch(`${backendUrl}/api/projects/${projectId}`, { method: 'DELETE' })
    }
  })
})
