import { ethers } from 'ethers';

/**
 * Lớp Cây Merkle (Merkle Tree Cryptographic Engine)
 * Tuân thủ thuật toán OpenZeppelin: ghép cặp sắp xếp thứ tự hash (hash(min, max))
 * Sử dụng Keccak-256 đối xứng 100% với hàm băm của Ethereum Virtual Machine (EVM).
 */
export class MerkleTree {
  constructor(elements = [], isAlreadyHashed = false) {
    this.elements = elements;
    this.isAlreadyHashed = isAlreadyHashed;
    this.leaves = elements.map(el => isAlreadyHashed ? el : this.hashLeaf(el));
    this.layers = [];
    this.buildTree();
  }

  hashLeaf(value) {
    if (typeof value === 'string' && value.startsWith('0x') && value.length === 66) {
      return value;
    }
    return ethers.keccak256(ethers.toUtf8Bytes(String(value).trim()));
  }

  hashPair(a, b) {
    if (!b) return a;
    return a <= b
      ? ethers.keccak256(ethers.concat([a, b]))
      : ethers.keccak256(ethers.concat([b, a]));
  }

  buildTree() {
    let currentLayer = [...this.leaves];
    this.layers = [currentLayer];

    while (currentLayer.length > 1) {
      const nextLayer = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        if (i + 1 < currentLayer.length) {
          nextLayer.push(this.hashPair(currentLayer[i], currentLayer[i + 1]));
        } else {
          nextLayer.push(currentLayer[i]);
        }
      }
      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  getRoot() {
    if (this.layers.length === 0 || this.layers[0].length === 0) {
      return ethers.ZeroHash;
    }
    return this.layers[this.layers.length - 1][0];
  }

  getProof(element) {
    const targetHash = this.isAlreadyHashed ? element : this.hashLeaf(element);
    let index = this.leaves.indexOf(targetHash);
    if (index === -1) return [];

    const proof = [];
    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isRightNode = index % 2 === 1;
      const siblingIndex = isRightNode ? index - 1 : index + 1;

      if (siblingIndex < layer.length) {
        proof.push(layer[siblingIndex]);
      }
      index = Math.floor(index / 2);
    }
    return proof;
  }

  verify(element, proof, root) {
    let computedHash = this.isAlreadyHashed ? element : this.hashLeaf(element);
    for (const proofElement of proof) {
      computedHash = this.hashPair(computedHash, proofElement);
    }
    return computedHash === (root || this.getRoot());
  }

  getTreeStructure() {
    return {
      root: this.getRoot(),
      totalLeaves: this.leaves.length,
      leaves: this.elements.map((el, i) => ({
        value: el,
        leafHash: this.leaves[i],
      })),
      layers: this.layers,
      layerDetails: this.layers.map((layer, idx) => ({
        level: idx,
        hashes: layer,
      })),
    };
  }
}

// =========================================================================
// HÀM BĂM MẬT MÃ DÀNH RIÊNG CHO CẤU TRÚC LƯU TRỮ (HASH STORAGE ENGINES)
// =========================================================================

/**
 * Băm số Serial thành bytes32 on-chain
 */
export function computeSerialHash(serialNumber) {
  return ethers.keccak256(ethers.toUtf8Bytes(serialNumber.trim()));
}

/**
 * Băm định danh chủ sở hữu (bảo vệ quyền riêng tư người dùng off-chain)
 */
export function computeOwnerHash(ownerIdentifier) {
  return ethers.keccak256(ethers.toUtf8Bytes(ownerIdentifier.trim().toLowerCase()));
}

/**
 * Băm thông số kỹ thuật, cấu hình phần cứng và sách hướng dẫn của thiết bị
 * Đảm bảo tính toàn vẹn 100% giữa Database off-chain và Smart contract
 */
export function computeMetadataHash(product) {
  if (!product) return ethers.ZeroHash;
  const payload = JSON.stringify({
    name: product.name || '',
    brand: product.brand || '',
    modelCode: product.modelCode || '',
    specs: product.specs || {},
    documentation: product.documentation || {
      manualUrl: '#',
      safetyGuide: '#',
      serviceCoverage: 'Chinh hang toan quoc'
    }
  });
  return ethers.keccak256(ethers.toUtf8Bytes(payload));
}

/**
 * Băm chi tiết một phiếu bảo dưỡng/sửa chữa (Service Record)
 */
export function computeServiceRecordHash(record) {
  const payload = JSON.stringify({
    serviceType: record.serviceType,
    notes: record.notes,
    replacedPart: record.replacedPart || 'None',
    technicianId: record.technicianId || 'TECH-DEFAULT',
    date: record.date || '2024-01-01'
  });
  return ethers.keccak256(ethers.toUtf8Bytes(payload));
}

/**
 * Xây dựng Cây Merkle Lịch sử Dịch vụ cho từng thiết bị (Per-Product Service History Merkle Tree)
 */
export function buildServiceHistoryTree(records = []) {
  if (records.length === 0) {
    return {
      root: ethers.ZeroHash,
      tree: null,
      proofs: []
    };
  }

  const hashes = records.map(r => computeServiceRecordHash(r));
  const tree = new MerkleTree(hashes, true);
  const proofs = hashes.map(h => tree.getProof(h));

  return {
    root: tree.getRoot(),
    tree,
    hashes,
    proofs
  };
}

// =========================================================================
// KHỞI TẠO CÁC CÂY MERKLE MẪU CHO HỆ THỐNG
// =========================================================================

// 1. Cây Merkle Lô sản phẩm xuất xưởng Q1/2024 (Batch Merkle Tree)
export const productBatchTree = new MerkleTree([
  'SN-APL-MAC16-9921',
  'SN-DELL-XPS15-4012',
  'SN-SONY-WHXM5-7731',
  'SN-SMS-S24U-5520',
]);

// 2. Cây Merkle Danh mục Linh kiện thay thế chính hãng của Nhà sản xuất
export const genuinePartsTree = new MerkleTree([
  'FAN-MBP-16-LEFT',
  'EP-WHXM5-SILVER',
  'BATTERY-S24U-OEM',
  'SCREEN-OLED-XPS15',
]);
