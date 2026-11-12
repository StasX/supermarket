// The compiled config lives in dist; resolve test paths from the backend root.
export default {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests-dist/backend.test.js'],
  transform: {},
  clearMocks: true,
};
