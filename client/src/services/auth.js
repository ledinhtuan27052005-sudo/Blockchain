import { loginApi, registerApi, sendOtpApi, getProfileApi, updateProfileApi, changePasswordApi, googleLoginApi } from './api';

const TOKEN_KEY = 'trust_warranty_token_v1';
const USER_KEY = 'trust_warranty_user_v1';

export const authService = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  getCurrentUser() {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setSession(user, token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  async login(credentials) {
    const res = await loginApi(credentials);
    this.setSession(res.user, res.token);
    return res;
  },

  async googleLogin(googlePayload) {
    const res = await googleLoginApi(googlePayload);
    this.setSession(res.user, res.token);
    return res;
  },

  async sendOtp(formData) {
    return await sendOtpApi(formData);
  },

  async register(userData) {
    const res = await registerApi(userData);
    this.setSession(res.user, res.token);
    return res;
  },

  async refreshProfile() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const user = await getProfileApi(token);
      this.setSession(user, token);
      return user;
    } catch (err) {
      console.warn('Lỗi refresh profile:', err.message);
      return this.getCurrentUser();
    }
  },

  async updateProfile(profileData) {
    const token = this.getToken();
    if (!token) throw new Error('Chưa đăng nhập');
    const res = await updateProfileApi(profileData, token);
    this.setSession(res.user, token);
    return res.user;
  },

  async changePassword(passwordData) {
    const token = this.getToken();
    if (!token) throw new Error('Chưa đăng nhập');
    return await changePasswordApi(passwordData, token);
  },

  logout() {
    this.clearSession();
  }
};
