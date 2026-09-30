// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WarrantyRegistry
 * @dev Hệ thống Quản lý Bảo hành & Lịch sử Dịch vụ trên Nền tảng Blockchain.
 *      KIẾN TRÚC LƯU TRỮ HOÀN TOÀN BẰNG BĂM (100% HASH STORAGE) & CÂY MERKLE THỰC THỂ.
 *      - Toàn bộ trạng thái on-chain được lưu trữ dưới dạng mã băm cryptographic digest (bytes32).
 *      - Dữ liệu chi tiết (thông số, tài liệu, ghi chú sửa chữa) lưu trữ off-chain.
 *      - Tính toàn vẹn và chống giả mạo được đảm bảo bằng 2 tầng Cây Merkle:
 *        1. Cây Merkle Lô sản xuất (Batch Merkle Tree) quản lý hàng nghìn thiết bị với 1 Root duy nhất.
 *        2. Cây Merkle Lịch sử Dịch vụ (Service History Merkle Tree) cho từng thiết bị.
 */
contract WarrantyRegistry {
    address public admin;
    bool public paused; // Circuit Breaker khẩn cấp

    enum WarrantyStatus { Inactive, Active, Expired, Voided }
    enum ServiceType { Maintenance, Repair, PartReplacement, Inspection }

    // Cấu trúc Lưu trữ Băm Phiếu Dịch vụ (Service Record Hash Commitment)
    struct ServiceRecordCommitment {
        uint256 recordId;
        uint256 timestamp;
        address serviceCenter;
        ServiceType serviceType;
        bytes32 recordDataHash;     // keccak256(serviceType, notes, replacedPart, technicianId)
        bytes32 previousRecordHash; // Chuỗi băm liên kết (Cryptographic Hash-Chain)
    }

    // Cấu trúc Lưu trữ Băm Sản Phẩm (Product Hash Commitment)
    struct ProductCommitment {
        bytes32 serialHash;        // keccak256(serialNumber)
        bytes32 metadataHash;      // keccak256(specs + modelCode + name + brand)
        bytes32 ownerHash;         // keccak256(customerAddress / privacySecret)
        bytes32 serviceMerkleRoot; // Gốc Merkle đại diện toàn bộ lịch sử sửa chữa của thiết bị này
        uint256 manufactureDate;
        uint256 warrantyMonths;
        uint256 activationDate;
        uint256 expiryDate;
        WarrantyStatus status;
        bool exists;
    }

    // Cấu trúc Lô sản phẩm quản lý bằng Merkle Root
    struct ProductBatch {
        bytes32 merkleRoot;
        bytes32 batchCodeHash;
        uint256 totalItems;
        uint256 createdAt;
        bool exists;
    }

    // Phân quyền theo chuẩn Doanh nghiệp
    mapping(address => bool) public authorizedManufacturers;
    mapping(address => bool) public authorizedSellers;
    mapping(address => bool) public authorizedServiceCenters;

    // Lưu trữ On-chain 100% bằng bytes32 Hash
    mapping(bytes32 => ProductCommitment) private productCommitments;
    mapping(bytes32 => ServiceRecordCommitment[]) private serviceCommitments;
    mapping(uint256 => ProductBatch) public productBatches;

    // Gốc Merkle Danh mục Phụ tùng / Linh kiện chính hãng
    bytes32 public genuinePartsMerkleRoot;

    // Danh sách các mã băm serial đã đăng ký
    bytes32[] public registeredSerialHashes;
    uint256 private nextRecordId = 1;

    // Events mật mã on-chain (Index theo mã băm bytes32)
    event ProductRegistered(bytes32 indexed serialHash, bytes32 indexed metadataHash, address indexed manufacturer);
    event WarrantyActivated(bytes32 indexed serialHash, bytes32 indexed ownerHash, uint256 activationDate, uint256 expiryDate);
    event ServiceRecorded(bytes32 indexed serialHash, uint256 indexed recordId, bytes32 recordDataHash, bytes32 newServiceMerkleRoot);
    event WarrantyVoided(bytes32 indexed serialHash, bytes32 reasonHash);
    event OwnershipTransferred(bytes32 indexed serialHash, bytes32 indexed previousOwnerHash, bytes32 indexed newOwnerHash);
    event WarrantyExtended(bytes32 indexed serialHash, uint256 addedMonths, uint256 newExpiryDate);
    event BatchRegistered(uint256 indexed batchId, bytes32 indexed merkleRoot, uint256 totalItems);
    event GenuinePartsRootUpdated(bytes32 indexed newRoot, address indexed updatedBy);
    event ContractPaused(address indexed admin);
    event ContractUnpaused(address indexed admin);
    event RoleGranted(string roleName, address indexed account);
    event RoleRevoked(string roleName, address indexed account);

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Chi Admin co quyen thuc thi");
        _;
    }

    modifier onlyManufacturer() {
        require(authorizedManufacturers[msg.sender] || msg.sender == admin, "Chi Nha san xuat duoc phep");
        _;
    }

    modifier onlyManufacturerOrSeller() {
        require(
            authorizedManufacturers[msg.sender] || authorizedSellers[msg.sender] || msg.sender == admin,
            "Chi Nha san xuat hoac Dai ly duoc phep"
        );
        _;
    }

    modifier onlySeller() {
        require(authorizedSellers[msg.sender] || authorizedManufacturers[msg.sender] || msg.sender == admin, "Chi Dai ly duoc phep");
        _;
    }

    modifier onlyServiceCenter() {
        require(authorizedServiceCenters[msg.sender] || msg.sender == admin, "Chi Tram dich vu duoc phep");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "He thong dang tam khoa bao ve an ninh (Circuit Breaker)");
        _;
    }

    constructor() {
        admin = msg.sender;
        authorizedManufacturers[msg.sender] = true;
        authorizedSellers[msg.sender] = true;
        authorizedServiceCenters[msg.sender] = true;

        emit RoleGranted("ADMIN", msg.sender);
        emit RoleGranted("MANUFACTURER", msg.sender);
        emit RoleGranted("SELLER", msg.sender);
        emit RoleGranted("SERVICE_CENTER", msg.sender);
    }

    // =========================================================================
    // 1. QUẢN TRỊ & PHÂN QUYỀN (ACCESS CONTROL)
    // =========================================================================

    function setManufacturer(address account, bool status) external onlyAdmin {
        authorizedManufacturers[account] = status;
        if (status) emit RoleGranted("MANUFACTURER", account);
        else emit RoleRevoked("MANUFACTURER", account);
    }

    function setSeller(address account, bool status) external onlyAdmin {
        authorizedSellers[account] = status;
        if (status) emit RoleGranted("SELLER", account);
        else emit RoleRevoked("SELLER", account);
    }

    function setServiceCenter(address account, bool status) external onlyAdmin {
        authorizedServiceCenters[account] = status;
        if (status) emit RoleGranted("SERVICE_CENTER", account);
        else emit RoleRevoked("SERVICE_CENTER", account);
    }

    function setPaused(bool _paused) external onlyAdmin {
        paused = _paused;
        if (_paused) emit ContractPaused(msg.sender);
        else emit ContractUnpaused(msg.sender);
    }

    // =========================================================================
    // 2. ĐĂNG KÝ SẢN PHẨM BẰNG BĂM (HASH COMMITMENT REGISTRATION)
    // =========================================================================

    /**
     * @dev Đăng ký thiết bị bằng mã băm trực tiếp (Native Hash Storage)
     * @param serialHash keccak256 của số Serial
     * @param metadataHash keccak256 của cấu hình/thông số kỹ thuật off-chain
     * @param warrantyMonths Thời hạn bảo hành tiêu chuẩn (tháng)
     */
    function registerProductCommitment(
        bytes32 serialHash,
        bytes32 metadataHash,
        uint256 warrantyMonths
    ) public onlyManufacturerOrSeller whenNotPaused {
        require(serialHash != bytes32(0), "Ma bam Serial khong hop le");
        require(!productCommitments[serialHash].exists, "Thiet bi da duoc dang ky tren he thong");
        require(warrantyMonths > 0, "Thoi han bao hanh phai lon hon 0");

        productCommitments[serialHash] = ProductCommitment({
            serialHash: serialHash,
            metadataHash: metadataHash,
            ownerHash: bytes32(0),
            serviceMerkleRoot: bytes32(0),
            manufactureDate: block.timestamp,
            warrantyMonths: warrantyMonths,
            activationDate: 0,
            expiryDate: 0,
            status: WarrantyStatus.Inactive,
            exists: true
        });

        registeredSerialHashes.push(serialHash);
        emit ProductRegistered(serialHash, metadataHash, msg.sender);
    }

    /**
     * @dev Hàm tiện ích nhận chuỗi Serial thô, tự động băm Keccak-256 trước khi lưu
     */
    function registerProduct(
        string calldata serialNumber,
        bytes32 metadataHash,
        uint256 warrantyMonths
    ) external onlyManufacturerOrSeller whenNotPaused {
        bytes32 sHash = keccak256(bytes(serialNumber));
        registerProductCommitment(sHash, metadataHash, warrantyMonths);
    }

    // =========================================================================
    // 3. KÍCH HOẠT BẢO HÀNH & CHUYỂN QUYỀN (WARRANTY ACTIVATION)
    // =========================================================================

    /**
     * @dev Kích hoạt bảo hành lưu trữ băm định danh chủ sở hữu (Owner Hash)
     */
    function activateWarrantyCommitment(
        bytes32 serialHash,
        bytes32 ownerHash
    ) public onlyManufacturerOrSeller whenNotPaused {
        require(productCommitments[serialHash].exists, "Thiet bi khong ton tai");
        require(ownerHash != bytes32(0), "Ma bam chu so huu khong hop le");

        ProductCommitment storage prod = productCommitments[serialHash];
        require(prod.status == WarrantyStatus.Inactive, "Trang thai thiet bi khong hop le de kich hoat");

        uint256 actDate = block.timestamp;
        uint256 expDate = actDate + (prod.warrantyMonths * 30 days);

        prod.ownerHash = ownerHash;
        prod.activationDate = actDate;
        prod.expiryDate = expDate;
        prod.status = WarrantyStatus.Active;

        emit WarrantyActivated(serialHash, ownerHash, actDate, expDate);
    }

    function activateWarranty(
        string calldata serialNumber,
        bytes32 ownerHash
    ) external onlyManufacturerOrSeller whenNotPaused {
        bytes32 sHash = keccak256(bytes(serialNumber));
        activateWarrantyCommitment(sHash, ownerHash);
    }

    /**
     * @dev Chuyển nhượng quyền sở hữu thiết bị sang băm chủ mới
     */
    function transferOwnership(
        bytes32 serialHash,
        bytes32 newOwnerHash
    ) external whenNotPaused {
        require(productCommitments[serialHash].exists, "Thiet bi khong ton tai");
        require(newOwnerHash != bytes32(0), "Ma bam chu moi khong hop le");

        ProductCommitment storage prod = productCommitments[serialHash];
        require(prod.status != WarrantyStatus.Voided, "Thiet bi da bi vo hieu hoa bao hanh");

        // Rang buoc bao mat: Chi chu so huu hien tai, Admin, Dai ly, Nha san xuat hoac Tram dich vu moi co quyen chuyen nhuong
        bytes32 callerHash = keccak256(abi.encodePacked(msg.sender));
        require(
            prod.ownerHash == callerHash || 
            msg.sender == admin || 
            authorizedSellers[msg.sender] ||
            authorizedManufacturers[msg.sender] ||
            authorizedServiceCenters[msg.sender],
            "Tu choi quyen: Chi chu so huu hien tai, Dai ly, Nha san xuat hoac Tram dich vu moi co quyen sang ten thiet bi"
        );

        bytes32 prevOwner = prod.ownerHash;
        prod.ownerHash = newOwnerHash;

        emit OwnershipTransferred(serialHash, prevOwner, newOwnerHash);
    }

    /**
     * @dev Gia hạn bảo hành mở rộng (AppleCare+ style)
     */
    function extendWarranty(
        bytes32 serialHash,
        uint256 extraMonths
    ) external onlySeller whenNotPaused {
        require(productCommitments[serialHash].exists, "Thiet bi khong ton tai");
        require(extraMonths > 0, "So thang gia han phai lon hon 0");

        ProductCommitment storage prod = productCommitments[serialHash];
        require(prod.status == WarrantyStatus.Active || prod.status == WarrantyStatus.Expired, "Khong the gia han");

        uint256 baseTime = block.timestamp > prod.expiryDate ? block.timestamp : prod.expiryDate;
        uint256 newExpiry = baseTime + (extraMonths * 30 days);

        prod.expiryDate = newExpiry;
        prod.warrantyMonths += extraMonths;
        prod.status = WarrantyStatus.Active;

        emit WarrantyExtended(serialHash, extraMonths, newExpiry);
    }

    // =========================================================================
    // 4. LỊCH SỬ DỊCH VỤ DẠNG CÂY MERKLE (PER-PRODUCT SERVICE MERKLE STORAGE)
    // =========================================================================

    /**
     * @dev Ghi nhận sửa chữa/bảo dưỡng dạng Hash Commitment & cập nhật Merkle Root của thiết bị
     * @param serialHash Băm số Serial
     * @param recordDataHash keccak256(serviceType, notes, replacedPart, technicianId, timestamp)
     * @param newServiceMerkleRoot Gốc Merkle mới đại diện cho toàn bộ các lần bảo dưỡng của thiết bị
     */
    function addServiceRecordCommitment(
        bytes32 serialHash,
        ServiceType serviceType,
        bytes32 recordDataHash,
        bytes32 newServiceMerkleRoot
    ) public onlyServiceCenter whenNotPaused returns (uint256) {
        require(productCommitments[serialHash].exists, "Thiet bi khong ton tai");
        require(recordDataHash != bytes32(0), "Ma bam phieu dich vu khong hop le");

        ProductCommitment storage prod = productCommitments[serialHash];
        if (prod.status == WarrantyStatus.Active && block.timestamp > prod.expiryDate) {
            prod.status = WarrantyStatus.Expired;
        }

        uint256 recId = nextRecordId++;
        bytes32 prevHash = bytes32(0);
        uint256 currentCount = serviceCommitments[serialHash].length;
        if (currentCount > 0) {
            prevHash = serviceCommitments[serialHash][currentCount - 1].recordDataHash;
        }

        serviceCommitments[serialHash].push(ServiceRecordCommitment({
            recordId: recId,
            timestamp: block.timestamp,
            serviceCenter: msg.sender,
            serviceType: serviceType,
            recordDataHash: recordDataHash,
            previousRecordHash: prevHash
        }));

        // Cập nhật Gốc Merkle lịch sử dịch vụ on-chain
        prod.serviceMerkleRoot = newServiceMerkleRoot;

        emit ServiceRecorded(serialHash, recId, recordDataHash, newServiceMerkleRoot);
        return recId;
    }

    function addServiceRecord(
        string calldata serialNumber,
        ServiceType serviceType,
        bytes32 recordDataHash,
        bytes32 newServiceMerkleRoot
    ) external onlyServiceCenter whenNotPaused returns (uint256) {
        bytes32 sHash = keccak256(bytes(serialNumber));
        return addServiceRecordCommitment(sHash, serviceType, recordDataHash, newServiceMerkleRoot);
    }

    /**
     * @dev Hủy hiệu lực bảo hành khi phát hiện vi phạm
     */
    function voidWarranty(
        bytes32 serialHash,
        bytes32 reasonHash
    ) external whenNotPaused {
        require(
            authorizedServiceCenters[msg.sender] || 
            authorizedManufacturers[msg.sender] || 
            msg.sender == admin,
            "Chi Tram dich vu hoac Nha san xuat duoc phep dinh chi bao hanh"
        );
        require(productCommitments[serialHash].exists, "Thiet bi khong ton tai");
        ProductCommitment storage prod = productCommitments[serialHash];
        prod.status = WarrantyStatus.Voided;
        emit WarrantyVoided(serialHash, reasonHash);
    }

    // =========================================================================
    // 5. CÂY MERKLE CHO LÔ XUẤT XƯỞNG & LINH KIỆN HÃNG (BATCH & PARTS MERKLE)
    // =========================================================================

    /**
     * @dev Đăng ký lô hàng xuất xưởng bằng 1 Merkle Root 32-bytes duy nhất
     */
    function registerProductBatch(
        uint256 batchId,
        bytes32 batchCodeHash,
        bytes32 merkleRoot,
        uint256 totalItems
    ) external onlyManufacturer whenNotPaused {
        require(merkleRoot != bytes32(0), "Merkle Root khong hop le");
        require(!productBatches[batchId].exists, "Lo san pham da ton tai");
        require(totalItems > 0, "So luong thiet bi phai lon hon 0");

        productBatches[batchId] = ProductBatch({
            merkleRoot: merkleRoot,
            batchCodeHash: batchCodeHash,
            totalItems: totalItems,
            createdAt: block.timestamp,
            exists: true
        });

        emit BatchRegistered(batchId, merkleRoot, totalItems);
    }

    /**
     * @dev Cập nhật Merkle Root danh mục linh kiện chính hãng của nhà sản xuất
     */
    function setGenuinePartsRoot(bytes32 newRoot) external onlyManufacturer whenNotPaused {
        require(newRoot != bytes32(0), "Root linh kien khong hop le");
        genuinePartsMerkleRoot = newRoot;
        emit GenuinePartsRootUpdated(newRoot, msg.sender);
    }

    // =========================================================================
    // 6. GIẢI THUẬT MẬT MÃ XÁC MINH TOÁN HỌC O(log N) - CRYPTOGRAPHIC VERIFIERS
    // =========================================================================

    /**
     * @dev Giải thuật kiểm tra tính toàn vẹn Bằng chứng Merkle Proof (Chuẩn OpenZeppelin)
     */
    function verifyMerkleProof(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) public pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash == root;
    }

    /**
     * @dev Kiểm chứng thiết bị thuộc Lô sản xuất thông qua Bằng chứng Merkle
     */
    function verifyProductWithProof(
        uint256 batchId,
        bytes32 serialHash,
        bytes32[] calldata proof
    ) external view returns (bool) {
        require(productBatches[batchId].exists, "Lo san pham khong ton tai");
        return verifyMerkleProof(proof, productBatches[batchId].merkleRoot, serialHash);
    }

    /**
     * @dev Kiểm chứng linh kiện thay thế là hàng chính hãng thông qua Merkle Proof
     */
    function verifyGenuinePart(
        bytes32 partHash,
        bytes32[] calldata proof
    ) external view returns (bool) {
        require(genuinePartsMerkleRoot != bytes32(0), "Chua thiet lap Root linh kien");
        return verifyMerkleProof(proof, genuinePartsMerkleRoot, partHash);
    }

    /**
     * @dev Kiểm chứng tính toàn vẹn của một phiếu dịch vụ trong Cây Merkle của thiết bị
     */
    function verifyServiceRecordIntegrity(
        bytes32 serialHash,
        bytes32 recordDataHash,
        bytes32[] calldata proof
    ) external view returns (bool) {
        require(productCommitments[serialHash].exists, "Thiet bi khong ton tai");
        bytes32 root = productCommitments[serialHash].serviceMerkleRoot;
        require(root != bytes32(0), "Thiet bi chua co lich su dich vu");
        return verifyMerkleProof(proof, root, recordDataHash);
    }

    /**
     * @dev Kiểm chứng thông số kỹ thuật off-chain có bị chỉnh sửa so với cam kết on-chain hay không
     */
    function verifyMetadataIntegrity(
        bytes32 serialHash,
        bytes32 computedMetadataHash
    ) external view returns (bool) {
        require(productCommitments[serialHash].exists, "Thiet bi khong ton tai");
        return productCommitments[serialHash].metadataHash == computedMetadataHash;
    }

    // =========================================================================
    // 7. CÁC HÀM TRUY VẤN VIEW (READ-ONLY GETTERS)
    // =========================================================================

    function getProductCommitment(bytes32 serialHash) external view returns (ProductCommitment memory) {
        require(productCommitments[serialHash].exists, "Thiet bi khong ton tai");
        return productCommitments[serialHash];
    }

    function getProduct(string calldata serialNumber) external view returns (ProductCommitment memory) {
        bytes32 sHash = keccak256(bytes(serialNumber));
        require(productCommitments[sHash].exists, "Thiet bi khong ton tai");
        return productCommitments[sHash];
    }

    function getServiceCommitments(bytes32 serialHash) external view returns (ServiceRecordCommitment[] memory) {
        return serviceCommitments[serialHash];
    }

    function getServiceHistory(string calldata serialNumber) external view returns (ServiceRecordCommitment[] memory) {
        bytes32 sHash = keccak256(bytes(serialNumber));
        return serviceCommitments[sHash];
    }

    function getTotalRegisteredProducts() external view returns (uint256) {
        return registeredSerialHashes.length;
    }

    function isExpired(bytes32 serialHash) external view returns (bool) {
        ProductCommitment storage prod = productCommitments[serialHash];
        if (!prod.exists || prod.status != WarrantyStatus.Active) return false;
        return block.timestamp > prod.expiryDate;
    }
}
