const API_BASE_URL = 'http://localhost:5000/api';

export async function getProducts(search = '') {
  try {
    const url = search ? `${API_BASE_URL}/products?search=${encodeURIComponent(search)}` : `${API_BASE_URL}/products`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Khong the tai danh sach san pham');
    return await res.json();
  } catch (err) {
    console.warn('Backend offline hoac loi, su dung fallback cache:', err.message);
    return [];
  }
}

export async function getProductBySerial(serial) {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(serial)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Loi lay thong tin san pham tu backend:', err.message);
    return null;
  }
}

export async function saveProduct(productData) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('trust_auth_token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify(productData),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Khong the luu thong tin san pham');
  }
  return await res.json();
}

export async function getServiceCenters() {
  try {
    const res = await fetch(`${API_BASE_URL}/service-centers`);
    if (!res.ok) throw new Error('Khong the tai danh sach tram');
    return await res.json();
  } catch (err) {
    console.warn('Loi tai danh sach tram bao hanh:', err.message);
    return [];
  }
}

export async function saveServiceCenter(centerData) {
  const res = await fetch(`${API_BASE_URL}/service-centers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(centerData),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Khong the luu tram bao hanh');
  }
  return await res.json();
}

export async function getSystemStats() {
  try {
    const res = await fetch(`${API_BASE_URL}/stats`);
    if (!res.ok) throw new Error('Khong the lay thong ke');
    return await res.json();
  } catch (err) {
    return { totalProductsInCatalog: 0, totalCenters: 0 };
  }
}

// ==========================================
// AUTH & USER APIS
// ==========================================

export async function sendOtpApi(formData) {
  const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể gửi mã xác thực OTP');
  return data;
}

export async function registerApi(userData) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Đăng ký thất bại');
  return data;
}

export async function loginApi(credentials) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');
  return data;
}

export async function googleLoginApi(googlePayload) {
  const res = await fetch(`${API_BASE_URL}/auth/google-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(googlePayload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Đăng nhập Google thất bại');
  return data;
}

export async function paymasterRelayActivateApi(activationPayload, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE_URL}/paymaster/relay-activate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(activationPayload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Kích hoạt qua Paymaster thất bại');
  return data;
}

export async function getProfileApi(token) {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể tải thông tin cá nhân');
  return data.user;
}

export async function updateProfileApi(profileData, token) {
  const res = await fetch(`${API_BASE_URL}/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(profileData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể cập nhật thông tin');
  return data;
}

export async function changePasswordApi(passwordData, token) {
  const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(passwordData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể đổi mật khẩu');
  return data;
}

export async function clearDatabaseApi() {
  const res = await fetch(`${API_BASE_URL}/database/clear`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể xóa dữ liệu');
  return data;
}

// ==========================================
// SECURITY, MERKLE & INTEGRITY APIS
// ==========================================

export async function getProductIntegrity(serial) {
  const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(serial)}/integrity`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể kiểm tra tính toàn vẹn');
  return data;
}

export async function getMerkleBatches() {
  const res = await fetch(`${API_BASE_URL}/security/merkle/batches`);
  if (!res.ok) throw new Error('Không thể tải danh sách lô Merkle');
  return await res.json();
}

export async function getMerkleTree() {
  const res = await fetch(`${API_BASE_URL}/security/merkle/tree`);
  if (!res.ok) throw new Error('Không thể tải cấu trúc cây Merkle');
  return await res.json();
}

export async function getMerkleProof(serial) {
  const res = await fetch(`${API_BASE_URL}/security/merkle/proof/${encodeURIComponent(serial)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể tạo bằng chứng Merkle Proof');
  return data;
}

export async function getGenuinePartsMerkle() {
  const res = await fetch(`${API_BASE_URL}/security/merkle/parts`);
  if (!res.ok) throw new Error('Không thể tải danh mục linh kiện Merkle');
  return await res.json();
}

// Circuit Breaker (Ngắt khẩn cấp)
export async function getCircuitBreakerStatus() {
  const res = await fetch(`${API_BASE_URL}/security/circuit-breaker`);
  if (!res.ok) throw new Error('Không thể kiểm tra trạng thái Circuit Breaker');
  return await res.json();
}

export async function toggleCircuitBreaker(paused, reason = '', operator = '') {
  const token = typeof window !== 'undefined' ? localStorage.getItem('trust_auth_token') : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/security/circuit-breaker/toggle`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ paused, reason, operator }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể điều khiển Circuit Breaker');
  return data;
}

// Tamper Simulation Laboratory (Diễn tập An ninh mạng can thiệp dữ liệu)
export async function simulateTamper(serialNumber, tamperedSpecs = null, tamperedName = null) {
  const res = await fetch(`${API_BASE_URL}/security/tamper/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serialNumber, tamperedSpecs, tamperedName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể thực hiện diễn tập can thiệp');
  return data;
}

export async function restoreTamper(serialNumber) {
  const res = await fetch(`${API_BASE_URL}/security/tamper/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serialNumber }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể khôi phục dữ liệu gốc');
  return data;
}

// ==========================================
// 4 PHƯƠNG ÁN NÂNG CẤP HỆ THỐNG THỰC TẾ
// ==========================================

// Phương án 4: Xác thực mã PIN cào bảo mật vật lý
export async function verifyProductPin(serialNumber, pin) {
  const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(serialNumber)}/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Mã PIN cào bảo mật không hợp lệ');
  return data;
}

// Phương án 3: Hệ thống phiếu yêu cầu bảo hành RMA
export async function getRmaTickets(serial = '', status = '') {
  try {
    let url = `${API_BASE_URL}/rma/tickets`;
    const params = new URLSearchParams();
    if (serial) params.append('serial', serial);
    if (status) params.append('status', status);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('Lỗi lấy danh sách RMA tickets:', err.message);
    return [];
  }
}

export async function createRmaTicket(ticketData) {
  const res = await fetch(`${API_BASE_URL}/rma/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticketData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể gửi phiếu yêu cầu bảo hành');
  return data;
}

export async function updateRmaTicketStatus(id, updateData) {
  const res = await fetch(`${API_BASE_URL}/rma/tickets/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể cập nhật trạng thái phiếu RMA');
  return data;
}

// Phương án 2: Tự động gửi Email thông báo & Biên nhận
export async function sendWarrantyActivationNotification(payload) {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/warranty-activated`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.warn('Lỗi gửi email kích hoạt bảo hành:', err.message);
    return { success: false, error: err.message };
  }
}

export async function sendRepairCompletedNotification(payload) {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/repair-completed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.warn('Lỗi gửi email hoàn tất sửa chữa:', err.message);
    return { success: false, error: err.message };
  }
}
// Faucet API: Yêu cầu nạp ETH cho ví MetaMask
export async function requestFaucetEth(address, amount = '50.0') {
  const res = await fetch(`${API_BASE_URL}/faucet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, amount }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi khi nạp ETH từ Faucet');
  return data;
}

// Tra cứu số dư ETH trên Ganache
export async function getWalletEthBalance(address) {
  try {
    const res = await fetch(`${API_BASE_URL}/faucet/balance/${encodeURIComponent(address)}`);
    if (!res.ok) return '0.0';
    const data = await res.json();
    return data.balance || '0.0';
  } catch (e) {
    return '0.0';
  }
}

// Phân giải thông tin người nhận (Email / SĐT / Địa chỉ ví) sang địa chỉ ví Web3
export async function resolveCustomerWallet(identifier) {
  if (!identifier || !identifier.trim()) return null;
  const res = await fetch(`${API_BASE_URL}/users/resolve-wallet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: identifier.trim() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Không thể tra cứu thông tin ví người nhận');
  return data;
}

// Chuyển nhượng quyền sở hữu sản phẩm trên máy chủ
export async function transferProductOwnership(serial, { newOwner, buyerPhone, buyerEmail, buyerName, txHash }) {
  const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(serial)}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newOwner, buyerPhone, buyerEmail, buyerName, txHash }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi khi cập nhật thông tin chủ sở hữu mới trên máy chủ');
  return data;
}
