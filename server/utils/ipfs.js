import crypto from 'crypto';

/**
 * Module Mật mã Lưu trữ Phi tập trung IPFS (InterPlanetary File System)
 * Sinh mã định danh nội dung bất biến Content Identifier (CIDv0 Multihash)
 * theo chuẩn SHA2-256 + Base58 (định dạng Qm... 46 ký tự).
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(buffer) {
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; ++j) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) digits.push(0);
  return digits.reverse().map(digit => BASE58_ALPHABET[digit]).join('');
}

export function computeIpfsCid(data) {
  // Sắp xếp keys để đảm bảo tính tất định (Canonical JSON Serialization)
  let normalizedStr = '';
  if (typeof data === 'string') {
    normalizedStr = data.trim();
  } else if (data && typeof data === 'object') {
    const sortedKeys = Object.keys(data).sort();
    const sortedObj = {};
    sortedKeys.forEach(k => { sortedObj[k] = data[k]; });
    normalizedStr = JSON.stringify(sortedObj);
  } else {
    normalizedStr = String(data);
  }

  // SHA2-256 digest
  const sha256Hash = crypto.createHash('sha256').update(normalizedStr, 'utf8').digest();

  // Multihash prefix: 0x12 (sha2-256 code) + 0x20 (32 bytes length)
  const multihash = Buffer.concat([Buffer.from([0x12, 0x20]), sha256Hash]);
  
  return base58Encode(multihash);
}

export function formatIpfsUri(cid) {
  return `ipfs://${cid}`;
}

export function getIpfsGatewayUrl(cid) {
  return `https://ipfs.io/ipfs/${cid}`;
}
