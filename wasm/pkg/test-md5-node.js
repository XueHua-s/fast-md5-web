/**
 * Node.js 环境下的 MD5 性能对比测试
 * 对比 WASM MD5 和 Node.js 内置 crypto 模块的性能
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// 导入 WASM 模块 (需要在 Node.js 环境中运行)
let wasmMd5;
try {
    // 注意：这里需要根据实际的 WASM 模块导入方式调整
    wasmMd5 = require('./wasm_md5.js');
} catch (error) {
    console.error('无法加载 WASM 模块:', error.message);
    console.log('请确保在支持 WASM 的 Node.js 环境中运行此脚本');
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化时间
 */
function formatTime(ms) {
    if (ms < 1000) return `${ms.toFixed(2)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * 使用 Node.js crypto 模块计算 MD5
 */
function calculateNodeMd5(filePath) {
    return new Promise((resolve, reject) => {
        const startTime = process.hrtime.bigint();
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);
        
        stream.on('data', (data) => {
            hash.update(data);
        });
        
        stream.on('end', () => {
            const endTime = process.hrtime.bigint();
            const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒
            const md5Hash = hash.digest('hex');
            
            resolve({
                hash: md5Hash,
                duration: duration,
                method: 'Node.js Crypto'
            });
        });
        
        stream.on('error', reject);
    });
}

/**
 * 使用 WASM 计算 MD5
 */
async function calculateWasmMd5(filePath) {
    if (!wasmMd5) {
        throw new Error('WASM 模块未加载');
    }
    
    const fileData = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(fileData);
    
    const startTime = process.hrtime.bigint();
    
    // 初始化 WASM 模块
    await wasmMd5.default('./wasm_md5_bg.wasm');
    const calculator = new wasmMd5.Md5Calculator();
    
    const md5Hash = await calculator.calculate_md5_async(uint8Array, 32);
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒
    
    calculator.free();
    
    return {
        hash: md5Hash,
        duration: duration,
        method: 'WASM (Rust)'
    };
}

/**
 * 创建测试文件
 */
function createTestFile(filePath, sizeInMB) {
    const sizeInBytes = sizeInMB * 1024 * 1024;
    const buffer = Buffer.alloc(sizeInBytes);
    
    // 填充随机数据
    for (let i = 0; i < sizeInBytes; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
    }
    
    fs.writeFileSync(filePath, buffer);
    console.log(`✅ 创建测试文件: ${filePath} (${formatFileSize(sizeInBytes)})`);
}

/**
 * 运行性能测试
 */
async function runPerformanceTest(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ 文件不存在: ${filePath}`);
        return;
    }
    
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    console.log(`\n🚀 开始测试文件: ${path.basename(filePath)}`);
    console.log(`📁 文件大小: ${formatFileSize(fileSize)}`);
    console.log('=' .repeat(60));
    
    const results = [];
    
    try {
        // 测试 Node.js crypto
        console.log('🔄 测试 Node.js Crypto MD5...');
        const nodeResult = await calculateNodeMd5(filePath);
        nodeResult.throughput = (fileSize / 1024 / 1024) / (nodeResult.duration / 1000);
        results.push(nodeResult);
        console.log(`✅ Node.js: ${nodeResult.hash} (${formatTime(nodeResult.duration)})`);
        
    } catch (error) {
        console.error(`❌ Node.js 测试失败:`, error.message);
    }
    
    try {
        // 测试 WASM
        console.log('🔄 测试 WASM MD5...');
        const wasmResult = await calculateWasmMd5(filePath);
        wasmResult.throughput = (fileSize / 1024 / 1024) / (wasmResult.duration / 1000);
        results.push(wasmResult);
        console.log(`✅ WASM: ${wasmResult.hash} (${formatTime(wasmResult.duration)})`);
        
    } catch (error) {
        console.error(`❌ WASM 测试失败:`, error.message);
    }
    
    // 显示对比结果
    if (results.length >= 2) {
        console.log('\n📊 性能对比结果:');
        console.log('=' .repeat(60));
        
        const [result1, result2] = results;
        const hashMatch = result1.hash.toLowerCase() === result2.hash.toLowerCase();
        
        console.log(`🔍 哈希值一致性: ${hashMatch ? '✅ 一致' : '❌ 不一致'}`);
        
        if (hashMatch) {
            const speedRatio = result1.duration / result2.duration;
            const faster = result1.duration < result2.duration ? result1 : result2;
            const slower = result1.duration >= result2.duration ? result1 : result2;
            
            console.log(`\n⚡ 性能对比:`);
            console.log(`   ${faster.method}: ${formatTime(faster.duration)} (${faster.throughput.toFixed(2)} MB/s)`);
            console.log(`   ${slower.method}: ${formatTime(slower.duration)} (${slower.throughput.toFixed(2)} MB/s)`);
            console.log(`   🏆 ${faster.method} 快 ${Math.abs(speedRatio - 1).toFixed(2)}x`);
        }
    }
    
    console.log('\n' + '=' .repeat(60));
}

/**
 * 主函数
 */
async function main() {
    console.log('🧪 MD5 性能对比测试 (Node.js)');
    console.log('对比 WASM MD5 vs Node.js Crypto');
    console.log('=' .repeat(60));
    
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('\n📝 使用方法:');
        console.log('  node test-md5-node.js <文件路径>');
        console.log('  node test-md5-node.js --create-test <大小MB>');
        console.log('\n📝 示例:');
        console.log('  node test-md5-node.js ./test-file.bin');
        console.log('  node test-md5-node.js --create-test 10  # 创建10MB测试文件');
        return;
    }
    
    if (args[0] === '--create-test') {
        const sizeInMB = parseInt(args[1]) || 10;
        const testFilePath = `./test-file-${sizeInMB}MB.bin`;
        
        console.log(`\n🔧 创建 ${sizeInMB}MB 测试文件...`);
        createTestFile(testFilePath, sizeInMB);
        
        console.log('\n🚀 开始性能测试...');
        await runPerformanceTest(testFilePath);
        
        // 询问是否删除测试文件
        console.log(`\n🗑️  测试完成，是否删除测试文件? (y/N)`);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', (key) => {
            if (key.toString().toLowerCase() === 'y') {
                fs.unlinkSync(testFilePath);
                console.log(`✅ 已删除测试文件: ${testFilePath}`);
            }
            process.exit(0);
        });
        
    } else {
        const filePath = args[0];
        await runPerformanceTest(filePath);
    }
}

// 错误处理
process.on('unhandledRejection', (error) => {
    console.error('❌ 未处理的错误:', error.message);
    process.exit(1);
});

// 运行主函数
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    calculateNodeMd5,
    calculateWasmMd5,
    runPerformanceTest,
    createTestFile
};