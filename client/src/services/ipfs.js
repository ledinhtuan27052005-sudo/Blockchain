import { ethers } from 'ethers';

/**
 * Module IPFS Web3 Client
 * Dẫn xuất và định dạng mã phân tán IPFS CIDv0 cho Metadata thiết bị
 */

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes) {
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    for (let j = 0; j < digits.length; j++) digits[j] <<= 8;
    digits[0] += bytes[i];
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
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) digits.push(0);
  return digits.reverse().map(digit => BASE58_ALPHABET[digit]).join('');
}

export function computeClientIpfsCid(data) {
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

  // SHA-256 via ethers
  const shaHashHex = ethers.sha256(ethers.toUtf8Bytes(normalizedStr));
  const rawHashBytes = ethers.getBytes(shaHashHex);

  // Multihash prefix: 0x12 (sha2-256) + 0x20 (32 bytes)
  const multihash = new Uint8Array(2 + rawHashBytes.length);
  multihash[0] = 0x12;
  multihash[1] = 0x20;
  multihash.set(rawHashBytes, 2);

  return base58Encode(multihash);
}

export const computeIpfsCid = computeClientIpfsCid;

export function formatIpfsUri(cid) {
  if (!cid) return '';
  return `ipfs://${cid}`;
}

export function getIpfsGatewayUrl(cid) {
  if (!cid) return '';
  return `https://ipfs.io/ipfs/${cid}`;
}

