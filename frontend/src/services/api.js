import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api",
  headers: { "Content-Type": "application/json" },
});

// Session storage survives reloads but is still accessible to injected JavaScript.
const ACCESS_TOKEN_KEY = "serviceDesk.accessToken";
const REFRESH_TOKEN_KEY = "serviceDesk.refreshToken";
let refreshRequest = null;

export const tokenStorage = {
  getAccess: () => sessionStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => sessionStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens({ access, refresh }) {
    if (access) sessionStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear() {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

function announceExpiredSession() {
  tokenStorage.clear();
  window.dispatchEvent(new CustomEvent("auth:session-expired"));
}

export function unwrapApiData(value) {
  if (
    value &&
    typeof value === "object" &&
    typeof value.status === "boolean" &&
    typeof value.statusCode === "number" &&
    Object.hasOwn(value, "data")
  ) {
    return value.data;
  }
  return value;
}

api.interceptors.request.use((config) => {
  const accessToken = tokenStorage.getAccess();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    response.data = unwrapApiData(response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || "";
    const isAuthRequest = /\/auth\/(login|refresh|logout)\/?$/.test(requestUrl);
    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthRequest
    ) {
      return Promise.reject(error);
    }

    const refreshToken = tokenStorage.getRefresh();
    if (!refreshToken) {
      announceExpiredSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      if (!refreshRequest) {
        refreshRequest = axios
          .post(`${api.defaults.baseURL}/auth/refresh/`, {
            refresh: refreshToken,
          })
          .then(({ data: responseData }) => {
            const data = unwrapApiData(responseData);
            if (!data.access) {
              throw new Error("The refresh response did not contain an access token.");
            }
            tokenStorage.setTokens({
              access: data.access,
              refresh: data.refresh,
            });
            return data.access;
          })
          .finally(() => {
            refreshRequest = null;
          });
      }

      const accessToken = await refreshRequest;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      announceExpiredSession();
      return Promise.reject(refreshError);
    }
  },
);

export function getErrorMessage(error) {
  const data = unwrapApiData(error?.response?.data);
  if (!data) return "Something went wrong. Please try again.";
  if (typeof data.detail === "string") return data.detail;
  if (typeof data === "string") return data;
  return "Please check the form and try again.";
}

export function getFieldErrors(error) {
  const data = unwrapApiData(error?.response?.data);
  if (!data || typeof data !== "object") return {};
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(" ") : String(value),
    ]),
  );
}

export default api;
