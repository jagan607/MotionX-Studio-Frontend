import "@testing-library/jest-dom";

// ── Mock next/navigation ──
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
  }),
  useParams: () => ({ id: "test-project-id" }),
  usePathname: () => "/project/test-project-id/postprod",
  useSearchParams: () => new URLSearchParams(),
}));

// ── Mock firebase ──
jest.mock("@/lib/firebase", () => ({
  auth: { currentUser: { uid: "test-uid", displayName: "Test User" } },
  db: {},
}));

// ── Mock react-hot-toast ──
jest.mock("react-hot-toast", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

// ── Mock framer-motion ──
jest.mock("framer-motion", () => ({
  motion: {
    div: jest.fn().mockImplementation(({ children, ...props }: any) => {
      const React = require("react");
      return React.createElement("div", props, children);
    }),
  },
  AnimatePresence: ({ children }: any) => children,
}));

// ── Mock API calls ──
jest.mock("@/lib/api", () => ({
  fetchProject: jest.fn(),
  fetchEpisodes: jest.fn(),
  saveTimeline: jest.fn(),
  loadTimeline: jest.fn(),
  generateShotImage: jest.fn(),
  exportTimeline: jest.fn(),
  aiEditTimeline: jest.fn(),
  invalidateDashboardCache: jest.fn(),
}));

// ── Mock firestore ──
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
}));

// Suppress requestAnimationFrame for tests
global.requestAnimationFrame = ((cb: FrameRequestCallback) =>
  setTimeout(cb, 0)) as any;
global.cancelAnimationFrame = ((id: number) =>
  clearTimeout(id)) as any;
