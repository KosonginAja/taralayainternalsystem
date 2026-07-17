const fs = require('fs');
const path = require('path');

const dirs = [
  'apps/backend/src/core',
  'apps/backend/src/modules/iam/routes',
  'apps/backend/src/modules/iam/services',
  'apps/backend/src/modules/iam/repositories',
  'apps/backend/src/modules/iam/dto',
  'apps/backend/src/modules/iam/domain',
  'apps/backend/src/modules/iam/events',
  'apps/worker/src',
  'apps/web/src',
  'packages/shared/src',
  'packages/db/src/schema',
  'packages/db/src/seed',
  'packages/db/src/migrations',
  'packages/ui/src',
  'packages/config',
];

dirs.forEach(dir => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

const packages = {
  'apps/backend/package.json': {
    name: '@taralaya/backend',
    version: '0.0.0',
    private: true,
    main: 'src/main.ts',
    scripts: {
      build: 'tsc',
      dev: 'tsx watch src/main.ts',
      lint: 'eslint src/',
      typecheck: 'tsc --noEmit',
      test: 'jest'
    },
    dependencies: {
      '@taralaya/shared': 'workspace:*',
      '@taralaya/db': 'workspace:*',
      'express': '^4.19.2',
      'zod': '^3.23.0',
      'pino': '^9.0.0',
      'argon2': '^0.40.1',
      'jsonwebtoken': '^9.0.2'
    },
    devDependencies: {
      '@taralaya/config': 'workspace:*',
      'tsx': '^4.16.0',
      'typescript': '^5.4.5',
      '@types/express': '^4.17.21',
      '@types/jsonwebtoken': '^9.0.6'
    }
  },
  'apps/worker/package.json': {
    name: '@taralaya/worker',
    version: '0.0.0',
    private: true,
    scripts: {
      build: 'tsc',
      dev: 'tsx watch src/main.ts'
    }
  },
  'apps/web/package.json': {
    name: '@taralaya/web',
    version: '0.0.0',
    private: true,
    scripts: {
      build: 'next build',
      dev: 'next dev'
    }
  },
  'packages/shared/package.json': {
    name: '@taralaya/shared',
    version: '0.0.0',
    private: true,
    main: 'src/index.ts',
    scripts: {
      build: 'tsc',
      typecheck: 'tsc --noEmit'
    },
    devDependencies: {
      'typescript': '^5.4.5'
    }
  },
  'packages/db/package.json': {
    name: '@taralaya/db',
    version: '0.0.0',
    private: true,
    main: 'src/index.ts',
    scripts: {
      build: 'tsc',
      typecheck: 'tsc --noEmit',
      migrate: 'drizzle-kit push',
      'generate-migration': 'drizzle-kit generate',
      seed: 'tsx src/seed/index.ts'
    },
    dependencies: {
      'drizzle-orm': '^0.31.2',
      'mysql2': '^3.10.1'
    },
    devDependencies: {
      'drizzle-kit': '^0.22.7',
      'typescript': '^5.4.5',
      'tsx': '^4.16.0'
    }
  },
  'packages/ui/package.json': {
    name: '@taralaya/ui',
    version: '0.0.0',
    private: true
  },
  'packages/config/package.json': {
    name: '@taralaya/config',
    version: '0.0.0',
    private: true
  }
};

Object.entries(packages).forEach(([file, content]) => {
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(content, null, 2));
});

// Create basic tsconfigs
const baseTsConfig = {
  compilerOptions: {
    target: 'ES2022',
    module: 'CommonJS',
    moduleResolution: 'node',
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true
  }
};

['apps/backend', 'apps/worker', 'packages/shared', 'packages/db'].forEach(pkg => {
  fs.writeFileSync(path.join(__dirname, pkg, 'tsconfig.json'), JSON.stringify(baseTsConfig, null, 2));
});

fs.writeFileSync(path.join(__dirname, 'tsconfig.base.json'), JSON.stringify(baseTsConfig, null, 2));

console.log('Scaffolding complete.');
