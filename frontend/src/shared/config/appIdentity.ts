export const APP_IDENTITY = {
  productName: 'is2ppt',
  displayName: 'is2ppt',
  frontendPackageName: 'is2ppt-frontend',
  storagePrefix: 'is2ppt',
  repository: 'PuPuSama/IS2PPT-DEMO',
  repositoryUrl: 'https://github.com/PuPuSama/IS2PPT-DEMO',
  repositoryIssuesUrl: 'https://github.com/PuPuSama/IS2PPT-DEMO/issues',
  repositoryShowcasesUrl: 'https://github.com/PuPuSama/IS2PPT-DEMO/issues',
} as const;

export const getRepositoryApiUrl = () =>
  `https://api.github.com/repos/${APP_IDENTITY.repository}`;