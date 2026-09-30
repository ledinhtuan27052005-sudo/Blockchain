import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import solc from 'solc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function compileContract() {
  const contractPath = path.resolve(__dirname, '../contracts/WarrantyRegistry.sol');
  const source = fs.readFileSync(contractPath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      'WarrantyRegistry.sol': {
        content: source,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode'],
        },
      },
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  };

  console.log('Dang bien dich smart contract WarrantyRegistry.sol bang solc...');
  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    let hasError = false;
    output.errors.forEach((err) => {
      if (err.severity === 'error') {
        console.error('Loi bien dich:', err.formattedMessage);
        hasError = true;
      } else {
        console.warn('Canh bao:', err.formattedMessage);
      }
    });
    if (hasError) {
      throw new Error('Bien dich that bai do co loi cu phap.');
    }
  }

  const contractData = output.contracts['WarrantyRegistry.sol']['WarrantyRegistry'];
  const artifact = {
    contractName: 'WarrantyRegistry',
    abi: contractData.abi,
    bytecode: contractData.evm.bytecode.object,
    updatedAt: new Date().toISOString(),
  };

  // Luu vao server
  const serverArtifactPath = path.resolve(__dirname, '../server/contractArtifacts.json');
  fs.writeFileSync(serverArtifactPath, JSON.stringify(artifact, null, 2), 'utf8');
  console.log('-> Da xuat artifact toi:', serverArtifactPath);

  // Tao thu muc client neu can va luu
  const clientDir = path.resolve(__dirname, '../client/src');
  if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir, { recursive: true });
  }
  const clientArtifactPath = path.resolve(clientDir, 'contractArtifacts.json');
  fs.writeFileSync(clientArtifactPath, JSON.stringify(artifact, null, 2), 'utf8');
  console.log('-> Da xuat artifact toi:', clientArtifactPath);

  console.log('Bien dich thanh cong 100%!');
}

compileContract();
