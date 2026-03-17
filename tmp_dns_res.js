const fs = require('fs');
const dns = require('dns').promises;

async function resolveDns() {
    try {
        dns.setServers(['8.8.8.8']);
        const srvRecords = await dns.resolveSrv('_mongodb._tcp.tourism.vcvk1qe.mongodb.net');
        const txtRecords = await dns.resolveTxt('tourism.vcvk1qe.mongodb.net');
        
        let output = 'SRV RECORDS:\n';
        output += srvRecords.map(r => `${r.name}:${r.port}`).join('\n');
        output += '\n\nTXT RECORDS:\n';
        output += txtRecords.map(t => t.join('')).join('\n');
        
        fs.writeFileSync('dns_results.txt', output);
        console.log('Results written to dns_results.txt');
    } catch (err) {
        fs.writeFileSync('dns_results.txt', err.message);
        console.error(err);
    }
}

resolveDns();


