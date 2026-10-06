// Kept separate so the refresh can be replaced in tests (a real page reload can't be observed from a test).
export const reloadPage = () => window.location.reload();
