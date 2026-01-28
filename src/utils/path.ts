export enum Page {
  dashboard = "dashboard/",
  home = "/",
}
export const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    // Browser environment
    return window.location.origin;
  }
  // Server environment
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  return "http://localhost:3000"; // fallback for development
};
export const basePath = (basePage = Page.dashboard, url: string = "") => {
  const hostname = getBaseUrl();
  const fullURL = basePage + url;
  const uri = new URL(fullURL, hostname);
  return uri.pathname;
};
