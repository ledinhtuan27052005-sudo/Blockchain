import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('====================================================');
  console.log('🚀 TRUSTWARRANTY - SMART CONTRACT DEPLOYER (WEB3)');
  console.log('====================================================\n');

  const artifactPath = path.resolve(__dirname, '../server/contractArtifacts.json');
  if (!fs.existsSync(artifactPath)) {
    throw new Error('Chưa tìm thấy contractArtifacts.json. Vui lòng chạy "npm run compile" trước!');
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const { abi, bytecode } = artifact;

  if (!bytecode || bytecode === '0x') {
    throw new Error('Bytecode hợp đồng rỗng. Vui lòng kiểm tra lại quá trình biên dịch solc!');
  }

  // Cấu hình RPC Provider
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  console.log(`📡 Đang kết nối tới RPC Node: ${rpcUrl}...`);
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Cấu hình Deployer Wallet
  // Mặc định: Hardhat account #0 nếu chưa có biến môi trường
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const wallet = new ethers.Wallet(privateKey, provider);

  const balance = await provider.getBalance(wallet.address);
  const network = await provider.getNetwork();

  console.log(`👤 Ví Deployer: ${wallet.address}`);
  console.log(`💰 Số dư: ${ethers.formatEther(balance)} ETH`);
  console.log(`🌐 Mạng lưới: ${network.name} (Chain ID: ${network.chainId})\n`);

  if (balance === 0n) {
    console.warn('⚠️ CẢNH BÁO: Số dư ví Deployer đang là 0 ETH. Giao dịch có thể thất bại nếu mạng yêu cầu phí gas thực!');
  }

  console.log('📦 Đang phát hành hợp đồng WarrantyRegistry lên blockchain...');
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();

  console.log(`⏳ Đang chờ xác nhận giao dịch khởi tạo (TxHash: ${contract.deploymentTransaction()?.hash})...`);
  await contract.waitForDeployment();

  const deployedAddress = await contract.getAddress();
  console.log(`\n🎉 HỢP ĐỒNG THÔNG MINH ĐÃ ĐƯỢC TRIỂN KHAI THÀNH CÔNG!`);
  console.log(`📍 Địa chỉ Contract: ${deployedAddress}`);

  // Tự động phân quyền (RBAC) cho các tài khoản người dùng thực tế
  const usersPath = path.resolve(__dirname, '../server/data/users.json');
  if (fs.existsSync(usersPath)) {
    try {
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      console.log('\n🔐 Đang tự động cấu hình phân quyền (RBAC) On-Chain cho các tài khoản:');

      let currentNonce = await wallet.getNonce();

      for (const u of users) {
        if (!u.walletAddress || u.walletAddress === '0x0000000000000000000000000000000000000000') continue;

        try {
          if (u.role === 'MANUFACTURER') {
            console.log(`  -> Cấp quyền MANUFACTURER cho: ${u.fullName} (${u.walletAddress}) [Nonce: ${currentNonce}]`);
            const tx = await contract.setManufacturer(u.walletAddress, true, { nonce: currentNonce++ });
            await tx.wait(1);
            console.log(`     ✓ Đã kích hoạt quyền Nhà sản xuất on-chain.`);

            // Đồng thời cấp thêm quyền SELLER & SERVICE_CENTER cho ví Admin/Nhà sản xuất chính để tiện test liên vai trò
            const txSell = await contract.setSeller(u.walletAddress, true, { nonce: currentNonce++ });
            await txSell.wait(1);
            const txSvc = await contract.setServiceCenter(u.walletAddress, true, { nonce: currentNonce++ });
            await txSvc.wait(1);
            console.log(`     ✓ Đã kích hoạt quyền SELLER & SERVICE_CENTER cho ${u.fullName} để tiện kiểm thử.`);
          } else if (u.role === 'SELLER') {
            console.log(`  -> Cấp quyền SELLER cho: ${u.fullName} (${u.walletAddress}) [Nonce: ${currentNonce}]`);
            const tx = await contract.setSeller(u.walletAddress, true, { nonce: currentNonce++ });
            await tx.wait(1);
            console.log(`     ✓ Đã kích hoạt quyền Đại lý on-chain.`);
          } else if (u.role === 'SERVICE_CENTER') {
            console.log(`  -> Cấp quyền SERVICE_CENTER cho: ${u.fullName} (${u.walletAddress}) [Nonce: ${currentNonce}]`);
            const tx = await contract.setServiceCenter(u.walletAddress, true, { nonce: currentNonce++ });
            await tx.wait(1);
            console.log(`     ✓ Đã kích hoạt quyền Trạm bảo hành on-chain.`);
          }
        } catch (roleErr) {
          console.warn(`    ⚠️ Không thể gán quyền cho ${u.walletAddress}:`, roleErr.message);
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc danh sách users để gán quyền:', e.message);
    }
  }

  // Cập nhật địa chỉ hợp đồng vào contractArtifacts.json
  const updatedArtifact = {
    ...artifact,
    address: deployedAddress,
    network: {
      name: network.name,
      chainId: Number(network.chainId),
    },
    deployedAt: new Date().toISOString(),
  };

  // Lưu vào server và client
  const clientArtifactPath = path.resolve(__dirname, '../client/src/contractArtifacts.json');
  fs.writeFileSync(artifactPath, JSON.stringify(updatedArtifact, null, 2), 'utf8');
  fs.writeFileSync(clientArtifactPath, JSON.stringify(updatedArtifact, null, 2), 'utf8');

  console.log('\n📝 Đã cập nhật địa chỉ hợp đồng vào file cấu hình Artifacts của Client & Server.');
  console.log('✅ Hoàn tất thiết lập Web3 & Blockchain!');
}

main().catch((err) => {
  console.error('\n❌ Lỗi khi triển khai hợp đồng:', err);
  process.exit(1);
});
