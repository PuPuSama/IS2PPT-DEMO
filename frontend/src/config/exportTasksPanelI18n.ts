export const exportTasksPanelI18n = {
  zh: {
    export: {
      tasks: "导出任务", inProgress: "{{count}} 进行中", clearHistory: "清除",
      exportPptx: "PPTX", exportPdf: "PDF", exportEditablePptx: "可编辑 PPTX", exportImages: "图片",
      allPages: "全部", pageRange: "第{{start}}-{{end}}页", singlePage: "第{{num}}页", pagesCount: "{{count}}页",
      warnings: "{{count}} 条警告", clickToView: "点击查看", warningsTitle: "导出警告",
      warningsCount: "导出警告 ({{count}} 条)", detailInfo: "详细信息",
      styleExtractionFailed: "转换失败 ({{count}} 个)", textRenderFailed: "文本渲染失败 ({{count}} 个)",
      moreItems: "... 还有 {{count}} 条", exportFailed: "导出失败", preparing: "准备中...",
      settingsTip: "可在「项目设置 → 导出设置」中调整配置或开启「返回半成品」选项",
      codexReconnectTip: "如果是 Codex 登录过期或连接中断，也可以前往设置重新登录 OpenAI 账号后再试",
      exportedFiles: "已导出文件",
    },
    shared: { historyRecords: "历史记录" }
  },
  en: {
    export: {
      tasks: "Export Tasks", inProgress: "{{count}} in progress", clearHistory: "Clear",
      exportPptx: "PPTX", exportPdf: "PDF", exportEditablePptx: "Editable PPTX", exportImages: "Images",
      allPages: "All", pageRange: "Pages {{start}}-{{end}}", singlePage: "Page {{num}}", pagesCount: "{{count}} pages",
      warnings: "{{count}} warnings", clickToView: "Click to view", warningsTitle: "Export Warnings",
      warningsCount: "Export Warnings ({{count}})", detailInfo: "Details",
      styleExtractionFailed: "Conversion failed ({{count}})", textRenderFailed: "Text render failed ({{count}})",
      moreItems: "... {{count}} more", exportFailed: "Export Failed", preparing: "Preparing...",
      settingsTip: "Adjust settings in \"Project Settings → Export Settings\" or enable \"Allow Partial Results\"",
      codexReconnectTip: "If Codex login expired or the connection was interrupted, reconnect your OpenAI account in Settings and try again.",
      exportedFiles: "Exported Files",
    },
    shared: { historyRecords: "History Records" }
  }
};
