# TrustWarranty - Product Warranty & Service History System

> Đồ án môn học: Lập trình Blockchain & Hợp đồng thông minh (Smart Contract)  
> Sinh viên thực hiện | Học phần Blockchain Technology

---

## 1. Giới thiệu Đề tài

Hệ thống quản lý vòng đời bảo hành và nhật ký sửa chữa, bảo dưỡng thiết bị điện tử trên nền tảng Blockchain, tích hợp **Chuẩn bảo mật Doanh nghiệp & Giải thuật Mật mã Cây Merkle (Merkle Tree)**.

- **Smart Contract (Solidity v0.8.20)**:
  - Kiểm soát bất biến việc đăng ký, kích hoạt, sang tên máy cũ, gia hạn bảo hành mở rộng và nhật ký bảo dưỡng.
  - Tích hợp giải thuật **`verifyMerkleProof`**: Quản lý xuất xưởng hàng nghìn sản phẩm/linh kiện chỉ bằng 1 chuỗi `merkleRoot` duy nhất, tiết kiệm 99% phí gas và bảo vệ danh sách Serial khỏi bị cào dữ liệu.
  - Cơ chế Khẩn cấp **Pausable (Circuit Breaker)**: Đóng băng các hàm thay đổi trạng thái khi phát hiện sự cố an ninh.
- **Backend Service (Express REST API)**:
  - Cung cấp dữ liệu mở rộng (specs, ảnh, hướng dẫn sử dụng).
  - Module Cây Merkle sinh Merkle Root và Merkle Proof cho từng sản phẩm và linh kiện.
  - Middleware Rate Limiting chống quét cào dữ liệu tự động.
- **Web Client (React + Vite + Tailwind + Lucide Icons)**:
  - Giao diện Dark mode hiện đại, tối giản chữ, ưu tiên biểu tượng (icon).
  - Khung thông báo hệ thống công nghệ cao (loại bỏ 100% pop-up `alert` trình duyệt).
  - Trực quan hóa Cây Merkle tương tác từ Root đến Leaves.
  - Thẻ bảo hành số phong cách Apple Wallet kèm mã QR động.

---

## 2. Kiến trúc Bảo mật & Cây Merkle (Merkle Tree Security)

### A. Bài toán Giải quyết bằng Cây Merkle
1. **Tiết kiệm Gas vượt bậc**: Thay vì gửi 10,000 giao dịch đăng ký từng số Serial lên chuỗi, Nhà sản xuất chỉ gửi duy nhất 1 chuỗi `bytes32 batchMerkleRoot`.
2. **Bảo mật Danh sách Serial (Anti-Scraping)**: Không lưu Serial dạng văn bản thô trên sổ cái công khai.
3. **Xác minh Mật mã \(O(\log N)\)**: Người dùng hoặc đại lý chỉ cần cung cấp số Serial kèm mảng `proof` (chỉ gồm vài chuỗi băm), Smart Contract tự tính toán và xác minh tính toàn vẹn toán học.
4. **Chống tráo Linh kiện**: Mọi linh kiện thay thế tại trạm dịch vụ được đối chiếu với Merkle Root linh kiện chính hãng của nhà sản xuất.

### B. Cơ chế Khẩn cấp Pausable (Circuit Breaker)
Khi Admin bật `paused = true`, toàn bộ các hàm ghi (`registerProduct`, `activateWarranty`, `addServiceRecord`, `transferOwnership`) bị chặn bởi modifier `whenNotPaused`. Các hàm tra cứu `view` của khách hàng vẫn hoạt động bình thường.

---

## 3. Phân quyền & Vai trò trong Hệ thống

| Vai trò | Quyền hạn trên Smart Contract | Hành động trên Giao diện Web |
| :--- | :--- | :--- |
| **Nhà sản xuất (Manufacturer)** | Đăng ký thiết bị lẻ (`registerProduct`), đăng ký Lô hàng bằng Merkle Root (`registerProductBatch`), thiết lập Root linh kiện chính hãng (`setGenuinePartsRoot`). | Biểu mẫu xuất xưởng, tạo nhanh Serial mẫu, tải Merkle Proof lên Smart Contract. |
| **Đại lý bán lẻ (Seller)** | Kích hoạt bảo hành (`activateWarranty`), gia hạn gói bảo hành mở rộng (`extendWarranty`). | Kích hoạt bảo hành 1 chạm cho khách hàng; Cung cấp gói gia hạn +6, +12, +24 tháng (AppleCare+ style). |
| **Trạm dịch vụ (Service Center)** | Ghi nhận sửa chữa (`addServiceRecord`), vô hiệu hóa bảo hành khi vi phạm (`voidWarranty`), xác thực linh kiện chính hãng (`verifyGenuinePart`). | Lập phiếu dịch vụ, đối chiếu mã linh kiện với Cây Merkle của nhà sản xuất. |
| **Khách hàng (Customer / Public)** | Tra cứu công khai (`getProduct`, `getServiceHistory`), sang tên máy cũ (`transferOwnership`), xác minh bằng chứng Merkle (`verifyProductWithProof`). | Xem huy hiệu chính hãng, kiểm tra đường đi Merkle Proof \(O(\log N)\), xem Thẻ bảo hành số Apple Wallet kèm mã QR, sang tên máy cũ khi bán lại. |

---

## 4. Cấu trúc Thư mục Dự án

```text
Blockchain/
├── contracts/
│   └── WarrantyRegistry.sol       # Smart Contract chính (Solidity v0.8.20, Merkle Tree, Pausable)
├── scripts/
│   └── compile.js                 # Biên dịch Solidity ra ABI & Bytecode (solc)
├── server/
│   ├── index.js                   # Express REST API & Merkle Endpoints (Port 5000)
│   ├── utils/
│   │   └── merkle.js              # Module mật mã Cây Merkle Keccak-256
│   ├── data/
│   │   ├── products.json          # Dữ liệu thông số kỹ thuật mở rộng
│   │   └── serviceCenters.json    # Danh mục trạm dịch vụ ủy quyền
│   └── contractArtifacts.json     # ABI & Bytecode của Smart Contract
├── client/                        # Giao diện Web (Vite + React + Tailwind CSS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx         # Thanh điều hướng, Dual-Engine & Role Switcher
│   │   │   ├── StatsBanner.jsx    # Thống kê tổng quan dạng thẻ icon
│   │   │   ├── PublicLookup.jsx   # Tra cứu, Timeline, Thẻ số QR & Sang tên máy cũ
│   │   │   ├── SecurityCenter.jsx # Trung tâm Bảo mật & Trực quan hóa Cây Merkle
│   │   │   ├── LiveEventStream.jsx# Sổ cái sự kiện Smart Contract thời gian thực
│   │   │   ├── DigitalWarrantyCard.jsx # Thẻ bảo hành số Apple Wallet & mã QR
│   │   │   ├── SystemNotificationBox.jsx # Khung thông báo hệ thống tích hợp
│   │   │   ├── ManufacturerHub.jsx# Cổng Nhà sản xuất
│   │   │   ├── SellerHub.jsx      # Cổng Đại lý (Kích hoạt & Gia hạn AppleCare+)
│   │   │   └── ServiceCenterHub.jsx# Cổng Trạm bảo dưỡng
│   │   └── services/
│   │       ├── api.js             # Giao tiếp Backend Express
│   │       ├── merkle.js          # Module tính toán Merkle Tree phía Client
│   │       └── blockchain.js      # Giao tiếp Web3 & Event Engine EIP-1193/EIP-2255
│   └── package.json
├── package.json                   # Root package quản lý scripts dự án
├── .env.example                   # Biến môi trường mẫu cho Sepolia
└── README.md
```

---

## 5. Hướng dẫn Khởi chạy Hệ thống

### Bước 1: Cài đặt thư viện dependencies (Tạo thư mục node_modules)
Sau khi clone dự án về máy tính, chạy 2 lệnh sau để cài đặt toàn bộ thư viện:
```bash
# 1. Cài đặt thư viện cho Backend và Scripts gốc
npm install

# 2. Cài đặt thư viện cho Giao diện Frontend Client
cd client && npm install && cd ..
```

---

### Bước 2: Khởi động hệ thống
#### Cách 1: Khởi động toàn bộ bằng 1 lệnh duy nhất (Khuyên dùng)
```bash
npm run dev
```
*(Chạy đồng thời Backend API tại `http://localhost:5000` và Web Client tại `http://localhost:3000`)*

#### Cách 2: Khởi động thủ công riêng biệt từng dịch vụ
- **Terminal 1 (Blockchain RPC Ganache)**:
  ```bash
  npx ganache --wallet.mnemonic "test test test test test test test test test test test junk" --port 8545 --chain.chainId 1337
  ```
- **Terminal 2 (Triển khai Smart Contract)**:
  ```bash
  npm run deploy
  ```
- **Terminal 3 (Backend Server)**:
  ```bash
  npm run server
  ```
- **Terminal 4 (Web Client Frontend)**:
  ```bash
  npm run client
  ```
